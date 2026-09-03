import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import InflowPage from './pages/InflowPage';
import SplitPage from './pages/SplitPage';
import ProposalsPage from './pages/ProposalsPage';
import DigestPage from './pages/DigestPage';
import CardsPage from './pages/CardsPage';
import './App.css';

function Navigation() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <nav className="glass" style={{
      position: 'fixed', bottom: '20px', left: '20px', right: '20px',
      maxWidth: '440px', margin: '0 auto', padding: '12px 20px',
      display: 'flex', justifyContent: 'space-around', zIndex: 100
    }}>
      <Link to="/" style={{ color: isHome ? '#667eea' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
        Inflow
      </Link>
      <Link to="/proposals" style={{ color: location.pathname === '/proposals' ? '#667eea' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
        Proposals
      </Link>
      <Link to="/cards" style={{ color: location.pathname === '/cards' ? '#667eea' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
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

  if (!showInstall) return null;
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
      <div className="container">
        <OfflineBanner />
        <div className="header">
          <div className="logo">Delta</div>
        </div>
        <Routes>
          <Route path="/" element={<InflowPage />} />
          <Route path="/split/:inflowEventId" element={<SplitPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/digest/:inflowEventId" element={<DigestPage />} />
          <Route path="/cards" element={<CardsPage />} />
        </Routes>
        <Navigation />
        <InstallPrompt />
      </div>
    </Router>
  );
}

export default App;
