// Persistent Client-Side Thumbnail Cache Service
// Uses IndexedDB to store thumbnail blobs locally on device/laptop.
// Supports deterministic version checking, in-memory Blob URL caching,
// and a concurrency-limited progressive queue (prioritizing visible thumbnails).

const DB_NAME = 'UncleJimsThumbnailDB';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';
const MAX_CONCURRENT_DOWNLOADS = 3;

class ThumbnailCacheService {
  constructor() {
    this.dbPromise = null;
    this.memoryMap = new Map(); // url -> { version, blobUrl }
    this.activeDownloads = 0;
    this.downloadQueue = []; // Array<{ url, version, priority, resolve, reject }>
    this.pendingRequests = new Map(); // url -> Promise<string|null>
    this.listeners = new Set();
    this.stats = {
      total: 0,
      cached: 0,
      updating: 0,
      remaining: 0,
      isComplete: false
    };
  }

  // Open / Initialize IndexedDB
  getDB() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') {
          return resolve(null);
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('Failed to open Thumbnail IndexedDB:', request.error);
          resolve(null);
        };
      });
    }
    return this.dbPromise;
  }

  // Synchronously check if a valid Blob URL already exists in memory
  getMemoryBlobUrl(url, version) {
    if (!url) return null;
    const entry = this.memoryMap.get(url);
    if (entry && (!version || entry.version === version)) {
      return entry.blobUrl;
    }
    return null;
  }

  // Retrieve cached blob URL from IndexedDB if version matches
  async getCached(url, version) {
    if (!url) return null;

    // Check memory first
    const mem = this.getMemoryBlobUrl(url, version);
    if (mem) return mem;

    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(url);

        req.onsuccess = () => {
          const record = req.result;
          if (record && record.blob && (!version || record.version === version)) {
            const blobUrl = URL.createObjectURL(record.blob);
            this.memoryMap.set(url, { version: record.version, blobUrl });
            resolve(blobUrl);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn('Error reading from thumbnail cache:', err);
        resolve(null);
      }
    });
  }

  // Store a blob into IndexedDB and memory map
  async storeInCache(url, version, blob) {
    if (!url || !blob) return null;
    const blobUrl = URL.createObjectURL(blob);
    this.memoryMap.set(url, { version: version || '1', blobUrl });

    const db = await this.getDB();
    if (!db) return blobUrl;

    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        url,
        version: version || '1',
        blob,
        cachedAt: Date.now()
      });
    } catch (err) {
      console.warn('Error writing to thumbnail cache:', err);
    }

    return blobUrl;
  }

  // Request a thumbnail: returns cached if available, or enqueues download
  async requestThumbnail(url, version, priority = false) {
    if (!url) return null;

    // 1. Immediate memory check
    const mem = this.getMemoryBlobUrl(url, version);
    if (mem) return mem;

    // 2. Check if there's already an in-flight request for this URL
    if (this.pendingRequests.has(url)) {
      if (priority) {
        // Bump priority in queue if currently queued
        const idx = this.downloadQueue.findIndex(q => q.url === url);
        if (idx > 0) {
          const [item] = this.downloadQueue.splice(idx, 1);
          item.priority = true;
          this.downloadQueue.unshift(item);
        }
      }
      return this.pendingRequests.get(url);
    }

    // 3. Check IndexedDB
    const cached = await this.getCached(url, version);
    if (cached) {
      return cached;
    }

    // 4. Enqueue network download
    const downloadPromise = new Promise((resolve) => {
      const queueItem = {
        url,
        version,
        priority,
        resolve: (val) => {
          this.pendingRequests.delete(url);
          resolve(val);
        }
      };

      if (priority) {
        this.downloadQueue.unshift(queueItem);
      } else {
        this.downloadQueue.push(queueItem);
      }

      this.updateStats();
      this.processQueue();
    });

    this.pendingRequests.set(url, downloadPromise);
    return downloadPromise;
  }

  // Process the download queue with max concurrency
  async processQueue() {
    if (this.activeDownloads >= MAX_CONCURRENT_DOWNLOADS || this.downloadQueue.length === 0) {
      return;
    }

    const item = this.downloadQueue.shift();
    if (!item) return;

    this.activeDownloads++;
    this.updateStats();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(item.url, {
        signal: controller.signal,
        headers: { 'Accept': 'image/webp,image/jpeg,image/*,*/*' }
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`Thumbnail download failed (${res.status}) for ${item.url}`);
        item.resolve(null);
      } else {
        const blob = await res.blob();
        const blobUrl = await this.storeInCache(item.url, item.version, blob);
        this.stats.cached++;
        item.resolve(blobUrl);
      }
    } catch (err) {
      console.warn(`Error downloading thumbnail ${item.url}:`, err.message);
      item.resolve(null);
    } finally {
      this.activeDownloads--;
      this.updateStats();
      this.processQueue();
    }
  }

  // Initialize and synchronize catalog thumbnails
  async syncCatalog(items) {
    if (!Array.isArray(items) || items.length === 0) {
      this.stats = { total: 0, cached: 0, updating: 0, remaining: 0, isComplete: true };
      this.notifyListeners();
      return;
    }

    const db = await this.getDB();
    const cachedRecordsMap = new Map();

    if (db) {
      try {
        await new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.openCursor();
          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              cachedRecordsMap.set(cursor.value.url, cursor.value);
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        });
      } catch (err) {
        console.warn("Could not read all thumbnail records:", err);
      }
    }

    let cachedCount = 0;
    const itemsNeedingDownload = [];

    for (const item of items) {
      const thumbUrl = item.primary_thumb || item.primary_photo;
      if (!thumbUrl) continue;

      const version = item.primary_thumb_version || '1';
      const existing = cachedRecordsMap.get(thumbUrl);

      if (existing && existing.blob && existing.version === version) {
        cachedCount++;
        // Pre-warm memory map if not already populated
        if (!this.memoryMap.has(thumbUrl)) {
          const blobUrl = URL.createObjectURL(existing.blob);
          this.memoryMap.set(thumbUrl, { version, blobUrl });
        }
      } else {
        itemsNeedingDownload.push({ url: thumbUrl, version });
      }
    }

    this.stats.total = items.length;
    this.stats.cached = cachedCount;
    this.stats.remaining = itemsNeedingDownload.length;
    this.stats.updating = this.activeDownloads + this.downloadQueue.length;
    this.stats.isComplete = itemsNeedingDownload.length === 0;
    this.notifyListeners();

    // Progressively queue remaining uncached thumbnails in background (low priority)
    for (const need of itemsNeedingDownload) {
      this.requestThumbnail(need.url, need.version, false);
    }
  }

  // Update status metrics and broadcast to UI
  updateStats() {
    this.stats.updating = this.activeDownloads + this.downloadQueue.length;
    this.stats.remaining = this.downloadQueue.length + (this.activeDownloads > 0 ? 1 : 0);
    this.stats.isComplete = this.downloadQueue.length === 0 && this.activeDownloads === 0;
    this.notifyListeners();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ ...this.stats });
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const copy = { ...this.stats };
    this.listeners.forEach(fn => {
      try { fn(copy); } catch (e) {}
    });
  }

  // Clear all cached thumbnails for diagnostics / testing
  async clearCache() {
    this.memoryMap.forEach(entry => {
      if (entry.blobUrl && entry.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(entry.blobUrl);
      }
    });
    this.memoryMap.clear();

    const db = await this.getDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    }
    this.stats = { total: 0, cached: 0, updating: 0, remaining: 0, isComplete: true };
    this.notifyListeners();
  }
}

export const thumbnailCache = new ThumbnailCacheService();
