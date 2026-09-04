import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { issueCard, setCardLimit } from '../services/api';
import { useToast } from '../components/Toast';

export default function CardsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('100000');
  const [singleLimit, setSingleLimit] = useState('50000');

  const handleIssueCard = async () => {
    const userId = localStorage.getItem('delta_user_id');
    if (!userId) {
      toast.warning('Seed demo users first');
      return;
    }
    setLoading(true);
    try {
      const res = await issueCard(userId, {
        card_name: 'Delta Spend',
        card_color: '#4285F4',
        currency: 'NGN',
        card_type: 'virtual',
        smart_wallet_id: 'default-wallet',
        nin: '63184876213'
      });
      setCards(prev => [...prev, {
        id: res.data.card_id,
        status: res.data.status,
        dailyLimit: dailyLimit,
        singleLimit: singleLimit
      }]);
      toast.success('Virtual card issued');
    } catch (err) {
      console.error('Card issuance failed:', err);
      toast.error('Card issuance failed');
    }
    setLoading(false);
  };

  const handleSetLimit = async (cardId) => {
    setLoading(true);
    try {
      await setCardLimit(cardId, parseFloat(dailyLimit), parseFloat(singleLimit));
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, dailyLimit, singleLimit } : c));
      toast.success('Card limits updated');
    } catch (err) {
      console.error('Set limit failed:', err);
      toast.error('Failed to update limits');
    }
    setLoading(false);
  };

  return (
    <div className="slide-up">
      <button className="back-btn" onClick={() => navigate('/app')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <h2 className="page-title">Virtual Cards</h2>

      <div className="glass-card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div className="stat-label" style={{ marginBottom: '8px' }}>Issue a new card</div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
          Create a virtual card with enforced spend limits. Real guardrails on your money.
        </p>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleIssueCard} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Issue Virtual Card'}
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state glass-card">
          <p>No cards issued yet.</p>
        </div>
      ) : (
        <div className="channels-grid">
          {cards.map((card) => (
            <div key={card.id} className="glass-card" style={{ borderLeft: '3px solid #4285F4' }}>
              <div className="channel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <div className="channel-label">Delta Spend</div>
                </div>
                <span className="channel-status status-approved">{card.status}</span>
              </div>
              <div className="card-grid">
                <div>
                  <div className="stat-label">Daily Limit</div>
                  <div className="stat-value">₦{parseFloat(card.dailyLimit || dailyLimit).toLocaleString()}</div>
                </div>
                <div>
                  <div className="stat-label">Single Txn</div>
                  <div className="stat-value">₦{parseFloat(card.singleLimit || singleLimit).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className="stat-label">Update Limits</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    className="input"
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="Daily limit"
                    style={{ fontSize: '14px', padding: '10px 12px' }}
                  />
                  <input
                    className="input"
                    type="number"
                    value={singleLimit}
                    onChange={(e) => setSingleLimit(e.target.value)}
                    placeholder="Single txn"
                    style={{ fontSize: '14px', padding: '10px 12px' }}
                  />
                </div>
                <button
                  className="btn btn-warning"
                  style={{ width: '100%', marginTop: '12px' }}
                  onClick={() => handleSetLimit(card.id)}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : 'Update Limits'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
