import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import useAutoTranslate from './hooks/useAutoTranslate';
import Dashboard from './Components/Dashboard';
import Upload from './Components/Upload';
import './App.css';
import Home from './Pages/Home';
import { ChevronDown, Globe, Menu, X, User, LogOut, Settings, Trash2, RefreshCw } from 'lucide-react';
import TranslatedText from './Components/TranslatedText';
import BoothManagement from './Components/BoothManagement';
import FilterPage from './Components/FilterPage';
import FullVoterDetails from './Components/FullVoterDetails';
import Team from './Components/Team';
import Contactus from './Components/Contactus';
import Setting from './Components/Setting';
import NewSurvey from './Components/NewSurvey';
import { VoterProvider } from './Context/VoterContext';
import usePendingSync from './hooks/usePendingSync';
import { syncPendingWrites } from './services/pendingSync';
import { CandidateProvider, useCandidate } from './Context/CandidateContext';
import Login from './Pages/Login';
import WhatsAppShare from './Components/WhatsAppShare';

// Clear Site Data Function
const clearSiteData = async () => {
  try {
    console.log('🧹 Starting to clear all site data...');

    // 1. Clear IndexedDB
    if (window.indexedDB) {
      const databases = await window.indexedDB.databases();
      for (const database of databases) {
        if (database.name) {
          window.indexedDB.deleteDatabase(database.name);
          console.log(`🗑️ Deleted IndexedDB: ${database.name}`);
        }
      }
    }

    // 2. Clear localStorage
    localStorage.clear();
    console.log('🗑️ Cleared localStorage');

    // 3. Clear sessionStorage
    sessionStorage.clear();
    console.log('🗑️ Cleared sessionStorage');

    // 4. Clear cookies
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;
    }
    console.log('🗑️ Cleared cookies');

    // 5. Clear service worker cache (if any)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('🗑️ Cleared service worker caches');
    }

    // 6. Clear application cache (if any)
    if (window.applicationCache) {
      window.applicationCache.clear();
    }

    console.log('✅ All site data cleared successfully!');

    // Show success message and reload
    setTimeout(() => {
      alert('All site data has been cleared successfully! The app will now reload.');
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('❌ Error clearing site data:', error);
    alert('Error clearing site data: ' + error.message);
  }
};

// Clear Data Button Component
const ClearDataButton = ({ mobile = false }) => {
  const [isClearing, setIsClearing] = useState(false);

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear ALL site data? This will delete all voter data, surveys, and settings. This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      await clearSiteData();
    } catch (error) {
      console.error('Error clearing data:', error);
    } finally {
      setIsClearing(false);
    }
  };

  if (mobile) {
    return (
      <button
        onClick={handleClearData}
        disabled={isClearing}
        className="w-full flex items-center gap-3 text-md px-4 py-3 rounded-xl text-base bg-red-500 font-medium text-white hover:bg-red-50 hover:text-red-700 transition-all duration-200 disabled:opacity-50"
      >
        <Trash2 className="w-5 h-5" />
        <span><TranslatedText>Clear All Data</TranslatedText></span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClearData}
      disabled={isClearing}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 hover:border-red-300 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 transition-all duration-200 shadow-sm disabled:opacity-50"
      title="Clear all site data and reload"
    >
      {isClearing ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      <span className="text-sm font-medium">{isClearing ? 'Clearing...' : 'Clear Data'}</span>
    </button>
  );
};

