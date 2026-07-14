// ─── Modal Component ─────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { HiX } from 'react-icons/hi';

export default function Modal({ isOpen, onClose, title, children, maxWidth = '500px' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="glass-card-static"
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflow: 'auto',
          animation: 'fadeInUp 0.25s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{title}</h3>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px' }}
          >
            <HiX size={18} />
          </button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
}
