import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the context
const CandidateContext = createContext();

// Custom hook to use the candidate context
export const useCandidate = () => {
  const context = useContext(CandidateContext);
  if (!context) {
    throw new Error('useCandidate must be used within a CandidateProvider');
  }
  return context;
};

// Provider component
export const CandidateProvider = ({ children }) => {
  const [candidateInfo, setCandidateInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default candidate information
  const defaultCandidateInfo = {
    mainFrontImage:'/frontstaringbanner.jpg',
    mainWhatsappBrandingImage:'/frontbanner.jpg',
    logoImageCircle: "/jannetaa.jpg",
    TagLine: "मंगरूळ नगर परिषद निवडणूक 2025",
    ReSellerName: "Packy Media Services - Powered By JanNetaa",
    name: 'डॉ.दिलीप रत्नपारखी',
    party: "Bhartiya Janta Party",
    electionSymbol: "कमळ",
    slogan:'सबका साथ, सबका विकास',
    contact: "",
    area: "मंगरूळ नगर परिषद निवडणूक 2025",
  };

  // Load candidate info from localStorage on mount
  useEffect(() => {
    const loadCandidateInfo = () => {
      try {
        const savedCandidateInfo = localStorage.getItem('candidateInfo');
        if (savedCandidateInfo) {
          setCandidateInfo(JSON.parse(savedCandidateInfo));
        } else {
          setCandidateInfo(defaultCandidateInfo);
        }
      } catch (error) {
        console.error('Error loading candidate info:', error);
        setCandidateInfo(defaultCandidateInfo);
      } finally {
        setLoading(false);
      }
    };

    loadCandidateInfo();
  }, []);

  // Save to localStorage whenever candidateInfo changes
  useEffect(() => {
    if (candidateInfo) {
      localStorage.setItem('candidateInfo', JSON.stringify(candidateInfo));
    }
  }, [candidateInfo]);

  const updateCandidateInfo = (newInfo) => {
    setCandidateInfo(prev => ({ ...prev, ...newInfo }));
  };

  const resetCandidateInfo = () => {
    setCandidateInfo(defaultCandidateInfo);
    localStorage.setItem('candidateInfo', JSON.stringify(defaultCandidateInfo));
  };

  // Don't render children until candidateInfo is loaded
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading candidate information...</p>
        </div>
      </div>
    );
  }

  const value = {
    candidateInfo,
    updateCandidateInfo,
    resetCandidateInfo
  };

  return (
    <CandidateContext.Provider value={value}>
      {children}
    </CandidateContext.Provider>
  );
};