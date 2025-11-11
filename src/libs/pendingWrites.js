// src/libs/pendingWrites.js
// Offline write queue using localStorage (simple, universal).
// Supports enqueue, remove, and background sync when online.

import { db } from "../Firebase/config";
import { doc, setDoc } from "firebase/firestore";

const KEY = "pending_writes_v2"; // bumped version for new schema

// ========== BASIC LOCAL STORAGE HELPERS ==========

function _readQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn("pendingWrites read failed", e);
    return [];
  }
}

function _writeQueue(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn("pendingWrites write failed", e);
  }
}

// ========== PUBLIC HELPERS ==========

export function enqueuePendingWrite(docId, collectionPath, payload) {
  const queue = _readQueue();
  queue.push({
    queueId: `${collectionPath}/${docId}::${Date.now()}`,
    docId,
    collectionPath,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    synced: false,
  });
  _writeQueue(queue);
}

export function getPendingWrites() {
  return _readQueue().filter((e) => !e.synced);
}

export function markAsSynced(queueId) {
  const queue = _readQueue();
  const updated = queue.map((item) =>
    item.queueId === queueId ? { ...item, synced: true } : item
  );
  _writeQueue(updated);
}

export function removePendingWrite(queueId) {
  const queue = _readQueue().filter((e) => e.queueId !== queueId);
  _writeQueue(queue);
}

export function clearPendingWrites() {
  _writeQueue([]);
}

// ========== SYNC LOGIC ==========
// Call this periodically or when app comes online

export async function syncPendingWrites() {
  const pending = getPendingWrites();
  if (!pending.length) {
    console.log("✅ No pending writes to sync");
    return;
  }

  console.log(`🔁 Syncing ${pending.length} pending writes...`);

  for (const item of pending) {
    try {
      const ref = doc(db, item.collectionPath, item.docId);
      await setDoc(ref, item.payload, { merge: true });
      markAsSynced(item.queueId);
      console.log(`✅ Synced ${item.queueId}`);
    } catch (err) {
      console.warn(`⚠️ Failed syncing ${item.queueId}`, err);
      // Retry on next attempt (keep unsynced)
    }
  }
}

// Optionally auto-sync when network returns online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("🌐 Back online — syncing pending writes...");
    syncPendingWrites();
  });
}
