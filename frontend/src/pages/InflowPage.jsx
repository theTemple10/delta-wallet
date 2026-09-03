import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { seedUsers, simulateInflow } from '../services/api';

export default function InflowPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState('USDB');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [mode, setMode] = useState('ai');
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState(null);
  const [seedMessage, setSeedMessage] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('delta_user_id');
    if (stored) {
      setUserId(stored);
      setSeeded(true);
    }
  }, []);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    setSeedMessage(null);
    try {
      const res = await seedUsers();
      const users = res.data.users;
      if (users && users.length > 0) {
        const bunchId = users[0].id;
        localStorage.setItem('delta_user_id', bunchId);
        setUserId(bunchId);
        setSeeded(true);
        setSeedMessage(res.data.message || 'Demo users ready');
      } else {
        setError('No users returned from server');
      }
    } catch (err) {
      console.error('Seed failed:', err);
      setError(err.response?.data?.detail || 'Failed to connect to server. Is the backend running?');
    }
    setLoading(false);
  };

  const handleInflow = async () => {
    if (!userId || !amount) return;
    setLoading(true);
    setError(null);
    try {
      const res = await simulateInflow(userId, parseFloat(amount), currency);
      navigate(`/app/split/${res.data.inflow_event_id}`, { state: { mode, amount, currency } });
    } catch (err) {
      console.error('Inflow failed:', err);
      setError(err.response?.data?.detail || 'Failed to simulate inflow');
    }
    setLoading(false);
  };

  return (
    <div className="slide-up">
      <div className="amount-display">
        <div className="amount-label">Incoming payment</div>
        <div className="amount-value">${amount || '0'}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{currency}</div>
      </div>

      {error && (
        <div className="glass-card" style={{ marginBottom: '16px', borderLeft: '3px solid #ef4444', padding: '14px 18px' }}>
          <p style={{ color: '#fca5a5', fontSize: '13px', margin: 0 }}>{error}</p>
        </div>
      )}

      {seedMessage && !error && (
        <div className="glass-card" style={{ marginBottom: '16px', borderLeft: '3px solid #4ade80', padding: '14px 18px' }}>
          <p style={{ color: '#86efac', fontSize: '13px', margin: 0 }}>{seedMessage}</p>
        </div>
      )}

      {!seeded ? (
        <div className="glass-card" style={{ marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            Set up demo personas to get started
          </p>
          <button className="btn btn-primary" onClick={handleSeed} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Seed Demo Users'}
          </button>
        </div>
      ) : (
        <>
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
              {['USDB', 'CNGN'].map(c => (
                <button
                  key={c}
                  className={`btn ${currency === c ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrency(c)}
                  style={{ flex: 1 }}
                >
                  {c}
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
        </>
      )}
    </div>
  );
}
