import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { proposeSplit, getChannels, createProposal, approveProposal, signProposal } from '../services/api';

export default function SplitPage() {
  const { inflowEventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode = 'ai', amount = 100, currency = 'USDB' } = location.state || {};

  const [channels, setChannels] = useState([]);
  const [manualAmounts, setManualAmounts] = useState({});
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('delta_user_id');
    if (stored) {
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

  const handleAISplit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await proposeSplit(inflowEventId, 'ai');
      setSplits(res.data.splits);
    } catch (err) {
      setError('AI split failed. Try again or use Manual mode.');
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
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await proposeSplit(inflowEventId, 'manual', splitsPayload);
      setSplits(res.data.splits);
    } catch (err) {
      setError('Manual split failed. Please try again.');
      console.error('Manual split failed:', err);
    }
    setLoading(false);
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

      await approveProposal(proposalId);
      await signProposal(proposalId);

      setSplits(prev => prev.map(s =>
        s.channel_id === split.channel_id ? { ...s, status: 'completed' } : s
      ));
    } catch (err) {
      setError('Approval/sign failed. Please try again.');
      console.error('Proposal flow failed:', err);
    }
    setLoading(false);
  };

  const allCompleted = splits.length > 0 && splits.every(s => s.status === 'completed');

  return (
    <div className="slide-up">
      <div className="amount-display">
        <div className="amount-label">Split proposal</div>
        <div className="amount-value">${amount}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{currency}</div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {splits.length === 0 && mode === 'ai' ? (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAISplit} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Generate AI Split'}
        </button>
      ) : splits.length === 0 && mode === 'manual' ? (
        <>
          <p className="stat-label" style={{ marginBottom: '16px' }}>
            Enter an amount for each channel to send.
          </p>
          <div className="channels-grid">
            {channels.map((ch) => (
              <div key={ch.id} className={`glass-card channel-${ch.type}`}>
                <div className="channel-header">
                  <div className="channel-label">{ch.label}</div>
                  <span className="stat-label">{ch.target_currency}</span>
                </div>
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
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleManualSplit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Submit Manual Split'}
          </button>
        </>
      ) : (
        <>
          <div className="channels-grid">
            {splits.map((split, i) => {
              const channel = channels.find(c => c.id === split.channel_id);
              return (
                <div key={i} className={`glass-card channel-${channel?.type || 'spend'} ${split.status === 'completed' ? 'signed' : 'pending'}`}>
                  <div className="channel-header">
                    <div className="channel-label">{channel?.label || 'Channel'}</div>
                    <div className="channel-amount" style={{
                      color: channel?.type === 'spend' ? 'var(--accent-spend)' :
                             channel?.type === 'save' ? 'var(--accent-save)' : 'var(--accent-transfer)'
                    }}>
                      ${split.amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="channel-reason">{split.one_line_reason}</div>
                  <span className={`channel-status status-${split.status || 'draft'}`}>
                    {split.status || 'draft'}
                  </span>
                  {!split.status && (
                    <div className="action-buttons">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApproveAndSign(split)}
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        Approve & Sign
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
      )}
    </div>
  );
}
