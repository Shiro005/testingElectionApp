import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../Firebase/config';
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  query,
  where,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  FiArrowLeft,
  FiHome,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiUserPlus,
  FiUser,
  FiCheck,
  FiX,
  FiFilter,
  FiPhoneOff,
  FiTrash2,
  FiRefreshCw,
  FiUsers,
  FiDownload,
  FiEye,
  FiFileText,
  FiUsers as FiTeam,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import TranslatedText from './TranslatedText';
import VoterList from './VoterList';

// Import VoterContext
import { VoterContext } from '../Context/VoterContext';

// Load Balancer for Firebase operations
class FirebaseLoadBalancer {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.active = 0;
  }

  async execute(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.process();
    });
  }

  process() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) return;

    this.active++;
    const { operation, resolve, reject } = this.queue.shift();

    operation()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.active--;
        this.process();
      });
  }
}

const firebaseLoadBalancer = new FirebaseLoadBalancer(3);

// Local caching for booths and karyakartas
const LOCAL_STORAGE_KEYS = {
  BOOTHS: 'cached_booths',
  KARYAKARTAS: 'cached_karyakartas',
  LAST_SYNC: 'last_sync_time'
};

// Helper functions for local dynamic data
const getDynamic = async (voterId) => {
  try {
    const dynamicData = localStorage.getItem(`dynamic_${voterId}`);
    return dynamicData ? JSON.parse(dynamicData) : null;
  } catch (error) {
    console.error('Error getting dynamic data:', error);
    return null;
  }
};

