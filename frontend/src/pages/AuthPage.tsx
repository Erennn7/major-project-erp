import React, { useState } from 'react';
import { Droplets, Lock, Mail, User, ShieldCheck, ArrowRight } from 'lucide-react';
import { api, setStoredToken } from '../services/api';
import type { UserRole, User as UserType } from '../types';

interface AuthPageProps {
  onAuthSuccess: (user: UserType) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.login({ email, password });
        setStoredToken(res.token);
        localStorage.setItem('aquaflow_user', JSON.stringify(res.user));
        onAuthSuccess(res.user);
      } else {
        const res = await api.register({ name, email, password, role });
        setStoredToken(res.token);
        localStorage.setItem('aquaflow_user', JSON.stringify(res.user));
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'var(--primary)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Droplets size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
              AquaDistribute Portal
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Packaged Water B2B Distribution & Margin Management
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '3px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            style={{
              padding: '8px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: isLogin ? 'var(--bg-surface)' : 'transparent',
              color: isLogin ? 'var(--text-main)' : 'var(--text-muted)',
              border: isLogin ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            style={{
              padding: '8px',
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: !isLogin ? 'var(--bg-surface)' : 'transparent',
              color: !isLogin ? 'var(--text-main)' : 'var(--text-muted)',
              border: !isLogin ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Register Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '10px 12px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Ramesh Patil"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={13} />
              <span>Email Address *</span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. admin@waterdistribution.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={13} />
              <span>Password *</span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={13} />
                <span>User Role & Permissions *</span>
              </label>
              <select
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="ADMIN">Distributor Admin / Owner (Full Profit & Control)</option>
                <option value="DISPATCHER">Operations & Dispatcher (Deliveries & Jars)</option>
                <option value="SALES">Sales Manager (Hotels & Sales Orders)</option>
                <option value="ACCOUNTANT">Billing Accountant (Invoices & Expenses)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', padding: '10px' }}
          >
            <span>{loading ? 'Authenticating...' : isLogin ? 'Sign In to Portal' : 'Create & Launch Account'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
          Secured with Bcrypt & JWT • Neon Cloud PostgreSQL
        </div>
      </div>
    </div>
  );
};
