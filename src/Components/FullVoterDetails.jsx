import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../Firebase/config';
import { doc, getDoc, updateDoc, setDoc, collection } from 'firebase/firestore';
import VoterSurvey from './VoterSurvey';
import FamilyManagement from './FamilyManagement';
import BluetoothPrinter from './BluetoothPrinter';
import {
  FiArrowLeft,
  FiUser,
  FiUsers,
  FiClipboard,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import TranslatedText from './TranslatedText';

// Import VoterContext
import { VoterContext } from '../Context/VoterContext';
import { useCandidate } from '../Context/CandidateContext'; // ✅ Updated import
import { dbLocal, putDynamic, getDynamic, enqueuePendingWrite } from '../libs/localdb'; // ✅ Use your existing exports


const FullVoterDetails = () => {
  const { voterId } = useParams();
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);

  const [surveyData, setSurveyData] = useState({
    gender: '',
    dob: '',
    whatsapp: '',
    phone: '',
    city: 'Akola',
    town: '',
    colony: '',
    address: '',
    category: '',
    education: '',
    occupation: '',
    issues: '',
    remarks: ''
  });

  // Use VoterContext for offline data
  const { voters: allVotersFromContext, loading: contextLoading, initialized } = useContext(VoterContext);

  const [voter, setVoter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [dynamic, setDynamic] = useState({}); // holds hasVoted, supportStatus, etc.

  const { candidateInfo } = useCandidate();

  useEffect(() => {
    if (voter) {
      // Load existing survey data from voter prop (if any)
      const existingData = {};
      Object.keys(surveyData).forEach(key => {
        if (voter[key] !== undefined) {
          existingData[key] = voter[key];
        }
      });
      setSurveyData(prev => ({ ...prev, ...existingData }));

      // Load previous survey data from local IndexedDB (faster than Firestore)
      const loadLocalSurvey = async () => {
        if (!voter?.voterId) return;
        try {
          const localSurvey = await dbLocal.voter_surveys.get(voter.voterId);
          if (localSurvey) {
            setSurveyData(prev => ({ ...prev, ...localSurvey }));
          }
        } catch (error) {
          console.error('Error loading local survey data:', error);
        }
      };
      loadLocalSurvey();
    }
  }, [voter]);

  // Initialize IndexedDB - No need for separate init with Dexie
  useEffect(() => {
    // Dexie automatically initializes when you use it
    console.log("✅ Dexie IndexedDB is ready to use");
  }, []);

  // Cleanup function for abort controller
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load voter from VoterContext INSTANTLY
  const loadVoterFromContext = useCallback(() => {
    if (initialized && allVotersFromContext && allVotersFromContext.length > 0) {
      const contextVoter = allVotersFromContext.find(v => v.id === voterId);
      if (contextVoter) {
        const voterData = { id: voterId, ...contextVoter };
        setVoter(voterData);
        setUsingCachedData(true);
        return voterData;
      }
    }
    return null;
  }, [initialized, allVotersFromContext, voterId]);

  // ✅ Load dynamic data from IndexedDB
  const loadDynamicData = useCallback(async (voterData) => {
    if (!voterData?.voterId) return voterData;

    try {
      // Try to load dynamic data from IndexedDB using your getDynamic helper
      const dynamicData = await getDynamic(voterData.voterId);

      if (dynamicData) {
        // Merge dynamic data with voter data
        const mergedData = {
          ...voterData,
          hasVoted: dynamicData.hasVoted || false,
          supportStatus: dynamicData.supportStatus || 'unknown',
        };
        setDynamic(dynamicData);
        return mergedData;
      }
    } catch (error) {
      console.warn('Failed to load dynamic data from IndexedDB:', error);
    }

    return voterData;
  }, []);

  const loadVoterDetails = useCallback(async (forceRefresh = false) => {
    // Try to load from VoterContext first for instant display
    if (!forceRefresh) {
      const contextVoter = loadVoterFromContext();
      if (contextVoter) {
        // We have the main voter, now load dynamic data and family members
        const voterWithDynamicData = await loadDynamicData(contextVoter);
        setVoter(voterWithDynamicData);
        await loadFamilyMembers(voterWithDynamicData);
        return;
      }
    }

    // Fallback to Firestore if not found in context or force refresh requested
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setUsingCachedData(false);

    try {
      const voterRef = doc(db, 'voters', voterId);
      const docSnap = await Promise.race([
        getDoc(voterRef),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);

      if (!abortControllerRef.current || !abortControllerRef.current.signal.aborted) {
        if (docSnap.exists && typeof docSnap.exists === 'function' ? docSnap.exists() : docSnap.exists) {
          const data = docSnap.data ? docSnap.data() : {};
          let voterData = { id: voterId, ...data };

          // Load dynamic data
          voterData = await loadDynamicData(voterData);
          setVoter(voterData);

          // Also try to load from Firestore voter_dynamic collection as fallback
          try {
            const dynRef = doc(collection(db, 'voter_dynamic'), String(voterData.voterId || voterId));
            const dynSnap = await getDoc(dynRef);
            if (dynSnap.exists()) {
              const dyn = dynSnap.data();
              setDynamic(dyn);
              setVoter(prev => ({ ...prev, ...dyn }));
              // cache locally using your putDynamic helper
              await putDynamic({
                id: voterData.voterId || voterId, // ✅ Important: include 'id' field
                voterId: voterData.voterId || voterId,
                ...dyn
              });
            }
          } catch (dynErr) {
            console.warn('Failed to load dynamic data from Firestore:', dynErr);
          }

          // Load family members
          await loadFamilyMembers(voterData);
          setRetryCount(0);
        } else {
          setVoter(null);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

      console.error('Error loading voter details:', error);
      setError(error.message);

      // Auto-retry logic for low internet scenarios
      if (retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadVoterDetails();
        }, 1000 * (retryCount + 1));
      }
    } finally {
      setLoading(false);
    }
  }, [voterId, retryCount, loadVoterFromContext, loadDynamicData]);

  const loadFamilyMembers = useCallback(async (voterData) => {
    if (!voterData.familyMembers || Object.keys(voterData.familyMembers).length === 0) {
      setFamilyMembers([]);
      return;
    }

    try {
      const members = [];
      const memberIds = Object.keys(voterData.familyMembers);

      // Try to load family members from VoterContext first
      for (const memberId of memberIds) {
        let memberData = null;

        // Check VoterContext first
        if (initialized && allVotersFromContext && allVotersFromContext.length > 0) {
          const contextMember = allVotersFromContext.find(v => v.id === memberId);
          if (contextMember) {
            memberData = { id: memberId, ...contextMember };
          }
        }

        // If not found in context, try Firestore
        if (!memberData) {
          try {
            const memberRef = doc(db, 'voters', memberId);
            const memberDoc = await Promise.race([
              getDoc(memberRef),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);

            if (memberDoc && (typeof memberDoc.exists === 'function' ? memberDoc.exists() : memberDoc.exists)) {
              memberData = { id: memberId, ...(memberDoc.data ? memberDoc.data() : {}) };
            }
          } catch (memberError) {
            console.warn(`Failed to load family member ${memberId}:`, memberError);
            // Create a placeholder for missing members
            memberData = {
              id: memberId,
              name: 'Unknown Member',
              voterId: memberId,
              boothNumber: 'N/A'
            };
          }
        }

        if (memberData) {
          members.push(memberData);
        }
      }

      setFamilyMembers(members);
    } catch (error) {
      console.error('Error loading family members:', error);
      setFamilyMembers([]);
    }
  }, [initialized, allVotersFromContext]);

  // ✅ Save dynamic data (voted, support level) in Firestore + local DB
  const saveDynamicData = useCallback(async (field, value) => {
    const vId = voter?.voterId || voterId;
    if (!vId) {
      console.warn('No voterId available for dynamic save');
      return;
    }

    const payload = {
      id: vId, // ✅ Important: Use 'id' as keyPath for IndexedDB
      voterId: vId,
      [field]: value,
      updatedAt: Date.now()
    };

    // optimistic UI
    setVoter(prev => ({ ...prev, [field]: value }));
    setDynamic(prev => ({ ...prev, [field]: value, voterId: vId }));

    try {
      // 1) Save to Firestore in voter_dynamic collection (id = voterId)
      const dynRef = doc(collection(db, 'voter_dynamic'), String(vId));
      await setDoc(dynRef, payload, { merge: true });

      // 2) Save to local Dexie store using your putDynamic helper
      await putDynamic(payload);

      console.log('✅ Dynamic saved for', vId, field, value);
    } catch (err) {
      console.warn('❌ Failed to save dynamic data, queueing locally', err);
      // fallback: enqueue pending write using your enqueuePendingWrite helper
      try {
        await enqueuePendingWrite('voter_dynamic', vId, { ...payload });
        // Still save locally for immediate UI
        await putDynamic(payload);
      } catch (e) {
        console.error('Failed to queue pending write', e);
      }
      // keep optimistic UI but show warn to user
      alert('Saved locally — will sync when network available.');
    }
  }, [voter, voterId]);

  const updateVoterField = useCallback(async (field, value) => {
    try {
      // Optimistic update for better UX
      setVoter(prev => ({ ...prev, [field]: value }));

      const voterDocRef = doc(db, 'voters', voterId);
      await updateDoc(voterDocRef, { [field]: value });
    } catch (error) {
      console.error('Error updating voter:', error);
      // Revert optimistic update on error
      setVoter(prev => ({ ...prev, [field]: voter[field] }));
      setError('Failed to update. Please check your connection.');
    }
  }, [voterId, voter]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    loadVoterDetails(true); // Force refresh
  }, [loadVoterDetails]);

  // Load voter details when component mounts or context becomes available
  useEffect(() => {
    if (initialized) {
      loadVoterDetails();
    }
  }, [loadVoterDetails, initialized]);

  // Show initial loading only if context is not initialized
  if (contextLoading && !initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">
            <TranslatedText>Starting your app... Please wait while we download all voter data</TranslatedText>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            <TranslatedText>This only happens on first visit</TranslatedText>
          </p>
        </div>
      </div>
    );
  }

  if (loading && !voter && !usingCachedData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-300 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">
            <TranslatedText>Loading voter details...</TranslatedText>
            {retryCount > 0 && (
              <span className="block text-xs text-orange-600 mt-1">
                <TranslatedText>Attempt</TranslatedText> {retryCount + 1}/3
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (error && !voter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3 text-gray-400">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            <TranslatedText>Connection Error</TranslatedText>
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            <TranslatedText>{error}</TranslatedText>
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <TranslatedText>Retry</TranslatedText>
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
            >
              <TranslatedText>Back to Dashboard</TranslatedText>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!voter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3 text-gray-400">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            <TranslatedText>Voter Not Found</TranslatedText>
          </h2>
          <button
            onClick={() => navigate('/')}
            className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <TranslatedText>Back to Dashboard</TranslatedText>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
            >
              <FiArrowLeft className="text-lg" />
              <span className="text-sm font-medium">
                {/* <TranslatedText>Back</TranslatedText> */}
              </span>
            </button>

            {/* Tab Navigation */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                { id: 'details', icon: FiUser, label: 'Details' },
                { id: 'family', icon: FiUsers, label: 'Family' },
                { id: 'survey', icon: FiClipboard, label: 'Survey' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <tab.icon className="text-sm" />
                  <span><TranslatedText>{tab.label}</TranslatedText></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-center">
            <span className="text-red-800 text-sm">
              <TranslatedText>{error}</TranslatedText>
            </span>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              <TranslatedText>Dismiss</TranslatedText>
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          {/* Candidate Branding Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 text-center">
            <div className="text-sm font-semibold opacity-90 mb-1">
              <TranslatedText>{candidateInfo.party}</TranslatedText>
            </div>
            <div className="text-xl font-bold mb-1">
              <TranslatedText>{candidateInfo.name}</TranslatedText>
            </div>
            <div className="text-xs opacity-80">
              <TranslatedText>{candidateInfo.area}</TranslatedText>
            </div>
          </div>

          <div className="p-5">
            {/* Voter Details Tab */}
            {activeTab === 'details' && (
              <div>
                <div className="text-center mb-6 border-b border-gray-200 pb-4">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    <TranslatedText>{voter.name}</TranslatedText>
                  </h1>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-6">
                  <DetailRow label="Voter ID" value={voter.voterId} />
                  <DetailRow label="Serial Number" value={voter.serialNumber} />
                  <DetailRow label="Booth Number" value={voter.boothNumber} />
                  <DetailRow
                    label="Age & Gender"
                    value={`${voter.age} | ${voter.gender}`}
                  />
                  {/* ✅ WhatsApp Number Display (Readonly) */}
                  <DetailRow
                    label="WhatsApp Number"
                    value={surveyData.whatsapp || 'Not available'}
                  />
                  <DetailRow
                    label="Phone Number"
                    value={surveyData.phone || 'Not available'}
                  />
                  <DetailRow
                    label="Polling Station Address"
                    value={voter.pollingStationAddress}
                    isFullWidth
                  />
                  <DetailRow
                    label="Yadi Bhag / Address"
                    value={voter.yadiBhagAddress}
                    isFullWidth
                  />
                </div>


                {/* 🟢 Dynamic Voter Controls (Offline-Synced) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
                  {/* ✅ Has Voted Toggle */}
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!(voter.hasVoted || dynamic.hasVoted)}
                        onChange={(e) => saveDynamicData('hasVoted', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-green-500 relative">
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${(voter.hasVoted || dynamic.hasVoted) ? 'translate-x-5' : ''}`}></div>
                      </div>
                    </label>
                    <span className="text-sm font-medium text-gray-700">
                      {(voter.hasVoted || dynamic.hasVoted)
                        ? <TranslatedText>Voted ✓</TranslatedText>
                        : <TranslatedText>Mark as Voted</TranslatedText>}
                    </span>
                  </div>

                  {/* ✅ Support Level Dropdown */}
                  <select
                    value={dynamic.supportStatus ?? voter.supportStatus ?? 'unknown'}
                    onChange={(e) => saveDynamicData('supportStatus', e.target.value)}
                    className={`text-sm font-medium rounded-full px-4 py-2 border shadow-sm transition-all
                      ${(dynamic.supportStatus || voter.supportStatus) === 'supporter'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : (dynamic.supportStatus || voter.supportStatus) === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                          : (dynamic.supportStatus || voter.supportStatus) === 'not-supporter'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                      }`}
                  >
                    <option value="unknown"><TranslatedText>Support Level</TranslatedText></option>
                    <option value="supporter"><TranslatedText>Strong</TranslatedText></option>
                    <option value="medium"><TranslatedText>Medium</TranslatedText></option>
                    <option value="not-supporter"><TranslatedText>Not</TranslatedText></option>
                  </select>
                </div>

                <BluetoothPrinter
                  voter={voter}
                  familyMembers={familyMembers}
                  candidateInfo={candidateInfo}
                />
              </div>


            )}

            {/* Family Tab */}
            {activeTab === 'family' && (
              <FamilyManagement
                voter={voter}
                familyMembers={familyMembers}
                onUpdate={loadVoterDetails}
                candidateInfo={candidateInfo}
              />
            )}

            {/* Survey Tab */}
            {activeTab === 'survey' && (
              <VoterSurvey
                voter={voter}
                onUpdate={loadVoterDetails}
              />
            )}
          </div>
        </div>

        {/* Bluetooth Printer Section */}
        {/* <BluetoothPrinter
          voter={voter}
          familyMembers={familyMembers}
          candidateInfo={candidateInfo}
        /> */}
      </div>
    </div>
  );
};

const DetailRow = ({ label, value, isFullWidth = false }) => (
  <div className={`flex ${isFullWidth ? 'flex-col' : 'justify-between items-center'} border-b border-gray-200 pb-3`}>
    <span className="font-medium text-gray-700 text-sm">
      <TranslatedText>{label}</TranslatedText>
    </span>
    <span className={`text-gray-900 text-sm ${isFullWidth ? 'mt-2 leading-relaxed' : ''}`}>
      {value || <TranslatedText>N/A</TranslatedText>}
    </span>
  </div>
);

export default FullVoterDetails;