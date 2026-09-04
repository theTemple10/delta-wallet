import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { proposeSplit, getChannels, createProposal, approveProposal, signProposal, createChannel, updateChannel, deleteChannel, updateAccountDetails, simulatePayout, getBalance } from '../services/api';
import { useToast } from '../components/Toast';

const CURRENCY_DISPLAY = { USDB: 'USD', CNGN: 'NGN' };

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
  const [editingChannel, setEditingChannel] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', type: 'spend', target_currency: 'CNGN', target_amount: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [channelLoading, setChannelLoading] = useState(null);
  const [balance, setBalance] = useState(null);
  const [totalSigned, setTotalSigned] = useState(0);
  const [accountForm, setAccountForm] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(null);

  const loadBalance = useCallback(async (uid) => {
    try {
      const res = await getBalance(uid);
      setBalance(res.data.balances || []);
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  }, []);

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
      loadBalance(stored);
    }
  }, [loadChannels, loadBalance]);

  const getCurrencySymbol = (c) => c === 'USDB' ? '$' : '\u20A6';
  const getDisplayCurrency = (c) => CURRENCY_DISPLAY[c] || c;

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
      setSplits(res.data.splits || []);
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
    if (!userId) {
      toast.error('No user found. Seed first.');
      return;
    }
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
      console.error('Backend channel creation failed:', err);
      toast.error('Failed to create channel on server');
    }
    setNewChannel({ label: '', type: 'spend', target_currency: 'CNGN', target_amount: '' });
    setShowAddChannel(false);
    toast.success('Channel added');
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
      if (!proposalId) {
        toast.error('Server did not return a proposal ID');
        setLoading(false);
        return;
      }

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
      setTotalSigned(prev => prev + split.amount);
      toast.success('Proposal approved & signed');

      const userId = localStorage.getItem('delta_user_id');
      if (userId) loadBalance(userId);
    } catch (err) {
      console.error('Proposal creation failed:', err);
      toast.error('Proposal creation failed: ' + (err.response?.data?.detail || 'Check server logs'));
    }
    setLoading(false);
  };

  const handleSaveAccount = async (channelId) => {
    if (!accountForm.bank_name || !accountForm.account_number || !accountForm.account_name) {
      toast.warning('Fill in all account details');
      return;
    }
    try {
      await updateAccountDetails(channelId, accountForm);
      setChannels(prev => prev.map(c =>
        c.id === channelId ? { ...c, ...accountForm } : c
      ));
      setAccountForm(null);
      toast.success('Account details saved');
    } catch (err) {
      toast.error('Failed to save account details');
    }
  };

  const handlePayout = async (channelId) => {
    setPayoutLoading(channelId);
    try {
      const res = await simulatePayout(channelId);
      const p = res.data;
      toast.success(`Payout simulated: ${getCurrencySymbol(p.currency)}${p.payout_amount.toLocaleString()} to ${p.account_name} at ${p.bank_name}`);
      const userId = localStorage.getItem('delta_user_id');
      if (userId) {
        loadBalance(userId);
        loadChannels(userId);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payout failed');
    }
    setPayoutLoading(null);
  };

  const remainingAfterSplits = parseFloat(amount) - totalSigned;

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
    const displayCurrency = split.target_currency || channel.target_currency || currency;

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
            justifyContent: 'center', fontSize: '14px', color: '#4ade80'
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
            {getCurrencySymbol(displayCurrency)}{split.amount.toFixed(2)}
          </div>
        </div>

        {split.target_amount !== null && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Funded: {getCurrencySymbol(displayCurrency)}{split.funded_amount.toFixed(0)} of {getCurrencySymbol(displayCurrency)}{split.target_amount.toFixed(0)}</span>
              <span style={{ color: split.shortfall > 0 ? '#fbbf24' : '#4ade80' }}>
                {split.shortfall > 0 ? `Needs ${getCurrencySymbol(displayCurrency)}${split.shortfall.toFixed(0)}` : 'Fully funded'}
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

        {isFullyFunded && !channel.account_name && (
          <div style={{ marginTop: '12px' }}>
            {accountForm && accountForm._channelId === split.channel_id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input className="input" placeholder="Bank name" value={accountForm.bank_name || ''}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, bank_name: e.target.value }))} style={{ fontSize: '13px', padding: '10px' }} />
                <input className="input" placeholder="Account number" value={accountForm.account_number || ''}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, account_number: e.target.value }))} style={{ fontSize: '13px', padding: '10px' }} />
                <input className="input" placeholder="Account name" value={accountForm.account_name || ''}
                  onChange={(e) => setAccountForm(prev => ({ ...prev, account_name: e.target.value }))} style={{ fontSize: '13px', padding: '10px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-success" style={{ flex: 1, fontSize: '12px' }} onClick={() => handleSaveAccount(split.channel_id)}>Save</button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setAccountForm(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-secondary" style={{ width: '100%', fontSize: '12px', marginTop: '8px' }}
                onClick={() => setAccountForm({ _channelId: split.channel_id, bank_name: '', account_number: '', account_name: '' })}>
                Add payout account
              </button>
            )}
          </div>
        )}

        {isFullyFunded && channel.account_name && (
          <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', fontSize: '12px' }}>
            <div style={{ color: '#4ade80', fontWeight: 600, marginBottom: '4px' }}>Ready to send</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {channel.account_name} at {channel.bank_name} ({channel.account_number})
            </div>
            <button className="btn btn-success" style={{ width: '100%', marginTop: '8px', fontSize: '12px' }}
              onClick={() => handlePayout(split.channel_id)} disabled={payoutLoading === split.channel_id}>
              {payoutLoading === split.channel_id ? <span className="spinner" /> : 'Send Funds'}
            </button>
          </div>
        )}

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
            {editingChannel === ch.id ? (
              <div>
                <div className="stat-label" style={{ marginBottom: '8px' }}>Edit Channel</div>
                <input className="input" type="text" value={editForm.label}
                  onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                  style={{ marginBottom: '8px', fontSize: '13px', padding: '10px' }} placeholder="Channel name" />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select className="input" value={editForm.type}
                    onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))} style={{ flex: 1, fontSize: '13px', padding: '10px' }}>
                    <option value="spend">Spend</option>
                    <option value="save">Save</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <select className="input" value={editForm.target_currency}
                    onChange={(e) => setEditForm(prev => ({ ...prev, target_currency: e.target.value }))} style={{ flex: 1, fontSize: '13px', padding: '10px' }}>
                    <option value="CNGN">NGN</option>
                    <option value="USDB">USD</option>
                  </select>
                </div>
                <input className="input" type="number" placeholder="Monthly target (optional)"
                  value={editForm.target_amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, target_amount: e.target.value }))}
                  style={{ marginBottom: '10px', fontSize: '13px', padding: '10px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }} onClick={handleEditChannel} disabled={channelLoading === ch.id}>
                    {channelLoading === ch.id ? <span className="spinner" /> : 'Save'}
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setEditingChannel(null)}>Cancel</button>
                </div>
              </div>
            ) : confirmDelete === ch.id ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>Delete "{ch.label}"?</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-success" style={{ flex: 1, fontSize: '12px' }} onClick={() => handleDeleteChannel(ch.id)} disabled={channelLoading === ch.id}>
                    {channelLoading === ch.id ? <span className="spinner" /> : 'Confirm'}
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="channel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{channelTypeIcon(ch.type)}</span>
                    <div className="channel-label">{ch.label}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="stat-label">{getDisplayCurrency(ch.target_currency)}</span>
                    <button className="channel-action-btn" onClick={() => startEditChannel(ch)} title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="channel-action-btn channel-action-btn-danger" onClick={() => setConfirmDelete(ch.id)} title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                {ch.target_amount !== null && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Target: {getCurrencySymbol(ch.target_currency)}{ch.target_amount.toLocaleString()} / month
                  </div>
                )}
                <input
                  className="input"
                  type="number"
                  placeholder="Amount"
                  min="0"
                  value={manualAmounts[ch.id] || ''}
                  onChange={(e) => setManualAmounts((prev) => ({ ...prev, [ch.id]: e.target.value }))}
                  style={{ marginTop: '12px', width: '100%', fontSize: '13px', padding: '10px' }}
                />
              </>
            )}
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
            style={{ marginBottom: '10px', fontSize: '13px', padding: '10px' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <select
              className="input"
              value={newChannel.type}
              onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value }))}
              style={{ flex: 1, fontSize: '13px', padding: '10px' }}
            >
              <option value="spend">Spend</option>
              <option value="save">Save</option>
              <option value="transfer">Transfer</option>
            </select>
            <select
              className="input"
              value={newChannel.target_currency}
              onChange={(e) => setNewChannel(prev => ({ ...prev, target_currency: e.target.value }))}
              style={{ flex: 1, fontSize: '13px', padding: '10px' }}
            >
              <option value="CNGN">NGN</option>
              <option value="USDB">USD</option>
            </select>
          </div>
          <input
            className="input"
            type="number"
            placeholder="Monthly target (optional)"
            value={newChannel.target_amount}
            onChange={(e) => setNewChannel(prev => ({ ...prev, target_amount: e.target.value }))}
            style={{ marginBottom: '12px', fontSize: '13px', padding: '10px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }} onClick={handleAddChannel}>
              Add
            </button>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setShowAddChannel(false)}>
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
      {/* Balance + summary */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div className="stat-label">Total Inflow</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
              {getCurrencySymbol(currency)}{amount} {getDisplayCurrency(currency)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">Channels funded</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700 }}>
              {splits.filter(s => s.amount > 0).length} / {splits.length}
            </div>
          </div>
        </div>

        {balance && balance.length > 0 && (
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
            <div className="stat-label" style={{ marginBottom: '4px' }}>Live Wallet Balance</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {balance.map(b => (
                <div key={b.currency} style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 600 }}>
                  {getCurrencySymbol(b.currency)}{parseFloat(b.amount).toLocaleString()}{' '}
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>{getDisplayCurrency(b.currency)}</span>
                </div>
              ))}
              {totalSigned > 0 && (
                <div style={{ fontSize: '12px', color: '#f87171' }}>
                  -{getCurrencySymbol(currency)}{totalSigned.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="channels-grid">
        {splits.map((split, i) => (
          <div key={i}>
            {renderShortfallCard(split, i)}
          </div>
        ))}
      </div>

      {allCompleted && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '24px' }}
          onClick={() => navigate(`/app/digest/${inflowEventId}`, { state: { amount, currency } })}
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
        <div className="amount-value">{getCurrencySymbol(currency)}{amount}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{getDisplayCurrency(currency)}</div>
      </div>

      {error && (
        <div className="error-state glass-card" style={{ marginBottom: '16px' }}>
          <div className="error-state-message">{error}</div>
        </div>
      )}

      {splits.length === 0 && mode === 'ai' && (
        <>
          {channels.length > 0 && (
            <div className="glass-card" style={{ marginBottom: '20px', padding: '20px' }}>
              <div className="stat-label" style={{ marginBottom: '12px' }}>Channel priorities (funded in order)</div>
              {channels.map((ch, i) => (
                <div key={ch.id} style={{
                  padding: '8px 0', borderBottom: i < channels.length - 1 ? '1px solid var(--glass-border)' : 'none'
                }}>
                  {editingChannel === ch.id ? (
                    <div style={{ padding: '8px 0' }}>
                      <input className="input" type="text" value={editForm.label}
                        onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                        style={{ marginBottom: '8px', fontSize: '13px', padding: '10px' }} placeholder="Channel name" />
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <select className="input" value={editForm.type}
                          onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))} style={{ flex: 1, fontSize: '13px', padding: '10px' }}>
                          <option value="spend">Spend</option>
                          <option value="save">Save</option>
                          <option value="transfer">Transfer</option>
                        </select>
                        <select className="input" value={editForm.target_currency}
                          onChange={(e) => setEditForm(prev => ({ ...prev, target_currency: e.target.value }))} style={{ flex: 1, fontSize: '13px', padding: '10px' }}>
                          <option value="CNGN">NGN</option>
                          <option value="USDB">USD</option>
                        </select>
                      </div>
                      <input className="input" type="number" placeholder="Monthly target (optional)"
                        value={editForm.target_amount}
                        onChange={(e) => setEditForm(prev => ({ ...prev, target_amount: e.target.value }))}
                        style={{ marginBottom: '8px', fontSize: '13px', padding: '10px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }} onClick={handleEditChannel} disabled={channelLoading === ch.id}>
                          {channelLoading === ch.id ? <span className="spinner" /> : 'Save'}
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setEditingChannel(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : confirmDelete === ch.id ? (
                    <div style={{ padding: '8px 0', textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>Delete "{ch.label}"?</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-success" style={{ flex: 1, fontSize: '12px' }} onClick={() => handleDeleteChannel(ch.id)} disabled={channelLoading === ch.id}>
                          {channelLoading === ch.id ? <span className="spinner" /> : 'Confirm'}
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {ch.target_amount !== null ? `${getCurrencySymbol(ch.target_currency)}${ch.target_amount.toLocaleString()}` : 'Remainder'}
                        </span>
                        <button className="channel-action-btn" onClick={() => startEditChannel(ch)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="channel-action-btn channel-action-btn-danger" onClick={() => setConfirmDelete(ch.id)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
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
                style={{ marginBottom: '10px', fontSize: '13px', padding: '10px' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <select
                  className="input"
                  value={newChannel.type}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value }))}
                  style={{ flex: 1, fontSize: '13px', padding: '10px' }}
                >
                  <option value="spend">Spend</option>
                  <option value="save">Save</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select
                  className="input"
                  value={newChannel.target_currency}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, target_currency: e.target.value }))}
                  style={{ flex: 1, fontSize: '13px', padding: '10px' }}
                >
                  <option value="CNGN">NGN</option>
                  <option value="USDB">USD</option>
                </select>
              </div>
              <input
                className="input"
                type="number"
                placeholder="Monthly target (optional)"
                value={newChannel.target_amount}
                onChange={(e) => setNewChannel(prev => ({ ...prev, target_amount: e.target.value }))}
                style={{ marginBottom: '12px', fontSize: '13px', padding: '10px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }} onClick={handleAddChannel}>
                  Add
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={() => setShowAddChannel(false)}>
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
