import "client-only";
import type { PatientRecord } from "./types";

const databaseName = "medical-decision-support-patient-vault";
const storeName = "patients";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Patient vault request failed."));
  });
}

function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, {keyPath: "id"});
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Patient vault could not be opened."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openVault();
  try {
    return await requestResult(work(database.transaction(storeName, mode).objectStore(storeName)));
  } finally {
    database.close();
  }
}

export async function listPatientRecords(): Promise<PatientRecord[]> {
  const records = await withStore("readonly", (store) => store.getAll()) as PatientRecord[];
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function savePatientRecord(record: PatientRecord): Promise<void> {
  await withStore("readwrite", (store) => store.put(record));
}

export async function deletePatientRecord(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
