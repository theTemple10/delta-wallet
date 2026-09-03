import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { proposeSplit, getChannels, createProposal, approveProposal, signProposal } from '../services/api';

export default function SplitPage() {
  const { inflowEventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode = 'ai', amount = 100, currency = 'USDB' } = location.state || {};

  const [channels, setChannels] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(false);
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

  const handlePropose = async () => {
    setLoading(true);
    try {
      const res = await proposeSplit(inflowEventId, mode);
      setSplits(res.data.splits);
    } catch (err) {
      console.error('Split proposal failed:', err);
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
        to_user_id: channels.find(c => c.id === split.channel_id)?.type === 'transfer' ? localStorage.getItem('delta_recipient_id') : undefined,
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

      {splits.length === 0 ? (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handlePropose} disabled={loading}>
          {loading ? <span className="spinner" /> : mode === 'ai' ? 'Generate AI Split' : 'Enter Manual Split'}
        </button>
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
              onClick={() => navigate(`/digest/${inflowEventId}`)}
            >
              View Digest
            </button>
          )}
        </>
      )}
    </div>
  );
}
