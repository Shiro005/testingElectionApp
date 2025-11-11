import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

// 🔐 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAjWIDIXvYg83EDH09I-1ef_TRlgoVJnWA",
  authDomain: "jannetaa-2bc82.firebaseapp.com",
  databaseURL: "https://jannetaa-2bc82-default-rtdb.firebaseio.com",
  projectId: "jannetaa-2bc82",
  storageBucket: "jannetaa-2bc82.firebasestorage.app",
  messagingSenderId: "839872960195",
  appId: "1:839872960195:web:c840f64a1007fee235b476",
  databaseURL:"https://jannetaa-2bc82-default-rtdb.firebaseio.com/"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🗑️ Booth to delete
const targetBooth = "299 Akola Kaulkhed"; // match exactly what is in DB

async function deleteBoothVoters() {
  console.log(`🔍 Checking voters for booth: ${targetBooth}`);
  const votersCol = collection(db, 'voters');
  const q = query(votersCol, where('boothNumber', '==', targetBooth));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log("❌ No voters found in the database for the specified booth.");
    return;
  }

  let deletedCount = 0;
  let totalCount = snapshot.size;

  for (const docSnap of snapshot.docs) {
    try {
      await deleteDoc(doc(db, 'voters', docSnap.id));
      deletedCount++;
      console.log(`🗑️ Deleted voter: ${docSnap.id}`);
    } catch (e) {
      console.error('Failed to delete', docSnap.id, e);
    }
  }

  console.log(`✅ Deleted ${deletedCount} out of ${totalCount} voters from booth "${targetBooth}"`);
}

deleteBoothVoters().catch(console.error);
