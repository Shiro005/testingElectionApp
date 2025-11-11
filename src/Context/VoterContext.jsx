// src/Context/VoterContext.jsx
import React, { createContext, useEffect, useState } from "react";
import { db } from "../Firebase/config";
import { collection, getDocs, addDoc } from "firebase/firestore";
import {
  saveToLocalDB,
  getFromLocalDB,
  saveSurveyLocal,
  mergeVoterAndSurvey,
} from "../libs/localdb";

export const VoterContext = createContext();

export const VoterProvider = ({ children }) => {
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // 🧩 Load static voters
  const loadStaticData = async () => {
    try {
      const cached = await getFromLocalDB("voters");
      if (cached?.length > 0) {
        console.log("✅ Loaded voters from local cache:", cached.length);
        return cached;
      }

      const response = await fetch("/voter.json");
      if (!response.ok) throw new Error("Failed to fetch voter.json");
      const json = await response.json();
      await saveToLocalDB("voters", json);
      console.log("✅ Downloaded and saved voter.json:", json.length);
      return json;
    } catch (err) {
      console.error("❌ Error loading static voter data:", err);
      return [];
    }
  };

  // 🧩 Load dynamic survey data from Firestore
  const loadDynamicData = async () => {
    try {
      const snapshot = await getDocs(collection(db, "surveys"));
      return snapshot.docs.map((d) => ({
        voterId: d.id,
        ...d.data(),
      }));
    } catch (error) {
      console.error("❌ Error loading survey data:", error);
      return [];
    }
  };

  // 🧠 Main initialization
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const staticData = await loadStaticData();
      const dynamicData = await loadDynamicData();

      // Merge both sets
      const dynamicMap = new Map(dynamicData.map((s) => [s.voterId, s]));
      const merged = staticData.map((v) => ({
        ...v,
        ...dynamicMap.get(v.voterId),
      }));

      setVoters(merged);
      setLoading(false);
      setInitialized(true);
    };
    init();
  }, []);

  // 📝 Save survey dynamically
  const saveSurveyData = async (voterId, survey) => {
    try {
      await saveSurveyLocal(voterId, survey);
      await addDoc(collection(db, "surveys"), { voterId, ...survey });
      console.log("✅ Survey saved for voter:", voterId);
    } catch (err) {
      console.error("❌ Error saving survey:", err);
    }
  };

  return (
    <VoterContext.Provider
      value={{ voters, setVoters, loading, initialized, saveSurveyData }}
    >
      {children}
    </VoterContext.Provider>
  );
};
