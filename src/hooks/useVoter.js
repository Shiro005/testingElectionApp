import { useState, useEffect, useCallback } from 'react';
import { db as firestore } from '../Firebase/config';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { localGetAll, localBulkPut, localUpdate } from '../libs/localdb';

export default function useVotersProvider() {
  const [voters, setVoters] = useState([]);
  const [ready, setReady] = useState(false);

  // init: load from local db then try to refresh from server if empty
  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await localGetAll();
      if (mounted && cached && cached.length) {
        setVoters(cached);
        setReady(true);
      } else {
        // fallback fetch once
        const snap = await getDocs(collection(firestore, 'voters'));
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        await localBulkPut(arr);
        if (mounted) {
          setVoters(arr);
          setReady(true);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const refreshFromServer = useCallback(async () => {
    const snap = await getDocs(collection(firestore, 'voters'));
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await localBulkPut(arr);
    setVoters(arr);
  }, []);

  const updateVoter = useCallback(async (id, patch) => {
    // write to local immediately
    await localUpdate(id, { ...patch, lastUpdated: Date.now() });
    setVoters(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));

    // write to Firestore (merge)
    const ref = doc(firestore, 'voters', id);
    await setDoc(ref, { ...patch, lastUpdated: Date.now() }, { merge: true });
  }, []);

  return { voters, ready, refreshFromServer, updateVoter, setVoters };
}
