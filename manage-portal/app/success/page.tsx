export default function SuccessPage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 16 }}>You&apos;re Premium!</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>Your BeachDawgs Premium subscription is now active.</p>
      <p style={{ marginTop: 24, color: '#94a3b8', fontSize: 14 }}>
        Return to the app — your premium features will unlock automatically within a few seconds.
      </p>
    </main>
  );
}
