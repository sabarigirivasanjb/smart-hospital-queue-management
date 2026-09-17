export default function SmsConfigGuide() {
  return (
    <div style={{
      background: 'rgba(255,167,38,0.08)', border: '1px solid rgba(255,167,38,0.3)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)'
    }}>
      <h4 style={{ color: 'var(--color-warning)', marginBottom: 12 }}>📱 SMS Notifications Setup</h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Enable real SMS alerts for patients (appointment confirmed, your turn, queue updates).
      </p>
      <div style={{ fontSize: '0.82rem', lineHeight: 2 }}>
        <div>1. Sign up free at <a href="https://twilio.com" target="_blank" rel="noopener" style={{ color: 'var(--color-primary)' }}>twilio.com</a> (free trial = 15$ credits)</div>
        <div>2. Get Account SID, Auth Token, Phone Number</div>
        <div>3. Open <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>backend/.env</code> file</div>
        <div>4. Set <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>SMS_ENABLED=true</code> and fill credentials</div>
        <div>5. Restart backend server</div>
      </div>
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(102,187,106,0.1)', border: '1px solid var(--color-success)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--color-success)' }}>
        ✅ Currently running in <strong>DEMO MODE</strong> — SMS messages are logged to backend console (no real SMS sent)
      </div>
    </div>
  );
}
