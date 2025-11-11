import React, { useState } from 'react';
import { db } from '../Firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import TranslatedText from './TranslatedText';
import { FiUser, FiHash, FiFileText, FiMapPin, FiCheckCircle, FiAlertCircle, FiHome, FiCalendar } from 'react-icons/fi';

const NewSurvey = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    serialNumber: '',
    name: '',
    voterId: '',
    age: '',
    gender: '',
    boothNumber: '',
    pollingAddress: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Validate form data
      if (!formData.serialNumber || !formData.name || !formData.voterId) {
        throw new Error('Please fill in all required fields');
      }

      // Add voter to Firestore
      const voterData = {
        ...formData,
        age: parseInt(formData.age) || 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'voters'), voterData);
      setSuccess(true);
      setFormData({
        serialNumber: '',
        name: '',
        voterId: '',
        age: '',
        gender: '',
        boothNumber: '',
        pollingAddress: ''
      });
      
      // Auto hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center ">
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            <TranslatedText>New Voter Registration</TranslatedText>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            <TranslatedText>Add new voter details to the system database. Fields marked with * are required.</TranslatedText>
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-8 py-6">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  <TranslatedText>Voter Information Form</TranslatedText>
                </h2>
                <p className="text-orange-100 text-sm mt-1">
                  <TranslatedText>Complete all required fields to register new voter</TranslatedText>
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8">
            {/* Status Messages */}
            {error && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
                <FiAlertCircle className="text-red-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-medium text-sm">Error</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
            
            {success && (
              <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 animate-fade-in">
                <FiCheckCircle className="text-green-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-800 font-medium text-sm">Success</p>
                  <p className="text-green-600 text-sm mt-1">
                    <TranslatedText>Voter information has been saved successfully!</TranslatedText>
                  </p>
                </div>
              </div>
            )}

            {/* Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Serial Number */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <TranslatedText>Serial Number</TranslatedText> <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiHash className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleChange}
                    required
                    className="block w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter serial number"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <TranslatedText>Full Name</TranslatedText> <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiUser className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="block w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter voter's full name"
                  />
                </div>
              </div>

              {/* Voter ID */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <TranslatedText>Voter ID</TranslatedText> <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiFileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="voterId"
                    value={formData.voterId}
                    onChange={handleChange}
                    required
                    className="block w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter voter ID number"
                  />
                </div>
              </div>

              {/* Age */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <TranslatedText>Age</TranslatedText>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCalendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    min="18"
                    max="120"
                    className="block w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter age"
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <TranslatedText>Gender</TranslatedText>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="block w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white appearance-none cursor-pointer"
                >
                  <option value=""><TranslatedText>Select gender</TranslatedText></option>
                  <option value="male"><TranslatedText>Male</TranslatedText></option>
                  <option value="female"><TranslatedText>Female</TranslatedText></option>
                  <option value="other"><TranslatedText>Other</TranslatedText></option>
                </select>
              </div>

              {/* Booth Number */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  <TranslatedText>Booth Number</TranslatedText>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="boothNumber"
                    value={formData.boothNumber}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="Enter booth number"
                  />
                </div>
              </div>
            </div>

            {/* Polling Address - Full Width */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <TranslatedText>Polling Station Address</TranslatedText>
              </label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FiHome className="h-5 w-5 text-gray-400" />
                </div>
                <textarea
                  name="pollingAddress"
                  value={formData.pollingAddress}
                  onChange={handleChange}
                  rows={4}
                  className="block w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all duration-200 bg-gray-50 hover:bg-white resize-none"
                  placeholder="Enter complete polling station address"
                ></textarea>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={loading}
                className={`relative w-full px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95
                  ${loading ? 'opacity-80 cursor-not-allowed' : 'hover:from-orange-600 hover:to-red-600'}
                `}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span><TranslatedText>Processing...</TranslatedText></span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <FiCheckCircle className="w-5 h-5" />
                    <span><TranslatedText>Register Now</TranslatedText></span>
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            <TranslatedText>All information is securely stored and encrypted</TranslatedText>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default NewSurvey;