import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../Firebase/config';
import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  deleteField
} from 'firebase/firestore';
import { 
  FiArrowLeft, 
  FiUsers, 
  FiUserPlus, 
  FiPhone, 
  FiMail, 
  FiMapPin,
  FiBarChart2,
  FiTrash2,
  FiHome,
  FiPhoneCall,
  FiUser,
  FiSearch,
  FiX
} from 'react-icons/fi';
import TranslatedText from './TranslatedText';

const Team = () => {
  const [karyakartas, setKaryakartas] = useState([]);
  const [booths, setBooths] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [karyakartaToDelete, setKaryakartaToDelete] = useState(null);
  const [newKaryakarta, setNewKaryakarta] = useState({
    name: '',
    phone: '',
    email: '',
    area: '',
    assignedBooths: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const karyakartasCol = collection(db, 'karyakartas');
    const boothsCol = collection(db, 'booths');

    const unsubscribeKaryakartas = onSnapshot(karyakartasCol, (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setKaryakartas(list);
      } else {
        setKaryakartas([]);
      }
      setLoading(false);
    }, (err) => {
      console.error('karyakartas snapshot error', err);
      setLoading(false);
    });

    const unsubscribeBooths = onSnapshot(boothsCol, (snapshot) => {
      if (!snapshot.empty) {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setBooths(list);
      } else {
        setBooths([]);
      }
    }, (err) => console.error('booths snapshot error', err));

    return () => {
      try { unsubscribeKaryakartas(); } catch (e) {}
      try { unsubscribeBooths(); } catch (e) {}
    };
  }, []);

  const addKaryakarta = async () => {
    if (!newKaryakarta.name || !newKaryakarta.phone) {
      alert('Please fill in name and phone number');
      return;
    }

    try {
      const karyakartaId = `karyakarta_${Date.now()}`;
      const docRef = doc(db, 'karyakartas', karyakartaId);
      await setDoc(docRef, {
        id: karyakartaId,
        name: newKaryakarta.name.trim(),
        phone: newKaryakarta.phone.trim(),
        email: newKaryakarta.email.trim(),
        area: newKaryakarta.area.trim(),
        assignedBooths: [],
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      setShowAddModal(false);
      setNewKaryakarta({ name: '', phone: '', email: '', area: '', assignedBooths: [] });
      alert('✅ Karyakarta added successfully!');
    } catch (error) {
      console.error('Error adding karyakarta:', error);
      alert('❌ Failed to add karyakarta. Please try again.');
    }
  };

  const deleteKaryakarta = async () => {
    if (!karyakartaToDelete) return;

    try {
      // Delete karyakarta doc
      await deleteDoc(doc(db, 'karyakartas', karyakartaToDelete.id));

      // Unassign from booths using a batch update
      const q = query(collection(db, 'booths'), where('assignedKaryakarta', '==', karyakartaToDelete.id));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.forEach(bdoc => {
          const bref = doc(db, 'booths', bdoc.id);
          batch.update(bref, {
            assignedKaryakarta: deleteField(),
            karyakartaName: deleteField(),
            karyakartaPhone: deleteField()
          });
        });
        await batch.commit();
      }

      setShowDeleteModal(false);
      setKaryakartaToDelete(null);
      alert('✅ Karyakarta deleted successfully!');
    } catch (error) {
      console.error('Error deleting karyakarta:', error);
      alert('❌ Failed to delete karyakarta. Please try again.');
    }
  };

  const openDeleteModal = (karyakarta) => {
    const stats = getKaryakartaStats(karyakarta.id);
    if (stats.assignedBooths > 0) {
      alert(`Cannot delete ${karyakarta.name}. Please unassign them from ${stats.assignedBooths} booth(s) first.`);
      return;
    }
    setKaryakartaToDelete(karyakarta);
    setShowDeleteModal(true);
  };

  const getKaryakartaStats = (karyakartaId) => {
    const assignedBooths = booths.filter(booth => booth.assignedKaryakarta === karyakartaId);
    const totalVoters = assignedBooths.reduce((sum, booth) => sum + (booth.voterCount || 0), 0);
    const totalVoted = assignedBooths.reduce((sum, booth) => sum + (booth.votedCount || 0), 0);
    const withPhoneCount = assignedBooths.reduce((sum, booth) => sum + (booth.withPhoneCount || 0), 0);
    
    return {
      assignedBooths: assignedBooths.length,
      totalVoters,
      totalVoted,
      withPhoneCount,
      progress: totalVoters > 0 ? (totalVoted / totalVoters * 100).toFixed(1) : 0
    };
  };

  const filteredKaryakartas = karyakartas.filter(karyakarta =>
    karyakarta.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    karyakarta.phone.includes(searchTerm) ||
    karyakarta.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeKaryakartas = karyakartas.filter(k => getKaryakartaStats(k.id).assignedBooths > 0);
  const unassignedKaryakartas = karyakartas.filter(k => getKaryakartaStats(k.id).assignedBooths === 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium"><TranslatedText>Loading team data...</TranslatedText></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)} 
                className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-all duration-200"
              >
                <FiArrowLeft className="text-gray-700 text-lg" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  <TranslatedText>Team Management</TranslatedText>
                </h1>
                <p className="text-gray-500 text-sm">
                  <TranslatedText>Manage your karyakartas and their assignments</TranslatedText>
                </p>
              </div>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-all duration-200 shadow-sm flex items-center gap-2"
            >
              <FiUserPlus size={18} />
              <TranslatedText>Add Karyakarta</TranslatedText>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6 max-w-2xl">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search karyakartas by name, phone, or area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX size={18} />
              </button>
            )}
          </div>

          {/* Team Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{karyakartas.length}</div>
              <div className="text-gray-600 text-sm"><TranslatedText>Total Karyakartas</TranslatedText></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{activeKaryakartas.length}</div>
              <div className="text-gray-600 text-sm"><TranslatedText>Active Workers</TranslatedText></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">
                {booths.filter(b => b.assignedKaryakarta).length}
              </div>
              <div className="text-gray-600 text-sm"><TranslatedText>Assigned Booths</TranslatedText></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{unassignedKaryakartas.length}</div>
              <div className="text-gray-600 text-sm"><TranslatedText>Available</TranslatedText></div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Karyakartas Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FiUsers className="text-orange-500" />
              <TranslatedText>Karyakartas</TranslatedText> ({filteredKaryakartas.length})
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 text-sm"
              >
                <TranslatedText>Clear Search</TranslatedText>
              </button>
            </div>
          </div>
          
          {filteredKaryakartas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FiUsers className="inline text-4xl mb-4 text-gray-300" />
              <p className="text-lg font-semibold mb-2">
                <TranslatedText>
                  {searchTerm ? 'No karyakartas found' : 'No karyakartas added yet'}
                </TranslatedText>
              </p>
              <p className="text-gray-400 mb-4 text-sm">
                <TranslatedText>
                  {searchTerm ? 'Try adjusting your search terms' : 'Start by adding your first karyakarta'}
                </TranslatedText>
              </p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-all duration-200 shadow-sm"
              >
                <TranslatedText>Add First Karyakarta</TranslatedText>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKaryakartas.map((karyakarta) => {
                const stats = getKaryakartaStats(karyakarta.id);
                return (
                  <div key={karyakarta.id} className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 hover:shadow-md transition-all duration-200 bg-white group">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                          <FiUser className="text-orange-500" size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{karyakarta.name}</h3>
                          <p className="text-gray-600 text-sm flex items-center gap-1">
                            <FiMapPin className="text-orange-500" size={12} />
                            {karyakarta.area || <TranslatedText>No area assigned</TranslatedText>}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        stats.assignedBooths > 0 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}>
                        {stats.assignedBooths > 0 ? <TranslatedText>Active</TranslatedText> : <TranslatedText>Available</TranslatedText>}
                      </span>
                    </div>
                    
                    {/* Contact Info */}
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <FiPhone className="text-blue-500" size={14} />
                        <span className="font-medium">{karyakarta.phone}</span>
                      </div>
                      {karyakarta.email && (
                        <div className="flex items-center gap-2">
                          <FiMail className="text-purple-500" size={14} />
                          <span className="truncate">{karyakarta.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    {stats.assignedBooths > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                            <div className="font-bold text-blue-700 text-sm">{stats.assignedBooths}</div>
                            <div className="text-xs text-blue-600"><TranslatedText>Booths</TranslatedText></div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                            <div className="font-bold text-green-700 text-sm">{stats.totalVoters}</div>
                            <div className="text-xs text-green-600"><TranslatedText>Voters</TranslatedText></div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                            <div className="font-bold text-purple-700 text-sm">{stats.progress}%</div>
                            <div className="text-xs text-purple-600"><TranslatedText>Progress</TranslatedText></div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span><TranslatedText>Voting Progress</TranslatedText></span>
                            <span className="font-semibold">{stats.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${stats.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-3 bg-gray-50 rounded-lg mb-3 border border-gray-200">
                        <p className="text-gray-500 text-sm"><TranslatedText>No booths assigned</TranslatedText></p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => navigate('/booths')}
                        className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-all duration-200 flex items-center justify-center gap-1 shadow-sm"
                      >
                        <FiHome size={14} />
                        <TranslatedText>Assign Booth</TranslatedText>
                      </button>
                      <button 
                        onClick={() => openDeleteModal(karyakarta)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all duration-200 border border-red-200"
                        title="Delete Karyakarta"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Performance Overview */}
        {activeKaryakartas.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiBarChart2 className="text-orange-500" />
              <TranslatedText>Team Performance</TranslatedText>
            </h2>
            
            <div className="space-y-4">
              {activeKaryakartas.map((karyakarta) => {
                const stats = getKaryakartaStats(karyakarta.id);
                return (
                  <div key={karyakarta.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-all duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center">
                          <FiUser className="text-orange-500" size={14} />
                        </div>
                        <span className="font-semibold text-gray-900">{karyakarta.name}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiHome size={14} />
                          {stats.assignedBooths} <TranslatedText>booths</TranslatedText>
                        </span>
                        <span className="flex items-center gap-1">
                          <FiPhoneCall size={14} />
                          {stats.withPhoneCount} <TranslatedText>contacts</TranslatedText>
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-2">
                      <span>{stats.totalVoted} <TranslatedText>voted of</TranslatedText> {stats.totalVoters}</span>
                      <span className="font-semibold">{stats.progress}% <TranslatedText>complete</TranslatedText></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Karyakarta Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-xl">
                <TranslatedText>Add New Karyakarta</TranslatedText>
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                <TranslatedText>Fill in the details to add a new team member</TranslatedText>
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <TranslatedText>Full Name</TranslatedText> *
                </label>
                <input
                  type="text"
                  value={newKaryakarta.name}
                  onChange={(e) => setNewKaryakarta({...newKaryakarta, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <TranslatedText>Phone Number</TranslatedText> *
                </label>
                <input
                  type="tel"
                  value={newKaryakarta.phone}
                  onChange={(e) => setNewKaryakarta({...newKaryakarta, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <TranslatedText>Email Address</TranslatedText>
                </label>
                <input
                  type="email"
                  value={newKaryakarta.email}
                  onChange={(e) => setNewKaryakarta({...newKaryakarta, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <TranslatedText>Assigned Area</TranslatedText>
                </label>
                <input
                  type="text"
                  value={newKaryakarta.area}
                  onChange={(e) => setNewKaryakarta({...newKaryakarta, area: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                  placeholder="Enter assigned area/village"
                />
              </div>
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewKaryakarta({ name: '', phone: '', email: '', area: '', assignedBooths: [] });
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
              >
                <TranslatedText>Cancel</TranslatedText>
              </button>
              <button
                onClick={addKaryakarta}
                disabled={!newKaryakarta.name.trim() || !newKaryakarta.phone.trim()}
                className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
              >
                <TranslatedText>Add Karyakarta</TranslatedText>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && karyakartaToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-xl">
                <TranslatedText>Delete Karyakarta</TranslatedText>
              </h3>
              <p className="text-gray-500 text-sm mt-1">
                <TranslatedText>This action cannot be undone</TranslatedText>
              </p>
            </div>
            
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <FiUser className="text-red-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-red-800">{karyakartaToDelete.name}</div>
                    <div className="text-red-600 text-sm">{karyakartaToDelete.phone}</div>
                  </div>
                </div>
              </div>
              <p className="text-gray-700 text-center">
                <TranslatedText>Are you sure you want to delete</TranslatedText> <strong>{karyakartaToDelete.name}</strong> <TranslatedText>from the team?</TranslatedText>
              </p>
            </div>
            
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setKaryakartaToDelete(null);
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
              >
                <TranslatedText>Cancel</TranslatedText>
              </button>
              <button
                onClick={deleteKaryakarta}
                className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-all duration-200"
              >
                <TranslatedText>Delete</TranslatedText>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Team;