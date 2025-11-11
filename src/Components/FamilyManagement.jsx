import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useContext,
} from 'react';
import { db } from '../Firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FiUsers, FiPlus, FiX, FiSearch, FiPrinter, FiTrash2 } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import TranslatedText from './TranslatedText';
import BluetoothPrinter from './BluetoothPrinter';
import { VoterContext } from '../Context/VoterContext';
import {
  enqueuePendingWrite,
  getPendingWrites,
  syncPendingWrites,
} from '../libs/pendingWrites';
import VoterList from './VoterList';

const FamilyManagement = ({ voter, onUpdate, candidateInfo }) => {
  const { voters: allVotersFromContext, refreshVoters } = useContext(VoterContext);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [modalQuery, setModalQuery] = useState('');
  const [modalPage, setModalPage] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [loadingOperation, setLoadingOperation] = useState(false);
  const [voterData, setVoterData] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [pendingSyncItems, setPendingSyncItems] = useState([]);
  const [availableVoters, setAvailableVoters] = useState([]);
  const [filteredVoters, setFilteredVoters] = useState([]);

  const loadingRef = useRef(false);
  const modalDebounceRef = useRef(null);
  const pageSize = 20;
  const currentVoterId = useMemo(() => voter?.id || voter?.voterId, [voter]);

  // 🔸 Load pending offline writes
  const loadPendingSyncItems = async () => {
    try {
      const pending = await getPendingWrites();
      setPendingSyncItems(Array.isArray(pending) ? pending : []);
    } catch {
      setPendingSyncItems([]);
    }
  };

  // 🔸 Save data to voter_surveys collection
  const saveSurveyData = async (docId, payload) => {
    try {
      const ref = doc(db, 'voter_surveys', String(docId));
      await setDoc(ref, payload, { merge: true });
      console.log('✅ Saved to voter_surveys:', docId, payload);
      return true;
    } catch (error) {
      console.error('❌ Error saving to voter_surveys, using offline fallback:', error);
      enqueuePendingWrite(String(docId), 'voter_surveys', {
        ...payload,
        lastUpdated: Date.now(),
      });
      await loadPendingSyncItems();
      return false;
    }
  };

  // 🔸 Read voter_surveys document
  const loadSurveyDoc = async (docId) => {
    try {
      const ref = doc(db, 'voter_surveys', String(docId));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        console.log('📥 Loaded survey data for:', docId, data);
        return data;
      }
      console.log('📭 No survey data found for:', docId);
      return null;
    } catch (error) {
      console.error('❌ Error loading survey doc:', error);
      return null;
    }
  };

  // 🔸 Load voter + survey data
  useEffect(() => {
    if (!currentVoterId) return;
    let cancelled = false;

    const loadData = async () => {
      try {
        console.log('🔄 Loading data for voter:', currentVoterId);

        // Load base voter data
        const voterRef = doc(db, 'voters', String(currentVoterId));
        const voterSnap = await getDoc(voterRef);

        const baseData = voterSnap.exists()
          ? { ...voterSnap.data(), id: voterSnap.id }
          : { ...(voter || {}), id: currentVoterId };

        // Load survey data (family members and WhatsApp)
        const surveyData = await loadSurveyDoc(currentVoterId);

        // Handle family members array
        let familyMembersArray = [];
        if (surveyData?.familyMembers) {
          if (Array.isArray(surveyData.familyMembers)) {
            familyMembersArray = surveyData.familyMembers;
          } else if (typeof surveyData.familyMembers === 'object') {
            // Convert object to array
            familyMembersArray = Object.values(surveyData.familyMembers);
          }
        }

        console.log('👨‍👩‍👧‍👦 Final family members:', familyMembersArray);

        if (!cancelled) {
          setVoterData({
            ...baseData,
            familyMembers: familyMembersArray,
            whatsapp: surveyData?.whatsapp || ''
          });
          setFamilyMembers(familyMembersArray);
        }

      } catch (err) {
        console.error('❌ Error loading voter data:', err);
      }
    };

    loadData();
    return () => (cancelled = true);
  }, [currentVoterId, voter]);

  // 🔸 Available voters for add modal
  useEffect(() => {
    if (!allVotersFromContext?.length) {
      setAvailableVoters([]);
      return;
    }

    const existingIds = new Set();

    // Add current voter ID
    if (currentVoterId) existingIds.add(currentVoterId);

    // Add all family member voter IDs
    familyMembers.forEach(member => {
      if (member.voterId) existingIds.add(member.voterId);
      if (member.id) existingIds.add(member.id);
    });

    console.log('🚫 Excluded voter IDs:', Array.from(existingIds));

    const available = allVotersFromContext.filter(v => {
      const voterId = v.voterId || v.id;
      return !existingIds.has(voterId);
    });

    console.log('✅ Available voters:', available.length);
    setAvailableVoters(available);
  }, [allVotersFromContext, familyMembers, currentVoterId]);

  // 🔸 Search + pagination
  useEffect(() => {
    if (modalDebounceRef.current) clearTimeout(modalDebounceRef.current);

    modalDebounceRef.current = setTimeout(() => {
      const query = modalQuery.toLowerCase().trim();

      if (!query) {
        setFilteredVoters(availableVoters);
      } else {
        const filtered = availableVoters.filter(v =>
          v.name?.toLowerCase().includes(query) ||
          v.voterId?.toLowerCase().includes(query) ||
          v.serialNumber?.toString().includes(query)
        );
        setFilteredVoters(filtered);
      }

      setModalPage(1);
    }, 300);
  }, [modalQuery, availableVoters]);

  const totalPages = Math.max(1, Math.ceil(filteredVoters.length / pageSize));
  const paginatedVoters = useMemo(() => {
    const start = (modalPage - 1) * pageSize;
    return filteredVoters.slice(start, start + pageSize);
  }, [filteredVoters, modalPage]);

  // 🔸 Add family member with full details
  const addFamilyMember = async (memberVoter) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      console.log('➕ Adding family member:', memberVoter);

      // Create full member details object
      const memberDetails = {
        voterId: memberVoter.voterId || memberVoter.id,
        id: memberVoter.voterId || memberVoter.id, // Ensure id field exists
        name: memberVoter.name || 'Unknown',
        serialNumber: memberVoter.serialNumber || '',
        gender: memberVoter.gender || '',
        age: memberVoter.age || '',
        boothNumber: memberVoter.boothNumber || '',
        pollingStationAddress: memberVoter.pollingStationAddress || '',
        addedAt: Date.now()
      };

      // Load current survey data
      const currentSurvey = await loadSurveyDoc(currentVoterId);
      const currentFamily = Array.isArray(currentSurvey?.familyMembers)
        ? currentSurvey.familyMembers
        : [];

      // Check if already exists
      const alreadyExists = currentFamily.some(m =>
        m.voterId === memberDetails.voterId || m.id === memberDetails.voterId
      );

      if (alreadyExists) {
        alert('This voter is already added as a family member.');
        return;
      }

      // Update family members
      const updatedFamily = [...currentFamily, memberDetails];

      // Save to survey collection
      const success = await saveSurveyData(currentVoterId, {
        familyMembers: updatedFamily,
        lastUpdated: Date.now()
      });

      if (success) {
        // Update local state
        setVoterData(prev => ({ ...prev, familyMembers: updatedFamily }));
        setFamilyMembers(updatedFamily);

        // Refresh context if available
        if (refreshVoters) await refreshVoters();
        if (onUpdate) onUpdate();

        alert('Family member added successfully! ✅');
      } else {
        alert('Family member added offline. Will sync when connected.');
      }

    } catch (error) {
      console.error('❌ Error adding family member:', error);
      alert('Error adding family member: ' + error.message);
    } finally {
      loadingRef.current = false;
    }
  };

  // 🔸 Remove family member
  const removeFamilyMember = async (memberVoterId) => {
    if (!confirm('Are you sure you want to remove this family member?')) return;

    try {
      const currentSurvey = await loadSurveyDoc(currentVoterId);
      const currentFamily = Array.isArray(currentSurvey?.familyMembers)
        ? currentSurvey.familyMembers
        : [];

      const updatedFamily = currentFamily.filter(m =>
        m.voterId !== memberVoterId && m.id !== memberVoterId
      );

      await saveSurveyData(currentVoterId, {
        familyMembers: updatedFamily,
        lastUpdated: Date.now()
      });

      setVoterData(prev => ({ ...prev, familyMembers: updatedFamily }));
      setFamilyMembers(updatedFamily);

      if (refreshVoters) await refreshVoters();
      if (onUpdate) onUpdate();

      alert('Family member removed successfully.');
    } catch (error) {
      console.error('❌ Error removing family member:', error);
      alert('Error removing family member.');
    }
  };

  // 🔸 Manual sync
  const handleManualSync = async () => {
    try {
      setLoadingOperation(true);
      await syncPendingWrites();
      if (refreshVoters) await refreshVoters();
      await loadPendingSyncItems();
      alert('Sync completed successfully!');
    } catch (error) {
      alert('Sync failed: ' + error.message);
    } finally {
      setLoadingOperation(false);
    }
  };

  // 🔸 WhatsApp functionality
  const validatePhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const saveWhatsAppNumber = async (number) => {
    const cleaned = number.replace(/\D/g, '');
    const success = await saveSurveyData(currentVoterId, { whatsapp: cleaned });
    if (success) {
      setVoterData(prev => ({ ...prev, whatsapp: cleaned }));
    }
    return success;
  };

  const generateFamilyWhatsAppMessage = () => {
    if (!voterData || !familyMembers.length) return '';

    let message = `*${candidateInfo?.party || ''}*\n`;
    message += `*${candidateInfo?.name || ''}*\n\n`;

    message += `*कुटुंब तपशील*\n\n`;
    message += `*1) ${voterData.name}*\n`;
    message += `अनुक्रमांक: ${voterData.serialNumber || 'N/A'}\n`;
    message += `मतदार आयडी: ${voterData.voterId || 'N/A'}\n`;
    message += `बूथ क्र.: ${voterData.boothNumber || 'N/A'}\n`;
    message += `लिंग: ${voterData.gender || 'N/A'}\n`;
    message += `वय: ${voterData.age || 'N/A'}\n`;
    message += `मतदान केंद्र: ${voterData.pollingStationAddress || 'N/A'}\n\n`;

    familyMembers.forEach((member, index) => {
      message += `*${index + 2}) ${member.name}*\n`;
      message += `अनुक्रमांक: ${member.serialNumber || 'N/A'}\n`;
      message += `मतदार आयडी: ${member.voterId || 'N/A'}\n`;
      message += `बूथ क्र.: ${member.boothNumber || 'N/A'}\n`;
      message += `लिंग: ${member.gender || 'N/A'}\n`;
      message += `वय: ${member.age || 'N/A'}\n`;
      message += `मतदान केंद्र: ${member.pollingStationAddress || 'N/A'}\n\n`;
    });

    message += `मी आपला *${candidateInfo?.name || ''}* माझी निशाणी *${candidateInfo?.electionSymbol || ''}* या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा\n\n`;

    return message;
  };

  const handleWhatsAppShare = async () => {
    if (familyMembers.length === 0) {
      alert('No family members to share.');
      return;
    }

    // Check if WhatsApp number exists
    if (voterData?.whatsapp && validatePhoneNumber(voterData.whatsapp)) {
      const message = generateFamilyWhatsAppMessage();
      const url = `https://wa.me/91${voterData.whatsapp}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      setShowWhatsAppModal(true);
    }
  };

  const confirmWhatsAppShare = async () => {
    if (!validatePhoneNumber(whatsAppNumber)) {
      alert('Please enter a valid 10-digit WhatsApp number');
      return;
    }

    const saved = await saveWhatsAppNumber(whatsAppNumber);
    if (saved) {
      const message = generateFamilyWhatsAppMessage();
      const url = `https://wa.me/91${whatsAppNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      setShowWhatsAppModal(false);
      setWhatsAppNumber('');
    } else {
      alert('Error saving WhatsApp number');
    }
  };

  // 🔸 Print Family - FIXED VERSION
  const printFamilyViaBluetooth = async () => {
    console.log('🧾 Starting family print for voter:', currentVoterId);
    console.log('👨‍👩‍👧‍👦 Current family members:', familyMembers);

    // Check if we have valid family members
    if (!familyMembers || familyMembers.length === 0) {
      alert('No family members found to print.');
      return;
    }

    // Validate that family members have required data
    const validFamilyMembers = familyMembers.filter(member =>
      member && member.voterId && member.name
    );

    if (validFamilyMembers.length === 0) {
      alert('No valid family members with complete data found.');
      return;
    }

    console.log('✅ Valid family members for printing:', validFamilyMembers);

    try {
      setPrinting(true);

      // Use Bluetooth printer if available
      if (typeof window.printFamily === 'function') {
        console.log('🖨 Using Bluetooth printer flow');
        await window.printFamily();
      } else {
        // Fallback to HTML printing
        console.log('🖨 Using Web print fallback');
        await printFamilyAsHTML();
      }
    } catch (error) {
      console.error('❌ Printing failed:', error);
      alert('Printing failed: ' + error.message);
    } finally {
      setPrinting(false);
    }
  };

  // 🔸 HTML Print Fallback
  const printFamilyAsHTML = async () => {
    const printWindow = window.open('', '_blank');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Family Details - ${voterData?.name || ''}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              line-height: 1.4;
            }
            .header { 
              text-align: center; 
              margin-bottom: 20px;
              border-bottom: 2px solid #f97316;
              padding-bottom: 10px;
            }
            .candidate-info {
              background: linear-gradient(135deg, #f97316, #dc2626);
              color: white;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              text-align: center;
            }
            .family-member {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              background: #f9fafb;
            }
            .member-header {
              font-weight: bold;
              color: #f97316;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .member-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: 14px;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-style: italic;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 10px;
            }
            @media print {
              body { padding: 10px; }
              .family-member { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Family Details</h1>
            <h2>${voterData?.name || ''}</h2>
          </div>
          
          <div class="candidate-info">
            <h3>${candidateInfo?.party || ''}</h3>
            <h2>${candidateInfo?.name || ''}</h2>
            <p>${candidateInfo?.area || ''}</p>
          </div>

          <div class="family-list">
            <!-- Primary Voter -->
            <div class="family-member">
              <div class="member-header">1) ${voterData?.name || ''}</div>
              <div class="member-details">
                <div><strong>Voter ID:</strong> ${voterData?.voterId || 'N/A'}</div>
                <div><strong>Serial No:</strong> ${voterData?.serialNumber || 'N/A'}</div>
                <div><strong>Booth No:</strong> ${voterData?.boothNumber || 'N/A'}</div>
                <div><strong>Age/Gender:</strong> ${voterData?.age || 'N/A'} | ${voterData?.gender || 'N/A'}</div>
                <div style="grid-column: 1 / -1;"><strong>Polling Station:</strong> ${voterData?.pollingStationAddress || 'N/A'}</div>
              </div>
            </div>

            <!-- Family Members -->
            ${familyMembers.map((member, index) => `
              <div class="family-member">
                <div class="member-header">${index + 2}) ${member.name || 'N/A'}</div>
                <div class="member-details">
                  <div><strong>Voter ID:</strong> ${member.voterId || 'N/A'}</div>
                  <div><strong>Serial No:</strong> ${member.serialNumber || 'N/A'}</div>
                  <div><strong>Booth No:</strong> ${member.boothNumber || 'N/A'}</div>
                  <div><strong>Age/Gender:</strong> ${member.age || 'N/A'} | ${member.gender || 'N/A'}</div>
                  <div style="grid-column: 1 / -1;"><strong>Polling Station:</strong> ${member.pollingStationAddress || 'N/A'}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>Total Family Members: ${familyMembers.length + 1}</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // 🔸 Close modal with Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowFamilyModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // 🔸 Enhanced VoterList with remove functionality
  const EnhancedVoterList = ({ voters, onRemove }) => (
    <div className="space-y-3">
      {voters.map((member, index) => (
        <div key={member.voterId || member.id} className="bg-white border-t-2 border-gray-300 mt-2 pt-2 flex justify-between items-center">
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{member.name}</h4>
            <div className="text-sm text-gray-600 mt-1">
              <span>Voter ID: {member.voterId}</span>
              {member.serialNumber && <span className="ml-3">Serial: {member.serialNumber}</span>}
              {member.boothNumber && <span className="ml-3">Booth: {member.boothNumber}</span>}
            </div>
          </div>
          <button
            onClick={() => onRemove(member.voterId || member.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-4"
            title="Remove family member"
          >
            <FiTrash2 className="text-lg" />
          </button>
        </div>
      ))}
      {voters.length === 0 && (
        <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <FiUsers className="text-4xl text-gray-400 mx-auto mb-3" />
          <p>No family members added yet</p>
          <p className="text-sm mt-1">Click "Add Family" to start building the family tree</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Pending Sync Banner */}
      {pendingSyncItems.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-yellow-800 font-medium">
              {pendingSyncItems.length} pending changes
            </span>
          </div>
          <button
            onClick={handleManualSync}
            disabled={loadingOperation}
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 disabled:opacity-50 transition-colors"
          >
            {loadingOperation ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white rounded-xl ">
        <div className="flex items-center flex-col justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                <TranslatedText>Family Management</TranslatedText>
              </h2>
            </div>
          </div>

          <div className="flex items-center mt-3 gap-2">
            {familyMembers.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={printFamilyViaBluetooth}
                    disabled={printing}
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    <FiPrinter />
                  </button>
                </div>
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
                >
                  <FaWhatsapp />
                </button>
              </>
            )}
            <button
              onClick={() => setShowFamilyModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-md hover:from-orange-600 hover:to-red-600 transition-colors"
            >
              <FiPlus />
            </button>
          </div>
        </div>
      </div>

      {/* Family Members List */}
      <div className="bg-white rounded-xl">
        <h3 className="text-lg font-semibold text-gray-900 ">
          Family Members ({familyMembers.length})
        </h3>
        <EnhancedVoterList voters={familyMembers} onRemove={removeFamilyMember} />
      </div>

      {/* Bluetooth Printer Component */}
      <div className='hidden'>
        <p>sjhkhsdkjad</p>
        <BluetoothPrinter
          voter={voterData}
          familyMembers={familyMembers}
          candidateInfo={candidateInfo}
        />
      </div>


      {/* Add Family Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Add Family Members
                </h2>
                <p className="text-gray-600 mt-1">
                  Search from {availableVoters.length} available voters
                </p>
              </div>
              <button
                onClick={() => setShowFamilyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-500" />
              </button>
            </div>

            <div className="p-4 border-b relative">
              <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={modalQuery}
                onChange={(e) => setModalQuery(e.target.value)}
                placeholder="Search by name, voter ID, or serial number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-2">
              {paginatedVoters.length > 0 ? (
                paginatedVoters.map((v) => (
                  <div
                    key={v.voterId}
                    className="flex items-center justify-between border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{v.name}</h4>
                      <div className="text-sm text-gray-600 mt-1">
                        <span>Voter ID: {v.voterId}</span>
                        {v.serialNumber && <span className="ml-3">Serial: {v.serialNumber}</span>}
                        {v.boothNumber && <span className="ml-3">Booth: {v.boothNumber}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => addFamilyMember(v)}
                      className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 transition-colors whitespace-nowrap"
                    >
                      +
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <FiSearch className="text-4xl text-gray-400 mx-auto mb-3" />
                  <p>No voters found</p>
                  <p className="text-sm mt-1">Try adjusting your search terms</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
              <span>
                Showing {paginatedVoters.length} of {filteredVoters.length} voters
              </span>
              <div className="flex items-center gap-4">
                {/* <span>
                  Page {modalPage} of {totalPages}
                </span> */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalPage(p => Math.max(1, p - 1))}
                    disabled={modalPage <= 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    -
                  </button>
                  <button
                    onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                    disabled={modalPage >= totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Number Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Enter WhatsApp Number
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This number will be saved to the voter's profile for future use.
            </p>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={whatsAppNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 10) {
                  setWhatsAppNumber(value);
                }
              }}
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              maxLength="10"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setWhatsAppNumber('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmWhatsAppShare}
                disabled={!validatePhoneNumber(whatsAppNumber)}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyManagement;

// proper workable code 