import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getDigest } from '../services/api';
import { useToast } from '../components/Toast';

const CURRENCY_DISPLAY = { USDB: 'USD', CNGN: 'NGN' };

export default function DigestPage() {
  const { inflowEventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { amount, currency } = location.state || {};
  const [digestData, setDigestData] = useState(null);
  const [mode, setMode] = useState('ai');
  const [loading, setLoading] = useState(false);

  const getCurrencySymbol = (c) => c === 'USDB' ? '$' : '\u20A6';
  const getDisplayCurrency = (c) => CURRENCY_DISPLAY[c] || c;

  const loadDigest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDigest(inflowEventId, mode);
      setDigestData(res.data);
    } catch (err) {
      console.error('Failed to load digest:', err);
      toast.error('Failed to load digest');
    }
    setLoading(false);
  }, [inflowEventId, mode, toast]);

  useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  const inflowAmount = digestData?.inflow_amount || amount || 0;
  const inflowCurrency = digestData?.inflow_currency || currency || 'USDB';
  const totalDeducted = digestData?.total_deducted || 0;
  const remaining = digestData?.remaining_balance ?? (inflowAmount - totalDeducted);
  const proposals = digestData?.proposals || [];

  return (
    <div className="slide-up">
      <button className="back-btn" onClick={() => navigate('/app')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <h2 className="page-title">Transaction Digest</h2>

      {/* Summary card */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div className="stat-label">Inflow</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: '#fbbf24' }}>
              {getCurrencySymbol(inflowCurrency)}{inflowAmount.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{getDisplayCurrency(inflowCurrency)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">Deducted</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: '#f87171' }}>
              -{getCurrencySymbol(inflowCurrency)}{totalDeducted.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>across {proposals.length} channels</div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '16px', paddingTop: '12px', textAlign: 'center' }}>
          <div className="stat-label">Remaining Balance</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, color: '#4ade80' }}>
            {getCurrencySymbol(inflowCurrency)}{remaining.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Proposal breakdown */}
      {proposals.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '20px', padding: '20px' }}>
          <div className="stat-label" style={{ marginBottom: '12px' }}>Channel Breakdown</div>
          {proposals.map((p, i) => {
            const channelTypeIcon = p.channel_type === 'spend' ? '\uD83D\uDCB8' : p.channel_type === 'save' ? '\uD83C\uDFE6' : '\u2197';
            const statusColor = p.status === 'COMPLETED' ? '#4ade80' : p.status === 'PENDING_SIGNATURES' ? '#fbbf24' : 'var(--text-secondary)';
            return (
              <div key={i} style={{
                padding: '12px 0',
                borderBottom: i < proposals.length - 1 ? '1px solid var(--glass-border)' : 'none'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{channelTypeIcon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600 }}>{p.channel_label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.type} {getDisplayCurrency(inflowCurrency)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 600 }}>
                      {getCurrencySymbol(inflowCurrency)}{p.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: statusColor, fontWeight: 600 }}>{p.status}</div>
                  </div>
                </div>
                {p.bank_name && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '28px' }}>
                    To: {p.account_name} at {p.bank_name} ({p.account_number})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mode toggle */}
      <div className="mode-toggle" style={{ marginBottom: '20px' }}>
        <button
          className={`mode-btn ${mode === 'ai' ? 'active' : ''}`}
          onClick={() => setMode('ai')}
        >
          AI Summary
        </button>
        <button
          className={`mode-btn ${mode === 'stats' ? 'active' : ''}`}
          onClick={() => setMode('stats')}
        >
          Raw Stats
        </button>
      </div>

      <div className="digest-card glass-card">
        <div className="digest-title">
          {mode === 'ai' ? 'AI Summary' : 'Statistics'}
        </div>
        {loading ? (
          <div style={{ padding: '20px 0' }}>
            <div className="skeleton skeleton-text" style={{ width: '100%' }} />
            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
            <div className="skeleton skeleton-text" style={{ width: '70%' }} />
          </div>
        ) : (
          <div className="digest-content" style={{ whiteSpace: 'pre-wrap' }}>{digestData?.digest || ''}</div>
        )}
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', marginTop: '24px' }}
        onClick={() => navigate('/app')}
      >
        Done
      </button>
    </div>
  );
}
