import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { proposeSplit, getChannels, createProposal, approveProposal, signProposal, createChannel } from '../services/api';
import { useToast } from '../components/Toast';

export default function SplitPage() {
  const { inflowEventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { mode = 'ai', amount = 100, currency = 'USDB' } = location.state || {};

  const [channels, setChannels] = useState([]);
  const [manualAmounts, setManualAmounts] = useState({});
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({ label: '', type: 'spend', target_currency: 'CNGN', target_amount: '' });

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

  const handleAISplit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await proposeSplit(inflowEventId, 'ai');
      setSplits(res.data.splits);
      toast.success('Priority-aware split generated');
    } catch (err) {
      setError('Split failed. Try again or use Manual mode.');
      toast.error('Split failed');
      console.error('Split proposal failed:', err);
    }
    setLoading(false);
  };

  const handleManualSplit = async () => {
    const splitsPayload = channels
      .filter((c) => manualAmounts[c.id] && parseFloat(manualAmounts[c.id]) > 0)
      .map((c) => ({
        channel_id: c.id,
        amount: parseFloat(manualAmounts[c.id]),
        one_line_reason: 'Manual split'
      }));

    if (splitsPayload.length === 0) {
      setError('Enter an amount for at least one channel.');
      toast.warning('Enter an amount for at least one channel');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await proposeSplit(inflowEventId, 'manual', splitsPayload);
      setSplits(res.data.splits);
      toast.success('Manual split submitted');
    } catch (err) {
      setError('Manual split failed. Please try again.');
      toast.error('Manual split failed');
      console.error('Manual split failed:', err);
    }
    setLoading(false);
  };

  const handleAddChannel = async () => {
    if (!newChannel.label.trim()) {
      toast.warning('Enter a channel name');
      return;
    }
    const userId = localStorage.getItem('delta_user_id');
    const tempId = 'temp_' + Date.now();

    // Try to create on backend
    if (userId) {
      try {
        const res = await createChannel({
          user_id: userId,
          label: newChannel.label.trim(),
          type: newChannel.type,
          target_currency: newChannel.target_currency,
          target_amount: newChannel.target_amount ? parseFloat(newChannel.target_amount) : null,
          period: 'monthly',
          priority_rank: channels.length + 1
        });
        const channel = {
          id: res.data.channel_id,
          label: newChannel.label.trim(),
          type: newChannel.type,
          target_currency: newChannel.target_currency,
          target_amount: newChannel.target_amount ? parseFloat(newChannel.target_amount) : null,
          period: 'monthly',
          priority_rank: channels.length + 1,
          funded_amount: 0
        };
        setChannels(prev => [...prev, channel]);
      } catch (err) {
        console.error('Backend channel creation failed, using local:', err);
        // Fall back to local
        const channel = {
          id: tempId,
          label: newChannel.label.trim(),
          type: newChannel.type,
          target_currency: newChannel.target_currency,
          target_amount: newChannel.target_amount ? parseFloat(newChannel.target_amount) : null,
          period: 'monthly',
          priority_rank: channels.length + 1,
          funded_amount: 0
        };
        setChannels(prev => [...prev, channel]);
      }
    } else {
      const channel = {
        id: tempId,
        label: newChannel.label.trim(),
        type: newChannel.type,
        target_currency: newChannel.target_currency,
        target_amount: newChannel.target_amount ? parseFloat(newChannel.target_amount) : null,
        period: 'monthly',
        priority_rank: channels.length + 1,
        funded_amount: 0
      };
      setChannels(prev => [...prev, channel]);
    }

    setNewChannel({ label: '', type: 'spend', target_currency: 'CNGN', target_amount: '' });
    setShowAddChannel(false);
    toast.success('Channel added');
  };

  const handleApproveAndSign = async (split) => {
    setLoading(true);
    try {
      const proposalRes = await createProposal(split.channel_id, {
        channel_id: split.channel_id,
        inflow_event_id: inflowEventId,
        type: currency === 'USDB' ? 'SWAP' : 'TRANSFER',
        amount: split.amount,
        currency: 'CNGN',
        from_stablecoin: 'USDB',
        to_stablecoin: 'CNGN'
      });

      const proposalId = proposalRes.data.proposal_id;

      try {
        await approveProposal(proposalId);
      } catch (approveErr) {
        console.error('Approve failed:', approveErr);
        toast.error('Approval failed: ' + (approveErr.response?.data?.detail || 'Server error'));
        setSplits(prev => prev.map(s =>
          s.channel_id === split.channel_id ? { ...s, status: 'approval-failed' } : s
        ));
        setLoading(false);
        return;
      }

      try {
        await signProposal(proposalId);
      } catch (signErr) {
        console.error('Sign failed:', signErr);
        toast.error('Signing failed: ' + (signErr.response?.data?.detail || 'Server error'));
        setSplits(prev => prev.map(s =>
          s.channel_id === split.channel_id ? { ...s, status: 'sign-failed' } : s
        ));
        setLoading(false);
        return;
      }

      setSplits(prev => prev.map(s =>
        s.channel_id === split.channel_id ? { ...s, status: 'completed' } : s
      ));
      toast.success('Proposal approved & signed');
    } catch (err) {
      console.error('Proposal creation failed:', err);
      toast.error('Proposal creation failed: ' + (err.response?.data?.detail || 'Check server logs'));
    }
    setLoading(false);
  };

  const allCompleted = splits.length > 0 && splits.every(s => s.status === 'completed' || s.amount === 0);

  const channelTypeColor = (type) => {
    switch (type) {
      case 'spend': return 'var(--accent-spend)';
      case 'save': return 'var(--accent-save)';
      case 'transfer': return 'var(--accent-transfer)';
      default: return 'var(--text-secondary)';
    }
  };

  const channelTypeIcon = (type) => {
    switch (type) {
      case 'spend': return '\uD83D\uDCB8';
      case 'save': return '\uD83C\uDFE6';
      case 'transfer': return '\u2197';
      default: return '\u25CF';
    }
  };

  const renderShortfallCard = (split, idx) => {
    const channel = channels.find(c => c.id === split.channel_id) || {};
    const type = split.type || channel.type || 'spend';
    const isCompleted = split.status === 'completed';
    const hasAllocation = split.amount > 0;
    const isFullyFunded = split.shortfall === 0 && split.target_amount !== null;
    const noTarget = split.target_amount === null;

    return (
      <div
        key={idx}
        className={`glass-card channel-${type} ${isCompleted ? 'signed' : hasAllocation ? 'pending' : ''}`}
        style={{ position: 'relative' }}
      >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{channelTypeIcon(type)}</span>
            <div className="channel-label">{split.label || channel.label || 'Channel'}</div>
          </div>
          <div className="channel-amount" style={{ color: channelTypeColor(type) }}>
            ${split.amount.toFixed(2)}
          </div>
        </div>

        {/* Shortfall visualization */}
        {split.target_amount !== null && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Funded: ${split.funded_amount.toFixed(0)} of ${split.target_amount.toFixed(0)}</span>
              <span style={{ color: split.shortfall > 0 ? '#fbbf24' : '#4ade80' }}>
                {split.shortfall > 0 ? `Needs $${split.shortfall.toFixed(0)}` : 'Fully funded'}
              </span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min((split.funded_amount / split.target_amount) * 100, 100)}%`,
                background: isFullyFunded
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: '2px',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        )}

        {noTarget && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Discretionary {'\u2014'} takes whatever is left
          </div>
        )}

        <div className="channel-reason">{split.one_line_reason}</div>

        <span className={`channel-status status-${isCompleted ? 'completed' : split.status === 'approval-failed' || split.status === 'sign-failed' ? 'error' : split.status || 'draft'}`}>
          {isCompleted ? 'completed' : split.status === 'approval-failed' ? 'approval failed' : split.status === 'sign-failed' ? 'sign failed' : split.status || 'draft'}
        </span>

        {!isCompleted && hasAllocation && (
          <div className="action-buttons">
            <button
              className="btn btn-success"
              onClick={() => handleApproveAndSign(split)}
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? <span className="spinner" /> : 'Approve & Sign'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderManualMode = () => (
    <>
      <p className="stat-label" style={{ marginBottom: '16px' }}>
        Enter an amount for each channel to send. Add new channels if needed.
      </p>
      <div className="channels-grid">
        {channels.map((ch) => (
          <div key={ch.id} className={`glass-card channel-${ch.type}`}>
            <div className="channel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{channelTypeIcon(ch.type)}</span>
                <div className="channel-label">{ch.label}</div>
              </div>
              <span className="stat-label">{ch.target_currency}</span>
            </div>
            {ch.target_amount !== null && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Target: ${ch.target_amount.toLocaleString()} / month
              </div>
            )}
            <input
              className="input"
              type="number"
              placeholder="Amount"
              min="0"
              value={manualAmounts[ch.id] || ''}
              onChange={(e) => setManualAmounts((prev) => ({ ...prev, [ch.id]: e.target.value }))}
              style={{ marginTop: '12px', width: '100%' }}
            />
          </div>
        ))}
      </div>

      {showAddChannel ? (
        <div className="glass-card" style={{ marginTop: '16px' }}>
          <div className="stat-label" style={{ marginBottom: '12px' }}>New Channel</div>
          <input
            className="input"
            type="text"
            placeholder="Channel name (e.g. Transport)"
            value={newChannel.label}
            onChange={(e) => setNewChannel(prev => ({ ...prev, label: e.target.value }))}
            style={{ marginBottom: '10px' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <select
              className="input"
              value={newChannel.type}
              onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value }))}
              style={{ flex: 1 }}
            >
              <option value="spend">Spend</option>
              <option value="save">Save</option>
              <option value="transfer">Transfer</option>
            </select>
            <select
              className="input"
              value={newChannel.target_currency}
              onChange={(e) => setNewChannel(prev => ({ ...prev, target_currency: e.target.value }))}
              style={{ flex: 1 }}
            >
              <option value="CNGN">CNGN</option>
              <option value="USDB">USDB</option>
            </select>
          </div>
          <input
            className="input"
            type="number"
            placeholder="Monthly target (optional)"
            value={newChannel.target_amount}
            onChange={(e) => setNewChannel(prev => ({ ...prev, target_amount: e.target.value }))}
            style={{ marginBottom: '12px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddChannel}>
              Add
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddChannel(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: '16px' }}
          onClick={() => setShowAddChannel(true)}
        >
          + Add Channel
        </button>
      )}

      <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleManualSplit} disabled={loading}>
        {loading ? <span className="spinner" /> : 'Submit Manual Split'}
      </button>
    </>
  );

  const renderSplitResults = () => (
    <>
      {/* Summary bar */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="stat-label">Total Inflow</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
              ${amount} {currency}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">Channels funded</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700 }}>
              {splits.filter(s => s.amount > 0).length} / {splits.length}
            </div>
          </div>
        </div>
      </div>

      <div className="channels-grid">
        {splits.map((split, i) => renderShortfallCard(split, i))}
      </div>

      {allCompleted && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '24px' }}
          onClick={() => navigate(`/app/digest/${inflowEventId}`)}
        >
          View Digest
        </button>
      )}
    </>
  );

  return (
    <div className="slide-up">
      <button className="back-btn" onClick={() => navigate('/app')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <div className="amount-display">
        <div className="amount-label">Priority-aware split</div>
        <div className="amount-value">${amount}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{currency}</div>
      </div>

      {error && (
        <div className="error-state glass-card" style={{ marginBottom: '16px' }}>
          <div className="error-state-message">{error}</div>
        </div>
      )}

      {splits.length === 0 && mode === 'ai' && (
        <>
          {/* Show channel targets before generating split */}
          {channels.length > 0 && (
            <div className="glass-card" style={{ marginBottom: '20px', padding: '20px' }}>
              <div className="stat-label" style={{ marginBottom: '12px' }}>Channel priorities (funded in order)</div>
              {channels.map((ch, i) => (
                <div key={ch.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: i < channels.length - 1 ? '1px solid var(--glass-border)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', fontSize: '11px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(175, 1, 175, 0.2)', color: 'var(--accent-secondary)'
                    }}>
                      {ch.priority_rank}
                    </span>
                    <span style={{ fontSize: '14px' }}>{ch.label}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {ch.target_amount !== null ? `${ch.target_currency === 'USDB' ? '$' : '\u20A6'}${ch.target_amount.toLocaleString()}` : 'Remainder'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddChannel ? (
            <div className="glass-card" style={{ marginBottom: '16px' }}>
              <div className="stat-label" style={{ marginBottom: '12px' }}>New Channel</div>
              <input
                className="input"
                type="text"
                placeholder="Channel name (e.g. Transport)"
                value={newChannel.label}
                onChange={(e) => setNewChannel(prev => ({ ...prev, label: e.target.value }))}
                style={{ marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <select
                  className="input"
                  value={newChannel.type}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="spend">Spend</option>
                  <option value="save">Save</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select
                  className="input"
                  value={newChannel.target_currency}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, target_currency: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="CNGN">CNGN</option>
                  <option value="USDB">USDB</option>
                </select>
              </div>
              <input
                className="input"
                type="number"
                placeholder="Monthly target (optional)"
                value={newChannel.target_amount}
                onChange={(e) => setNewChannel(prev => ({ ...prev, target_amount: e.target.value }))}
                style={{ marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddChannel}>
                  Add
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddChannel(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: '12px' }}
              onClick={() => setShowAddChannel(true)}
            >
              + Add Channel
            </button>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAISplit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Generate Priority Split'}
          </button>
        </>
      )}

      {splits.length === 0 && mode === 'manual' && renderManualMode()}
      {splits.length > 0 && renderSplitResults()}
    </div>
  );
}
