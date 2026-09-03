import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import InflowPage from './pages/InflowPage';
import SplitPage from './pages/SplitPage';
import ProposalsPage from './pages/ProposalsPage';
import DigestPage from './pages/DigestPage';
import CardsPage from './pages/CardsPage';
import './App.css';

function Navigation() {
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');

  if (!isApp) return null;

  return (
    <nav className="glass" style={{
      position: 'fixed', bottom: '20px', left: '20px', right: '20px',
      maxWidth: '440px', margin: '0 auto', padding: '12px 20px',
      display: 'flex', justifyContent: 'space-around', zIndex: 100
    }}>
      <Link to="/app" style={{ color: location.pathname === '/app' ? '#667eea' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
        Inflow
      </Link>
      <Link to="/app/proposals" style={{ color: location.pathname === '/app/proposals' ? '#667eea' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
        Proposals
      </Link>
      <Link to="/app/cards" style={{ color: location.pathname === '/app/cards' ? '#667eea' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
        Cards
      </Link>
    </nav>
  );
}

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;
  return <div className="offline-banner">You're offline. Some features may be unavailable.</div>;
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setDeferredPrompt(null);
  };

  if (!showInstall || !location.pathname.startsWith('/app')) return null;
  return (
    <div className="install-banner glass">
      <span style={{ fontSize: '14px', fontWeight: 500 }}>Install Delta</span>
      <button className="btn btn-primary" onClick={handleInstall} style={{ padding: '8px 16px' }}>
        Install
      </button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={
          <div className="container">
            <div className="header">
              <div className="logo">Delta</div>
            </div>
            <InflowPage />
          </div>
        } />
        <Route path="/app/split/:inflowEventId" element={
          <div className="container">
            <div className="header">
              <div className="logo">Delta</div>
            </div>
            <SplitPage />
          </div>
        } />
        <Route path="/app/proposals" element={
          <div className="container">
            <div className="header">
              <div className="logo">Delta</div>
            </div>
            <ProposalsPage />
          </div>
        } />
        <Route path="/app/digest/:inflowEventId" element={
          <div className="container">
            <div className="header">
              <div className="logo">Delta</div>
            </div>
            <DigestPage />
          </div>
        } />
        <Route path="/app/cards" element={
          <div className="container">
            <div className="header">
              <div className="logo">Delta</div>
            </div>
            <CardsPage />
          </div>
        } />
      </Routes>
      <Navigation />
      <InstallPrompt />
    </Router>
  );
}

export default App;
