// src/services/pendingSync.js
import { getPendingWrites, removePendingWrite } from '../libs/pendingWrites';
import { getFirestore, writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../Firebase/config';

// batchSize should be <= 500 (firestore batch limit). Use 200 to be safe.
const BATCH_SIZE = 200;

function isQuotaError(err) {
  // Firestore returns "resource-exhausted" or "quotaExceeded" style errors.
  if (!err) return false;
  const msg = (err.code || err.message || '').toString().toLowerCase();
  return msg.includes('resource-exhausted') || msg.includes('quota') || msg.includes('exceeded');
}

export async function syncPendingWrites({ onProgress = () => {}, stopOnQuota = true } = {}) {
  const pending = getPendingWrites();
  if (!pending || pending.length === 0) return { uploaded: 0 };

  // chunk into batches
  let uploaded = 0;
  const chunks = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    chunks.push(pending.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    let localIds = []; // keep track to remove later
    try {
      chunk.forEach((entry) => {
        // entry.collectionPath expected like 'voters' or 'voters/<docId>/subcol'
        const ref = doc(collection(db, entry.collectionPath), entry.docId);
        // If you want merge behavior: use { merge: true } but set via update won't be possible in batch.set API, so include full doc
        batch.set(ref, { ...entry.payload, lastSyncedAt: Date.now() });
        localIds.push(entry.id);
      });

      await batch.commit();
      // remove uploaded entries from local queue
      localIds.forEach(id => removePendingWrite(id));
      uploaded += chunk.length;
      onProgress({ uploaded, remaining: getPendingWrites().length });
    } catch (err) {
      console.error('Batch commit failed', err);
      // if quota-like error, stop syncing further
      if (isQuotaError(err) && stopOnQuota) {
        return { uploaded, stopped: true, reason: 'quota' };
      }
      // else, don't remove queue entries; try next chunk later
      return { uploaded, stopped: false, reason: err.message || 'unknown' };
    }
  }

  return { uploaded };
}