// Navigation component for better organization
const Navigation = ({ currentLanguage, languages, changeLanguage, translating, mobileMenuOpen, setMobileMenuOpen, onLogout }) => {
  const location = useLocation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { candidateInfo } = useCandidate();

  const navigation = [
    { name: 'Home', path: '/home', icon: '' },
    { name: 'Search', path: '/search', icon: '' },
    { name: 'Booth', path: '/booths', icon: '' },
    { name: 'Lists', path: '/lists', icon: '' },
    { name: 'New Survey', path: '/new-survey', icon: '' },
    { name: 'Setting', path: '/settings', icon: '' },
    { name: 'Contact', path: '/contact', icon: '' },
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    onLogout();
  };

  return (
    <nav className="bg-gradient-to-l from-orange-500 to-orange-600 border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="flex items-center gap-3 group"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full flex items-center justify-center">
                  <img
                    src={candidateInfo.logoImageCircle}
                    alt="Logo"
                    className='rounded-full'
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white group-hover:text-gray-100 transition-colors">
                  <TranslatedText>{candidateInfo.name}</TranslatedText>
                </span>
                <span className="text-xs text-gray-50 group-hover:text-gray-100 transition-colors">
                  <TranslatedText>{candidateInfo.TagLine}</TranslatedText>
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(item.path)
                  ? 'bg-gray-100 text-orange-700 border border-orange-200 shadow-sm'
                  : 'text-gray-50 hover:text-gray-100 hover:bg-orange-700'
                  }`}
              >
                <TranslatedText className='text-semibold'>{item.name}</TranslatedText>
              </Link>
            ))}
          </div>

          {/* Right Side Controls */}
          <div className="hidden md:flex items-center gap-3">
            {/* Clear Data Button */}
            <ClearDataButton />

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLanguageOpen(!languageOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm"
              >
                <Globe className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {languages.find(lang => lang.code === currentLanguage)?.flag}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${languageOpen ? 'rotate-180' : ''}`} />
              </button>

              {languageOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLanguageOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="p-2">
                      <div className="text-xs font-semibold text-gray-500 px-3 py-2 uppercase tracking-wide">
                        Select Language
                      </div>
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            changeLanguage(lang.code);
                            setLanguageOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${currentLanguage === lang.code
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          disabled={translating}
                        >
                          <span className="text-lg">{lang.flag}</span>
                          <span className="font-medium flex-1 text-left">{lang.name}</span>
                          {currentLanguage === lang.code && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">
                    Admin
                  </div>
                  <div className="text-xs text-gray-500"><TranslatedText>User</TranslatedText></div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="p-2">
                      <div className="px-3 py-3 border-b border-gray-100">
                        <div className="text-sm font-semibold text-gray-900">
                          Admin User
                        </div>
                        <div className="text-xs text-gray-500">Jannetaa123</div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700"><TranslatedText>Sign Out</TranslatedText></span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition-colors shadow-sm"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
          <div className="px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${isActive(item.path)
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                <TranslatedText>{item.name}</TranslatedText>
              </Link>
            ))}

            {/* Mobile Clear Data Button */}
            <div className="pt-2">
              <ClearDataButton mobile={true} />
            </div>

            {/* Mobile Language Selector */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="text-sm font-semibold text-gray-500 px-4 py-2 uppercase tracking-wide">
                <TranslatedText>Language</TranslatedText>
              </div>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${currentLanguage === lang.code
                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                    : 'hover:bg-gray-50 text-gray-700'
                    }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="font-medium"><TranslatedText>{lang.name}</TranslatedText></span>
                  {currentLanguage === lang.code && (
                    <div className="ml-auto w-2 h-2 bg-orange-500 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Mobile User Info & Logout */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">
                    Admin User
                  </div>
                  <div className="text-xs text-gray-500">Jannetaa123</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span><TranslatedText>Sign Out</TranslatedText></span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  try {
    const saved = localStorage.getItem('preferredLanguage');
    if (!saved) {
      localStorage.setItem('preferredLanguage', 'mr');
      if (typeof document !== 'undefined') document.documentElement.lang = 'mr';
    }
  } catch { }

  const [currentView, setCurrentView] = useState('upload');
  const [uploadComplete, setUploadComplete] = useState(false);
  const { currentLanguage, languages, changeLanguage, translating } = useAutoTranslate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if user is already logged in
    const savedAuth = localStorage.getItem('isAuthenticated');
    return savedAuth === 'true';
  });

  const handleUploadComplete = (totalVoters) => {
    setUploadComplete(true);
    setCurrentView('dashboard');
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
  };

  useEffect(() => {
    syncPendingWrites();
    const interval = setInterval(syncPendingWrites, 10 * 60 * 1000); // every 10 mins
    return () => clearInterval(interval);
  }, []);

  usePendingSync({ intervalMs: 30000 }); // try every 30s when online

  return (
    <CandidateProvider>
      <VoterProvider>
        <Router>
          <div className="App min-h-screen">
            {isAuthenticated && (
              <Navigation
                currentLanguage={currentLanguage}
                languages={languages}
                changeLanguage={changeLanguage}
                translating={translating}
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                onLogout={handleLogout}
              />
            )}

            <main className="flex-1">
              <Routes>
                <Route
                  path="/login"
                  element={
                    isAuthenticated ?
                      <Navigate to="/home" replace /> :
                      <Login onLogin={handleLogin} />
                  }
                />

                <Route
                  path="/upload"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <Upload onUploadComplete={handleUploadComplete} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/home"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <Team />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/booths"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <BoothManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lists"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <FilterPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/voter/:voterId"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <FullVoterDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/contact"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <Contactus />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/survey"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <NewSurvey />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/demo"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <WhatsAppShare />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <Setting />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/new-survey"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <NewSurvey />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <Navigate to={isAuthenticated ? "/home" : "/login"} replace />
                  }
                />
              </Routes>
            </main>

            {isAuthenticated && (
              <footer className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[95%] md:w-auto">
                {/* <div className="backdrop-blur-sm bg-white border border-white/30 shadow-lg w-auto rounded-full px-4 py-2 flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap select-none">
                  <strong className="text-orange-500 font-semibold tracking-wide">
                    <CandidateFooter />
                  </strong>
                </div> */}
              </footer>
            )}
          </div>
        </Router>
      </VoterProvider>
    </CandidateProvider>
  );
}

// Separate component for footer to use candidate hook
const CandidateFooter = () => {
  const { candidateInfo } = useCandidate();
  return candidateInfo?.ReSellerName;
};

export default App;