// ─── Toast Wrapper ───────────────────────────────────────────────────────────
// Re-exports react-hot-toast with custom default styling.

import toast, { Toaster } from 'react-hot-toast';

export function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'rgba(30, 41, 59, 0.95)',
          color: '#f1f5f9',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          backdropFilter: 'blur(16px)',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.875rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        },
        success: {
          iconTheme: { primary: '#34d399', secondary: '#0a0e1a' },
        },
        error: {
          iconTheme: { primary: '#f87171', secondary: '#0a0e1a' },
          duration: 5000,
        },
      }}
    />
  );
}

export { toast };
export default toast;
