// FilterPage.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../Firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import {
  FiHome, FiCheckCircle, FiPhone, FiUser, FiList,
  FiChevronRight, FiUsers, FiBarChart2, FiDownload,
  FiMap, FiMapPin, FiSearch
} from 'react-icons/fi';
import TranslatedText from './TranslatedText';
import VoterList from './VoterList';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Dexie from 'dexie';
import Sanscript from 'sanscript';
import SearchBar from './SearchBar';

// ---------- Dexie setup ----------
const dbLocal = new Dexie('JanNetaaDB_v1');
dbLocal.version(1).stores({
  voters: 'voterId, name, age, gender, boothNumber, prabhag, lastUpdated',
  voter_surveys: 'voterId, phone, whatsapp, city, education, occupation, category, issues, remarks, supportStatus, updatedAt',
  voters_dynamic: 'voterId, updatedAt, hasVoted, supportStatus, id',
  pending_writes: '++id, collection, docId, payload, createdAt, attempts'
});

// ---------- Helpers ----------
const marathiToEnglishDigits = (s = '') => {
  if (!s) return '';
  const map = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
  return s.toString().split('').map(ch => map[ch] ?? ch).join('');
};

const cleanPhone = (raw = '') => raw ? raw.toString().replace(/[^\d]/g, '') : '';

const normalizeGender = (g = '') => {
  if (!g) return '';
  const gg = g.toString().toLowerCase().trim();
  if (/\bmale\b/i.test(gg) || gg === 'पुरुष') return 'male';
  if (/\bfemale\b/i.test(gg) || gg === 'स्त्री') return 'female';
  return gg;
};

function normalizeRecord(data = {}) {
  const voterIdRaw = (data.voterId || data.VoterId || data.id || '').toString().trim();
  const voterId = voterIdRaw ? voterIdRaw.toUpperCase() : '';

  const rawName = (data.name || data.Name || '').toString().trim();
  const parts = rawName.split(' ').map(p => p.trim()).filter(Boolean);
  const surname = parts.length > 0 ? parts[0] : '';
  const name = rawName;

  const rawAge = data.age || data.Age || '';
  let age = 0;
  try {
    const conv = marathiToEnglishDigits(String(rawAge));
    age = parseInt(conv.replace(/[^\d]/g, ''), 10) || 0;
  } catch (e) {
    age = 0;
  }

  const phone = cleanPhone(data.phone || data.whatsapp || data.mobile || '');
  const boothNumber = (data.boothNumber || data.booth || data.Booth || '').toString().trim();
  const prabhag = (data.prabhag || data.Prabhag || data.ward || data.wardNo || '').toString().trim();
  const yadiBhagAddress = (data.yadiBhagAddress || data.yadiAddress || data.address || '').toString().trim();

  const hv = data.hasVoted ?? data.voted ?? data.votedStatus ?? false;
  const hasVoted = (hv === true) || (hv === 'true') || (hv === 'yes') || (hv === 1) || (hv === '1');

  return {
    id: voterId || `tmp_${Math.random().toString(36).slice(2, 9)}`,
    voterId,
    name,
    surname,
    serialNumber: data.serialNumber || data.serial || '',
    age,
    gender: normalizeGender(data.gender || data.Gender || ''),
    boothNumber,
    prabhag,
    yadiBhagAddress,
    pollingStationAddress: (data.pollingStationAddress || data.pollingStation || data.pollingStationName || '').toString().trim(),
    village: (data.village || data.area || '').toString().trim(),
    fatherName: (data.fatherName || data.father || '').toString().trim(),
    phone,
    hasVoted,
    supportStatus: (data.supportStatus || data.support || '').toString().toLowerCase() || 'unknown',
    lastUpdated: data.lastUpdated || data.updatedAt || Date.now()
  };
}

