// ─── Failed Notifications Page ───────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin.api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function FailedNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await adminApi.getFailedNotifications();
        setNotifications(res.data.notifications || []);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading) return <LoadingSpinner fullPage text="Loading notifications..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Failed Notifications</h1>
          <p className="page-subtitle">Notifications that exhausted all retry attempts</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state glass-card-static">
          <div className="empty-icon">✅</div>
          <div className="empty-title">All Clear!</div>
          <div className="empty-message">No failed notifications. Everything is working smoothly.</div>
        </div>
      ) : (
        <div className="glass-card-static" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Type</th>
                <th>Channel</th>
                <th>Attempts</th>
                <th>Last Error</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td style={{ color: 'var(--text-muted)' }}>#{n.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{n.user?.fullName}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{n.user?.email}</div>
                  </td>
                  <td><span className="badge badge-cancelled" style={{ textTransform: 'none' }}>{n.type}</span></td>
                  <td>{n.channel}</td>
                  <td>{n.attempts}/5</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--danger)', fontSize: 'var(--font-size-xs)' }}>
                    {n.lastError || '—'}
                  </td>
                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
