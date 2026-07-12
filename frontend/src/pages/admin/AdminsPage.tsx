import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { API_URL } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';

const ADMIN_ACCENT = '#FF5740';

interface AdminUser {
  userId: string;
  email: string;
  superAdmin: boolean;
  createdAt: string;
}

export function AdminsPage() {
  const { accessToken, isSuperAdmin } = useAuthStore();
  const { C } = useTheme();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState('');
  const [addSuperAdmin, setAddSuperAdmin] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function fetchAdmins() {
    try {
      const res = await fetch(`${API_URL}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to load admins');
      setAdmins(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAdmins(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/admins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: addEmail.trim(), superAdmin: addSuperAdmin }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add admin');
      }
      setAddEmail('');
      setAddSuperAdmin(false);
      await fetchAdmins();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string, email: string) {
    if (!confirm(`Remove admin access from ${email}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/admins/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove admin');
      }
      await fetchAdmins();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: `1px solid ${C.rule}`,
    borderRadius: '2px',
    backgroundColor: C.paper,
    color: C.ink,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: '14px',
    outline: 'none',
    flex: 1,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '12px',
    letterSpacing: '0.22em',
    color: C.muted,
    borderTop: `1px solid ${C.rule}`,
    paddingTop: '12px',
    marginBottom: '16px',
    marginTop: 0,
  };

  if (!isSuperAdmin) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '64px 0',
        fontFamily: "'Lora', Georgia, serif",
        fontStyle: 'italic',
        color: C.muted,
      }}>
        Super-admin access required to manage admins.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 'clamp(672px, 55vw, 1100px)' }}>
      <h1 style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '28px',
        letterSpacing: '0.08em',
        color: C.ink,
        margin: '0 0 8px 0',
      }}>
        Manage Admins
      </h1>
      <p style={{
        fontFamily: "'Lora', Georgia, serif",
        fontStyle: 'italic',
        fontSize: '13px',
        color: C.muted,
        marginTop: 0,
        marginBottom: '32px',
      }}>
        Add or remove admin access. Super-admins can manage this list and cannot be removed by others.
      </p>

      {/* Add admin form */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', padding: '24px', marginBottom: '32px' }}>
        <div style={sectionHeaderStyle}>ADD ADMIN</div>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="user@example.com"
              required
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={adding || !addEmail.trim()}
              style={{
                padding: '8px 20px',
                backgroundColor: ADMIN_ACCENT,
                color: '#fff',
                border: 'none',
                borderRadius: '2px',
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '14px',
                letterSpacing: '0.1em',
                cursor: adding || !addEmail.trim() ? 'not-allowed' : 'pointer',
                opacity: adding || !addEmail.trim() ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {adding ? 'ADDING...' : 'ADD'}
            </button>
          </div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Lora', Georgia, serif",
            fontSize: '13px',
            color: C.muted,
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={addSuperAdmin}
              onChange={(e) => setAddSuperAdmin(e.target.checked)}
              style={{ accentColor: ADMIN_ACCENT }}
            />
            Grant super-admin (can manage other admins)
          </label>
          {addError && (
            <p style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '13px', color: C.incorrect, margin: 0 }}>
              {addError}
            </p>
          )}
        </form>
      </div>

      {/* Admin list */}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.rule}` }}>
          <div style={{ ...sectionHeaderStyle, borderTop: 'none', paddingTop: 0 }}>CURRENT ADMINS</div>
        </div>
        {loading ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.mutedFg, fontSize: '13px' }}>
            Loading...
          </div>
        ) : error ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: "'Lora', Georgia, serif", color: C.incorrect, fontSize: '13px' }}>
            {error}
          </div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', color: C.mutedFg, fontSize: '13px' }}>
            No admins yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {admins.map((admin) => (
              <li key={admin.userId} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: `1px solid ${C.ruleLight}`,
              }}>
                <div>
                  <p style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: '14px',
                    color: C.ink,
                    margin: '0 0 4px 0',
                    fontWeight: 600,
                  }}>
                    {admin.email}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {admin.superAdmin && (
                      <span style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '10px',
                        letterSpacing: '0.1em',
                        padding: '2px 6px',
                        backgroundColor: 'rgba(255,87,64,0.12)',
                        color: ADMIN_ACCENT,
                        borderRadius: '2px',
                      }}>
                        SUPER-ADMIN
                      </span>
                    )}
                    <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: '12px', color: C.mutedFg }}>
                      Added {new Date(admin.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(admin.userId, admin.email)}
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '12px',
                    letterSpacing: '0.1em',
                    color: C.mutedFg,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.incorrect)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.mutedFg)}
                  title="Remove admin access"
                >
                  REMOVE
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
