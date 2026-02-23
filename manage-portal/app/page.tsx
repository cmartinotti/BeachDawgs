export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>🌊 BeachDawgs</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>Manage your subscription</p>
      <p style={{ marginTop: 32, color: '#94a3b8', fontSize: 14 }}>
        Open the BeachDawgs app and go to <strong>Profile → Account & Subscription</strong> to manage your plan.
      </p>
    </main>
  );
}
