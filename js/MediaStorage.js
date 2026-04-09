/**
 * MediaStorage
 * Interacts with IndexedDB to store custom backgrounds without blowing up LocalStorage quotas.
 */
class MediaStorage {
  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      request.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(CONFIG.STORE_NAME);
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e);
    });
  }

  async saveMedia(key, file, isVideo) {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG.STORE_NAME, "readwrite");
      const store = tx.objectStore(CONFIG.STORE_NAME);
      store.put({ file, isVideo }, key);
      tx.oncomplete = resolve;
    });
  }

  async loadMedia(key) {
    const db = await this.dbPromise;
    return new Promise((resolve) => {
      const tx = db.transaction(CONFIG.STORE_NAME, "readonly");
      const store = tx.objectStore(CONFIG.STORE_NAME);
      const request = store.get(key);
      request.onsuccess = (e) => resolve(e.target.result || null);
      request.onerror = () => resolve(null);
    });
  }
}
