import { useState } from 'react';
import { feedbackAPI } from '../api';

function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: '2rem', cursor: readonly ? 'default' : 'pointer' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => !readonly && onChange && onChange(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            color: star <= (hover || value) ? '#FFD54F' : 'rgba(255,255,255,0.2)',
            transition: 'color 0.15s',
            userSelect: 'none',
          }}
        >★</span>
      ))}
    </div>
  );
}

export function FeedbackForm({ appointment, doctorId, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const ratingLabels = ['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Very Good 😊', 'Excellent! ⭐'];

  const submit = async () => {
    if (!rating) { alert('Please select a star rating!'); return; }
    setLoading(true);
    try {
      await feedbackAPI.submit({
        appointment_id: appointment.id,
        doctor_id: doctorId || appointment.doctor_id,
        rating,
        comment,
      });
      setDone(true);
      onDone && onDone();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit feedback';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div style={{
      textAlign: 'center', padding: '20px 16px',
      background: 'rgba(102,187,106,0.1)',
      border: '1px solid var(--color-success)',
      borderRadius: 'var(--radius-md)',
      marginTop: 8,
    }}>
      <div style={{ fontSize: '2rem' }}>🙏</div>
      <p style={{ color: 'var(--color-success)', fontWeight: 600, marginTop: 6 }}>Thank you for your feedback!</p>
    </div>
  );

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      marginTop: 8,
    }}>
      <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem' }}>⭐ Rate Your Experience</h4>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>How was your consultation with the doctor?</p>

      <StarRating value={rating} onChange={setRating} />
      {rating > 0 && (
        <p style={{ fontSize: '0.78rem', color: '#FFD54F', marginTop: 4, fontWeight: 600 }}>
          {ratingLabels[rating]}
        </p>
      )}

      <textarea
        className="form-input"
        rows={2}
        placeholder="Share your experience (optional)..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        style={{ marginTop: 12, marginBottom: 10, resize: 'vertical', fontSize: '0.85rem' }}
      />

      <button
        className="btn btn-primary"
        onClick={submit}
        disabled={loading || !rating}
        style={{ width: '100%', padding: '9px' }}
      >
        {loading ? <span className="loading-spinner" /> : '✉️'} Submit Feedback
      </button>
    </div>
  );
}

export { StarRating };
