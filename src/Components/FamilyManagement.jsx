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

// Add transliteration library (install: npm install transliteration)
import { transliterate as tr } from 'transliteration';

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

  // 🔸 Enhanced search function with transliteration
  const searchVoters = (voters, query) => {
    if (!query.trim()) return voters;

    const searchTerm = query.toLowerCase().trim();
    
    return voters.filter(v => {
      const name = v.name || '';
      const voterId = v.voterId || '';
      const serialNumber = v.serialNumber?.toString() || '';
      
      // Direct search
      if (name.toLowerCase().includes(searchTerm) ||
          voterId.toLowerCase().includes(searchTerm) ||
          serialNumber.includes(searchTerm)) {
        return true;
      }

      // Transliterated search for Marathi/Hindi names
      try {
        const transliteratedName = tr(name).toLowerCase();
        if (transliteratedName.includes(searchTerm)) {
          return true;
        }
      } catch (error) {
        console.log('Transliteration error:', error);
      }

      return false;
    });
  };

  // 🔸 Extract surname from full name
  const extractSurname = (fullName) => {
    if (!fullName) return '';
    
    // Split name by spaces and get the first part (surname)
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts.length > 0 ? nameParts[0] : '';
  };

  // 🔸 Get current voter's surname
  const currentVoterSurname = useMemo(() => {
    return extractSurname(voterData?.name || voter?.name);
  }, [voterData, voter]);

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

  // 🔸 Enhanced Search + pagination with surname priority and transliteration
  useEffect(() => {
    if (modalDebounceRef.current) clearTimeout(modalDebounceRef.current);

    modalDebounceRef.current = setTimeout(() => {
      let filtered = availableVoters;

      // Apply search filter if query exists
      if (modalQuery.trim()) {
        filtered = searchVoters(availableVoters, modalQuery);
      }

      // Sort: same surname voters first, then others
      const sortedVoters = [...filtered].sort((a, b) => {
        const aSurname = extractSurname(a.name);
        const bSurname = extractSurname(b.name);
        
        const aHasSameSurname = aSurname === currentVoterSurname;
        const bHasSameSurname = bSurname === currentVoterSurname;
        
        if (aHasSameSurname && !bHasSameSurname) return -1;
        if (!aHasSameSurname && bHasSameSurname) return 1;
        return 0; // Keep original order if both have same surname status
      });

      setFilteredVoters(sortedVoters);
      setModalPage(1);
    }, 300);
  }, [modalQuery, availableVoters, currentVoterSurname]);

  const totalPages = Math.max(1, Math.ceil(filteredVoters.length / pageSize));
  const paginatedVoters = useMemo(() => {
    const start = (modalPage - 1) * pageSize;
    return filteredVoters.slice(start, start + pageSize);
  }, [filteredVoters, modalPage]);

  // 🔸 Count voters with same surname
  const sameSurnameCount = useMemo(() => {
    if (!currentVoterSurname) return 0;
    return availableVoters.filter(v => 
      extractSurname(v.name) === currentVoterSurname
    ).length;
  }, [availableVoters, currentVoterSurname]);

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

  // 🔸 Enhanced Print Family Function with Main Voter Details
  const printFamilyViaBluetooth = async () => {
    console.log('🧾 Starting family print for voter:', currentVoterId);
    console.log('👨 Main voter details:', voterData);
    console.log('👨‍👩‍👧‍👦 Current family members:', familyMembers);

    // Check if we have valid voter data
    if (!voterData) {
      alert('No voter data found to print.');
      return;
    }

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

      // Prepare complete family data including main voter
      const completeFamilyData = {
        mainVoter: {
          name: voterData.name || 'N/A',
          voterId: voterData.voterId || 'N/A',
          serialNumber: voterData.serialNumber || 'N/A',
          boothNumber: voterData.boothNumber || 'N/A',
          gender: voterData.gender || 'N/A',
          age: voterData.age || 'N/A',
          pollingStationAddress: voterData.pollingStationAddress || 'N/A'
        },
        familyMembers: validFamilyMembers,
        candidateInfo: candidateInfo,
        totalMembers: validFamilyMembers.length + 1,
        printDate: new Date().toLocaleString()
      };

      // Use Bluetooth printer if available
      if (typeof window.printFamily === 'function') {
        console.log('🖨 Using Bluetooth printer flow');
        await window.printFamily(completeFamilyData);
      } else {
        // Fallback to HTML printing
        console.log('🖨 Using Web print fallback');
        await printFamilyAsHTML(completeFamilyData);
      }
    } catch (error) {
      console.error('❌ Printing failed:', error);
      alert('Printing failed: ' + error.message);
    } finally {
      setPrinting(false);
    }
  };

  // 🔸 Enhanced HTML Print Fallback with Main Voter
  const printFamilyAsHTML = async (familyData) => {
    const printWindow = window.open('', '_blank');
    
    const { mainVoter, familyMembers, candidateInfo, totalMembers, printDate } = familyData;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Family Details - ${mainVoter.name}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 25px; 
              line-height: 1.6;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
            }
            .print-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 15px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .header { 
              background: linear-gradient(135deg, #f97316, #dc2626);
              color: white;
              padding: 25px;
              text-align: center;
              margin-bottom: 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header h2 {
              margin: 10px 0 0 0;
              font-size: 20px;
              font-weight: 500;
              opacity: 0.9;
            }
            .candidate-info {
              background: linear-gradient(135deg, #4f46e5, #7c3aed);
              color: white;
              padding: 20px;
              text-align: center;
              margin: 0;
            }
            .candidate-info h3 {
              margin: 0 0 8px 0;
              font-size: 18px;
              font-weight: 600;
            }
            .candidate-info h2 {
              margin: 0 0 8px 0;
              font-size: 24px;
              font-weight: 700;
            }
            .candidate-info p {
              margin: 0;
              font-size: 16px;
              opacity: 0.9;
            }
            .family-section {
              padding: 25px;
            }
            .section-title {
              font-size: 20px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 3px solid #f97316;
              display: inline-block;
            }
            .family-member {
              background: linear-gradient(135deg, #f8fafc, #f1f5f9);
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
              transition: all 0.3s ease;
            }
            .family-member:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 15px rgba(0,0,0,0.1);
              border-color: #f97316;
            }
            .member-header {
              font-weight: 700;
              color: #dc2626;
              margin-bottom: 15px;
              font-size: 18px;
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .member-header::before {
              content: "👤";
              font-size: 20px;
            }
            .member-details {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 12px;
              font-size: 14px;
            }
            .detail-item {
              display: flex;
              flex-direction: column;
            }
            .detail-label {
              font-weight: 600;
              color: #64748b;
              font-size: 12px;
              margin-bottom: 2px;
            }
            .detail-value {
              color: #1f2937;
              font-weight: 500;
            }
            .polling-station {
              grid-column: 1 / -1;
              background: #fef3c7;
              padding: 12px;
              border-radius: 8px;
              border-left: 4px solid #d97706;
            }
            .main-voter {
              border: 3px solid #f97316;
              background: linear-gradient(135deg, #fff7ed, #fed7aa);
            }
            .main-voter .member-header {
              color: #ea580c;
            }
            .footer {
              background: #1f2937;
              color: white;
              padding: 20px;
              text-align: center;
              margin-top: 20px;
            }
            .stats {
              display: flex;
              justify-content: center;
              gap: 30px;
              margin-bottom: 15px;
            }
            .stat-item {
              text-align: center;
            }
            .stat-number {
              font-size: 24px;
              font-weight: 700;
              color: #f97316;
            }
            .stat-label {
              font-size: 12px;
              opacity: 0.8;
              margin-top: 5px;
            }
            @media print {
              body { 
                background: white !important;
                padding: 10px;
              }
              .print-container {
                box-shadow: none;
                margin: 0;
              }
              .family-member { 
                break-inside: avoid;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <h1>Family Details Report</h1>
              <h2>Complete Family Information</h2>
            </div>
            
            <div class="candidate-info">
              <h3>${candidateInfo?.party || 'Political Party'}</h3>
              <h2>${candidateInfo?.name || 'Candidate Name'}</h2>
              <p>${candidateInfo?.area || 'Constituency Area'}</p>
            </div>

            <div class="family-section">
              <div class="section-title">Primary Voter Details</div>
              
              <!-- Main Voter -->
              <div class="family-member main-voter">
                <div class="member-header">1) ${mainVoter.name}</div>
                <div class="member-details">
                  <div class="detail-item">
                    <span class="detail-label">Voter ID</span>
                    <span class="detail-value">${mainVoter.voterId}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Serial Number</span>
                    <span class="detail-value">${mainVoter.serialNumber}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Booth Number</span>
                    <span class="detail-value">${mainVoter.boothNumber}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Age & Gender</span>
                    <span class="detail-value">${mainVoter.age} | ${mainVoter.gender}</span>
                  </div>
                  <div class="polling-station">
                    <span class="detail-label">Polling Station Address</span>
                    <span class="detail-value">${mainVoter.pollingStationAddress}</span>
                  </div>
                </div>
              </div>

              <div class="section-title">Family Members (${familyMembers.length})</div>
              
              <!-- Family Members -->
              ${familyMembers.map((member, index) => `
                <div class="family-member">
                  <div class="member-header">${index + 2}) ${member.name || 'N/A'}</div>
                  <div class="member-details">
                    <div class="detail-item">
                      <span class="detail-label">Voter ID</span>
                      <span class="detail-value">${member.voterId || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Serial Number</span>
                      <span class="detail-value">${member.serialNumber || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Booth Number</span>
                      <span class="detail-value">${member.boothNumber || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Age & Gender</span>
                      <span class="detail-value">${member.age || 'N/A'} | ${member.gender || 'N/A'}</span>
                    </div>
                    <div class="polling-station">
                      <span class="detail-label">Polling Station Address</span>
                      <span class="detail-value">${member.pollingStationAddress || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="footer">
              <div class="stats">
                <div class="stat-item">
                  <div class="stat-number">${totalMembers}</div>
                  <div class="stat-label">Total Family Members</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${familyMembers.length}</div>
                  <div class="stat-label">Additional Members</div>
                </div>
              </div>
              <p>Generated on ${printDate}</p>
              <p style="opacity: 0.7; margin-top: 8px; font-size: 12px;">
                Powered by Voter Management System
              </p>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => {
                window.close();
              }, 1000);
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
            <h4 className="font-semibold text-gray-900"><TranslatedText>{member.name}</TranslatedText></h4>
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
      <div className="bg-white rounded-xl">
        <div className="flex items-center flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center justify-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                <TranslatedText>Family Management</TranslatedText>
              </h2>
              <p className="text-gray-600 mt-1">
                Manage family members for {voterData?.name || 'current voter'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {familyMembers.length > 0 && (
              <>
                <button
                  onClick={printFamilyViaBluetooth}
                  disabled={printing}
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <FiPrinter className="text-lg" />
                  {/* <span className="font-semibold">
                    {printing ? 'Printing...' : 'Print Family'}
                  </span> */}
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <FaWhatsapp className="text-lg" />
                  {/* <span className="font-semibold">Share via WhatsApp</span> */}
                </button>
              </>
            )}
            <button
              onClick={() => setShowFamilyModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <FiPlus className="text-lg" />
              {/* <span className="font-semibold">+</span> */}
            </button>
          </div>
        </div>
      </div>

      {/* Family Members List */}
      <div className="bg-white rounded-xl mt-5">
        <div className="flex flex-col items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Family Members ({familyMembers.length})
          </h3>
          {familyMembers.length > 0 && (
            <div className="text-sm text-gray-500">
              Total {familyMembers.length + 1} family members including primary voter
            </div>
          )}
        </div>
        <EnhancedVoterList voters={familyMembers} onRemove={removeFamilyMember} />
      </div>

      {/* Bluetooth Printer Component */}
      <div className='hidden'>
        <BluetoothPrinter
          voter={voterData}
          familyMembers={familyMembers}
          candidateInfo={candidateInfo}
        />
      </div>

      {/* Add Family Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 p-4 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-orange-50 to-red-50">
              <div>
                <p className="text-gray-600 mt-1">
                  {currentVoterSurname && (
                    <span className=" text-orange-600 font-medium">
                      ({sameSurnameCount} with same surname "{currentVoterSurname}" shown first)
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowFamilyModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-500" />
              </button>
            </div>

            <div className="p-4 border-b relative bg-white">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={modalQuery}
                  onChange={(e) => setModalQuery(e.target.value)}
                  placeholder="Search by name (English or regional language), voter ID, or serial number..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                />
              </div>
              {modalQuery && (
                <div className="text-xs text-gray-500 mt-2">
                  🔍 Voters Name, Voter IDs, Serial Numbers, and transliterated regional names
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 bg-gray-50">
              {paginatedVoters.length > 0 ? (
                paginatedVoters.map((v) => {
                  const voterSurname = extractSurname(v.name);
                  const hasSameSurname = voterSurname === currentVoterSurname;
                  
                  return (
                    <div
                      key={v.voterId}
                      className={`flex items-center justify-between border-2 rounded-xl p-4 transition-all duration-300 hover:shadow-lg ${
                        hasSameSurname 
                          ? 'bg-orange-50 border-orange-100 hover:border-orange-200' 
                          : 'border-gray-200 hover:border-orange-300 bg-white hover:bg-orange-50'
                      }`}
                    >
                      <div className="flex-1">  
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-red-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {v.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h4 className="font-bold text-gray-900 text-md">{v.name}</h4>
                              {/* {hasSameSurname && (
                                <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                  Same Surname
                                </span>
                              )} */}
                            </div>
                            <div className="text-sm text-gray-600 flex flex-wrap gap-3">
                              <span>Voter ID: <strong>{v.voterId}</strong></span>
                              {v.serialNumber && <span>Serial: <strong>{v.serialNumber}</strong></span>}
                              {v.boothNumber && <span>Booth: <strong>{v.boothNumber}</strong></span>}
                              {hasSameSurname && (
                                <span className="text-orange-600 font-medium">
                                  Surname: <strong>{voterSurname}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => addFamilyMember(v)}
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
                      >
                        +
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <FiSearch className="text-5xl text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium">No voters found</p>
                  <p className="text-sm mt-2 max-w-md mx-auto">
                    Try adjusting your search terms. You can search in English or regional languages - 
                    the system will automatically transliterate your search.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-center items-center text-sm text-gray-600 bg-white">
              {/* <span className="font-medium">
                Showing {paginatedVoters.length} of {filteredVoters.length} voters
                {modalQuery && ` for "${modalQuery}"`}
              </span> */}
              <div className="flex  gap-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setModalPage(p => Math.max(1, p - 1))}
                    disabled={modalPage <= 1}
                    className="px-4 py-2 border-2 border-gray-300 rounded-xl disabled:opacity-50 hover:bg-gray-50 transition-colors font-medium"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 bg-orange-500 text-white rounded-xl font-medium">
                    Page {modalPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                    disabled={modalPage >= totalPages}
                    className="px-4 py-2 border-2 border-gray-300 rounded-xl disabled:opacity-50 hover:bg-gray-50 transition-colors font-medium"
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaWhatsapp className="text-2xl text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">
                Enter WhatsApp Number
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This number will be saved to the voter's profile for future WhatsApp communications.
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
              className="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
              maxLength="10"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setWhatsAppNumber('');
                }}
                className="px-4 py-2 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmWhatsAppShare}
                disabled={!validatePhoneNumber(whatsAppNumber)}
                className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-medium shadow-lg hover:shadow-xl"
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