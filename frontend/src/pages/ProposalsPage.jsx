import { useState, useEffect } from 'react';
import { getChannels } from '../services/api';

export default function ProposalsPage() {
  const [channels, setChannels] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('delta_user_id');
    if (stored) {
      setUserId(stored);
      loadChannels(stored);
    }
  }, []);

  const loadChannels = async (uid) => {
    try {
      const res = await getChannels(uid);
      setChannels(res.data);
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  return (
    <div className="slide-up">
      <h2 className="page-title">Your Channels</h2>

      {channels.length === 0 ? (
        <div className="empty-state glass-card">
          <p>No channels yet. Seed demo users first.</p>
        </div>
      ) : (
        <div className="channels-grid">
          {channels.map((ch) => (
            <div key={ch.id} className={`glass-card channel-${ch.type}`}>
              <div className="channel-header">
                <div className="channel-label">{ch.label}</div>
                <span className={`channel-status status-${ch.type === 'spend' ? 'approved' : ch.type === 'save' ? 'pending' : 'draft'}`}>
                  {ch.type}
                </span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span className="stat-label">Currency</span>
                <div className="stat-value">{ch.target_currency}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
