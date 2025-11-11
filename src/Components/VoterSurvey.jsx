import React, { useState, useEffect } from 'react';
import { db } from '../Firebase/config';
import { doc, setDoc, collection } from 'firebase/firestore';
import { dbLocal } from '../libs/localdb';
import TranslatedText from './TranslatedText';

const VoterSurvey = ({ voter, onUpdate }) => {
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

  const [saving, setSaving] = useState(false);

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

  const handleInputChange = (field, value) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (field, value) => {
    // Allow only numbers and limit to 10 digits
    let formattedValue = value.replace(/\D/g, '');
    if (formattedValue.length > 10) {
      formattedValue = formattedValue.slice(0, 10);
    }
    setSurveyData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const formatPhoneDisplay = (value) => {
    if (!value) return '';
    return value;
  };

  const saveSurveyData = async () => {
    if (!voter?.voterId) {
      alert('Missing voterId — cannot save survey!');
      return;
    }

    setSaving(true);
    try {
      const surveyDoc = {
        voterId: voter.voterId, // ✅ link to static voter
        ...surveyData,
        updatedAt: new Date().toISOString(),
      };

      // ✅ 1. Save to Firestore in "voter_surveys" collection
      const docRef = doc(collection(db, 'voter_surveys'), voter.voterId);
      await setDoc(docRef, surveyDoc, { merge: true });

      // ✅ 2. Save to IndexedDB (for offline)
      await dbLocal.voter_surveys.put({
        id: voter.voterId, // primary key in local DB
        ...surveyDoc,
      });

      alert('Survey data saved successfully (both local + cloud)!');
      onUpdate?.();
    } catch (error) {
      console.error('Error saving survey data:', error);
      alert('Failed to save survey data.');
    } finally {
      setSaving(false);
    }
  };

  const clearSurveyData = async () => {
    if (!voter?.voterId) return;

    const confirmDelete = window.confirm('Are you sure you want to clear this survey data?');
    if (!confirmDelete) return;

    setSaving(true);
    try {
      // Clear in Firestore
      const docRef = doc(collection(db, 'voter_surveys'), voter.voterId);
      await setDoc(docRef, {}, { merge: false }); // overwrite empty

      // Clear in IndexedDB
      await dbLocal.voter_surveys.delete(voter.voterId);

      // Reset local state
      setSurveyData({
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

      alert('Survey data cleared successfully (both local + cloud).');
      onUpdate?.();
    } catch (error) {
      console.error('Error clearing survey data:', error);
      alert('Failed to clear survey data.');
    } finally {
      setSaving(false);
    }
  };

  const cities = ['Akola', 'Amravati', 'Nagpur', 'Mumbai', 'Pune', 'Other'];
  const categories = ['', 'General', 'OBC', 'SC', 'ST', 'Other'];
  const educationLevels = ['', 'Nothing', '10th Pass', '12th Pass', 'Graduation', 'Upper Education'];
  const occupations = ['', 'Student', 'Farmer', 'Business', 'Service', 'Professional', 'Housewife', 'Retired', 'Unemployed', 'Other'];

  return (
    <div className="space-y-6 bg-white rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="text-orange-500"></span>
          <TranslatedText>Voter Survey</TranslatedText>
        </h3>
        <div className="text-xs bg-orange-50 text-orange-700 px-3 py-1 rounded-full font-medium">
          <TranslatedText>Required fields marked with *</TranslatedText>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Personal Information Section */}
        <div className="rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-blue-500"></span>
            <TranslatedText>Personal Information</TranslatedText>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Gender</TranslatedText> *
              </label>
              <select
                value={surveyData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
              >
                <option value=""><TranslatedText>Select Gender</TranslatedText></option>
                <option value="Male"><TranslatedText>Male</TranslatedText></option>
                <option value="Female"><TranslatedText>Female</TranslatedText></option>
                <option value="Other"><TranslatedText>Other</TranslatedText></option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Date of Birth</TranslatedText>
              </label>
              <input
                type="date"
                value={surveyData.dob}
                onChange={(e) => handleInputChange('dob', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Contact Information Section */}
        <div className="rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-green-500"></span>
            <TranslatedText>Contact Information</TranslatedText>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>WhatsApp Number</TranslatedText>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 text-sm font-medium">+91</span>
                <input
                  type="tel"
                  value={surveyData.whatsapp}
                  onChange={(e) => handlePhoneChange('whatsapp', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
                  placeholder="9876543210"
                  maxLength={10}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <TranslatedText>Enter 10-digit number without +91</TranslatedText>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Phone Number</TranslatedText>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 text-sm font-medium">+91</span>
                <input
                  type="tel"
                  value={surveyData.phone}
                  onChange={(e) => handlePhoneChange('phone', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
                  placeholder="9876543210"
                  maxLength={10}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <TranslatedText>Enter 10-digit number without +91</TranslatedText>
              </div>
            </div>
          </div>
        </div>

        {/* Address Information Section */}
        <div className=" rounded-lg ">
          <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-purple-500"></span>
            <TranslatedText>Address Information</TranslatedText>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>City</TranslatedText> *
              </label>
              <select
                value={surveyData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
              >
                {cities.map(city => (
                  <option key={city} value={city}><TranslatedText>{city}</TranslatedText></option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Town/Village</TranslatedText>
              </label>
              <input
                type="text"
                value={surveyData.town}
                onChange={(e) => handleInputChange('town', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
                placeholder="Enter town/village"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Colony/Area</TranslatedText>
              </label>
              <input
                type="text"
                value={surveyData.colony}
                onChange={(e) => handleInputChange('colony', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
                placeholder="Enter colony/area"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2 font-medium">
              <TranslatedText>Detailed Address</TranslatedText>
            </label>
            <textarea
              value={surveyData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white resize-none"
              placeholder="Enter complete address with landmarks..."
            />
          </div>
        </div>

        {/* Socio-Economic Information Section */}
        <div className="">
          <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-indigo-500"></span>
            <TranslatedText>Socio-Economic Information</TranslatedText>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Category</TranslatedText>
              </label>
              <select
                value={surveyData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}><TranslatedText>{cat || 'Select Category'}</TranslatedText></option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Education</TranslatedText>
              </label>
              <select
                value={surveyData.education}
                onChange={(e) => handleInputChange('education', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
              >
                {educationLevels.map(edu => (
                  <option key={edu} value={edu}><TranslatedText>{edu || 'Select Education'}</TranslatedText></option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Occupation</TranslatedText>
              </label>
              <select
                value={surveyData.occupation}
                onChange={(e) => handleInputChange('occupation', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white"
              >
                {occupations.map(occ => (
                  <option key={occ} value={occ}><TranslatedText>{occ || 'Select Occupation'}</TranslatedText></option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Additional Information Section */}
        <div className="">
          <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-teal-500"></span>
            <TranslatedText>Additional Information</TranslatedText>
          </h4>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Key Issues / Concerns</TranslatedText>
              </label>
              <textarea
                value={surveyData.issues}
                onChange={(e) => handleInputChange('issues', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white resize-none"
                placeholder="What issues matter most to this voter?"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2 font-medium">
                <TranslatedText>Remarks / Notes</TranslatedText>
              </label>
              <textarea
                value={surveyData.remarks}
                onChange={(e) => handleInputChange('remarks', e.target.value)}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-white resize-none"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={saveSurveyData}
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <TranslatedText>Saving...</TranslatedText>
            </>
          ) : (
            <>
              <TranslatedText>Save Survey Data</TranslatedText>
            </>
          )}
        </button>
        <button
          onClick={clearSurveyData}
          disabled={saving}
          className="flex-1 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:from-gray-300 hover:to-gray-400 transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <TranslatedText>Clear All</TranslatedText>
        </button>
      </div>
    </div>
  );
};

export default VoterSurvey;