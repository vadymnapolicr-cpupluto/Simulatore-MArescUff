const DB_NAME = "gdf-sim"
const DB_VERSION = 1
export type StoreName = "kv" | "files"

let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv")
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files")
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        dbPromise = null
        reject(req.error)
      }
    })
  }
  return dbPromise
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(req.result as T)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const idbGet = <T>(store: StoreName, key: string) =>
  run<T | undefined>(store, "readonly", (s) => s.get(key))
export const idbSet = (store: StoreName, key: string, value: unknown) =>
  run<IDBValidKey>(store, "readwrite", (s) => s.put(value, key))
export const idbDelete = (store: StoreName, key: string) => run<undefined>(store, "readwrite", (s) => s.delete(key))

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}

export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