const putDynamic = async (data) => {
  try {
    localStorage.setItem(`dynamic_${data.voterId}`, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving dynamic data:', error);
    return false;
  }
};

// Offline support helper
const saveWithOfflineSupport = async (docId, data, collectionName) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, data);
    return true;
  } catch (error) {
    console.error('Error saving to Firestore:', error);
    // Queue for offline retry
    const offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    offlineQueue.push({ docId, data, collectionName, timestamp: Date.now() });
    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    return false;
  }
};

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pages = [];

  // Show up to 5 page buttons
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <button
        key={i}
        onClick={() => onPageChange(i)}
        className={`px-3 py-1 rounded text-sm font-medium ${
          currentPage === i
            ? 'bg-orange-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {i}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FiChevronLeft size={16} />
      </button>

      {pages}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FiChevronRight size={16} />
      </button>
    </div>
  );
};

// Export Modal Component
const ExportModal = ({ onClose, onExport, isLoading }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== 'AkolaPRServices@3535') {
      setError('Incorrect password');
      return;
    }
    onExport();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 text-lg text-center">
            <TranslatedText>Export Data</TranslatedText>
          </h3>
          <p className="text-gray-600 text-sm text-center mt-1">
            <TranslatedText>Enter password to export voter data</TranslatedText>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <TranslatedText>Password</TranslatedText>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password"
              className="w-full px-3 py-3 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
              autoFocus
            />
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>

          <div className="bg-gray-50 rounded p-3 mb-4">
            <div className="flex items-center gap-2">
              <FiFileText className="text-gray-600" />
              <div>
                <div className="font-medium text-gray-800 text-sm">
                  <TranslatedText>Export Format</TranslatedText>
                </div>
                <div className="text-gray-700 text-xs">
                  <TranslatedText>Excel file with all voter details</TranslatedText>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <TranslatedText>Cancel</TranslatedText>
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 bg-orange-500 text-white py-3 rounded font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span><TranslatedText>Exporting...</TranslatedText></span>
              </>
            ) : (
              <>
                <FiDownload size={16} />
                <span><TranslatedText>Export</TranslatedText></span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const BoothManagement = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('boothList');
  const [selectedBooth, setSelectedBooth] = useState(null);
  const [loadingBoothDetail, setLoadingBoothDetail] = useState(false);

  const handleBoothSelect = useCallback(async (booth) => {
    setLoadingBoothDetail(true);
    setSelectedBooth(booth);
    setActiveView('boothDetail');
    setLoadingBoothDetail(false);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedBooth(null);
    setActiveView('boothList');
  }, []);

  const handleViewVoterDetails = useCallback((voter) => {
    navigate(`/voter/${voter.id || voter.voterId}`);
  }, [navigate]);

  const handleTeamClick = useCallback(() => {
    navigate('/team');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white">
      {activeView === 'boothList' && (
        <BoothListView
          onBoothSelect={handleBoothSelect}
          loadingBoothDetail={loadingBoothDetail}
          onViewVoterDetails={handleViewVoterDetails}
        />
      )}

      {activeView === 'boothDetail' && selectedBooth && (
        <BoothDetailView
          booth={selectedBooth}
          onBack={handleBack}
          onViewVoterDetails={handleViewVoterDetails}
        />
      )}

      {/* Floating Team Button */}
      <button
        onClick={handleTeamClick}
        className="fixed bottom-14 right-6 w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center z-40"
        title="Team Management"
      >
        <FiTeam size={24} />
      </button>
    </div>
  );
};

const BoothListView = ({ onBoothSelect, loadingBoothDetail, onViewVoterDetails }) => {
  const navigate = useNavigate();

  // State for static data
  const [staticVoters, setStaticVoters] = useState([]);
  const [allBooths, setAllBooths] = useState([]);
  
  // Use VoterContext for offline data
  const { voters: allVoters, loading: contextLoading, initialized } = useContext(VoterContext);

  const [booths, setBooths] = useState([]);
  const [karyakartas, setKaryakartas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showKaryakartaModal, setShowKaryakartaModal] = useState(false);
  const [selectedKaryakarta, setSelectedKaryakarta] = useState('');
  const [currentBooth, setCurrentBooth] = useState(null);
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Load static voter data from voter.json
  useEffect(() => {
    const loadStaticVoters = async () => {
      try {
        const response = await fetch('/voter.json');
        if (!response.ok) {
          throw new Error('Failed to load voter data');
        }
        const voterData = await response.json();
        setStaticVoters(voterData);
        
        // Extract unique booths from static data
        const boothNumbers = [...new Set(voterData.map(v => v.boothNumber).filter(Boolean))];
        const boothData = boothNumbers.map(boothNumber => {
          const boothVoters = voterData.filter(v => v.boothNumber === boothNumber);
          const votedCount = boothVoters.filter(v => v.hasVoted || v.voted).length;
          
          return {
            id: `booth_${boothNumber}`,
            boothNumber: boothNumber,
            boothName: `Booth ${boothNumber}`,
            pollingStationAddress: boothVoters[0]?.pollingStationAddress || `Booth ${boothNumber}`,
            voterCount: boothVoters.length,
            votedCount: votedCount,
            withPhoneCount: boothVoters.filter(v => v.phone).length,
            progressPercentage: Math.round((votedCount / Math.max(boothVoters.length, 1)) * 100),
            voters: boothVoters
          };
        });
        
        setAllBooths(boothData);
        setBooths(boothData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading static voter data:', error);
        setLoading(false);
      }
    };

    loadStaticVoters();
  }, []);

  // Merge dynamic data with static voters
  const mergeDynamicData = async (voterList) => {
    const merged = await Promise.all(
      voterList.map(async (v) => {
        const dynamic = await getDynamic(v.voterId);
        return { ...v, ...(dynamic || {}) };
      })
    );
    return merged;
  };

  // Load cached data from localStorage
  const loadCachedData = useCallback(() => {
    try {
      const cachedBooths = localStorage.getItem(LOCAL_STORAGE_KEYS.BOOTHS);
      const cachedKaryakartas = localStorage.getItem(LOCAL_STORAGE_KEYS.KARYAKARTAS);

      if (cachedBooths) {
        setBooths(JSON.parse(cachedBooths));
      }

      if (cachedKaryakartas) {
        setKaryakartas(JSON.parse(cachedKaryakartas));
      }

      return { hasCachedBooths: !!cachedBooths, hasCachedKaryakartas: !!cachedKaryakartas };
    } catch (error) {
      console.error('Error loading cached data:', error);
      return { hasCachedBooths: false, hasCachedKaryakartas: false };
    }
  }, []);

  // Save data to localStorage
  const saveToLocalStorage = useCallback((key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, []);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      setLoading(true);
    }
    setRefreshing(true);

    try {
      // Load karyakartas in background
      setTimeout(async () => {
        try {
          const karyakartasSnap = await getDocs(collection(db, 'karyakartas'));
          if (!karyakartasSnap.empty) {
            const karyakartasData = karyakartasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setKaryakartas(karyakartasData);
            saveToLocalStorage(LOCAL_STORAGE_KEYS.KARYAKARTAS, karyakartasData);
          }
        } catch (error) {
          console.error('Error loading karyakartas:', error);
        }
      }, 0);

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading data:', error);
      loadCachedData();
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCachedData, saveToLocalStorage]);

  // Enhanced booth selection with dynamic data merging
  const handleBoothSelectWithData = useCallback(async (booth) => {
    setLoading(true);
    try {
      // Get static voters for this booth
      const boothStaticVoters = staticVoters.filter(v => v.boothNumber === booth.boothNumber);
      
      // Merge with dynamic data
      const mergedVoters = await mergeDynamicData(boothStaticVoters);
      
      // Create enhanced booth object with merged voters
      const enhancedBooth = {
        ...booth,
        voters: mergedVoters,
        votedCount: mergedVoters.filter(v => v.hasVoted || v.voted).length,
        progressPercentage: Math.round((mergedVoters.filter(v => v.hasVoted || v.voted).length / Math.max(mergedVoters.length, 1)) * 100)
      };
      
      onBoothSelect(enhancedBooth);
    } catch (error) {
      console.error('Error loading booth data:', error);
      onBoothSelect(booth);
    } finally {
      setLoading(false);
    }
  }, [staticVoters, onBoothSelect]);

  const exportAllVoters = async () => {
    setExportLoading(true);
    try {
      // Use static voters data for export
      if (!staticVoters || staticVoters.length === 0) {
        alert('No voter data available to export');
        return;
      }

      // Merge dynamic data for export
      const votersWithDynamicData = await mergeDynamicData(staticVoters);

      const exportData = votersWithDynamicData.map((voter) => {
        const survey = voter.survey || {};

        return {
          'Serial Number': voter.serialNumber || '',
          'Voter ID': voter.voterId || '',
          'Name': voter.name || '',
          'Age': voter.age || '',
          'Gender': voter.gender || '',
          'Booth Number': voter.boothNumber || '',
          'Polling Station': voter.pollingStationAddress || '',
          'Address': survey.address || voter.address || '',
          'House Number': voter.houseNumber || '',
          'Phone': survey.mobile || voter.phone || '',
          'Has Voted': (voter.hasVoted || voter.voted) ? 'Yes' : 'No',
          'Family Members': voter.familyMembers ? Object.keys(voter.familyMembers).length : 0,
          'Family Income': survey.familyIncome || '',
          'Education': survey.education || '',
          'Occupation': survey.occupation || '',
          'Caste': survey.caste || '',
          'Political Affiliation': survey.politicalAffiliation || '',
          'Issues': survey.issues || '',
          'Support Status': voter.supportStatus || '',
          'Assigned Karyakarta': voter.assignedKaryakarta || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Voters Data');

      const date = new Date().toISOString().split('T')[0];
      const filename = `Voters_Data_${date}.xlsx`;

      XLSX.writeFile(wb, filename);
      alert(`✅ Successfully exported ${exportData.length} voter records`);

    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
      setShowExportModal(false);
    }
  };

  const filteredBooths = useMemo(() => {
    if (!booths.length) return [];

    const q = searchTerm.trim().toLowerCase();
    const results = booths.filter(booth => {
      if (!q) return true;

      // match by polling address, booth number
      if ((booth.pollingStationAddress || '').toLowerCase().includes(q)) return true;
      if ((booth.boothNumber || '').toString().toLowerCase().includes(q)) return true;
      if ((booth.boothName || '').toString().toLowerCase().includes(q)) return true;

      return false;
    });

    // sort results by booth number
    results.sort((a, b) => (a.boothNumber || '').localeCompare(b.boothNumber || ''));
    return results;
  }, [booths, searchTerm]);

  const handleAssignKaryakarta = async () => {
    if (!selectedKaryakarta) {
      setMessage('Please select a karyakarta');
      return;
    }

    try {
      await firebaseLoadBalancer.execute(async () => {
        const karyakarta = karyakartas.find(k => k.id === selectedKaryakarta);

        if (!karyakarta) {
          setMessage('Selected karyakarta not found');
          return;
        }

        const boothId = currentBooth.id;

        const batch = writeBatch(db);

        // Update or create booth assignment
        const boothRef = doc(db, 'booths', boothId);
        batch.set(boothRef, {
          assignedKaryakarta: selectedKaryakarta,
          karyakartaName: karyakarta.name,
          karyakartaPhone: karyakarta.phone,
          pollingStationAddress: currentBooth.pollingStationAddress,
          boothNumber: currentBooth.boothNumber,
          lastUpdated: new Date().toISOString()
        });

        // Update local state immediately for instant UI update
        setBooths(prev => prev.map(booth =>
          booth.id === boothId
            ? {
              ...booth,
              assignedKaryakarta: selectedKaryakarta,
              karyakartaName: karyakarta.name,
              karyakartaPhone: karyakarta.phone
            }
            : booth
        ));

        await batch.commit();

        setShowKaryakartaModal(false);
        setSelectedKaryakarta('');
        setCurrentBooth(null);
        setMessage(`✅ ${karyakarta.name} assigned successfully!`);

        setTimeout(() => setMessage(''), 3000);
      });
    } catch (error) {
      console.error('Error assigning karyakarta:', error);
      setMessage('❌ Error assigning karyakarta. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const openKaryakartaModal = (booth) => {
    setCurrentBooth(booth);
    setSelectedKaryakarta(booth.assignedKaryakarta || '');
    setShowKaryakartaModal(true);
    setMessage('');
  };

  const handleTeamClick = () => {
    navigate('/team');
  };

  // Back navigation
  const onBack = useCallback(() => {
    try {
      if (window.history && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    } catch (e) {
      window.location.href = '/';
    }
  }, []);

  if (loading && staticVoters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            <TranslatedText>Loading polling stations...</TranslatedText>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              <FiArrowLeft className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                <TranslatedText>Polling Stations</TranslatedText>
              </h1>
              <p className="text-gray-500 text-sm">
                <TranslatedText>Manage booth assignments</TranslatedText>
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-gray-100 text-gray-700 p-3 rounded-lg hover:bg-gray-200 transition-colors"
            title="Export All Data"
          >
            <FiDownload size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <FiSearch className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search booths by number, name, or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <div className="font-bold text-gray-900 text-lg">{booths.length}</div>
            <div className="text-gray-600 text-xs">
              <TranslatedText>Total Booths</TranslatedText>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <div className="font-bold text-gray-900 text-lg">
              {booths.filter(b => b.assignedKaryakarta).length}
            </div>
            <div className="text-gray-600 text-xs">
              <TranslatedText>Assigned</TranslatedText>
            </div>
          </div>
        </div>

        {/* Data Status Indicator */}
        {staticVoters.length > 0 && (
          <div className="mt-3 text-center">
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>
                <TranslatedText>Static Data</TranslatedText> • {staticVoters.length} <TranslatedText>voters loaded</TranslatedText>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-4 mt-4 p-3 rounded-lg text-center font-medium text-sm ${
          message.includes('✅')
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Booths List */}
      <div className="p-4 space-y-3">
        {filteredBooths.length === 0 && !loading ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FiHome className="inline text-gray-300 text-4xl mb-3" />
            <p className="text-gray-600 font-medium">
              <TranslatedText>No polling stations found</TranslatedText>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              <TranslatedText>Try adjusting your search terms</TranslatedText>
            </p>
          </div>
        ) : (
          filteredBooths.map((booth) => (
            <div
              key={booth.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleBoothSelectWithData(booth)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-900 text-base">
                      <TranslatedText>Booth {booth.boothNumber}</TranslatedText>
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 text-sm">
                    <span><TranslatedText>{booth.pollingStationAddress}</TranslatedText></span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openKaryakartaModal(booth);
                  }}
                  className="bg-gray-100 text-gray-600 p-2 rounded hover:bg-gray-200 transition-colors"
                >
                  <FiUserPlus size={16} />
                </button>
              </div>

              {/* Karyakarta Info */}
              {booth.assignedKaryakarta ? (
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <FiUser className="text-gray-600 text-sm" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">
                          {booth.karyakartaName}
                        </div>
                        <div className="text-gray-600 text-xs">
                          {booth.karyakartaPhone || 'No phone'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openKaryakartaModal(booth);
                      }}
                      className="text-orange-500 font-medium hover:text-orange-600 bg-orange-50 px-3 py-1 rounded text-xs"
                    >
                      <TranslatedText>Change</TranslatedText>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-orange-50 rounded-lg p-3 mb-3 border border-orange-200 text-center">
                  <p className="text-orange-700 font-medium text-sm">
                    <TranslatedText>No karyakarta assigned</TranslatedText>
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openKaryakartaModal(booth);
                    }}
                    className="mt-2 bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600 transition-all text-xs"
                  >
                    <TranslatedText>Assign Now</TranslatedText>
                  </button>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <div className="bg-gray-50 rounded p-2 border border-gray-200">
                  <div className="font-bold text-gray-900 text-sm">{booth.voterCount}</div>
                  <div className="text-gray-600 text-xs">
                    <TranslatedText>Total</TranslatedText>
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2 border border-gray-200">
                  <div className="font-bold text-gray-900 text-sm">{booth.votedCount}</div>
                  <div className="text-gray-600 text-xs">
                    <TranslatedText>Voted</TranslatedText>
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2 border border-gray-200">
                  <div className="font-bold text-gray-900 text-sm">{booth.withPhoneCount}</div>
                  <div className="text-gray-600 text-xs">
                    <TranslatedText>Phones</TranslatedText>
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2 border border-gray-200">
                  <div className="font-bold text-gray-900 text-sm">
                    {booth.progressPercentage}%
                  </div>
                  <div className="text-gray-600 text-xs">
                    <TranslatedText>Progress</TranslatedText>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleBoothSelectWithData(booth)}
                disabled={loadingBoothDetail}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all align-center m-auto flex items-center justify-center gap-2 text-sm shadow-sm
                  ${
                    loadingBoothDetail
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-white to-gray-100 text-orange-600 font-semibold hover:from-gray-50 hover:to-gray-100 hover:shadow-md active:scale-95'
                  }`}
              >
                {loadingBoothDetail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>
                      <TranslatedText>Loading...</TranslatedText>
                    </span>
                  </>
                ) : (
                  <>
                    <FiUsers size={16} className="text-orange-600 font-semibold" />
                    <span>
                      <TranslatedText>View Voters</TranslatedText>
                    </span>
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={exportAllVoters}
          isLoading={exportLoading}
        />
      )}

      {/* Karyakarta Assignment Modal */}
      {showKaryakartaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-lg">
                <TranslatedText>Assign Karyakarta</TranslatedText>
              </h3>
              <p className="text-gray-500 text-sm mt-1">Booth {currentBooth?.boothNumber}</p>
            </div>

            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <TranslatedText>Select Karyakarta</TranslatedText>
              </label>
              <select
                value={selectedKaryakarta}
                onChange={(e) => setSelectedKaryakarta(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-3 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">
                  <TranslatedText>Choose a karyakarta</TranslatedText>
                </option>
                {karyakartas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} - {k.phone || 'No Phone'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowKaryakartaModal(false);
                  setSelectedKaryakarta('');
                  setCurrentBooth(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded font-medium hover:bg-gray-200 transition-colors"
              >
                <TranslatedText>Cancel</TranslatedText>
              </button>
              <button
                onClick={handleAssignKaryakarta}
                disabled={!selectedKaryakarta}
                className="flex-1 bg-orange-500 text-white py-3 rounded font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
              >
                <TranslatedText>Assign</TranslatedText>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BoothDetailView = ({ booth, onBack, onViewVoterDetails }) => {
  const [voters, setVoters] = useState(booth.voters || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [votersPerPage] = useState(100);

  // Handle mark as voted with offline support
  const handleMarkAsVoted = async (voterId, currentStatus) => {
    try {
      const newVotedStatus = !currentStatus;
      
      // Optimistic UI update
      setVoters(prev => 
        prev.map(voter => 
          voter.voterId === voterId 
            ? { ...voter, hasVoted: newVotedStatus, voted: newVotedStatus }
            : voter
        )
      );

      // Save to Firestore with offline support
      await saveWithOfflineSupport(
        voterId,
        { 
          voterId, 
          hasVoted: newVotedStatus, 
          voted: newVotedStatus,
          lastUpdated: Date.now() 
        },
        "voters"
      );

      // Update local storage for offline access
      await putDynamic({ 
        voterId, 
        hasVoted: newVotedStatus, 
        voted: newVotedStatus,
        lastUpdated: Date.now() 
      });

    } catch (error) {
      console.error('Error updating voted status:', error);
      // Revert optimistic update on error
      setVoters(prev => 
        prev.map(voter => 
          voter.voterId === voterId 
            ? { ...voter, hasVoted: currentStatus, voted: currentStatus }
            : voter
        )
      );
      alert('Failed to update vote status. Please try again.');
    }
  };

  const exportBoothVoters = async () => {
    setExportLoading(true);
    try {
      if (voters.length === 0) {
        alert('No voters found for this booth');
        return;
      }

      const exportData = voters.map(voter => {
        const survey = voter.survey || {};

        return {
          'Serial Number': voter.serialNumber || '',
          'Voter ID': voter.voterId || '',
          'Name': voter.name || '',
          'Age': voter.age || '',
          'Gender': voter.gender || '',
          'Booth Number': voter.boothNumber || '',
          'Polling Station': voter.pollingStationAddress || '',
          'Address': survey.address || voter.address || '',
          'House Number': voter.houseNumber || '',
          'Phone': survey.mobile || voter.phone || '',
          'Has Voted': (voter.hasVoted || voter.voted) ? 'Yes' : 'No',
          'Family Members': voter.familyMembers ? Object.keys(voter.familyMembers).length : 0,
          'Family Income': survey.familyIncome || '',
          'Education': survey.education || '',
          'Occupation': survey.occupation || '',
          'Caste': survey.caste || '',
          'Political Affiliation': survey.politicalAffiliation || '',
          'Issues': survey.issues || '',
          'Support Status': voter.supportStatus || '',
          'Assigned Karyakarta': voter.assignedKaryakarta || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Booth Voters Data');

      const date = new Date().toISOString().split('T')[0];
      const boothName = booth.boothNumber || 'Unknown';
      const filename = `Booth_${boothName}_Voters_${date}.xlsx`;

      XLSX.writeFile(wb, filename);
      alert(`✅ Successfully exported ${voters.length} voters from Booth ${booth.boothNumber}`);

    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export booth data. Please try again.');
    } finally {
      setExportLoading(false);
      setShowExportModal(false);
    }
  };

  const deleteBoothAndVoters = useCallback(async () => {
    try {
      await firebaseLoadBalancer.execute(async () => {
        const batch = writeBatch(db);

        const boothRef = doc(db, 'booths', booth.id);
        batch.delete(boothRef);

        // Note: We don't delete static voters from voter.json
        // Only delete dynamic assignments if they exist

        await batch.commit();
      });

      alert('Booth assignment deleted successfully!');
      onBack();
    } catch (error) {
      console.error('Error deleting booth:', error);
      alert('Error deleting booth assignment. Please try again.');
    }
  }, [booth, onBack]);

  const filteredVoters = useMemo(() =>
    voters.filter(voter => {
      if (searchTerm && !voter.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !voter.voterId.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !voter.phone.includes(searchTerm)) {
        return false;
      }

      switch (filter) {
        case 'voted': return voter.hasVoted || voter.voted;
        case 'notVoted': return !(voter.hasVoted || voter.voted);
        case 'withPhone': return voter.phone;
        case 'withoutPhone': return !voter.phone;
        default: return true;
      }
    }),
    [voters, searchTerm, filter]
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredVoters.length / votersPerPage);
  const indexOfLastVoter = currentPage * votersPerPage;
  const indexOfFirstVoter = indexOfLastVoter - votersPerPage;
  const currentVoters = filteredVoters.slice(indexOfFirstVoter, indexOfLastVoter);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stats = useMemo(() => ({
    total: voters.length,
    voted: voters.filter(v => v.hasVoted || v.voted).length,
    withPhone: voters.filter(v => v.phone).length,
    votedPercentage: Math.round((voters.filter(v => v.hasVoted || v.voted).length / Math.max(voters.length, 1)) * 100)
  }), [voters]);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              <FiArrowLeft className="text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-lg">Booth {booth.boothNumber}</h1>
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                <span>{booth.pollingStationAddress}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="w-10 h-10 bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all"
                title="Export Booth Voters"
              >
                <FiDownload size={18} />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-10 h-10 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 transition-all"
                title="Delete Booth Assignment"
              >
                <FiTrash2 size={18} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded p-3 text-center border border-gray-200">
              <div className="font-bold text-gray-900 text-base">{stats.total}</div>
              <div className="text-gray-600 text-xs">
                <TranslatedText>Total</TranslatedText>
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3 text-center border border-gray-200">
              <div className="font-bold text-gray-900 text-base">{stats.voted}</div>
              <div className="text-gray-600 text-xs">
                <TranslatedText>Voted</TranslatedText>
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3 text-center border border-gray-200">
              <div className="font-bold text-gray-900 text-base">{stats.withPhone}</div>
              <div className="text-gray-600 text-xs">
                <TranslatedText>Phones</TranslatedText>
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3 text-center border border-gray-200">
              <div className="font-bold text-gray-900 text-base">{stats.votedPercentage}%</div>
              <div className="text-gray-600 text-xs">
                <TranslatedText>Progress</TranslatedText>
              </div>
            </div>
          </div>

          {/* Data Status Indicator */}
          <div className="mt-3 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs border border-blue-200">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>
                <TranslatedText>Static Data + Dynamic Updates</TranslatedText>
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search voters by name, ID, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white transition-colors text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <FiX size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-100 text-gray-600 p-3 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiFilter size={16} />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              >
                <option value="all">
                  <TranslatedText>All Voters</TranslatedText>
                </option>
                <option value="voted">
                  <TranslatedText>Voted</TranslatedText>
                </option>
                <option value="notVoted">
                  <TranslatedText>Not Voted</TranslatedText>
                </option>
                <option value="withPhone">
                  <TranslatedText>With Phone</TranslatedText>
                </option>
                <option value="withoutPhone">
                  <TranslatedText>Without Phone</TranslatedText>
                </option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Voters List using the VoterList component */}
      <div className="p-4">
        {loadingVoters ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-orange-500 mx-auto mb-3"></div>
            <h3 className="text-gray-600 font-medium mb-1">
              <TranslatedText>Loading Voters</TranslatedText>
            </h3>
            <p className="text-gray-400 text-sm">
              <TranslatedText>Please wait...</TranslatedText>
            </p>
          </div>
        ) : (
          <>
            {/* Page Info */}
            <div className="mb-4 text-center">
              <p className="text-gray-600 text-sm">
                <TranslatedText>Showing</TranslatedText> {indexOfFirstVoter + 1}-{Math.min(indexOfLastVoter, filteredVoters.length)} <TranslatedText>of</TranslatedText> {filteredVoters.length} <TranslatedText>voters</TranslatedText>
                {totalPages > 1 && (
                  <span className="ml-2">
                    (<TranslatedText>Page</TranslatedText> {currentPage} <TranslatedText>of</TranslatedText> {totalPages})
                  </span>
                )}
              </p>
            </div>

            {/* Use VoterList component */}
            <VoterList 
              voters={currentVoters} 
              loading={loadingVoters}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          onExport={exportBoothVoters}
          isLoading={exportLoading}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="text-red-600 text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                <TranslatedText>Delete Booth Assignment?</TranslatedText>
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                <TranslatedText>This will remove the booth assignment but keep the static voter data.</TranslatedText>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded font-medium hover:bg-gray-200 transition-colors"
                >
                  <TranslatedText>Cancel</TranslatedText>
                </button>
                <button
                  onClick={deleteBoothAndVoters}
                  className="flex-1 bg-red-500 text-white py-3 rounded font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <FiTrash2 size={16} />
                  <TranslatedText>Delete</TranslatedText>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoothManagement;