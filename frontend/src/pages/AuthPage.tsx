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

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setIsLogin(true);
    setError(null);
    setLoading(true);
    try {
      const res = await api.login({ email: demoEmail, password: 'password123' });
      setStoredToken(res.token);
      localStorage.setItem('aquaflow_user', JSON.stringify(res.user));
      onAuthSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
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
          maxWidth: '460px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
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

        {/* Quick Demo Role Picker */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⚡ 1-Click Role-Based Demo Login
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', justifyContent: 'flex-start', padding: '6px 8px' }}
              onClick={() => handleDemoLogin('admin@aquaflow.local')}
              disabled={loading}
            >
              <span>👑</span>
              <span style={{ fontWeight: 600 }}>Admin Owner</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', justifyContent: 'flex-start', padding: '6px 8px' }}
              onClick={() => handleDemoLogin('dispatcher@aquaflow.local')}
              disabled={loading}
            >
              <span>🚚</span>
              <span style={{ fontWeight: 600 }}>Dispatcher</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', justifyContent: 'flex-start', padding: '6px 8px' }}
              onClick={() => handleDemoLogin('sales@aquaflow.local')}
              disabled={loading}
            >
              <span>💼</span>
              <span style={{ fontWeight: 600 }}>Sales Rep</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px', justifyContent: 'flex-start', padding: '6px 8px' }}
              onClick={() => handleDemoLogin('accountant@aquaflow.local')}
              disabled={loading}
            >
              <span>📊</span>
              <span style={{ fontWeight: 600 }}>Accountant</span>
            </button>
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              placeholder="e.g. admin@aquaflow.local"
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
            style={{ width: '100%', marginTop: '6px', padding: '10px' }}
          >
            <span>{loading ? 'Authenticating...' : isLogin ? 'Sign In to Portal' : 'Create & Launch Account'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
          Enterprise Cloud Security • Encrypted Session Protection
        </div>
      </div>
    </div>
  );
};

