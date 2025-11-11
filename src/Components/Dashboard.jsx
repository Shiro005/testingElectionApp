import React, { useState, useEffect, useCallback, lazy, Suspense, useContext, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { db } from '../Firebase/config';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import useAutoTranslate from '../hooks/useAutoTranslate';
import localforage from "localforage";
import Sanscript from 'sanscript';
import { saveAs } from 'file-saver';

// Import VoterContext
import { VoterContext } from "../Context/VoterContext";

// Icons
import {
  FiFilter,
  FiDownload,
  FiX,
  FiUsers,
  FiEye,
  FiSearch,
  FiHome,
  FiLoader,
  FiChevronLeft,
  FiChevronRight,
  FiSliders,
  FiBarChart2,
  FiUserCheck,
  FiMapPin,
  FiRefreshCw,
  FiWifi,
  FiWifiOff
} from 'react-icons/fi';
import { FaUsers } from 'react-icons/fa';
import TranslatedText from './TranslatedText';

// Lazy load components
const VoterList = lazy(() => import('./VoterList'));
const SearchBar = lazy(() => import('./SearchBar'));

// --- Helper: normalize text for search (lowercase, remove punctuation, remove diacritics-ish)
const normalizeForSearch = (str = '') => {
  return str
    .toString()
    .normalize('NFKD')                // split combined chars
    .replace(/[\u0300-\u036f]/g, '')  // remove diacritics
    .replace(/[^0-9a-z\s]/gi, ' ')    // remove non-latin letters/numbers (keeps spaces)
    .replace(/\s+/g, ' ')             // collapse spaces
    .trim()
    .toLowerCase();
};

// --- Helper: build searchable text for a voter (includes transliterated Latin)
const buildVoterSearchIndex = (voter = {}) => {
  const name = voter.name || '';
  const voterId = voter.voterId || '';
  const booth = voter.boothNumber || '';
  const address = (voter.pollingStationAddress || voter.address) || '';
  const yadiBhagAddress = voter.yadiBhagAddress || '';
  const village = voter.village || '';
  const fatherName = voter.fatherName || '';

  // Transliterate Devanagari -> Latin using Sanscript.
  let translitLatin = '';
  try {
    translitLatin = Sanscript.t(name, 'devanagari', 'itrans') || '';
  } catch (e) {
    translitLatin = name;
  }

  // Combine fields and normalize
  const combined = `${name} ${translitLatin} ${voterId} ${booth} ${address} ${yadiBhagAddress} ${village} ${fatherName}`;
  return normalizeForSearch(combined);
};

// Search helper function for English to Marathi search
const searchVoters = (voters, searchTerm) => {
  if (!searchTerm.trim()) return voters;

  const term = searchTerm.toLowerCase().trim();
  
  return voters.filter(voter => {
    // Direct search in various fields
    const fieldsToSearch = [
      voter.name,
      voter.voterId,
      voter.boothNumber,
      voter.prabhag,
      voter.yadiBhagAddress,
      voter.pollingStationAddress,
      voter.village,
      voter.fatherName,
      voter.surname
    ];

    // Check direct matches
    const directMatch = fieldsToSearch.some(field => 
      field && field.toString().toLowerCase().includes(term)
    );

    if (directMatch) return true;

    // Try transliteration for Marathi to English search
    try {
      const marathiName = voter.name || '';
      const transliterated = Sanscript.t(marathiName, 'devanagari', 'itrans').toLowerCase();
      if (transliterated.includes(term)) return true;
      
      // Also try reverse transliteration for English to Marathi
      const englishToMarathi = Sanscript.t(term, 'itrans', 'devanagari');
      if (marathiName.includes(englishToMarathi)) return true;
    } catch (error) {
      // If transliteration fails, continue with other checks
    }

    // Search in phone numbers (exact match)
    if (voter.phone && voter.phone.includes(term.replace(/[^\d]/g, ''))) {
      return true;
    }

    return false;
  });
};

const Dashboard = () => {
  const { currentLanguage, translateText, translateMultiple } = useAutoTranslate();

  // Use VoterContext for offline data - added refreshVotersData function
  const { voters: allVoters, loading: contextLoading, initialized, refreshVotersData } = useContext(VoterContext);

  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const [voters, setVoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    boothNumbers: [], // allow multi-select of booths
    pollingStationAddress: ''
  });
  const [boothsList, setBoothsList] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isSticky, setIsSticky] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // New auto-sync states
  const [lastSync, setLastSync] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'

  // New JSON data states - FIXED: Add state to track if we've checked for local data
  const [jsonDataLoaded, setJsonDataLoaded] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [dataCheckComplete, setDataCheckComplete] = useState(false); // NEW: Track if we've completed initial data check

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  // new local state to hold indexed (search-ready) voters
  const [indexedVoters, setIndexedVoters] = useState([]);
  const [totalVoters, setTotalVoters] = useState(0);

  // Search states
  const [searchFilteredVoters, setSearchFilteredVoters] = useState([]);

  useEffect(() => {
    const loadVoterData = async () => {
      try {
        const response = await fetch(`/voter.json?v=${Date.now()}`);
        const text = await response.text();
        const data = JSON.parse(text);
        setTotalVoters(data.length); // ✅ sets total voter count
      } catch (error) {
        console.error("Error loading voter data:", error);
        setTotalVoters(0);
      }
    };

    loadVoterData();
  }, []);

  // Handle search
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setSearchFilteredVoters(voters);
    } else {
      const results = searchVoters(voters, term);
      setSearchFilteredVoters(results);
    }
    setCurrentPage(1);
  }, [voters]);

  // Update searchFilteredVoters when voters changes
  useEffect(() => {
    setSearchFilteredVoters(voters);
  }, [voters]);

  // Monitor online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        console.log('App is online - auto-sync enabled');
      } else {
        console.log('App is offline - using cached data');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // FIXED: Check for multiple data sources - local storage, context, and JSON data
  useEffect(() => {
    const checkAllDataSources = async () => {
      try {
        console.log('🔍 Checking all data sources...');
        
        // Check 1: LocalForage data
        const localData = await localforage.getItem('voterData');
        const hasLocalData = localData && localData.length > 0;
        
        // Check 2: Context data (from VoterProvider)
        const hasContextData = allVoters && allVoters.length > 0;
        
        // Check 3: Check if JSON data was previously loaded
        const jsonLoaded = localStorage.getItem('jsonDataLoaded') === 'true';
        
        console.log('Data sources check:', {
          hasLocalData: hasLocalData,
          hasContextData: hasContextData,
          jsonLoaded: jsonLoaded,
          localDataLength: localData?.length,
          contextDataLength: allVoters?.length
        });

        // If we have data from ANY source, consider JSON data as loaded
        if (hasLocalData || hasContextData || jsonLoaded) {
          console.log('✅ Data available from at least one source');
          setJsonDataLoaded(true);
          
          // Set last sync time from cache if available
          const lastSyncTime = await localforage.getItem('lastSyncTime');
          if (lastSyncTime) {
            setLastSync(lastSyncTime);
          }
        } else {
          console.log('❌ No data found in any source');
          setJsonDataLoaded(false);
        }
        
        setDataCheckComplete(true);
      } catch (error) {
        console.error('Error checking data sources:', error);
        setDataCheckComplete(true);
      }
    };

    // Only check if we haven't completed the check yet
    if (!dataCheckComplete) {
      checkAllDataSources();
    }
  }, [allVoters, dataCheckComplete]); // Added allVoters dependency

  // Auto sync data (no button needed) - every 3 minutes when online
  const autoSyncFromFirestore = useCallback(async () => {
    if (!isOnline || !initialized) {
      console.log('Skipping auto-sync: offline or not initialized');
      return;
    }

    try {
      setSyncStatus('syncing');
      console.log('Starting auto-sync from Firestore...');

      const votersCollection = collection(db, 'voters');
      const snapshot = await getDocs(votersCollection);
      const freshData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Compare new data length to detect updates
      const oldData = await localforage.getItem('voterData');
      const isChanged = !oldData || oldData.length !== freshData.length;

      if (isChanged) {
        console.log(`Data changed: ${oldData?.length || 0} -> ${freshData.length} records`);

        // Store fresh data in localforage
        await localforage.setItem('voterData', freshData);

        // Update last sync time
        const syncTime = new Date().toLocaleString();
        await localforage.setItem('lastSyncTime', syncTime);
        setLastSync(syncTime);

        // Mark JSON as loaded
        setJsonDataLoaded(true);
        localStorage.setItem('jsonDataLoaded', 'true');

        // Trigger context refresh to update allVoters
        if (refreshVotersData) {
          await refreshVotersData();
        }

        setSyncStatus('success');
        console.log('Auto-sync completed successfully');
      } else {
        console.log('No data changes detected');
        setSyncStatus('idle');
      }
    } catch (error) {
      console.error('Error in auto-sync:', error);
      setSyncStatus('error');
    }
  }, [isOnline, initialized, refreshVotersData]);

  // Auto sync setup - every 3 minutes when online
  useEffect(() => {
    if (!isOnline || !initialized) return;

    // Initial sync
    autoSyncFromFirestore();

    // Set up interval for auto-sync (3 minutes)
    const interval = setInterval(autoSyncFromFirestore, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoSyncFromFirestore, isOnline, initialized]);

  // Manual sync function (for manual trigger)
  const handleManualSync = useCallback(async () => {
    if (!isOnline) {
      alert('You are offline. Please check your internet connection.');
      return;
    }

    setSyncing(true);
    try {
      await autoSyncFromFirestore();
      alert('Data sync completed successfully!');
    } catch (error) {
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }, [autoSyncFromFirestore, isOnline]);

  // FIXED: Function to download and cache JSON voter data - also mark as loaded
  const handleDownloadVoterJson = useCallback(async () => {
    try {
      setDownloadingJson(true);
      const response = await fetch('/voter.json');
      if (!response.ok) throw new Error('Failed to fetch voter.json');

      const voterData = await response.json();
      // Store JSON data locally for offline use
      await localforage.setItem('voterData', voterData);
      
      // Mark JSON as loaded in localStorage for persistence
      localStorage.setItem('jsonDataLoaded', 'true');

      // Merge with Firebase dynamic data
      if (refreshVotersData) {
        await refreshVotersData();
      }

      setJsonDataLoaded(true);
      alert(`✅ Voter data downloaded successfully! ${voterData.length} records cached for offline use.`);
    } catch (error) {
      console.error('Error downloading JSON:', error);
      alert('❌ Failed to download voter data. Please check your internet.');
    } finally {
      setDownloadingJson(false);
    }
  }, [refreshVotersData]);

  // Sticky header effect
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Build indexed search fields whenever allVoters updates
  useEffect(() => {
    if (!allVoters || allVoters.length === 0) {
      setIndexedVoters([]);
      return;
    }

    try {
      const built = allVoters.map(v => ({
        ...v,
        _searchIndex: buildVoterSearchIndex(v)   // add the normalized searchable string
      }));
      setIndexedVoters(built);
    } catch (err) {
      console.error('Error building search index:', err);
      setIndexedVoters(allVoters);
    }
  }, [allVoters]);

  // Process and filter voters from context (OFFLINE MODE)
  const processAndFilterVoters = useCallback((page = 1, search = '', filter = {}) => {
    try {
      setLoading(true);

      if (!allVoters || allVoters.length === 0) {
        setVoters([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      let filteredVoters = (indexedVoters && indexedVoters.length > 0) ? [...indexedVoters] : [...(allVoters || [])];

      // ✅ Search filter (multi-term) - OFFLINE
      if (search.trim()) {
        // normalize incoming search string the same way we normalized data
        const terms = normalizeForSearch(search).split(/\s+/).filter(Boolean);

        filteredVoters = filteredVoters.filter(voter => {
          // use indexed search text we created earlier
          const text = (voter._searchIndex || '').toLowerCase();
          return terms.every(term => text.includes(term));
        });
      }

      // ✅ Booth filter - OFFLINE
      if (filter.boothNumbers?.length > 0) {
        const setBooths = new Set(filter.boothNumbers.map(String));
        filteredVoters = filteredVoters.filter(v => setBooths.has(String(v.boothNumber)));
      }

      // ✅ Polling station filter - OFFLINE
      if (filter.pollingStationAddress) {
        const q = filter.pollingStationAddress.toLowerCase();
        filteredVoters = filteredVoters.filter(v =>
          v.pollingStationAddress?.toLowerCase().includes(q)
        );
      }

      // ✅ Pagination - OFFLINE
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginated = filteredVoters.slice(startIndex, endIndex);

      setVoters(paginated);
      setTotalCount(filteredVoters.length);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error processing voters:', err);
    } finally {
      setLoading(false);
    }
  }, [allVoters, itemsPerPage, indexedVoters]);

  // Debounced search with offline data
  useEffect(() => {
    const handler = debounce(() => {
      processAndFilterVoters(1, searchTerm, filters);
    }, 300); // Reduced debounce for faster offline response

    if (initialized) {
      handler();
    }
    return () => handler.cancel();
  }, [searchTerm, filters, processAndFilterVoters, initialized]);

  // Initialize data when context is ready
  useEffect(() => {
    if (initialized && allVoters) {
      processAndFilterVoters(1, searchTerm, filters);

      // Extract booth list from cached data (OFFLINE)
      const boothMap = new Map();
      allVoters.forEach(voter => {
        const booth = String(voter.boothNumber || '');
        if (!booth) return;
        if (!boothMap.has(booth)) {
          boothMap.set(booth, {
            number: booth,
            name: voter.pollingStationAddress || `Booth ${booth}`,
            count: 1
          });
        } else {
          boothMap.get(booth).count++;
        }
      });
      const booths = Array.from(boothMap.values()).sort((a, b) => a.number.localeCompare(b.number));
      setBoothsList(booths);
    }
  }, [initialized, allVoters, processAndFilterVoters]);

  // Real-time updates (optional - for online sync)
  useEffect(() => {
    if (initialized) {
      const votersCol = collection(db, 'voters');
      const unsubscribe = onSnapshot(votersCol, (snapshot) => {
        // This will update the context which will trigger re-renders
        console.log('Real-time update received:', snapshot.size, 'voters');
      });

      return () => unsubscribe();
    }
  }, [initialized]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      boothNumbers: [],
      pollingStationAddress: ''
    });
    setSearchTerm('');
  }, []);

  // Export handlers
  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const verifyPasswordAndExport = useCallback(async () => {
    if ((exportPassword || '').trim() === 'admin8668722207') {
      await exportAllVoters();
      setShowExportModal(false);
      setExportPassword('');
      setPasswordError('');
    } else {
      setPasswordError('Invalid password. Please try again.');
    }
  }, [exportPassword]);

  const exportAllVoters = useCallback(async () => {
    setLoading(true);
    try {
      // Use cached data from context for export (OFFLINE)
      if (!allVoters || allVoters.length === 0) {
        alert('No voter data available to export');
        return;
      }

      const exportData = allVoters.map((voter) => {
        const survey = voter?.survey || {};

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
          'Has Voted': voter.hasVoted ? 'Yes' : 'No',
          'Family Members': voter.familyMembers ? 'Yes' : 'No',
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

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 8 },  // Serial Number
        { wch: 15 }, // Voter ID
        { wch: 25 }, // Name
        { wch: 5 },  // Age
        { wch: 8 },  // Gender
        { wch: 15 }, // Booth Number
        { wch: 40 }, // Polling Station
        { wch: 30 }, // Address
        { wch: 10 }, // House Number
        { wch: 12 }, // Phone
        { wch: 8 },  // Has Voted
        { wch: 12 }, // Family Members
        { wch: 15 }, // Family Income
        { wch: 15 }, // Education
        { wch: 20 }, // Occupation
        { wch: 15 }, // Caste
        { wch: 20 }, // Political Affiliation
        { wch: 30 }, // Issues
        { wch: 15 }, // Support Status
        { wch: 20 }  // Assigned Karyakarta
      ];
      ws['!cols'] = colWidths;

      // Style the header row
      const headerRange = XLSX.utils.decode_range(ws['!ref']);
      for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + "1";
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "FFA500" } }, // Orange background
          alignment: { horizontal: "center" }
        };
      }

      // Create workbook and append worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Voters Data');

      // Generate filename with date
      const date = new Date().toISOString().split('T')[0];
      const filename = `Voters_Data_${date}.xlsx`;

      // Write file using file-saver for better compatibility
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);

      // Show success message
      alert(`Successfully exported ${exportData.length} voter records to ${filename}`);

    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setLoading(false);
      setShowExportModal(false);
      setExportPassword('');
    }
  }, [allVoters]);

  // Pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      processAndFilterVoters(newPage, searchTerm, filters);
    }
  }, [totalPages, processAndFilterVoters, searchTerm, filters]);

  // Stats calculation
  const stats = {
    total: totalCount,
    filtered: voters.length,
    filteredOut: totalCount - voters.length
  };

  // Quick search suggestions
  const quickSearchSuggestions = useMemo(() => {
    const suggestions = new Set();
    
    // Add some common booth numbers
    boothsList.slice(0, 5).forEach(booth => {
      suggestions.add(`Booth ${booth.number}`);
    });
    
    // Add some common locations
    suggestions.add('मुंबई');
    suggestions.add('Mumbai');
    suggestions.add('पुणे');
    suggestions.add('Pune');
    
    return Array.from(suggestions);
  }, [boothsList]);

  const StatsCard = useCallback(({ icon: Icon, label, value, color, subtitle }) => (
    <div className="group bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 hover:border-orange-200">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color === 'text-orange-600' ? 'bg-orange-50' : color === 'text-blue-600' ? 'bg-blue-50' : 'bg-green-50'} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`text-lg ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">
            <TranslatedText>{label}</TranslatedText>
          </p>
          <p className={`text-xl font-bold ${color} truncate`}>{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5"><TranslatedText>{subtitle}</TranslatedText></p>}
        </div>
      </div>
    </div>
  ), []);

  // FIXED: CONDITIONAL RETURNS - Only show download screen if data check is complete AND no data is available
  if (!dataCheckComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-3 border-gray-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-3 border-transparent border-t-orange-500 rounded-full absolute top-0 left-0 animate-spin"></div>
            <FiLoader className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-orange-500 text-lg animate-pulse" />
          </div>
          <div className="text-gray-600 text-sm font-medium mt-4">
            <TranslatedText>Checking for voter data...</TranslatedText>
          </div>
        </div>
      </div>
    );
  }

  // Only show download screen if we've completed data check and found no data
  if (!jsonDataLoaded && dataCheckComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
        <div className="bg-white shadow-md p-6 rounded-xl max-w-sm">
          <FiDownload className="text-5xl text-orange-500 mx-auto mb-3 animate-bounce" />
          <h2 className="text-xl font-semibold mb-2 text-gray-800">
            <TranslatedText>Download Voter Data</TranslatedText>
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            <TranslatedText>Please download all voter data before using the app offline.</TranslatedText>
          </p>
          <button
            onClick={handleDownloadVoterJson}
            disabled={downloadingJson}
            className={`px-5 py-3 rounded-lg w-full font-medium text-white transition-all duration-200 ${downloadingJson
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-600"
              }`}
          >
            {downloadingJson ? <TranslatedText>Downloading...</TranslatedText> : <TranslatedText>Download Voter Data</TranslatedText>}
          </button>
        </div>
      </div>
    );
  }

  if (contextLoading && !initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-3 border-gray-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-3 border-transparent border-t-orange-500 rounded-full absolute top-0 left-0 animate-spin"></div>
            <FiLoader className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-orange-500 text-lg animate-pulse" />
          </div>
          <div className="text-gray-600 text-sm font-medium mt-4">
            <TranslatedText>Starting your app... Please wait while we download all voter data</TranslatedText>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            <TranslatedText>This only happens on first visit</TranslatedText>
          </p>
        </div>
      </div>
    );
  }

  if (loading && voters.length === 0 && initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-3 border-gray-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-3 border-transparent border-t-orange-500 rounded-full absolute top-0 left-0 animate-spin"></div>
            <FiLoader className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-orange-500 text-lg animate-pulse" />
          </div>
          <div className="text-gray-600 text-sm font-medium mt-4">
            <TranslatedText>Filtering voters...</TranslatedText>
          </div>
        </div>
      </div>
    );
  }

  // MAIN COMPONENT RETURN
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Search & Controls Bar */}
      <div className={`bg-white border-b border-gray-200 transition-all duration-300 z-40 ${isSticky ? 'fixed top-16 left-0 right-0 shadow-md' : 'relative'
        }`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            {/* Search Bar Component */}
            <div className="flex-1">
              <Suspense fallback={
                <div className="flex items-center justify-center h-12 bg-gray-100 rounded-xl">
                  <FiLoader className="animate-spin text-orange-500 mr-2" />
                  <span className="text-gray-600 text-sm">Loading search...</span>
                </div>
              }>
                <SearchBar
                  placeholder="Search by name, voter ID, booth, address... (English/Marathi)"
                  onSearch={handleSearch}
                  initialValue={searchTerm}
                  quickFilters={quickSearchSuggestions}
                  size="medium"
                  showClearButton={true}
                  showFiltersButton={false}
                  className="w-full"
                />
              </Suspense>
              {searchTerm && (
                <div className="text-xs text-gray-500 mt-2 px-1">
                  Found {searchFilteredVoters.length} voters matching "{searchTerm}"
                </div>
              )}
            </div>

            <div className="hidden md:flex gap-2">
              {/* Export Button */}
              <button
                onClick={handleExport}
                className="px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all duration-200 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
              >
                <FiDownload className="text-lg" />
                <span className="hidden sm:inline"><TranslatedText>Export</TranslatedText></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`px-4 ${isSticky ? 'pt-10' : 'pt-0'} pb-0`}>
        {/* Data Status Indicator */}
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {initialized && (
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>
                  <TranslatedText>Total Voters: </TranslatedText> {totalVoters.toLocaleString()}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Voter List */}
        {(activeTab === 'voters' || activeTab === 'overview') && (
          <Suspense fallback={
            <div className="flex justify-center items-center py-12">
              <FiLoader className="animate-spin text-orange-500 text-xl mr-2" />
              <span className="text-gray-600 text-sm"><TranslatedText>Loading voters...</TranslatedText></span>
            </div>
          }>
            <VoterList voters={searchFilteredVoters} />
          </Suspense>
        )}

        {/* Pagination Controls - Bottom */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FiChevronLeft className="text-lg" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = currentPage <= 3 ? i + 1 :
                    currentPage >= totalPages - 2 ? totalPages - 4 + i :
                      currentPage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FiChevronRight className="text-lg" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating buttons (mobile) */}
      <div className="fixed bottom-15 right-5 flex flex-col gap-3 md:hidden z-50">
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="px-4 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all duration-200 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
        >
          <FiDownload className="text-lg" />
          <span className="hidden sm:inline"><TranslatedText>Export</TranslatedText></span>
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              <TranslatedText>Export Data</TranslatedText>
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              <TranslatedText>Enter password to export voter data</TranslatedText>
            </p>
            <input
              type="password"
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all duration-200 mb-3 text-sm"
            />
            {passwordError && (
              <p className="text-red-500 text-sm mb-3">{passwordError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportPassword('');
                  setPasswordError('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
              >
                <TranslatedText>Cancel</TranslatedText>
              </button>
              <button
                onClick={verifyPasswordAndExport}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all duration-200 text-sm font-medium"
              >
                <TranslatedText>Export</TranslatedText>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;