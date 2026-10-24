import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Truck,
  ShoppingCart,
  Boxes,
  Building2,
  RotateCcw,
  Receipt,
  Droplets,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingDeliveriesCount?: number;
  unpaidOrdersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingDeliveriesCount = 0,
  unpaidOrdersCount = 0,
}) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'analytics', label: 'Profit & Analytics', icon: TrendingUp },
    {
      id: 'deliveries',
      label: 'Deliveries & Challans',
      icon: Truck,
      badge: pendingDeliveriesCount > 0 ? `${pendingDeliveriesCount}` : undefined,
    },
    {
      id: 'orders',
      label: 'Sales Orders',
      icon: ShoppingCart,
      badge: unpaidOrdersCount > 0 ? `${unpaidOrdersCount} due` : undefined,
    },
    { id: 'batches', label: 'Procurement Batches', icon: Boxes },
    { id: 'clients', label: 'Hotels & Clients', icon: Building2 },
    { id: 'jars', label: 'Empty Jar Ledger', icon: RotateCcw },
    { id: 'expenses', label: 'Operating Expenses', icon: Receipt },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">
          <Droplets size={18} />
        </div>
        <div className="brand-info">
          <h1>AquaDistribute</h1>
          <p>Packaged Water B2B</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span>PostgreSQL 16 • Prisma</span>
        <span className="mono">v1.0</span>
      </div>
    </aside>
  );
};
