import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDigest } from '../services/api';

export default function DigestPage() {
  const { inflowEventId } = useParams();
  const navigate = useNavigate();
  const [digest, setDigest] = useState('');
  const [mode, setMode] = useState('ai');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDigest();
  }, [mode]);

  const loadDigest = async () => {
    setLoading(true);
    try {
      const res = await getDigest(inflowEventId, mode);
      setDigest(res.data.digest);
    } catch (err) {
      console.error('Failed to load digest:', err);
    }
    setLoading(false);
  };

  return (
    <div className="slide-up">
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
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <span className="spinner" />
          </div>
        ) : (
          <div className="digest-content">{digest}</div>
        )}
      </div>

      <button
        className="btn btn-secondary"
        style={{ width: '100%', marginTop: '24px' }}
        onClick={() => navigate('/')}
      >
        Back to Inflow
      </button>
    </div>
  );
}
