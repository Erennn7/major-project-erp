import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  meta?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  meta,
  icon: Icon,
  variant = 'default',
}) => {
  const getBorderColor = () => {
    switch (variant) {
      case 'success':
        return 'rgba(16, 185, 129, 0.3)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.3)';
      case 'danger':
        return 'rgba(239, 68, 68, 0.3)';
      default:
        return 'var(--border)';
    }
  };

  return (
    <div className="stat-card" style={{ borderColor: getBorderColor() }}>
      <div className="stat-label">
        <span>{label}</span>
        {Icon && <Icon size={16} color="var(--text-muted)" />}
      </div>
      <div className="stat-value">{value}</div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
};
