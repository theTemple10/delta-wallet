import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { seedUsers, resetUsers, simulateInflow, getBalance, getChannels } from '../services/api';
import { useToast } from '../components/Toast';

const CURRENCY_DISPLAY = { USDB: 'USD', CNGN: 'NGN' };

export default function InflowPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState('USDB');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [mode, setMode] = useState('ai');
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadBalance = useCallback(async (uid) => {
    setBalanceLoading(true);
    try {
      const res = await getBalance(uid);
      setBalance(res.data.balances || []);
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
    setBalanceLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('delta_user_id');
    if (stored) {
      getChannels(stored).then(() => {
        setUserId(stored);
        setSeeded(true);
        loadBalance(stored);
      }).catch(() => {
        localStorage.removeItem('delta_user_id');
      });
    }
  }, [loadBalance]);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await seedUsers();
      const users = res.data.users;
      if (users && users.length > 0) {
        const bunchId = users[0].id;
        localStorage.setItem('delta_user_id', bunchId);
        setUserId(bunchId);
        setSeeded(true);
        toast.success(res.data.message || 'Demo users ready');
        loadBalance(bunchId);
      } else {
        setError('No users returned from server');
      }
    } catch (err) {
      console.error('Seed failed:', err);
      const msg = err.response?.data?.detail || 'Failed to connect to server. Is the backend running?';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetUsers();
      localStorage.removeItem('delta_user_id');
      setSeeded(false);
      setUserId(null);
      setBalance(null);
      toast.success('Demo reset. Seed new users to continue.');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Reset failed';
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleInflow = async () => {
    if (!userId || !amount) return;
    setLoading(true);
    setError(null);
    try {
      const res = await simulateInflow(userId, parseFloat(amount), currency);
      toast.success(`Inflow of ${getCurrencySymbol(currency)}${amount} simulated`);
      navigate(`/app/split/${res.data.inflow_event_id}`, { state: { mode, amount, currency } });
    } catch (err) {
      console.error('Inflow failed:', err);
      const msg = err.response?.data?.detail || 'Failed to simulate inflow';
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  };

  const getCurrencySymbol = (c) => c === 'USDB' ? '$' : '\u20A6';
  const getDisplayCurrency = (c) => CURRENCY_DISPLAY[c] || c;

  return (
    <div className="slide-up">
      {!seeded ? (
        <>
          <div className="amount-display">
            <div className="amount-label">Welcome to Delta</div>
            <div className="amount-value" style={{ fontSize: '36px' }}>Decision-support for your money</div>
          </div>

          {error && (
            <div className="error-state glass-card" style={{ marginBottom: '16px' }}>
              <div className="error-state-icon">{'\u26A0'}</div>
              <div className="error-state-message">{error}</div>
            </div>
          )}

          <div className="glass-card" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
              Set up demo personas to get started
            </p>
            <button className="btn btn-primary" onClick={handleSeed} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Seed Demo Users'}
            </button>
          </div>
        </>
      ) : (
        <>
          {balance && balance.length > 0 && (
            <div className="balance-card">
              <div className="balance-label">Wallet Balance</div>
              {balanceLoading ? (
                <div className="skeleton skeleton-amount" />
              ) : (
                <div className="balance-amount">
                  {balance.map(b => (
                    <div key={b.currency} style={{ marginBottom: '4px' }}>
                      {getCurrencySymbol(b.currency)}{parseFloat(b.amount).toLocaleString()}{' '}
                      <span style={{ fontSize: '14px', opacity: 0.7 }}>{getDisplayCurrency(b.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="amount-display">
            <div className="amount-label">Incoming payment</div>
            <div className="amount-value">{getCurrencySymbol(currency)}{amount || '0'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{getDisplayCurrency(currency)}</div>
          </div>

          {error && (
            <div className="error-state glass-card" style={{ marginBottom: '16px' }}>
              <div className="error-state-message">{error}</div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="stat-label">Amount</label>
            <input
              className="input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="stat-label">Currency</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[['USDB', 'USD'], ['CNGN', 'NGN']].map(([code, label]) => (
                <button
                  key={code}
                  className={`btn ${currency === code ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrency(code)}
                  style={{ flex: 1 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mode-toggle" style={{ marginBottom: '24px' }}>
            <button
              className={`mode-btn ${mode === 'ai' ? 'active' : ''}`}
              onClick={() => setMode('ai')}
            >
              Guided (AI)
            </button>
            <button
              className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              Manual
            </button>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleInflow} disabled={loading || !amount}>
            {loading ? <span className="spinner" /> : 'Simulate Inflow'}
          </button>

          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '16px', fontSize: '12px', opacity: 0.6 }}
            onClick={handleReset}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Reset Demo'}
          </button>
        </>
      )}
    </div>
  );
}
