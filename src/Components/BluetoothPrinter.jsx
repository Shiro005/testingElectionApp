import React, { useState, useEffect } from 'react';
import { FiPrinter, FiBluetooth, FiDownload, FiShare2, FiMessageCircle, FiX } from 'react-icons/fi';
import { FaWhatsapp, FaRegFilePdf } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import TranslatedText from './TranslatedText';
import { db } from '../Firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { useCandidate } from '../Context/CandidateContext';

// Global Bluetooth connection state
let globalBluetoothConnection = {
  device: null,
  characteristic: null,
  connected: false
};

const BluetoothPrinter = ({ voter, familyMembers }) => {
  const [printing, setPrinting] = useState(false);
  const [bluetoothConnected, setBluetoothConnected] = useState(globalBluetoothConnection.connected);
  const [printerDevice, setPrinterDevice] = useState(globalBluetoothConnection.device);
  const [printerCharacteristic, setPrinterCharacteristic] = useState(globalBluetoothConnection.characteristic);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [isFamily, setIsFamily] = useState(false);
  const [voterData, setVoterData] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const { candidateInfo } = useCandidate();

  useEffect(() => {
    // Initialize from global connection state
    setBluetoothConnected(globalBluetoothConnection.connected);
    setPrinterDevice(globalBluetoothConnection.device);
    setPrinterCharacteristic(globalBluetoothConnection.characteristic);

    // Load voter data from local storage first, then fallback to Firebase
    if (voter) {
      loadVoterData();
    }

    // Expose print functions to window for FamilyManagement component
    window.printVoter = () => printViaBluetooth(false);
    window.printFamily = () => printViaBluetooth(true);
    
    // Expose WhatsApp functions
    window.handleWhatsAppShare = handleWhatsAppShare;
  }, [voter]);

  // Load voter data from local storage or Firebase
  const loadVoterData = async () => {
    try {
      const docId = voter?.id || voter?.voterId;
      if (!docId) {
        setVoterData(voter);
        return;
      }

      // Try to get from local storage first
      const localVoterData = localStorage.getItem(`voter_${docId}`);
      if (localVoterData) {
        const parsedData = JSON.parse(localVoterData);
        setVoterData({ ...voter, ...parsedData });
        return;
      }

      // Fallback to Firebase
      const voterDocRef = doc(db, 'voters', String(docId));
      const voterDoc = await getDoc(voterDocRef);

      if (voterDoc.exists()) {
        const data = voterDoc.data();
        // Save to local storage for future use
        localStorage.setItem(`voter_${docId}`, JSON.stringify(data));
        setVoterData({ ...voter, ...data });
      } else {
        setVoterData(voter);
      }
    } catch (error) {
      console.error('Error loading voter data:', error);
      setVoterData(voter);
    }
  };

  // Fetch WhatsApp number from voter_surveys -> whatsapp_root fallback
  const fetchWhatsAppNumberFromStores = async (docId) => {
    try {
      // 1) Try voterData (already loaded)
      if (voterData?.whatsapp && voterData.whatsapp.length === 10) return voterData.whatsapp;

      // 2) Try voter_surveys collection doc with id = docId
      if (docId) {
        const vsRef = doc(db, 'voter_surveys', String(docId));
        const vsSnap = await getDoc(vsRef);
        if (vsSnap.exists()) {
          const data = vsSnap.data();
          if (data?.whatsapp && String(data.whatsapp).replace(/\D/g, '').length === 10) {
            return String(data.whatsapp).replace(/\D/g, '');
          }
        }
      }

      // 3) Fallback to whatsapp_root document
      const rootRef = doc(db, 'whatsapp_root', 'root');
      const rootSnap = await getDoc(rootRef);
      if (rootSnap.exists()) {
        const rootData = rootSnap.data();
        if (rootData?.number && String(rootData.number).replace(/\D/g, '').length === 10) {
          return String(rootData.number).replace(/\D/g, '');
        }
        if (rootData?.whatsapp && String(rootData.whatsapp).replace(/\D/g, '').length === 10) {
          return String(rootData.whatsapp).replace(/\D/g, '');
        }
      }

      // nothing found
      return null;
    } catch (e) {
      console.error('Error fetching whatsapp number from stores:', e);
      return null;
    }
  };

  // Generate receipt as base64 image
  const generateReceiptImageBase64 = async (isFamily, voterForImage, familyForImage) => {
    ensureDevanagariFont();
    
    const safeDiv = document.createElement('div');
    safeDiv.style.width = '380px';
    safeDiv.style.padding = '15px';
    safeDiv.style.background = '#fff';
    safeDiv.style.fontFamily = `"Noto Sans Devanagari", sans-serif`;
    safeDiv.style.fontSize = '14px';
    safeDiv.style.lineHeight = '1.4';
    safeDiv.style.position = 'absolute';
    safeDiv.style.left = '-9999px';
    safeDiv.style.boxSizing = 'border-box';

    let html = `
      <div style="text-align:center;font-weight:700;font-size:16px;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:10px;">
        ${escapeHtml(candidateInfo.party)}<br/>
        <div style="font-size:24px;margin:8px 0;color:#1e40af;">${escapeHtml(candidateInfo.name)}</div>
        <div style="font-size:14px;color:#555;">${escapeHtml(candidateInfo.slogan)}</div>
        <div style="font-size:14px;margin-top:6px;color:#666;">${escapeHtml(candidateInfo.area)}</div>
      </div>
    `;

    if (isFamily && Array.isArray(familyForImage) && familyForImage.length > 0) {
      html += `
        <div style="text-align:center;margin-top:10px;font-size:18px;font-weight:700;color:#1e40af;margin-bottom:15px;">
          कुटुंब तपशील
        </div>
        <div style="margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #ddd;">
          <div style="font-weight:700;font-size:16px;margin-bottom:5px;">1) ${escapeHtml(voterForImage.name || '')}</div>
          <div style="margin:2px 0;">अनुक्रमांक: ${escapeHtml(voterForImage.serialNumber || '')}</div>
          <div style="margin:2px 0;">मतदार आयडी: ${escapeHtml(voterForImage.voterId || '')}</div>
          <div style="margin:2px 0;">बूथ क्रमांक: ${escapeHtml(voterForImage.boothNumber || '')}</div>
          <div style="margin:2px 0;">लिंग: ${escapeHtml(voterForImage.gender || '')}</div>
          <div style="margin:2px 0;">वय: ${escapeHtml(voterForImage.age || '')}</div>
          <div style="margin:4px 0 0 0;font-size:13px;color:#555;">मतदान केंद्र: ${escapeHtml(voterForImage.pollingStationAddress || '')}</div>
        </div>
      `;

      familyForImage.forEach((m, i) => {
        html += `
          <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eee;">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${i + 2}) ${escapeHtml(m.name || '')}</div>
            <div style="margin:2px 0;">अनुक्रमांक: ${escapeHtml(m.serialNumber || '')}</div>
            <div style="margin:2px 0;">मतदार आयडी: ${escapeHtml(m.voterId || '')}</div>
            <div style="margin:2px 0;">बूथ क्रमांक: ${escapeHtml(m.boothNumber || '')}</div>
            <div style="margin:2px 0;">लिंग: ${escapeHtml(m.gender || '')}</div>
            <div style="margin:2px 0;">वय: ${escapeHtml(m.age || '')}</div>
            <div style="margin:4px 0 0 0;font-size:13px;color:#555;">मतदान केंद्र: ${escapeHtml(m.pollingStationAddress || '')}</div>
          </div>
        `;
      });

      html += `
        <div style="margin-top:15px;padding-top:10px;border-top:2px solid #000;font-size:13px;text-align:center;color:#333;">
          मी आपला <b>${candidateInfo.name}</b> माझी निशाणी <b>${candidateInfo.electionSymbol}</b> या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा
        </div>
      `;
    } else {
      html += `
        <div style="text-align:center;margin-top:10px;font-size:18px;font-weight:700;color:#1e40af;margin-bottom:15px;">
          मतदार तपशील
        </div>
        <div style="margin-bottom:10px;">
          <div style="margin:6px 0;"><b>नाव:</b> ${escapeHtml(voterForImage.name || '')}</div>
          <div style="margin:6px 0;"><b>मतदार आयडी:</b> ${escapeHtml(voterForImage.voterId || '')}</div>
          <div style="margin:6px 0;"><b>अनुक्रमांक:</b> ${escapeHtml(voterForImage.serialNumber || '')}</div>
          <div style="margin:6px 0;"><b>बूथ क्रमांक:</b> ${escapeHtml(voterForImage.boothNumber || '')}</div>
          <div style="margin:6px 0;"><b>लिंग:</b> ${escapeHtml(voterForImage.gender || '')}</div>
          <div style="margin:6px 0;"><b>वय:</b> ${escapeHtml(voterForImage.age || '')}</div>
          <div style="margin:8px 0 0 0;font-size:13px;color:#555;"><b>मतदान केंद्र:</b> ${escapeHtml(voterForImage.pollingStationAddress || '')}</div>
        </div>
        <div style="margin-top:15px;padding-top:10px;border-top:2px solid #000;font-size:13px;text-align:center;color:#333;">
          मी आपला <b>${candidateInfo.name}</b> माझी निशाणी <b>${candidateInfo.electionSymbol}</b> या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा
        </div>
        <div style="margin-top:8px;text-align:center;font-weight:700;color:#1e40af;">${escapeHtml(candidateInfo.name)}</div>
      `;
    }

    safeDiv.innerHTML = html;
    document.body.appendChild(safeDiv);

    try {
      const canvas = await html2canvas(safeDiv, {
        scale: 2,
        backgroundColor: '#fff',
        useCORS: true,
        width: 380,
        height: safeDiv.scrollHeight,
        windowWidth: 380,
        windowHeight: safeDiv.scrollHeight
      });
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      return dataUrl;
    } catch (e) {
      console.error('generateReceiptImageBase64 failed:', e);
      return null;
    } finally {
      document.body.removeChild(safeDiv);
    }
  };

  // Upload base64 to Firebase Storage and get public URL
  const uploadBase64ToFirebase = async (dataUrl) => {
    try {
      if (!dataUrl) return null;
      const storage = getStorage();
      const filePath = `voter_receipts/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const r = storageRef(storage, filePath);
      await uploadString(r, dataUrl, 'data_url');
      const url = await getDownloadURL(r);
      return url;
    } catch (e) {
      console.error('uploadBase64ToFirebase failed:', e);
      return null;
    }
  };

  // Save contact number to Firebase and local storage
  const saveContactNumber = async (type, number) => {
    try {
      const docId = voter?.id || voter?.voterId;
      if (!docId) throw new Error('Voter ID not available');

      const voterDocRef = doc(db, 'voters', String(docId));
      const updateData = type === 'whatsapp' ? { whatsapp: number } : { phone: number };

      // Save to Firebase
      await setDoc(voterDocRef, updateData, { merge: true });

      // Update local storage
      const localVoterData = localStorage.getItem(`voter_${docId}`);
      if (localVoterData) {
        const parsedData = JSON.parse(localVoterData);
        localStorage.setItem(`voter_${docId}`, JSON.stringify({ ...parsedData, ...updateData }));
      }

      // Update local state
      setVoterData(prev => ({ ...prev, ...updateData }));
      return true;
    } catch (error) {
      console.error(`Error saving ${type} number:`, error);
      return false;
    }
  };

  const getContactNumber = (type) => {
    return voterData?.[type] || '';
  };

  const hasContactNumber = (type) => {
    const number = getContactNumber(type);
    return number && number.length === 10;
  };

  const validatePhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const generateWhatsAppMessage = (isFamily = false) => {
    if (!voterData) return '';

    let message = `*${candidateInfo.party}*\n`;
    message += `*${candidateInfo.name}*\n\n`;

    if (isFamily && familyMembers.length > 0) {
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
    } else {
      message += `*मतदार तपशील*\n\n`;
      message += `*नाव:* ${voterData.name}\n`;
      message += `*मतदार आयडी:* ${voterData.voterId || 'N/A'}\n`;
      message += `*अनुक्रमांक:* ${voterData.serialNumber || 'N/A'}\n`;
      message += `*बूथ क्र.:* ${voterData.boothNumber || 'N/A'}\n`;
      message += `*लिंग:* ${voterData.gender || 'N/A'}\n`;
      message += `*वय:* ${voterData.age || 'N/A'}\n`;
      message += `*मतदान केंद्र:* ${voterData.pollingStationAddress || 'N/A'}\n\n`;
    }

    message += `मी आपला *${candidateInfo.name}* माझी निशाणी *${candidateInfo.electionSymbol}* या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा\n\n`;

    return message;
  };

  const handleWhatsAppShare = async (isFamilyShare = false) => {
    if (!voter && !voterData) return;

    setIsFamily(isFamilyShare);
    setGeneratingImage(true);

    try {
      // 1) Resolve recipient whatsapp number
      const docId = voter?.id || voter?.voterId || voterData?.id || voterData?.voterId;
      const recipientNumber = await fetchWhatsAppNumberFromStores(docId);

      // If no number found, show modal to enter number
      if (!recipientNumber) {
        setShowWhatsAppModal(true);
        setGeneratingImage(false);
        return;
      }

      // 2) Generate caption text
      const message = generateWhatsAppMessage(isFamilyShare);

      // 3) Generate receipt as image
      const voterForImage = voterData || voter;
      const familyForImage = isFamilyShare ? (familyMembers || []) : [];
      const dataUrl = await generateReceiptImageBase64(isFamilyShare, voterForImage, familyForImage);

      if (!dataUrl) {
        throw new Error('Could not generate receipt image');
      }

      // 4) Try native sharing (best for PWA)
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `voter_receipt_${voterForImage.voterId || 'details'}.png`, {
          type: 'image/png'
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            text: message,
            title: `${candidateInfo.name} - Voter Details`
          });
          setGeneratingImage(false);
          return;
        }
      } catch (shareError) {
        console.log('Native share not supported or failed:', shareError);
        // Continue to fallback method
      }

      // 5) Fallback: Upload to Firebase and send URL via WhatsApp
      const imageUrl = await uploadBase64ToFirebase(dataUrl);
      
      let finalMessage = message;
      if (imageUrl) {
        finalMessage += `\n\n📄 Receipt Image: ${imageUrl}`;
        finalMessage += `\n\n(Image will be displayed as a preview in WhatsApp)`;
      }

      const url = `https://wa.me/91${recipientNumber}?text=${encodeURIComponent(finalMessage)}`;
      window.open(url, '_blank');

    } catch (error) {
      console.error('Error in WhatsApp share:', error);
      
      // Ultimate fallback: text only
      const docId = voter?.id || voter?.voterId || voterData?.id || voterData?.voterId;
      const recipientNumber = await fetchWhatsAppNumberFromStores(docId);
      
      if (recipientNumber) {
        const message = generateWhatsAppMessage(isFamilyShare);
        const url = `https://wa.me/91${recipientNumber}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
      } else {
        setShowWhatsAppModal(true);
      }
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSMSShare = async () => {
    if (!voterData) return;

    const hasPhone = hasContactNumber('phone');

    if (hasPhone) {
      // Direct SMS if number exists
      const message = generateWhatsAppMessage(false);
      window.open(`sms:${getContactNumber('phone')}?body=${encodeURIComponent(message)}`, '_blank');
    } else {
      setShowSMSModal(true);
    }
  };

  const confirmWhatsAppShare = async () => {
    if (!validatePhoneNumber(whatsappNumber)) {
      alert('कृपया वैध 10-अंकी व्हॉट्सअॅप क्रमांक प्रविष्ट करा');
      return;
    }

    const cleanedNumber = whatsappNumber.replace(/\D/g, '');
    const saved = await saveContactNumber('whatsapp', cleanedNumber);

    if (saved) {
      const message = generateWhatsAppMessage(isFamily);
      const url = `https://wa.me/91${cleanedNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      setShowWhatsAppModal(false);
      setWhatsappNumber('');
    } else {
      alert('व्हॉट्सअॅप क्रमांक जतन करण्यात त्रुटी आली');
    }
  };

  const confirmSMSShare = async () => {
    if (!validatePhoneNumber(smsNumber)) {
      alert('कृपया वैध 10-अंकी मोबाईल क्रमांक प्रविष्ट करा');
      return;
    }

    const cleanedNumber = smsNumber.replace(/\D/g, '');
    const saved = await saveContactNumber('phone', cleanedNumber);

    if (saved) {
      const message = generateWhatsAppMessage(false);
      window.open(`sms:${cleanedNumber}?body=${encodeURIComponent(message)}`, '_blank');
      setShowSMSModal(false);
      setSmsNumber('');
    } else {
      alert('मोबाईल क्रमांक जतन करण्यात त्रुटी आली');
    }
  };

  const ContactModal = ({
    isOpen,
    onClose,
    title,
    number,
    setNumber,
    onConfirm,
    type = 'whatsapp'
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-md mx-auto">
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX size={24} />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === 'whatsapp' ? 'व्हॉट्सअॅप क्रमांक' : 'मोबाईल क्रमांक'}
              </label>
              <input
                type="tel"
                placeholder={`10-अंकी ${type === 'whatsapp' ? 'व्हॉट्सअॅप' : 'मोबाईल'} क्रमांक`}
                value={number}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setNumber(value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength="10"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                हा क्रमांक डेटाबेसमध्ये जतन केला जाईल
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                रद्द करा
              </button>
              <button
                onClick={onConfirm}
                disabled={!validatePhoneNumber(number)}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors ${validatePhoneNumber(number)
                  ? type === 'whatsapp'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-400 cursor-not-allowed'
                  }`}
              >
                {type === 'whatsapp' ? 'व्हॉट्सअॅप वर पाठवा' : 'एसएमएस पाठवा'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      alert('Bluetooth is not supported in this browser. Please use Chrome or Edge on Android.');
      return null;
    }

    try {
      setPrinting(true);

      console.log('Requesting Bluetooth device...');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb'
        ]
      });

      device.addEventListener?.('gattserverdisconnected', () => {
        console.log('Bluetooth device disconnected');
        globalBluetoothConnection.connected = false;
        setBluetoothConnected(false);
        setPrinterDevice(null);
        setPrinterCharacteristic(null);
      });

      console.log('Connecting to GATT server...');
      const server = await device.gatt.connect();
      console.log('Getting primary services...');
      const services = await server.getPrimaryServices();

      let foundChar = null;
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const c of characteristics) {
            if (c.properties && (c.properties.write || c.properties.writeWithoutResponse)) {
              foundChar = c;
              break;
            }
          }
          if (foundChar) break;
        } catch (err) {
          console.warn('Could not read characteristics for service', service.uuid, err);
        }
      }

      if (!foundChar) {
        try { server.disconnect?.(); } catch (e) { /* ignore */ }
        setPrinting(false);
        alert('Connected to printer but no writable characteristic found. Many portable printers use Bluetooth Classic (SPP) which browsers cannot access. If your RPD-588 supports BLE, enable BLE mode.');
        return null;
      }

      globalBluetoothConnection.device = device;
      globalBluetoothConnection.characteristic = foundChar;
      globalBluetoothConnection.connected = true;

      setPrinterDevice(device);
      setPrinterCharacteristic(foundChar);
      setBluetoothConnected(true);
      setPrinting(false);

      console.log('Bluetooth printer connected', device.name || device.id, foundChar.uuid);
      return { device, characteristic: foundChar };
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      setPrinting(false);
      setBluetoothConnected(false);
      if (error?.name === 'NotFoundError') {
        alert('No Bluetooth printer found / selected. Make sure printer is ON and in BLE mode.');
      } else if (error?.name === 'SecurityError') {
        alert('Bluetooth permission denied. Please allow Bluetooth access.');
      } else {
        alert(`Bluetooth connection failed: ${error?.message || error}`);
      }
      return null;
    }
  };

  const canvasToEscPosRaster = (canvas) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const widthBytes = Math.ceil(width / 8);
    const imageData = ctx.getImageData(0, 0, width, height).data;
    const rasterData = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        const byteIndex = y * widthBytes + (x >> 3);
        const bit = 7 - (x % 8);
        if (luminance < 160) {
          rasterData[byteIndex] |= (1 << bit);
        }
      }
    }

    const header = [0x1D, 0x76, 0x30, 0x00];
    const xL = widthBytes & 0xFF;
    const xH = (widthBytes >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;

    const command = new Uint8Array(header.length + 4 + rasterData.length);
    let offset = 0;
    command.set(header, offset); offset += header.length;
    command[offset++] = xL;
    command[offset++] = xH;
    command[offset++] = yL;
    command[offset++] = yH;
    command.set(rasterData, offset);

    return command;
  };

  const ensureDevanagariFont = () => {
    if (document.getElementById('noto-devanagari-font')) return;
    const link = document.createElement('link');
    link.id = 'noto-devanagari-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap';
    document.head.appendChild(link);
  };

  const translateToMarathi = async (text) => {
    if (!text) return '';
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await res.json();
      return data?.[0]?.[0]?.[0] || text;
    } catch (e) {
      console.error('Translation failed:', e);
      return text;
    }
  };

  const printViaBluetooth = async (isFamily = false) => {
    if (!voter) {
      alert('No voter data available');
      return;
    }

    if (isFamily && familyMembers.length === 0) {
      alert('No family members to print');
      return;
    }

    try {
      setPrinting(true);

      let connection;
      if (
        globalBluetoothConnection.connected &&
        globalBluetoothConnection.device?.gatt?.connected
      ) {
        connection = {
          device: globalBluetoothConnection.device,
          characteristic: globalBluetoothConnection.characteristic,
        };
      } else {
        connection = await connectBluetooth();
      }

      if (!connection?.characteristic) {
        setPrinting(false);
        return;
      }

      // Use local data directly without fetching from Firebase
      const voterGender = voter?.gender || '';
      const voterAge = (voter?.age ?? '')?.toString?.() || '';

      const translatedVoter = {
        name: await translateToMarathi(voter.name || ''),
        voterId: await translateToMarathi(voter.voterId || ''),
        serialNumber: await translateToMarathi(String(voter.serialNumber ?? '')),
        boothNumber: await translateToMarathi(String(voter.boothNumber ?? '')),
        pollingStationAddress: await translateToMarathi(voter.pollingStationAddress || ''),
        gender: await translateToMarathi(voterGender),
        age: await translateToMarathi(voterAge),
      };

      const translatedFamily =
        isFamily && familyMembers.length > 0
          ? await Promise.all(
            familyMembers.map(async (member) => {
              const mGender = member?.gender || '';
              const mAge = (member?.age ?? '')?.toString?.() || '';
              return {
                ...member,
                name: await translateToMarathi(member.name || ''),
                voterId: await translateToMarathi(member.voterId || ''),
                boothNumber: await translateToMarathi(String(member.boothNumber ?? '')),
                pollingStationAddress: await translateToMarathi(member.pollingStationAddress || ''),
                gender: await translateToMarathi(mGender),
                age: await translateToMarathi(mAge),
              };
            })
          )
          : [];

      await printReceiptAsImage(
        connection.characteristic,
        isFamily,
        translatedVoter,
        translatedFamily
      );

      alert(
        isFamily
          ? 'कुटुंब तपशील यशस्वीरित्या प्रिंट झाले! 🎉'
          : 'मतदाराची माहिती यशस्वीरित्या प्रिंट झाली! 🎉'
      );
    } catch (error) {
      console.error('Printing failed:', error);
      globalBluetoothConnection.connected = false;
      globalBluetoothConnection.device = null;
      globalBluetoothConnection.characteristic = null;
      setBluetoothConnected(false);
      setPrinterDevice(null);
      setPrinterCharacteristic(null);

      alert('प्रिंटिंग अयशस्वी: ' + (error?.message || error));
    } finally {
      setPrinting(false);
    }
  };

  const printReceiptAsImage = async (characteristic, isFamily, voterData, familyData) => {
    ensureDevanagariFont();
    await new Promise((r) => setTimeout(r, 220));

    const safeDiv = document.createElement('div');
    safeDiv.id = 'voter-receipt-printable-temp';
    safeDiv.style.width = '200px';
    safeDiv.style.padding = '10px';
    safeDiv.style.background = '#fff';
    safeDiv.style.fontFamily = `"Noto Sans Devanagari", sans-serif`;
    safeDiv.style.fontSize = '14px';
    safeDiv.style.lineHeight = '1.3';
    safeDiv.style.position = 'absolute';
    safeDiv.style.left = '-9999px';

    let html = `
      <div style="text-align:center;font-weight:700;font-size:13px;border-bottom:1px solid #000;padding-bottom:8px;">
        ${escapeHtml(candidateInfo.party)}<br/>
        <div style="font-size:18px;margin:4px 0;">${escapeHtml(candidateInfo.name)}</div>
        <div style="font-size:14px;">${escapeHtml(candidateInfo.slogan)}</div>
        <div style="font-size:14px;margin-top:4px;padding-bottom:8px;">${escapeHtml(candidateInfo.area)}</div>
      </div>
    `;

    if (isFamily && Array.isArray(familyData) && familyData.length > 0) {
      html += `
        <div style="text-align:center;margin-top:6px;font-size:14px;"><b>कुटुंब तपशील</b></div>
        <div style="margin-top:6px;font-size:14px;"><b>1) ${escapeHtml(voterData.name)}</b></div>
        <div style="font-size:14px;">अनुक्रमांक: ${escapeHtml(voterData.serialNumber || '')}</div>
        <div style="font-size:14px;">मतदार आयडी: ${escapeHtml(voterData.voterId || '')}</div>
        <div style="font-size:14px;">बूथ क्रमांक: ${escapeHtml(voterData.boothNumber || '')}</div>
        <div style="font-size:14px;">लिंग: ${escapeHtml(voterData.gender || '')}</div>
        <div style="font-size:14px;">वय: ${escapeHtml(voterData.age || '')}</div>
        <div style="margin-top:4px;border-bottom:1px solid #000;padding-bottom:10px;font-size:14px;">मतदान केंद्र: ${escapeHtml(voterData.pollingStationAddress || '')}</div>
      `;

      familyData.forEach((m, i) => {
        html += `
          <div style="margin-top:6px;font-size:14px;margin-bottom:2px;border-bottom:1px solid #000;padding-bottom:10px;">
            <div style="font-weight:700;">${i + 2}) ${escapeHtml(m.name || '')}</div>
            <div style="margin-top:4px;">अनुक्रमांक: ${escapeHtml(m.serialNumber || '')}</div>
            <div style="margin-top:2px;">मतदार आयडी: ${escapeHtml(m.voterId || '')}</div>
            <div style="margin-top:2px;">बूथ क्रमांक: ${escapeHtml(m.boothNumber || '')}</div>
            <div style="margin-top:2px;">लिंग: ${escapeHtml(m.gender || '')}</div>
            <div style="margin-top:2px;">वय: ${escapeHtml(m.age || '')}</div>
            <div style="margin-top:4px;font-size:13px;">मतदान केंद्र: ${escapeHtml(m.pollingStationAddress || '')}</div>
          </div>
        `;
      });

      html += `
        <div style="margin-top:6px;border-top:1px solid #000;padding-top:6px;font-size:13px;">
          मी आपला <b>${candidateInfo.name}</b> माझी निशाणी <b>${candidateInfo.electionSymbol}</b> या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा
        </div>
        <div style="margin-top:18px;text-align:center;"></div>
      `;
    } else {
      html += `
        <div style="text-align:center;margin-top:6px;font-weight:700;">मतदार तपशील</div>
        <div style="margin-top:6px;"><b>नाव:</b> ${escapeHtml(voterData.name || '')}</div>
        <div style="margin-top:4px;"><b>मतदार आयडी:</b> ${escapeHtml(voterData.voterId || '')}</div>
        <div style="margin-top:4px;"><b>अनुक्रमांक:</b> ${escapeHtml(voterData.serialNumber || '')}</div>
        <div style="margin-top:4px;"><b>बूथ क्रमांक:</b> ${escapeHtml(voterData.boothNumber || '')}</div>
        <div style="margin-top:4px;"><b>लिंग:</b> ${escapeHtml(voterData.gender || '')}</div>
        <div style="margin-top:4px;"><b>वय:</b> ${escapeHtml(voterData.age || '')}</div>
        <div style="margin-top:6px;margin-bottom:10px;"><b>मतदान केंद्र:</b> ${escapeHtml(voterData.pollingStationAddress || '')}</div>
       <div style="margin-top:6px;border-top:1px solid #000;padding-top:6px;font-size:13px;">
          मी आपला <b>${candidateInfo.name}</b> माझी निशाणी <b>${candidateInfo.electionSymbol}</b> या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा
        </div>
        <div style="margin-top:6px;text-align:center;font-weight:700;">${escapeHtml(candidateInfo.name)}</div>
        <div style="margin-top:18px;"></div>
      `;
    }

    safeDiv.innerHTML = html;
    document.body.appendChild(safeDiv);

    try {
      const canvas = await html2canvas(safeDiv, {
        scale: 2,
        backgroundColor: '#fff',
        useCORS: true,
        width: 230,
      });

      const escImage = canvasToEscPosRaster(canvas);
      const init = new Uint8Array([0x1B, 0x40]);
      const align = new Uint8Array([0x1B, 0x61, 0x01]);
      const cut = new Uint8Array([0x0A, 0x0A, 0x1D, 0x56, 0x00]);

      const payload = new Uint8Array(init.length + align.length + escImage.length + cut.length);
      payload.set(init, 0);
      payload.set(align, init.length);
      payload.set(escImage, init.length + align.length);
      payload.set(cut, init.length + align.length + escImage.length);

      for (let i = 0; i < payload.length; i += 180) {
        const slice = payload.slice(i, i + 180);
        if (characteristic.properties.writeWithoutResponse)
          await characteristic.writeValueWithoutResponse(slice);
        else await characteristic.writeValue(slice);
        await new Promise((r) => setTimeout(r, 40));
      }
    } finally {
      document.body.removeChild(safeDiv);
    }
  };

  const escapeHtml = (str) => {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const disconnectBluetooth = async () => {
    if (globalBluetoothConnection.device && globalBluetoothConnection.device.gatt.connected) {
      try {
        await globalBluetoothConnection.device.gatt.disconnect();
        console.log('Bluetooth disconnected');
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }

    globalBluetoothConnection.device = null;
    globalBluetoothConnection.characteristic = null;
    globalBluetoothConnection.connected = false;

    setBluetoothConnected(false);
    setPrinterDevice(null);
    setPrinterCharacteristic(null);

    alert('Bluetooth printer disconnected');
  };

  return (
    <>
      <ContactModal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false);
          setWhatsappNumber('');
        }}
        title="व्हॉट्सअॅप क्रमांक प्रविष्ट करा"
        number={whatsappNumber}
        setNumber={setWhatsappNumber}
        onConfirm={confirmWhatsAppShare}
        type="whatsapp"
      />

      <ContactModal
        isOpen={showSMSModal}
        onClose={() => {
          setShowSMSModal(false);
          setSmsNumber('');
        }}
        title="मोबाईल क्रमांक प्रविष्ट करा"
        number={smsNumber}
        setNumber={setSmsNumber}
        onConfirm={confirmSMSShare}
        type="sms"
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>

        <div className="flex items-center justify-between mb-4">
          <ActionBtn
            icon={FaWhatsapp}
            label={generatingImage ? "Generating..." : "WhatsApp"}
            onClick={() => handleWhatsAppShare(false)}
            color="bg-green-500 hover:bg-green-600"
            disabled={!voterData || generatingImage}
          />
          <ActionBtn
            icon={FiPrinter}
            label="Print"
            onClick={() => printViaBluetooth(false)}
            color="bg-indigo-600 hover:bg-indigo-700"
            disabled={printing || !voterData}
          />
          <ActionBtn
            icon={FiShare2}
            label="Share"
            onClick={() => navigator.share?.({
              title: `${candidateInfo.name}`,
              text: `Voter Details: ${voterData?.name}, Voter ID: ${voterData?.voterId}, Booth: ${voterData?.boothNumber}`,
            })}
            color="bg-purple-500 hover:bg-purple-600"
            disabled={!voterData}
          />
          <ActionBtn
            icon={FiMessageCircle}
            label="SMS"
            onClick={handleSMSShare}
            color="bg-blue-400 hover:bg-blue-500"
            disabled={!voterData}
          />
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiBluetooth className={bluetoothConnected ? "text-green-500" : "text-gray-400"} />
              <span className="text-xs text-gray-600">Printer: {bluetoothConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {bluetoothConnected && (
              <button
                onClick={disconnectBluetooth}
                className="text-red-600 text-xs hover:text-red-700 font-medium"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const ActionBtn = ({ icon: Icon, label, onClick, color, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`${color} text-white py-4 px-5 rounded-xl font-medium transition-all duration-200 flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm hover:shadow-md`}
  >
    <Icon className="text-lg" />
    <span className="text-xs">{label}</span>
  </button>
);

export default BluetoothPrinter;