// Merge static + survey + dynamic (dynamic overrides)
const mergeStaticWithDynamic = (staticArr = [], surveys = [], dynamics = []) => {
  const surveyMap = new Map(surveys.map(s => [String((s.voterId || '')).trim().toUpperCase(), s]));
  const dynamicMap = new Map(dynamics.map(d => [String((d.voterId || '')).trim().toUpperCase(), d]));
  return staticArr.map(s => {
    const id = String((s.voterId || s.id || s.VoterId || '')).trim().toUpperCase();
    const survey = surveyMap.get(id) || {};
    const dyn = dynamicMap.get(id) || {};
    const merged = { ...s, ...survey, ...dyn };
    return normalizeRecord(merged);
  });
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

// ---------- Component ----------
const FilterPage = () => {
  const [voters, setVoters] = useState([]);
  const [filteredVoters, setFilteredVoters] = useState([]);
  const [searchFilteredVoters, setSearchFilteredVoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedBooth, setSelectedBooth] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('');
  const [selectedSurname, setSelectedSurname] = useState('');
  const [selectedPrabhag, setSelectedPrabhag] = useState('');
  const [selectedYadiBhag, setSelectedYadiBhag] = useState('');
  const [page, setPage] = useState(1);
  const [alphabetLetters, setAlphabetLetters] = useState(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')));
  const votersPerPage = 50;

  // Enhanced categories with new filters
  const categories = [
    { id: 'booth', title: 'Booth Wise Voting List', icon: FiHome, color: 'bg-orange-500', description: 'View voters by polling booth' },
    { id: 'prabhag', title: 'Ward Wise List', icon: FiMap, color: 'bg-orange-500', description: 'View voters by Prabhag' },
    { id: 'yadibhag', title: 'Yadi Bhag Address', icon: FiMapPin, color: 'bg-orange-500', description: 'View voters by Yadi Bhag Address' },
    { id: 'surname', title: 'According to Surname', icon: FiUsers, color: 'bg-orange-500', description: 'Voters grouped by surname' },
    { id: 'alphabet', title: 'Alphabet-wise', icon: FiUsers, color: 'bg-orange-500', description: 'A → Z grouping (transliteration)' },

    { id: 'voted', title: 'View Voted Voters', icon: FiCheckCircle, color: 'bg-orange-500', description: 'Voted Voters' },
    { id: 'withPhone', title: 'According to phone number', icon: FiPhone, color: 'bg-orange-500', description: 'Voters with phone numbers' },
    { id: 'male', title: 'Male Voters', icon: FiUser, color: 'bg-orange-500', description: 'All male voters' },
    { id: 'female', title: 'Female Voters', icon: FiUser, color: 'bg-orange-500', description: 'All female voters' },

    { id: 'duplicates', title: 'Duplicates', icon: FiList, color: 'bg-orange-500', description: 'Potential duplicate records' },
    { id: 'age', title: 'Age Wise', icon: FiBarChart2, color: 'bg-orange-500', description: 'Voters grouped by age ranges' },
  ];

  const ageGroups = [
    { id: '18-29', label: '18-29', min: 18, max: 29 },
    { id: '30-49', label: '30-49', min: 30, max: 49 },
    { id: '50-59', label: '50-59', min: 50, max: 59 },
    { id: '60+', label: '60+', min: 60, max: 150 }
  ];

  // Handle search
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setSearchFilteredVoters(filteredVoters);
    } else {
      const results = searchVoters(filteredVoters, term);
      setSearchFilteredVoters(results);
    }
    setPage(1);
  }, [filteredVoters]);

  // Update searchFilteredVoters when filteredVoters changes
  useEffect(() => {
    setSearchFilteredVoters(filteredVoters);
  }, [filteredVoters]);

  // Optimized data loading with local storage caching
  const ensureStaticLoaded = useCallback(async () => {
    // Check if we already have data in localStorage for faster loading
    const cachedData = localStorage.getItem('voters_static_cache');
    const cacheTimestamp = localStorage.getItem('voters_static_cache_timestamp');
    const isCacheValid = cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < (24 * 60 * 60 * 1000); // 24 hours cache

    if (cachedData && isCacheValid) {
      try {
        const parsedData = JSON.parse(cachedData);
        await dbLocal.voters.bulkPut(parsedData);
        console.log('📦 Loaded static data from cache');
        return;
      } catch (e) {
        console.warn('Cache load failed, fetching fresh data');
      }
    }

    const cnt = await dbLocal.voters.count();
    if (cnt > 0 && !isCacheValid) return;

    try {
      const resp = await fetch('/voter.json');
      if (!resp.ok) throw new Error('Failed to fetch /voter.json');
      const json = await resp.json();
      const arr = Array.isArray(json) ? json : (json.voters || []);
      const putArr = arr.map(item => ({
        ...item,
        voterId: String(item.voterId || item.id || item.VoterId || '').trim().toUpperCase(),
        name: item.name || item.Name || '',
        age: item.age || item.Age || '',
        gender: item.gender || item.Gender || '',
        boothNumber: item.boothNumber || item.booth || '',
        prabhag: item.prabhag || item.Prabhag || item.ward || item.wardNo || '',
        yadiBhagAddress: item.yadiBhagAddress || item.yadiAddress || item.address || ''
      }));

      if (putArr.length) {
        await dbLocal.voters.bulkPut(putArr);
        // Cache the data for faster future loads
        localStorage.setItem('voters_static_cache', JSON.stringify(putArr));
        localStorage.setItem('voters_static_cache_timestamp', Date.now().toString());
      }
    } catch (err) {
      console.error('ensureStaticLoaded error:', err);
    }
  }, []);

  // Optimized dynamic data fetching
  const fetchAndStoreDynamic = useCallback(async () => {
    try {
      const [surveysSnap, dynSnap] = await Promise.all([
        getDocs(collection(db, 'voter_surveys')),
        getDocs(collection(db, 'voters_dynamic'))
      ]);

      const surveys = surveysSnap.docs.map(d => {
        const doc = d.data() || {};
        return { ...doc, voterId: String(doc.voterId || doc.VoterId || d.id || '').trim().toUpperCase() };
      });

      const dynamics = dynSnap.docs.map(d => {
        const doc = d.data() || {};
        const rawHv = doc.hasVoted ?? doc.voted ?? false;
        const hasVotedBool = (rawHv === true) || (rawHv === 'true') || (rawHv === 'yes') || (rawHv === 1) || (rawHv === '1');
        return { ...doc, voterId: String(doc.voterId || doc.VoterId || d.id || '').trim().toUpperCase(), hasVoted: hasVotedBool };
      });

      await dbLocal.transaction('rw', dbLocal.voter_surveys, dbLocal.voters_dynamic, async () => {
        if (surveys.length) await dbLocal.voter_surveys.bulkPut(surveys);
        if (dynamics.length) await dbLocal.voters_dynamic.bulkPut(dynamics);
      });
    } catch (err) {
      console.warn('fetchAndStoreDynamic (offline mode):', err);
    }
  }, []);

  const refreshMerged = useCallback(async () => {
    if (initialLoad) setLoading(true);

    try {
      const [staticArr, surveysArr, dynArr] = await Promise.all([
        dbLocal.voters.toArray(),
        dbLocal.voter_surveys.toArray(),
        dbLocal.voters_dynamic.toArray()
      ]);

      const merged = mergeStaticWithDynamic(staticArr, surveysArr, dynArr);
      setVoters(merged);
      setFilteredVoters(merged);
      setSearchFilteredVoters(merged);
    } catch (err) {
      console.error('refreshMerged error:', err);
      setVoters([]);
      setFilteredVoters([]);
      setSearchFilteredVoters([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [initialLoad]);

  // Optimized useEffect for initial load
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (initialLoad) setLoading(true);

      try {
        // Load static data first (fast from cache)
        await ensureStaticLoaded();

        // Try to fetch dynamic data but don't block UI
        fetchAndStoreDynamic().catch(console.warn);

        // Refresh merged data
        if (mounted) await refreshMerged();
      } catch (err) {
        console.error('Initial load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    // Set up refresh interval only after initial load
    const id = setInterval(async () => {
      if (!initialLoad && mounted) {
        try {
          await fetchAndStoreDynamic();
          await refreshMerged();
        } catch (e) { }
      }
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [ensureStaticLoaded, fetchAndStoreDynamic, refreshMerged, initialLoad]);

  // ---------- Derived data (optimized) ----------
  const uniqueBooths = useMemo(() => {
    const s = new Set();
    voters.forEach(v => {
      if (v.boothNumber && String(v.boothNumber).trim() !== '') s.add(String(v.boothNumber));
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [voters]);

  const uniquePrabhags = useMemo(() => {
    const s = new Set();
    voters.forEach(v => {
      if (v.prabhag && String(v.prabhag).trim() !== '') s.add(String(v.prabhag));
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [voters]);

  const uniqueYadiBhags = useMemo(() => {
    const s = new Set();
    voters.forEach(v => {
      if (v.yadiBhagAddress && String(v.yadiBhagAddress).trim() !== '') s.add(String(v.yadiBhagAddress));
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [voters]);

  const surnameGroups = useMemo(() => {
    const map = {};
    voters.forEach(v => {
      const key = v.surname || 'Unknown';
      if (!map[key]) map[key] = [];
      map[key].push(v);
    });
    const sortedKeys = Object.keys(map).sort((a, b) => a.localeCompare(b));
    const obj = {};
    sortedKeys.forEach(k => obj[k] = map[k]);
    return obj;
  }, [voters]);

  const categoryCounts = useMemo(() => {
    return {
      booth: uniqueBooths.length,
      voted: voters.filter(v => v.hasVoted).length,
      notVoted: voters.filter(v => !v.hasVoted).length,
      withPhone: voters.filter(v => v.phone && v.phone.trim() !== '').length,
      withoutPhone: voters.filter(v => !v.phone || v.phone.trim() === '').length,
      male: voters.filter(v => v.gender === 'male').length,
      female: voters.filter(v => v.gender === 'female').length,
      surname: Object.keys(surnameGroups).filter(k => surnameGroups[k].length > 1).length,
      duplicates: 0,
      prabhag: uniquePrabhags.length,
      yadibhag: uniqueYadiBhags.length
    };
  }, [voters, uniqueBooths, surnameGroups, uniquePrabhags, uniqueYadiBhags]);

  // Pagination - use searchFilteredVoters for display
  const totalPages = Math.max(1, Math.ceil(searchFilteredVoters.length / votersPerPage));
  const canGoNext = page < totalPages;
  const canGoPrev = page > 1;
  const pagedVoters = useMemo(() => {
    const start = (page - 1) * votersPerPage;
    return searchFilteredVoters.slice(start, start + votersPerPage);
  }, [searchFilteredVoters, page]);

  // Alphabet letters setup
  useEffect(() => {
    (async () => {
      try {
        const arr = await dbLocal.voters.toArray();
        const set = new Set();
        arr.forEach(v => {
          const devName = v.name || '';
          let latin = '';
          try {
            latin = Sanscript.t(devName, 'devanagari', 'itrans') || '';
          } catch (e) {
            latin = devName;
          }
          const first = (latin || '').replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '#';
          set.add(first);
        });
        const letters = Array.from(set).sort();
        setAlphabetLetters(letters);
      } catch (err) {
        console.warn('alphabetLetters load failed:', err);
      }
    })();
  }, []);

  // ---------- Filter Functions ----------
  const getStaticByIds = useCallback(async (ids = []) => {
    if (!ids || ids.length === 0) return [];
    const upIds = ids.map(i => String(i).trim().toUpperCase());
    try {
      const res = await dbLocal.voters.where('voterId').anyOf(upIds).toArray();
      return res.map(normalizeRecord);
    } catch (err) {
      const all = await dbLocal.voters.toArray();
      return all.filter(a => upIds.includes(String(a.voterId).trim().toUpperCase())).map(normalizeRecord);
    }
  }, []);

  // Booth filter
  const applyBoothFilter = useCallback(async (booth) => {
    setLoading(true);
    try {
      if (!booth) {
        setFilteredVoters(voters);
      } else {
        const matchedRaw = await dbLocal.voters.where('boothNumber').equals(String(booth)).toArray();
        setFilteredVoters(matchedRaw.map(normalizeRecord));
      }
      setSelectedBooth(booth || '');
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyBoothFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, [voters]);

  // Prabhag filter
  const applyPrabhagFilter = useCallback(async (prabhag) => {
    setLoading(true);
    try {
      if (!prabhag) {
        setFilteredVoters(voters);
      } else {
        const matchedRaw = await dbLocal.voters.where('prabhag').equals(String(prabhag)).toArray();
        setFilteredVoters(matchedRaw.map(normalizeRecord));
      }
      setSelectedPrabhag(prabhag || '');
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyPrabhagFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, [voters]);

  // Yadi Bhag Address filter
  const applyYadiBhagFilter = useCallback(async (yadiBhag) => {
    setLoading(true);
    try {
      if (!yadiBhag) {
        setFilteredVoters(voters);
      } else {
        const allVoters = await dbLocal.voters.toArray();
        const matched = allVoters.filter(v =>
          v.yadiBhagAddress && v.yadiBhagAddress.includes(yadiBhag)
        );
        setFilteredVoters(matched.map(normalizeRecord));
      }
      setSelectedYadiBhag(yadiBhag || '');
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyYadiBhagFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, [voters]);

  // Voted filter (optimized)
  const applyVotedFilter = useCallback(async () => {
    console.log("🚀 Running View Voted Voters Filter...");
    setLoading(true);
    try {
      let dynamicRecords = [];

      try {
        const snap = await getDocs(collection(db, "voter_dynamic"));
        dynamicRecords = snap.docs.map((doc) => {
          const d = doc.data() || {};
          return {
            voterId: String(d.voterId || d.VoterId || doc.id || "").trim().toUpperCase(),
            hasVoted: !!d.hasVoted,
            updatedAt: d.updatedAt || Date.now(),
          };
        });

        console.log("📥 Firestore fetched:", dynamicRecords.length);
        await dbLocal.voters_dynamic.bulkPut(dynamicRecords);
      } catch (fireErr) {
        console.warn("⚠️ Firestore unreachable, using local cache:", fireErr);
        dynamicRecords = await dbLocal.voters_dynamic.toArray();
      }

      const votedDynamics = dynamicRecords.filter((d) => d.hasVoted === true);
      console.log("✅ Found votedDynamics:", votedDynamics.length);

      if (votedDynamics.length === 0) {
        setFilteredVoters([]);
        setPage(1);
        return;
      }

      const votedIds = votedDynamics.map((v) => v.voterId).filter(Boolean);
      const staticRecords = await dbLocal.voters
        .where("voterId")
        .anyOf(votedIds)
        .toArray();

      const dynamicMap = new Map(votedDynamics.map((d) => [d.voterId, d]));
      const merged = staticRecords.map((v) => {
        const dyn = dynamicMap.get(String(v.voterId).toUpperCase()) || {};
        return normalizeRecord({ ...v, ...dyn });
      });

      setFilteredVoters(merged);
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error("❌ applyVotedFilter failed:", err);
      setFilteredVoters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Other existing filter functions (phone, gender, surname, duplicates, age, alphabet)
  const applyPhoneFilter = useCallback(async () => {
    setLoading(true);
    try {
      const surveys = await dbLocal.voter_surveys.filter(s => (s.phone && String(s.phone).trim() !== '') || (s.whatsapp && String(s.whatsapp).trim() !== '')).toArray();
      const ids = surveys.map(s => String(s.voterId).trim().toUpperCase());
      const staticMatched = await getStaticByIds(ids);
      setFilteredVoters(staticMatched);
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyPhoneFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, [getStaticByIds]);

  const applyGenderFilter = useCallback(async (gender) => {
    setLoading(true);
    try {
      const matchedRaw = await dbLocal.voters.filter(v => {
        const gg = normalizeGender(v.gender || v.Gender || '');
        return gg === gender;
      }).toArray();
      setFilteredVoters(matchedRaw.map(normalizeRecord));
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyGenderFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const applySurnameList = useCallback(async (surname) => {
    setLoading(true);
    try {
      if (!surname) {
        setFilteredVoters([]);
      } else {
        const all = await dbLocal.voters.toArray();
        const matched = all.filter(v => {
          const firstToken = (v.name || '').split(' ')[0] || '';
          return firstToken === surname;
        }).map(normalizeRecord);
        setFilteredVoters(matched);
      }
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applySurnameList error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyDuplicatesFilter = useCallback(async (mode = 'name') => {
    setLoading(true);
    try {
      const all = await dbLocal.voters.toArray();
      const map = new Map();
      const dupes = [];
      all.forEach(v => {
        const key = (mode === 'voterId') ? String(v.voterId).trim().toUpperCase() : String(v.name || '').toLowerCase().trim();
        if (!key) return;
        if (map.has(key)) {
          const prev = map.get(key);
          if (Array.isArray(prev)) prev.push(v);
          else map.set(key, [prev, v]);
        } else map.set(key, v);
      });
      for (const val of map.values()) {
        if (Array.isArray(val) && val.length > 1) val.forEach(item => dupes.push(item));
      }
      setFilteredVoters(dupes.map(normalizeRecord));
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyDuplicatesFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyAgeFilter = useCallback(async (groupId = '') => {
    setLoading(true);
    try {
      const dyn = await dbLocal.voters_dynamic.toArray();
      const dynMap = new Map(dyn.map(d => [String(d.voterId).trim().toUpperCase(), d]));
      const staticArr = await dbLocal.voters.toArray();
      const merged = staticArr.map(s => normalizeRecord({ ...s, ...(dynMap.get(String(s.voterId).trim().toUpperCase()) || {}) }));
      if (!groupId) setFilteredVoters(merged);
      else {
        const g = ageGroups.find(x => x.id === groupId);
        if (g) setFilteredVoters(merged.filter(m => m.age >= g.min && m.age <= g.max));
        else if (groupId.endsWith('+')) {
          const min = parseInt(groupId.replace('+', ''), 10) || 60;
          setFilteredVoters(merged.filter(m => m.age >= min));
        } else setFilteredVoters(merged);
      }
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyAgeFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyAlphabetFilter = useCallback(async (letter = '') => {
    setLoading(true);
    try {
      const all = await dbLocal.voters.toArray();
      const mapped = all.map(v => {
        const devName = v.name || '';
        let latin = '';
        try {
          latin = Sanscript.t(devName, 'devanagari', 'itrans') || '';
        } catch (e) {
          latin = devName;
        }
        const first = (latin || '').replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '#';
        return { ...v, __latinFirst: first || '#' };
      });

      const groups = {};
      mapped.forEach(v => {
        const key = v.__latinFirst || '#';
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
      });

      const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

      if (!letter) {
        const groupedList = sortedKeys.flatMap(key => {
          return [
            { __isHeader: true, header: key },
            ...groups[key].map(normalizeRecord)
          ];
        });
        setFilteredVoters(groupedList);
      } else {
        const matched = (groups[letter] || []).map(normalizeRecord);
        setFilteredVoters(matched);
      }
      setPage(1);
      setSearchTerm(''); // Clear search when changing filter
    } catch (err) {
      console.error('applyAlphabetFilter error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Category handler with new filters
  const handleCategorySelect = useCallback((category) => {
    setActiveCategory(category);
    setSelectedBooth('');
    setSelectedAgeGroup('');
    setSelectedSurname('');
    setSelectedPrabhag('');
    setSelectedYadiBhag('');
    setPage(1);
    setSearchTerm(''); // Clear search when changing category

    if (['booth', 'age', 'surname', 'alphabet', 'prabhag', 'yadibhag'].includes(category.id)) {
      setFilteredVoters([]);
    } else {
      switch (category.id) {
        case 'voted': applyVotedFilter(); break;
        case 'withPhone': applyPhoneFilter(); break;
        case 'male': applyGenderFilter('male'); break;
        case 'female': applyGenderFilter('female'); break;
        case 'duplicates': applyDuplicatesFilter('name'); break;
        default: setFilteredVoters(voters); break;
      }
    }
  }, [applyVotedFilter, applyPhoneFilter, applyGenderFilter, applyDuplicatesFilter, voters]);

  // New filter handlers
  const handlePrabhagSelect = useCallback((prabhag) => {
    setSelectedPrabhag(prabhag);
    applyPrabhagFilter(prabhag);
  }, [applyPrabhagFilter]);

  const handleYadiBhagSelect = useCallback((yadiBhag) => {
    setSelectedYadiBhag(yadiBhag);
    applyYadiBhagFilter(yadiBhag);
  }, [applyYadiBhagFilter]);

  // Existing handlers
  const handleAgeGroupSelect = useCallback((gId) => { setSelectedAgeGroup(gId); applyAgeFilter(gId); }, [applyAgeFilter]);
  const handleBoothSelect = useCallback((b) => { setSelectedBooth(b); applyBoothFilter(b); }, [applyBoothFilter]);
  const handleSurnameSelect = useCallback((s) => { setSelectedSurname(s); applySurnameList(s); }, [applySurnameList]);
  const handleAlphabetSelect = useCallback((letter) => { applyAlphabetFilter(letter); }, [applyAlphabetFilter]);

  // Export function
  const handleExportExcel = useCallback(async () => {
    const dataToExport = searchTerm ? searchFilteredVoters : filteredVoters;
    if (!dataToExport || dataToExport.length === 0) { alert('No data to export.'); return; }
    const password = prompt('Enter password to export data:');
    if (password !== 'admin8668722207') { alert('Incorrect password!'); return; }

    const exportData = dataToExport.map(v => ({
      'Voter ID': v.voterId, 'Name': v.name, 'Surname': v.surname, 'Serial Number': v.serialNumber,
      'Age': v.age, 'Gender': v.gender, 'Booth Number': v.boothNumber, 'Prabhag': v.prabhag,
      'Polling Station': v.pollingStationAddress, 'Yadi Bhag Address': v.yadiBhagAddress, 'Village': v.village,
      'Father Name': v.fatherName, 'Phone': v.phone, 'Voted': v.hasVoted ? 'Yes' : 'No', 'Support Status': v.supportStatus
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Voters');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `VoterData_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [filteredVoters, searchFilteredVoters, searchTerm]);

  // Quick search suggestions
  const quickSearchSuggestions = useMemo(() => {
    const suggestions = new Set();
    
    // Add some common booth numbers
    uniqueBooths.slice(0, 5).forEach(booth => {
      suggestions.add(`Booth ${booth}`);
    });
    
    // Add some common prabhags
    uniquePrabhags.slice(0, 5).forEach(prabhag => {
      suggestions.add(`Ward ${prabhag}`);
    });
    
    // Add some common surnames from the data
    Object.keys(surnameGroups).slice(0, 5).forEach(surname => {
      if (surname !== 'Unknown') {
        suggestions.add(surname);
      }
    });
    
    return Array.from(suggestions);
  }, [uniqueBooths, uniquePrabhags, surnameGroups]);

  // Render
  if (loading && initialLoad) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading voter data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-3">
        {!activeCategory ? (
          <div className="space-y-2">
            {categories.map((category) => {
              const IconComponent = category.icon;
              const count = categoryCounts[category.id] || 0;
              return (
                <div
                  key={category.id}
                  onClick={() => handleCategorySelect(category)}
                  className="bg-white p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`${category.color} w-8 h-8 rounded-lg flex items-center justify-center`}>
                      <IconComponent className="text-white text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm">
                        <TranslatedText>{category.title}</TranslatedText>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {category.description}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => {
                      setActiveCategory(null);
                      setSelectedBooth('');
                      setSelectedSurname('');
                      setSelectedPrabhag('');
                      setSelectedYadiBhag('');
                      setFilteredVoters(voters);
                      setSearchTerm('');
                      setPage(1);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    <FiChevronRight className="text-gray-600 text-lg transform rotate-180" />
                  </button>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      <TranslatedText>{activeCategory.title}</TranslatedText>
                    </h3>
                    <p className="text-xs text-gray-500">
                      <TranslatedText>{activeCategory.description}</TranslatedText>
                      {searchFilteredVoters.length > 0 && (
                        <span> • {searchFilteredVoters.length} <TranslatedText>voters found</TranslatedText></span>
                      )}
                    </p>
                  </div>
                </div>
                {searchFilteredVoters.length > 0 && (
                  <button onClick={handleExportExcel} className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-3 py-1.5 rounded-lg flex items-center gap-1 ml-2">
                    <FiDownload className="text-xs" /><span>Export</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar - Always show when in a category */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
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
              {searchTerm && (
                <div className="text-xs text-gray-500 mt-2 px-1">
                  Found {searchFilteredVoters.length} voters matching "{searchTerm}"
                </div>
              )}
            </div>

            {/* Selection screens for new filters */}
            {activeCategory.id === 'prabhag' && !selectedPrabhag && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 px-1">Select Ward:</h4>
                <div className="flex flex-col gap-2">
                  {uniquePrabhags.map((prabhag) => {
                    const prabhagVotersCount = voters.filter(v => v.prabhag === prabhag).length;
                    const votedCount = voters.filter(v => v.prabhag === prabhag && v.hasVoted).length;
                    return (
                      <button key={prabhag} onClick={() => handlePrabhagSelect(prabhag)}
                        className="bg-white p-2 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors text-center">
                        <div className="text-md w-full font-medium text-gray-800"><TranslatedText>Ward wise</TranslatedText> {prabhag}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeCategory.id === 'yadibhag' && !selectedYadiBhag && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 px-1">Select Yadi Bhag Address:</h4>
                <div className="space-y-2">
                  {uniqueYadiBhags.map((yadiBhag) => {
                    const yadiVotersCount = voters.filter(v => v.yadiBhagAddress === yadiBhag).length;
                    const votedCount = voters.filter(v => v.yadiBhagAddress === yadiBhag && v.hasVoted).length;
                    return (
                      <button key={yadiBhag} onClick={() => handleYadiBhagSelect(yadiBhag)}
                        className="w-full bg-white p-3 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors text-left">
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 text-sm truncate">{yadiBhag}</div>
                          </div>
                          <FiChevronRight className="text-gray-400 text-sm flex-shrink-0 ml-2" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Existing selection screens (booth, age, surname, alphabet) */}
            {activeCategory.id === 'booth' && !selectedBooth && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 px-1">Select Booth:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {uniqueBooths.map((booth) => {
                    const boothVotersCount = voters.filter(v => v.boothNumber === booth).length;
                    const votedCount = voters.filter(v => v.boothNumber === booth && v.hasVoted).length;
                    return (
                      <button key={booth} onClick={() => handleBoothSelect(booth)}
                        className="bg-white p-2 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors text-center">
                        <div className="text-xs font-medium text-gray-800">Booth {booth}</div>
                        <div className="text-xs text-gray-500">{boothVotersCount} voters</div>
                        <div className="text-xs text-green-500">{votedCount} voted</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeCategory.id === 'age' && !selectedAgeGroup && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 px-1">Choose Age Group</h4>
                <div className="grid grid-cols-2 gap-2">
                  {ageGroups.map(group => (
                    <button key={group.id} onClick={() => handleAgeGroupSelect(group.id)}
                      className="bg-white p-2 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-center">
                      <div className="text-xs font-medium text-gray-800">{group.label}</div>
                      <div className="text-xs text-gray-500">Show voters in this group</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeCategory.id === 'surname' && !selectedSurname && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 px-1">Choose Surname</h4>
                <div className="space-y-2">
                  {Object.entries(surnameGroups)
                    .filter(([surname, arr]) => arr.length > 1)
                    .map(([surname, surnameVoters]) => (
                      <button key={surname} onClick={() => handleSurnameSelect(surname)}
                        className="w-full bg-white p-3 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors text-left">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-800 text-sm">{surname === 'Unknown' ? 'Unknown Surname' : surname}</div>
                            <div className="text-xs text-gray-500">{surnameVoters.length} people with this surname</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{surnameVoters.filter(v => v.hasVoted).length} voted</div>
                            <FiChevronRight className="text-gray-400 text-sm" />
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {activeCategory.id === 'alphabet' && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 px-1">Alphabet groups (A → Z)</h4>
                <div className="flex flex-wrap gap-2">
                  {alphabetLetters.map(letter => (
                    <button key={letter} onClick={() => handleAlphabetSelect(letter)}
                      className="text-xs bg-white p-2 rounded border border-gray-200 hover:border-orange-300">{letter}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Voter list */}
            {(selectedBooth || selectedAgeGroup || selectedSurname || selectedPrabhag || selectedYadiBhag ||
              (activeCategory.id && !['booth', 'age', 'surname', 'alphabet', 'prabhag', 'yadibhag'].includes(activeCategory.id)) ||
              (activeCategory.id === 'alphabet' && filteredVoters.length > 0)) && (
                <>
                  <VoterList voters={pagedVoters} loading={loading} />

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                      <button onClick={() => setPage(prev => Math.max(prev - 1, 1))} disabled={!canGoPrev}
                        className={`px-3 py-1 rounded text-sm ${canGoPrev ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}>Previous</button>
                      <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                      <button onClick={() => setPage(prev => Math.min(prev + 1, totalPages))} disabled={!canGoNext}
                        className={`px-3 py-1 rounded text-sm ${canGoNext ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}>Next</button>
                    </div>
                  )}
                </>
              )}

            {searchFilteredVoters.length === 0 && !['surname', 'alphabet', 'prabhag', 'yadibhag'].includes(activeCategory.id) && (
              <div className="text-center py-8">
                <div className="text-gray-300 text-4xl mb-2">📝</div>
                <p className="text-gray-500 text-sm">No voters found {searchTerm ? `matching "${searchTerm}"` : 'in this category'}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {searchTerm ? 'Try a different search term' : 'Try selecting a different category'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPage;