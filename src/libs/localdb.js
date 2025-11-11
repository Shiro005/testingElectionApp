// src/libs/localdb.js
import Dexie from "dexie";

// ✅ Initialize local Dexie database
export const dbLocal = new Dexie("ElectionDB");

// ✅ Define all stores including voter_dynamic
dbLocal.version(1).stores({
  voters: "id, name, voterId, age, gender, boothNumber, pollingStationAddress, prabhag, yadiBhagAddress, lastUpdated",
  voter_surveys: "id, voterId, phone, whatsapp, city, education, occupation, category, issues, remarks, hasVoted, supportStatus, updatedAt",
  voter_dynamic: "id, voterId, updatedAt", // ✅ Added missing table
  pending_writes: "++id, collection, docId, payload, createdAt, attempts",
});

// ✅ Local helpers
export const localBulkPut = async (rows) => dbLocal.voters.bulkPut(rows);
export const localGetAll = () => dbLocal.voters.toArray();
export const localUpdate = (id, patch) => dbLocal.voters.update(id, patch);
export const localClear = () => dbLocal.voters.clear();

// ✅ Dynamic data (family / survey updates)
export const putDynamic = async (obj) => {
  if (!obj) return;
  const record = { ...obj, id: String(obj.voterId || obj.id) };
  await dbLocal.voter_dynamic.put(record);
  return record;
};

export const getAllVoters = async () => {
  try {
    console.log('📥 Fetching all voters from IndexedDB...');
    const voters = await db.voters.toArray();
    console.log(`✅ Retrieved ${voters.length} voters from IndexedDB`);
    return voters;
  } catch (error) {
    console.error('❌ Error fetching voters from IndexedDB:', error);
    throw error;
  }
};


export const getDynamic = async (voterId) => {
  if (!voterId) return null;
  // ✅ Ensure store exists before access
  if (!dbLocal.voter_dynamic) {
    console.warn("voter_dynamic store not found — returning null");
    return null;
  }
  return await dbLocal.voter_dynamic.get(String(voterId));
};

export const clearDynamic = async () => {
  if (dbLocal.voter_dynamic) await dbLocal.voter_dynamic.clear();
};

// ✅ Pending writes
export const enqueuePendingWrite = async (collectionName, docId, payload) => {
  await dbLocal.pending_writes.add({
    collection: collectionName,
    docId,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  });
};

export const getPendingWrites = () => dbLocal.pending_writes.toArray();
export const removePendingWrite = (id) => dbLocal.pending_writes.delete(id);

// ✅ IndexedDB direct methods (static data)
export const openDB = async (dbName = "ElectionAppDB", version = 3) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("voters")) {
        db.createObjectStore("voters", { keyPath: "voterId" });
      }
      if (!db.objectStoreNames.contains("surveys")) {
        db.createObjectStore("surveys", { keyPath: "voterId" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

// ✅ Save static voter data
export const saveToLocalDB = async (storeName, data) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    data.forEach((item) => store.put(item));
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
};

// ✅ Get static data
export const getFromLocalDB = async (storeName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
};

// ✅ Save or update survey data
export const saveSurveyLocal = async (voterId, surveyData) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("surveys", "readwrite");
    const store = tx.objectStore("surveys");
    store.put({ voterId, ...surveyData, lastUpdated: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
};



export const getVoterSurveys = async () => {
  try {
    const surveys = await db.voter_surveys.toArray();
    console.log(`✅ Retrieved ${surveys.length} voter surveys from IndexedDB`);
    return surveys;
  } catch (error) {
    console.error('Error fetching voter surveys:', error);
    throw error;
  }
};

// ✅ Merge static + dynamic data
export const mergeVoterAndSurvey = async () => {
  const voters = await getFromLocalDB("voters");
  const surveys = await getFromLocalDB("surveys");

  const surveyMap = new Map(surveys.map((s) => [s.voterId, s]));
  return voters.map((v) => ({
    ...v,
    ...surveyMap.get(v.voterId),
  }));
};
