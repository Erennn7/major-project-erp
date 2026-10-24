import React, { useState, useEffect } from 'react';
import { Sun, Moon, Database, LogOut, User as UserIcon } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  currentTab: string;
  user?: User | null;
  onLogout?: () => void;
}

const TAB_TITLES: Record<string, string> = {
  overview: 'Executive Dashboard & Overview',
  analytics: 'Profit Calculations & Financial Analytics',
  deliveries: 'Non-GPS Delivery Management & Challans',
  orders: 'Sales Orders, Invoicing & COGS',
  batches: 'Batch Procurement & Landed Cost Tracking',
  clients: 'Hotels, Banquets & Corporate Clients',
  jars: '20L Returnable Empty Jar Ledger',
  expenses: 'Operating Expenses & Overheads',
};

export const Navbar: React.FC<NavbarProps> = ({ currentTab, user, onLogout }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="page-title">{TAB_TITLES[currentTab] || 'Management'}</h2>
      </div>

      <div className="topbar-right">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--success-text)' }}>
          <Database size={13} />
          <span>Neon Cloud Active</span>
        </div>

        <div className="time-pill">{currentTime}</div>

        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <UserIcon size={13} color="var(--text-muted)" />
            <span style={{ fontWeight: 500 }}>{user.name}</span>
            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{user.role}</span>
          </div>
        )}

        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {onLogout && (
          <button
            className="theme-toggle-btn"
            onClick={onLogout}
            title="Log out of session"
            style={{ color: 'var(--danger-text)' }}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  );
};
