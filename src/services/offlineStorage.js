// IndexedDB Offline Staging & Persistence Service for Uncle Jim's Estate App
// Stores full-resolution photo blobs, cropped variants, and metadata locally on device/browser

const DB_NAME = 'UncleJimsEstateOfflineDB';
const DB_VERSION = 2;
const STORE_STAGED = 'staged_items';
const STORE_ACTIVE_DRAFT = 'active_draft';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_STAGED)) {
        db.createObjectStore(STORE_STAGED, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ACTIVE_DRAFT)) {
        db.createObjectStore(STORE_ACTIVE_DRAFT, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineStorage = {
  // -------------------------------------------------------------
  // ACTIVE DRAFT (Persists during camera capture & form filling)
  // -------------------------------------------------------------
  async saveActiveDraft(draft) {
    try {
      const db = await openDB();
      const record = {
        id: 'current',
        photos: draft.photos || [],
        croppedBlob: draft.croppedBlob || null,
        title: draft.title || '',
        categoryId: draft.categoryId || '',
        locationInHouse: draft.locationInHouse || '',
        notes: draft.notes || '',
        value: draft.value || '',
        captureStep: draft.captureStep || 'enter_details',
        updatedAt: Date.now()
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ACTIVE_DRAFT, 'readwrite');
        const store = tx.objectStore(STORE_ACTIVE_DRAFT);
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Could not save active draft to IndexedDB:", err);
      return null;
    }
  },

  async getActiveDraft() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ACTIVE_DRAFT, 'readonly');
        const store = tx.objectStore(STORE_ACTIVE_DRAFT);
        const req = store.get('current');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Could not retrieve active draft from IndexedDB:", err);
      return null;
    }
  },

  async clearActiveDraft() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ACTIVE_DRAFT, 'readwrite');
        const store = tx.objectStore(STORE_ACTIVE_DRAFT);
        const req = store.delete('current');
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Could not clear active draft from IndexedDB:", err);
      return false;
    }
  },

  // -------------------------------------------------------------
  // STAGED OFFLINE ITEMS (Full records saved while in Offline Mode)
  // -------------------------------------------------------------
  async saveStagedItem(itemData, photos = [], croppedBlob = null) {
    const db = await openDB();
    const photoBlobs = [];

    for (let p of photos) {
      if (p.file) {
        photoBlobs.push({ name: p.file.name || 'photo.jpg', type: p.file.type || 'image/jpeg', data: p.file });
      } else if (p.data) {
        photoBlobs.push({ name: p.name || 'photo.jpg', type: p.type || 'image/jpeg', data: p.data });
      } else if (p.blob) {
        photoBlobs.push({ name: p.name || 'photo.jpg', type: p.blob.type || 'image/jpeg', data: p.blob });
      }
    }

    const stableId = itemData.id || ('offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    const record = {
      id: stableId,
      clientId: stableId,
      title: (itemData.title !== undefined ? itemData.title : '').trim(),
      locationInHouse: (itemData.locationInHouse || itemData.location || '').trim(),
      categoryId: itemData.categoryId || itemData.category_id || '',
      category_name: itemData.category_name || '',
      notes: (itemData.notes || itemData.description || '').trim(),
      description: (itemData.notes || itemData.description || '').trim(),
      value: (itemData.value || '').trim(),
      condition: itemData.condition || '',
      dimensions: itemData.dimensions || '',
      weight: itemData.weight || '',
      institutionalCandidate: itemData.institutionalCandidate || itemData.institutional_candidate || 'None',
      institutionalName: itemData.institutionalName || itemData.institutional_name || '',
      createdAt: itemData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncError: null,
      photos: photoBlobs,
      croppedBlob: croppedBlob || itemData.croppedBlob || null
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAGED, 'readwrite');
      const store = tx.objectStore(STORE_STAGED);
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  },

  async updateStagedItem(itemRecord) {
    const db = await openDB();
    const updated = {
      ...itemRecord,
      updatedAt: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAGED, 'readwrite');
      const store = tx.objectStore(STORE_STAGED);
      const req = store.put(updated);
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  },

  async getStagedItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAGED, 'readonly');
      const store = tx.objectStore(STORE_STAGED);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async getStagedItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAGED, 'readonly');
      const store = tx.objectStore(STORE_STAGED);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteStagedItem(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAGED, 'readwrite');
      const store = tx.objectStore(STORE_STAGED);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async clearStagedQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STAGED, 'readwrite');
      const store = tx.objectStore(STORE_STAGED);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};

