import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, TrendingUp, ShieldAlert, FileBarChart, 
  UserPlus, ChevronLeft, ChevronRight, LogOut, Boxes, Settings, Lock, Truck, Landmark, BriefcaseBusiness, ShieldCheck, DatabaseZap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/lib/BusinessContext';
import CurrencySelector from '@/Components/shared/CurrencySelector';
import { useAuth } from '@/lib/AuthContext';
import AppLogo from '@/components/shared/AppLogo';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permission: 'dashboard.view' },
  { icon: Users, label: 'Contacts', path: '/contacts', permission: 'contacts.view' },
  { icon: TrendingUp, label: 'Deals', path: '/deals', permission: 'deals.view' },
  { icon: ShieldAlert, label: 'Risk Management', path: '/risk', permission: 'reports.view' },
  { icon: FileBarChart, label: 'Reports', path: '/reports', permission: 'reports.view' },
  { icon: UserPlus, label: 'Onboarding', path: '/onboarding', permission: 'onboarding.view' },
  { icon: BriefcaseBusiness, label: 'Sales Ops', path: '/sales', permission: 'saleshub.view' },
  { icon: Boxes, label: 'Inventory', path: '/inventory', permission: 'inventory.view' },
  { icon: Truck, label: 'Procurement', path: '/procurement', permission: 'procurement.view' },
  { icon: Landmark, label: 'Accounting', path: '/accounting', permission: 'accounting.view' },
  { icon: ShieldCheck, label: 'Workspace', path: '/workspace', permission: 'workspace.view' },
  { icon: DatabaseZap, label: 'Data Center', path: '/data-center', permission: 'workspace.view' },
  { icon: Settings, label: 'Settings', path: '/settings', permission: 'dashboard.view' },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { profile, requiresPassword, lockApp } = useBusiness();
  const { can, logout } = useAuth();

  const visibleNavItems = navItems.filter((item) => !item.permission || can(item.permission));

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen border-r border-sidebar-border/80 bg-[linear-gradient(180deg,#081a3c_0%,#0d234c_52%,#132a58_100%)] text-sidebar-foreground z-40 flex flex-col transition-all duration-300 shadow-[18px_0_60px_-42px_rgba(8,23,58,0.75)]",
      collapsed ? "w-[68px]" : "w-[240px]"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/8">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <AppLogo src={profile.logoDataUrl} alt={profile.companyName || 'RiskFlow CRM'} className="h-9 w-9 rounded-lg" />
            <div className="min-w-0">
              <span className="font-inter font-bold text-base text-sidebar-accent-foreground tracking-tight block truncate">
                {profile.companyName || 'RiskFlow'}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/70">Workspace</span>
            </div>
          </div>
        )}
        {collapsed && (
          <AppLogo src={profile.logoDataUrl} alt={profile.companyName || 'RiskFlow CRM'} className="mx-auto h-9 w-9 rounded-lg" />
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-[linear-gradient(135deg,rgba(59,130,246,0.95),rgba(99,102,241,0.88))] text-white shadow-[0_18px_45px_-24px_rgba(59,130,246,0.65)]" 
                  : "text-sidebar-foreground hover:bg-white/8 hover:text-white"
              )}
            >
              <item.icon className={cn("w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200", isActive ? 'scale-105' : 'group-hover:scale-105')} />
              {!collapsed && <span className="font-inter">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {/* Currency selector visible only when not collapsed */}
        {!collapsed && (
          <div className="px-1 pb-1">
            <CurrencySelector compact />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-sidebar-foreground hover:bg-white/8 hover:text-white transition-all w-full"
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!collapsed && <span className="font-inter">Collapse</span>}
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-sidebar-foreground hover:bg-white/8 hover:text-white transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span className="font-inter">Logout</span>}
        </button>
        {requiresPassword && (
          <button
            onClick={lockApp}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-sidebar-foreground hover:bg-white/8 hover:text-white transition-all w-full"
          >
            <Lock className="w-[18px] h-[18px]" />
            {!collapsed && <span className="font-inter">Lock App</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
