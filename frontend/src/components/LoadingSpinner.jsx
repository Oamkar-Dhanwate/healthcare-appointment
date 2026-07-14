// ─── Loading Spinner ─────────────────────────────────────────────────────────

export default function LoadingSpinner({ fullPage = false, size = 40, text = '' }) {
  const containerStyle = fullPage
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        zIndex: 9999,
        gap: '16px',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        gap: '16px',
      };

  return (
    <div style={containerStyle}>
      <div
        style={{
          width: size,
          height: size,
          border: '3px solid var(--glass-border)',
          borderTopColor: 'var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {text && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {text}
        </p>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
