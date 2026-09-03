import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const navigate = useNavigate();
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

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="logo">Delta</div>
          <button className="btn btn-secondary" onClick={() => navigate('/app')} style={{ padding: '8px 20px', fontSize: '13px' }}>
            Open App
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content slide-up">
          <h1 className="landing-headline">
            Money lands.<br />
            <span className="landing-headline-accent">You decide where it goes.</span>
          </h1>
          <p className="landing-subtitle">
            Delta is a decision-support layer for Nigerian tech workers getting paid in foreign currency. It sits on top of BMONI's wallet infrastructure and makes every split deliberate.
          </p>
          <div className="landing-cta-group">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>
              Get Started
            </button>
            {showInstall && (
              <button className="btn btn-secondary btn-lg" onClick={handleInstall}>
                Install App
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">Everything you need</h2>
          <p className="landing-section-sub">Multi-currency wallets. Smart splits. Virtual cards. One deliberate flow.</p>

          <div className="features-grid">
            <div className="feature-card glass-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="feature-title">Multi-Currency Wallets</h3>
              <p className="feature-desc">Hold USD, NGN, and more. Fund with bank transfers or stablecoins. Your money, your currencies.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3 className="feature-title">AI-Powered Splits</h3>
              <p className="feature-desc">When payment lands, Delta proposes a split across spend, save, and obligations. Guided by AI, executed by you.</p>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <h3 className="feature-title">Virtual Cards</h3>
              <p className="feature-desc">Issue virtual cards with enforced spend limits. Not just visual limits -- real guardrails on your money.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-steps">
        <div className="landing-section-inner">
          <h2 className="landing-section-title">How it works</h2>
          <p className="landing-section-sub">Three steps from inflow to deliberate action.</p>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3 className="step-title">Receive Payment</h3>
              <p className="step-desc">A payment lands in your BMONI smart wallet. USD, NGN, or any supported stablecoin.</p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <h3 className="step-title">Delta Proposes a Split</h3>
              <p className="step-desc">AI analyzes your channels and proposes how to split the inflow. Or do it manually -- the AI is optional, the execution layer is not.</p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <h3 className="step-title">Review, Approve & Sign</h3>
              <p className="step-desc">Each channel becomes a real BMONI proposal. You review, approve, and sign each one. Nothing auto-executes.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="landing-section-inner" style={{ textAlign: 'center' }}>
          <h2 className="landing-section-title">Ready to be deliberate?</h2>
          <p className="landing-section-sub" style={{ marginBottom: '32px' }}>
            Stop guessing where your money should go. Let Delta help you decide.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/app')}>
            Start Managing Money
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-section-inner">
          <div className="landing-footer-inner">
            <div className="logo" style={{ fontSize: '18px' }}>Delta</div>
            <p className="landing-footer-text">
              Built on <a href="https://bmoni.com" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', textDecoration: 'none' }}>BMONI</a>'s embedded wallet API. A hackathon project for BMONI x Learn2Earn.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
