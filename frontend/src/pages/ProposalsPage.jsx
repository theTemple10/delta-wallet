import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChannels } from '../services/api';

export default function ProposalsPage() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState([]);

  const loadChannels = useCallback(async (uid) => {
    try {
      const res = await getChannels(uid);
      setChannels(res.data);
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('delta_user_id');
    if (stored) {
      loadChannels(stored);
    }
  }, [loadChannels]);

  const getFundingPercentage = (ch) => {
    if (!ch.target_amount) return null;
    return Math.min((ch.funded_amount / ch.target_amount) * 100, 100);
  };

  return (
    <div className="slide-up">
      <button className="back-btn" onClick={() => navigate('/app')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <h2 className="page-title">Your Channels</h2>

      {channels.length === 0 ? (
        <div className="empty-state glass-card">
          <p>No channels yet. Seed demo users first.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
            onClick={() => navigate('/app')}
          >
            Go to Inflow
          </button>
        </div>
      ) : (
        <>
          <div className="channels-grid">
            {channels.map((ch) => {
              const pct = getFundingPercentage(ch);
              const isFullyFunded = pct !== null && pct >= 100;
              const noTarget = ch.target_amount === null;

              return (
                <div key={ch.id} className={`glass-card channel-${ch.type}`} style={{ position: 'relative' }}>
                  {isFullyFunded && (
                    <div style={{
                      position: 'absolute', top: '12px', right: '12px',
                      background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%',
                      width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '14px'
                    }}>
                      {'\u2713'}
                    </div>
                  )}

                  <div className="channel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '50%', fontSize: '11px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(175, 1, 175, 0.2)', color: 'var(--accent-secondary)',
                        flexShrink: 0
                      }}>
                        {ch.priority_rank}
                      </span>
                      <div className="channel-label">{ch.label}</div>
                    </div>
                    <span className={`channel-status status-${ch.type === 'spend' ? 'approved' : ch.type === 'save' ? 'pending' : 'draft'}`}>
                      {ch.type}
                    </span>
                  </div>

                  {/* Funding progress */}
                  {pct !== null && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <span>${ch.funded_amount.toLocaleString()} funded</span>
                        <span style={{ color: isFullyFunded ? '#4ade80' : 'var(--text-secondary)' }}>
                          ${ch.target_amount.toLocaleString()} target
                        </span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: isFullyFunded
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                          borderRadius: '2px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                        {Math.round(pct)}% funded
                      </div>
                    </div>
                  )}

                  {noTarget && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Discretionary {'\u2014'} takes remainder
                    </div>
                  )}

                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="stat-label">Currency</span>
                      <div className="stat-value" style={{ fontSize: '16px' }}>{ch.target_currency}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="stat-label">Period</span>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ch.period || 'monthly'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-card" style={{ marginTop: '24px', padding: '20px' }}>
            <div className="stat-label" style={{ marginBottom: '12px' }}>How priority funding works</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '8px' }}>
                Channels are funded in <strong style={{ color: 'var(--accent-secondary)' }}>priority order</strong> {'\u2014'} obligations first, then savings, then discretionary.
              </p>
              <p style={{ marginBottom: '8px' }}>
                If an inflow <strong style={{ color: '#fbbf24' }}>isn't enough</strong> to cover everything, higher-priority channels get funded first.
              </p>
              <p>
                A <strong style={{ color: '#4ade80' }}>second inflow</strong> tops up shortfalls instead of re-splitting from zero.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
