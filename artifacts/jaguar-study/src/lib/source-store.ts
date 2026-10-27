// Original files stay in this browser's IndexedDB so page/slide previews survive reloads.
export type StoredSource = { name: string; type: string; blob: Blob };

const DB_NAME = 'jaguar-sources';
const STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request.result as T); };
    tx.onerror = () => { db.close(); reject(tx.error ?? request.error); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Storage transaction was interrupted.')); };
  });
}

export const sourceKey = (userId: string, setId: string) => `${userId}:${setId}`;

export async function saveSources(key: string, files: StoredSource[]) {
  await run<IDBValidKey>('readwrite', (store) => store.put(files, key));
}
export async function loadSources(key: string): Promise<StoredSource[]> {
  try { return (await run<StoredSource[] | undefined>('readonly', (store) => store.get(key))) ?? []; } catch { return []; }
}
export async function deleteSources(key: string) {
  try { await run<undefined>('readwrite', (store) => store.delete(key)); } catch { /* ignore */ }
}

export function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {
    window.dispatchEvent(new CustomEvent('jaguar-storage-error', { detail: 'Browser storage is full or unavailable. Your latest exam answers cannot be saved across reloads. Keep this page open and copy your written answers.' }));
  }
}
