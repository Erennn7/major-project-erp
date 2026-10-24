import React from 'react';

interface BadgeProps {
  status: string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const normalize = (status || '').toUpperCase();

  switch (normalize) {
    case 'DELIVERED':
    case 'PAID':
      return <span className="badge badge-success">{normalize}</span>;

    case 'OUT_FOR_DELIVERY':
    case 'PARTIAL':
      return <span className="badge badge-warning">{normalize.replace(/_/g, ' ')}</span>;

    case 'SCHEDULED':
      return <span className="badge badge-info">{normalize}</span>;

    case 'OVERDUE':
    case 'CANCELLED':
      return <span className="badge badge-danger">{normalize}</span>;

    case 'PENDING':
      return <span className="badge badge-warning">PENDING</span>;

    default:
      return <span className="badge badge-neutral">{normalize.replace(/_/g, ' ')}</span>;
  }
};
