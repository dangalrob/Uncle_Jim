// IndexedDB Offline Staging Service for Uncle Jim's Estate App
// Stores full-resolution photo blobs and metadata locally on iPhone when offline

const DB_NAME = 'UncleJimsEstateOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'staged_items';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineStorage = {
  async saveStagedItem(itemData, photos) {
    const db = await openDB();
    const photoBlobs = [];

    for (let p of photos) {
      if (p.file) {
        photoBlobs.push({ name: p.file.name, type: p.file.type, data: p.file });
      } else if (p.url) {
        photoBlobs.push({ url: p.url });
      }
    }

    const record = {
      id: 'staged_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: itemData.title || 'Untitled Item',
      locationInHouse: itemData.locationInHouse || 'House',
      categoryId: itemData.categoryId || '',
      notes: itemData.notes || '',
      createdAt: new Date().toISOString(),
      photos: photoBlobs
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  },

  async getStagedItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteStagedItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async clearStagedQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};
