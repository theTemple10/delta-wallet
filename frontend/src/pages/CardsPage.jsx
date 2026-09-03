import { useState } from 'react';
import { issueCard, setCardLimit } from '../services/api';

export default function CardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('100000');
  const [singleLimit, setSingleLimit] = useState('50000');

  const handleIssueCard = async () => {
    const userId = localStorage.getItem('delta_user_id');
    if (!userId) return;
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
      setCards(prev => [...prev, { id: res.data.card_id, status: res.data.status }]);
    } catch (err) {
      console.error('Card issuance failed:', err);
    }
    setLoading(false);
  };

  const handleSetLimit = async (cardId) => {
    setLoading(true);
    try {
      await setCardLimit(cardId, parseFloat(dailyLimit), parseFloat(singleLimit));
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, dailyLimit, singleLimit } : c));
    } catch (err) {
      console.error('Set limit failed:', err);
    }
    setLoading(false);
  };

  return (
    <div className="slide-up">
      <h2 className="page-title">Cards</h2>

      <button className="btn btn-primary" style={{ width: '100%', marginBottom: '24px' }} onClick={handleIssueCard} disabled={loading}>
        {loading ? <span className="spinner" /> : 'Issue Virtual Card'}
      </button>

      {cards.length === 0 ? (
        <div className="empty-state glass-card">
          <p>No cards issued yet.</p>
        </div>
      ) : (
        <div className="channels-grid">
          {cards.map((card) => (
            <div key={card.id} className="glass-card" style={{ borderLeft: '3px solid #4285F4' }}>
              <div className="channel-header">
                <div className="channel-label">Delta Spend</div>
                <span className="channel-status status-approved">{card.status}</span>
              </div>
              <div className="card-grid">
                <div>
                  <div className="stat-label">Daily Limit</div>
                  <div className="stat-value">₦{card.dailyLimit || dailyLimit}</div>
                </div>
                <div>
                  <div className="stat-label">Single Txn</div>
                  <div className="stat-value">₦{card.singleLimit || singleLimit}</div>
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label className="stat-label">Set New Limits</label>
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
                  Update Limits
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
