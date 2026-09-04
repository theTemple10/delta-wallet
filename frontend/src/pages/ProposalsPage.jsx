import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChannels, updateChannel, deleteChannel } from '../services/api';
import { useToast } from '../components/Toast';

export default function ProposalsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', type: 'spend', target_currency: 'CNGN', target_amount: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [channelLoading, setChannelLoading] = useState(null);

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

  const startEditChannel = (ch) => {
    setEditingChannel(ch.id);
    setEditForm({
      label: ch.label,
      type: ch.type,
      target_currency: ch.target_currency,
      target_amount: ch.target_amount !== null ? String(ch.target_amount) : ''
    });
  };

  const handleEditChannel = async () => {
    if (!editForm.label.trim()) {
      toast.warning('Enter a channel name');
      return;
    }
    setChannelLoading(editingChannel);
    try {
      await updateChannel(editingChannel, {
        label: editForm.label.trim(),
        type: editForm.type,
        target_currency: editForm.target_currency,
        target_amount: editForm.target_amount ? parseFloat(editForm.target_amount) : null
      });
      setChannels(prev => prev.map(c =>
        c.id === editingChannel ? {
          ...c,
          label: editForm.label.trim(),
          type: editForm.type,
          target_currency: editForm.target_currency,
          target_amount: editForm.target_amount ? parseFloat(editForm.target_amount) : null
        } : c
      ));
      setEditingChannel(null);
      toast.success('Channel updated');
    } catch (err) {
      console.error('Update channel failed:', err);
      toast.error('Failed to update channel');
    }
    setChannelLoading(null);
  };

  const handleDeleteChannel = async (channelId) => {
    setChannelLoading(channelId);
    try {
      await deleteChannel(channelId);
      setChannels(prev => prev.filter(c => c.id !== channelId));
      setConfirmDelete(null);
      toast.success('Channel deleted');
    } catch (err) {
      console.error('Delete channel failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete channel');
    }
    setChannelLoading(null);
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
                  {editingChannel === ch.id ? (
                    <div>
                      <div className="stat-label" style={{ marginBottom: '8px' }}>Edit Channel</div>
                      <input className="input" type="text" value={editForm.label}
                        onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                        style={{ marginBottom: '8px' }} placeholder="Channel name" />
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <select className="input" value={editForm.type}
                          onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))} style={{ flex: 1 }}>
                          <option value="spend">Spend</option>
                          <option value="save">Save</option>
                          <option value="transfer">Transfer</option>
                        </select>
                        <select className="input" value={editForm.target_currency}
                          onChange={(e) => setEditForm(prev => ({ ...prev, target_currency: e.target.value }))} style={{ flex: 1 }}>
                          <option value="CNGN">CNGN</option>
                          <option value="USDB">USDB</option>
                        </select>
                      </div>
                      <input className="input" type="number" placeholder="Monthly target (optional)"
                        value={editForm.target_amount}
                        onChange={(e) => setEditForm(prev => ({ ...prev, target_amount: e.target.value }))}
                        style={{ marginBottom: '10px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleEditChannel} disabled={channelLoading === ch.id}>
                          {channelLoading === ch.id ? <span className="spinner" /> : 'Save'}
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingChannel(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : confirmDelete === ch.id ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Delete "{ch.label}"?</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleDeleteChannel(ch.id)} disabled={channelLoading === ch.id}>
                          {channelLoading === ch.id ? <span className="spinner" /> : 'Confirm'}
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className={`channel-status status-${ch.type === 'spend' ? 'approved' : ch.type === 'save' ? 'pending' : 'draft'}`}>
                            {ch.type}
                          </span>
                          <button className="channel-action-btn" onClick={() => startEditChannel(ch)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="channel-action-btn channel-action-btn-danger" onClick={() => setConfirmDelete(ch.id)} title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Funding progress */}
                      {pct !== null && (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            <span>{ch.target_currency === 'USDB' ? '$' : '\u20A6'}{ch.funded_amount.toLocaleString()} funded</span>
                            <span style={{ color: isFullyFunded ? '#4ade80' : 'var(--text-secondary)' }}>
                              {ch.target_currency === 'USDB' ? '$' : '\u20A6'}{ch.target_amount.toLocaleString()} target
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
                    </>
                  )}
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
