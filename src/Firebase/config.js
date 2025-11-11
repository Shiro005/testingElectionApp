// src/Firebase/config.js
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtvA4ADdd1hUpRhMk7Ra7v3gu03PPOxgM",
  authDomain: "nodejsdbelection.firebaseapp.com",
  projectId: "nodejsdbelection",
  storageBucket: "nodejsdbelection.firebasestorage.app",
  messagingSenderId: "65083918675",
  appId: "1:65083918675:web:e558ca16831fd4a700b9a6"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence and long polling
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true, // better for low-speed networks
  useFetchStreams: false,
});

export { db };