import React, { useState, useEffect } from 'react';
import { FiPrinter, FiBluetooth, FiDownload, FiShare2, FiMessageCircle, FiX } from 'react-icons/fi';
import { FaWhatsapp, FaRegFilePdf } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import TranslatedText from './TranslatedText';
import { db } from '../Firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  const { candidateInfo } = useCandidate();

  // Website URL - update this with your actual domain
  const WEBSITE_URL = "https://testing-election-app.vercel.app/";

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

    // Prefetch small assets to show preview faster (non-blocking)
    prefetchSitePreview();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voter]);

  // Prefetch homepage (light, non-blocking) to help preview/link open speed
  const prefetchSitePreview = async () => {
    try {
      // Try to create a hidden img to warm cache. It's safe and non-blocking.
      const img = new Image();
      img.src = WEBSITE_URL;
      img.style.display = 'none';
      document.body.appendChild(img);
      setTimeout(() => {
        try { document.body.removeChild(img); } catch (e) {}
      }, 1000);
    } catch (e) {
      // ignore
    }
  };

  // Load voter data from local storage or Firebase and merge voter_surveys
  const loadVoterData = async () => {
    try {
      const docId = voter?.id || voter?.voterId;
      if (!docId) {
        setVoterData(voter);
        return;
      }

      // 1) Try to get from local storage first
      const localVoterData = localStorage.getItem(`voter_${docId}`);
      let merged = { ...(voter || {}) };

      if (localVoterData) {
        try {
          const parsedData = JSON.parse(localVoterData);
          merged = { ...merged, ...parsedData };
        } catch (e) {
          console.warn('local parse error', e);
        }
      } else {
        // Try to get from voters collection
        const voterDocRef = doc(db, 'voters', String(docId));
        const voterDoc = await getDoc(voterDocRef);
        if (voterDoc.exists()) {
          const data = voterDoc.data();
          merged = { ...merged, ...data };
          localStorage.setItem(`voter_${docId}`, JSON.stringify(data));
        }
      }

      // 2) Try to merge contact info from voter_surveys (preferred source for contact)
      try {
        const vsRef = doc(db, 'voter_surveys', String(docId));
        const vsSnap = await getDoc(vsRef);
        if (vsSnap.exists()) {
          const vsData = vsSnap.data() || {};
          // Normalize phone keys (phone, whatsapp)
          if (vsData.whatsapp) merged.whatsapp = String(vsData.whatsapp).replace(/\D/g, '');
          if (vsData.phone) merged.phone = String(vsData.phone).replace(/\D/g, '');
        }
      } catch (e) {
        console.warn('voter_surveys fetch failed', e);
      }

      // Save merged to local storage for quick future reads
      localStorage.setItem(`voter_${docId}`, JSON.stringify(merged));
      setVoterData(merged);
    } catch (error) {
      console.error('Error loading voter data:', error);
      setVoterData(voter);
    }
  };

  // Save contact number to voters and voter_surveys and local storage
  const saveContactNumber = async (type, number) => {
    try {
      const docId = voter?.id || voter?.voterId;
      if (!docId) throw new Error('Voter ID not available');

      const cleaned = String(number).replace(/\D/g, '');
      const updateData = type === 'whatsapp' ? { whatsapp: cleaned } : { phone: cleaned };

      // Save to voters collection (merge)
      const voterDocRef = doc(db, 'voters', String(docId));
      await setDoc(voterDocRef, updateData, { merge: true });

      // Save to voter_surveys root (merge)
      const vsDocRef = doc(db, 'voter_surveys', String(docId));
      await setDoc(vsDocRef, updateData, { merge: true });

      // Update local storage
      const localVoterDataRaw = localStorage.getItem(`voter_${docId}`);
      let localVoterData = {};
      if (localVoterDataRaw) {
        try { localVoterData = JSON.parse(localVoterDataRaw); } catch (e) { localVoterData = {}; }
      }
      const newLocal = { ...localVoterData, ...updateData };
      localStorage.setItem(`voter_${docId}`, JSON.stringify(newLocal));

      // Update local state quickly
      setVoterData(prev => ({ ...prev, ...updateData }));

      return true;
    } catch (error) {
      console.error(`Error saving ${type} number:`, error);
      return false;
    }
  };

  const getContactNumber = (type) => {
    const val = voterData?.[type];
    if (!val) return '';
    return String(val).replace(/\D/g, '');
  };

  const hasContactNumber = (type) => {
    const number = getContactNumber(type);
    return number && number.length === 10;
  };

  const validatePhoneNumber = (number) => {
    const cleaned = String(number || '').replace(/\D/g, '');
    return cleaned.length === 10;
  };

  // Ensure we treat names as raw strings (preserve dots etc.)
  const safeString = (v) => {
    if (v === null || v === undefined) return '';
    // replace invisible characters and trim, but keep dots and letters
    return String(v).replace(/\u200C/g, '').replace(/\u200B/g, '').trim();
  };

  const generateWhatsAppMessage = (isFamily = false) => {
    if (!voterData) return '';

    // Use safeString to preserve punctuation (dots)
    let message = `*${safeString(candidateInfo.party)}*\n`;
    message += `*${safeString(candidateInfo.name)}*\n\n`;

    if (isFamily && Array.isArray(familyMembers) && familyMembers.length > 0) {
      message += `*कुटुंब तपशील*\n\n`;
      message += `*1) ${safeString(voterData.name)}*\n`;
      message += `अनुक्रमांक: ${safeString(voterData.serialNumber || 'N/A')}\n`;
      message += `मतदार आयडी: ${safeString(voterData.voterId || 'N/A')}\n`;
      message += `बूथ क्र.: ${safeString(voterData.boothNumber || 'N/A')}\n`;
      message += `लिंग: ${safeString(voterData.gender || 'N/A')}\n`;
      message += `वय: ${safeString(voterData.age || 'N/A')}\n`;
      message += `मतदान केंद्र: ${safeString(voterData.pollingStationAddress || 'N/A')}\n\n`;

      familyMembers.forEach((member, index) => {
        message += `*${index + 2}) ${safeString(member.name)}*\n`;
        message += `अनुक्रमांक: ${safeString(member.serialNumber || 'N/A')}\n`;
        message += `मतदार आयडी: ${safeString(member.voterId || 'N/A')}\n`;
        message += `बूथ क्र.: ${safeString(member.boothNumber || 'N/A')}\n`;
        message += `लिंग: ${safeString(member.gender || 'N/A')}\n`;
        message += `वय: ${safeString(member.age || 'N/A')}\n`;
        message += `मतदान केंद्र: ${safeString(member.pollingStationAddress || 'N/A')}\n\n`;
      });
    } else {
      message += `*मतदार तपशील*\n\n`;
      message += `*नाव:* ${safeString(voterData.name)}\n`;
      message += `*मतदार आयडी:* ${safeString(voterData.voterId || 'N/A')}\n`;
      message += `*अनुक्रमांक:* ${safeString(voterData.serialNumber || 'N/A')}\n`;
      message += `*बूथ क्र.:* ${safeString(voterData.boothNumber || 'N/A')}\n`;
      message += `*लिंग:* ${safeString(voterData.gender || 'N/A')}\n`;
      message += `*वय:* ${safeString(voterData.age || 'N/A')}\n`;
      message += `*मतदान केंद्र:* ${safeString(voterData.pollingStationAddress || 'N/A')}\n\n`;
    }

    message += `मी आपला *${safeString(candidateInfo.name)}* माझी निशाणी *${safeString(candidateInfo.electionSymbol)}* या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा\n\n`;
    message += `📍 *अधिक माहितीसाठी भेट द्या:* ${WEBSITE_URL}`;

    return message;
  };

  // Main WhatsApp share flow
  const handleWhatsAppShare = async (isFamilyShare = false) => {
    if (!voterData) return;

    setIsFamily(isFamilyShare);

    const docId = voter?.id || voter?.voterId;
    // Prefer the voter_surveys contact if available (we merged it on load)
    const vsNumber = getContactNumber('whatsapp');

    if (vsNumber && vsNumber.length === 10) {
      const message = generateWhatsAppMessage(isFamilyShare);
      const url = `https://wa.me/91${vsNumber}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      return;
    }

    // If no number saved, open modal prefilled with any existing number (if any)
    setWhatsappNumber(getContactNumber('whatsapp') || '');
    setShowWhatsAppModal(true);
  };

  const handleSMSShare = async () => {
    if (!voterData) return;

    const vsNumber = getContactNumber('phone');

    if (vsNumber && vsNumber.length === 10) {
      const message = generateWhatsAppMessage(false);
      window.open(`sms:${vsNumber}?body=${encodeURIComponent(message)}`, '_blank');
      return;
    }

    setSmsNumber(getContactNumber('phone') || '');
    setShowSMSModal(true);
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

  // Bluetooth connection functions remain the same...
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
        name: await translateToMarathi(safeString(voter.name || '')),
        voterId: await translateToMarathi(safeString(voter.voterId || '')),
        serialNumber: await translateToMarathi(String(voter.serialNumber ?? '')),
        boothNumber: await translateToMarathi(String(voter.boothNumber ?? '')),
        pollingStationAddress: await translateToMarathi(safeString(voter.pollingStationAddress || '')),
        gender: await translateToMarathi(safeString(voterGender)),
        age: await translateToMarathi(safeString(voterAge)),
      };

      const translatedFamily =
        isFamily && familyMembers.length > 0
          ? await Promise.all(
            familyMembers.map(async (member) => {
              const mGender = member?.gender || '';
              const mAge = (member?.age ?? '')?.toString?.() || '';
              return {
                ...member,
                name: await translateToMarathi(safeString(member.name || '')),
                voterId: await translateToMarathi(safeString(member.voterId || '')),
                boothNumber: await translateToMarathi(String(member.boothNumber ?? '')),
                pollingStationAddress: await translateToMarathi(safeString(member.pollingStationAddress || '')),
                gender: await translateToMarathi(safeString(mGender)),
                age: await translateToMarathi(safeString(mAge)),
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
    // improve wrapping and preserve punctuation
    safeDiv.style.whiteSpace = 'pre-wrap';
    safeDiv.style.wordBreak = 'break-word';
    safeDiv.style.overflowWrap = 'break-word';

    const esc = (s) => escapeHtml(s);

    let html = `
      <div style="text-align:center;font-weight:700;font-size:13px;border-bottom:1px solid #000;padding-bottom:8px;">
        ${esc(candidateInfo.party)}<br/>
        <div style="font-size:18px;margin:4px 0;">${esc(candidateInfo.name)}</div>
        <div style="font-size:14px;">${esc(candidateInfo.slogan)}</div>
        <div style="font-size:14px;margin-top:4px;padding-bottom:8px;">${esc(candidateInfo.area)}</div>
      </div>
    `;

    if (isFamily && Array.isArray(familyData) && familyData.length > 0) {
      html += `
        <div style="text-align:center;margin-top:6px;font-size:14px;"><b>कुटुंब तपशील</b></div>
        <div style="margin-top:6px;font-size:14px;"><b>1) <span style="white-space:pre-wrap;">${esc(voterData.name)}</span></b></div>
        <div style="font-size:14px;">अनुक्रमांक: <span style="white-space:pre-wrap;">${esc(voterData.serialNumber || '')}</span></div>
        <div style="font-size:14px;">मतदार आयडी: <span style="white-space:pre-wrap;">${esc(voterData.voterId || '')}</span></div>
        <div style="font-size:14px;">बूथ क्रमांक: <span style="white-space:pre-wrap;">${esc(voterData.boothNumber || '')}</span></div>
        <div style="font-size:14px;">लिंग: <span style="white-space:pre-wrap;">${esc(voterData.gender || '')}</span></div>
        <div style="font-size:14px;">वय: <span style="white-space:pre-wrap;">${esc(voterData.age || '')}</span></div>
        <div style="margin-top:4px;border-bottom:1px solid #000;padding-bottom:10px;font-size:14px;">मतदान केंद्र: <span style="white-space:pre-wrap;">${esc(voterData.pollingStationAddress || '')}</span></div>
      `;

      familyData.forEach((m, i) => {
        html += `
          <div style="margin-top:6px;font-size:14px;margin-bottom:2px;border-bottom:1px solid #000;padding-bottom:10px;">
            <div style="font-weight:700;"><span style="white-space:pre-wrap;">${i + 2}) ${esc(m.name || '')}</span></div>
            <div style="margin-top:4px;">अनुक्रमांक: <span style="white-space:pre-wrap;">${esc(m.serialNumber || '')}</span></div>
            <div style="margin-top:2px;">मतदार आयडी: <span style="white-space:pre-wrap;">${esc(m.voterId || '')}</span></div>
            <div style="margin-top:2px;">बूथ क्रमांक: <span style="white-space:pre-wrap;">${esc(m.boothNumber || '')}</span></div>
            <div style="margin-top:2px;">लिंग: <span style="white-space:pre-wrap;">${esc(m.gender || '')}</span></div>
            <div style="margin-top:2px;">वय: <span style="white-space:pre-wrap;">${esc(m.age || '')}</span></div>
            <div style="margin-top:4px;font-size:13px;">मतदान केंद्र: <span style="white-space:pre-wrap;">${esc(m.pollingStationAddress || '')}</span></div>
          </div>
        `;
      });

      html += `
        <div style="margin-top:6px;border-top:1px solid #000;padding-top:6px;font-size:13px;">
          मी आपला <b>${esc(candidateInfo.name)}</b> माझी निशाणी <b>${esc(candidateInfo.electionSymbol)}</b> या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा
        </div>
        <div style="margin-top:6px;font-size:12px;text-align:center;">
          अधिक माहितीसाठी: ${WEBSITE_URL}
        </div>
        <div style="margin-top:18px;text-align:center;"></div>
      `;
    } else {
      html += `
        <div style="text-align:center;margin-top:6px;font-weight:700;">मतदार तपशील</div>
        <div style="margin-top:6px;"><b>नाव:</b> <span style="white-space:pre-wrap;">${esc(voterData.name || '')}</span></div>
        <div style="margin-top:4px;"><b>मतदार आयडी:</b> <span style="white-space:pre-wrap;">${esc(voterData.voterId || '')}</span></div>
        <div style="margin-top:4px;"><b>अनुक्रमांक:</b> <span style="white-space:pre-wrap;">${esc(voterData.serialNumber || '')}</span></div>
        <div style="margin-top:4px;"><b>बूथ क्रमांक:</b> <span style="white-space:pre-wrap;">${esc(voterData.boothNumber || '')}</span></div>
        <div style="margin-top:4px;"><b>लिंग:</b> <span style="white-space:pre-wrap;">${esc(voterData.gender || '')}</span></div>
        <div style="margin-top:4px;"><b>वय:</b> <span style="white-space:pre-wrap;">${esc(voterData.age || '')}</span></div>
        <div style="margin-top:6px;margin-bottom:10px;"><b>मतदान केंद्र:</b> <span style="white-space:pre-wrap;">${esc(voterData.pollingStationAddress || '')}</span></div>
       <div style="margin-top:6px;border-top:1px solid #000;padding-top:6px;font-size:13px;">
          मी आपला <b>${esc(candidateInfo.name)}</b> माझी निशाणी <b>${esc(candidateInfo.electionSymbol)}</b> या चिन्हावर मतदान करून मला प्रचंड बहुमतांनी विजय करा
        </div>
        <div style="margin-top:6px;font-size:12px;text-align:center;">
          अधिक माहितीसाठी: ${WEBSITE_URL}
        </div>
        <div style="margin-top:6px;text-align:center;font-weight:700;">${esc(candidateInfo.name)}</div>
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
      try { document.body.removeChild(safeDiv); } catch (e) { /* ignore */ }
    }
  };

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
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
            label="WhatsApp"
            onClick={() => handleWhatsAppShare(false)}
            color="bg-green-500 hover:bg-green-600"
            disabled={!voterData}
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
              text: `Voter Details: ${voterData?.name}, Voter ID: ${voterData?.voterId}, Booth: ${voterData?.boothNumber}\n\nVisit: ${WEBSITE_URL}`,
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
  </button>
);

export default BluetoothPrinter;
