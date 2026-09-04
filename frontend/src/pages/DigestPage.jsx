import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDigest } from '../services/api';
import { useToast } from '../components/Toast';

export default function DigestPage() {
  const { inflowEventId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [digest, setDigest] = useState('');
  const [mode, setMode] = useState('ai');
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const loadDigest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDigest(inflowEventId, mode);
      setDigest(res.data.digest);
    } catch (err) {
      console.error('Failed to load digest:', err);
      toast.error('Failed to load digest');
    }
    setLoading(false);
  }, [inflowEventId, mode, toast]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      loadDigest();
    }
  }, [loadDigest]);

  return (
    <div className="slide-up">
      <button className="back-btn" onClick={() => navigate('/app')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      <h2 className="page-title">Transaction Digest</h2>

      <div className="mode-toggle" style={{ marginBottom: '24px' }}>
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
          <div className="digest-content">{digest}</div>
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
