import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingUp, ShieldAlert, FileBarChart,
  UserPlus, ChevronLeft, ChevronRight, LogOut, Boxes, Settings, Lock, Truck, Landmark, BriefcaseBusiness, ShieldCheck, DatabaseZap, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/lib/BusinessContext';
import CurrencySelector from '@/components/shared/CurrencySelector';
import { useAuth } from '@/lib/AuthContext';
import AppLogo from '@/components/shared/AppLogo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  { icon: Settings, label: 'Settings', path: '/settings', permission: 'settings.view' },
];

const footerButtonClass = 'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-sidebar-foreground hover:bg-white/8 hover:text-white transition-all w-full';

/**
 * Sidebar renders in two variants:
 * - "desktop" (default): fixed rail, shown from the lg breakpoint up. Collapsible.
 * - "drawer": full-height navigation panel used inside the mobile slide-in drawer.
 */
export default function Sidebar({ collapsed = false, setCollapsed, variant = 'desktop', onNavigate, onClose }) {
  const location = useLocation();
  const { profile, requiresPassword, lockApp } = useBusiness();
  const { can, logout } = useAuth();

  const isDrawer = variant === 'drawer';
  const isCollapsed = collapsed && !isDrawer;
  const visibleNavItems = navItems.filter((item) => !item.permission || can(item.permission));
  const companyName = profile.companyName || 'RiskFlow CRM';

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        aria-label="Application sidebar"
        className={cn(
          'flex flex-col border-r border-sidebar-border/80 bg-[linear-gradient(180deg,#081a3c_0%,#0d234c_52%,#132a58_100%)] text-sidebar-foreground shadow-[18px_0_60px_-42px_rgba(8,23,58,0.75)]',
          isDrawer
            ? 'h-full w-[280px] max-w-[85vw]'
            : cn('fixed left-0 top-0 z-40 hidden h-screen lg:flex transition-all duration-300 motion-reduce:transition-none', collapsed ? 'w-[68px]' : 'w-[240px]')
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-white/8">
          {isCollapsed ? (
            <AppLogo src={profile.logoDataUrl} alt={companyName} className="mx-auto h-9 w-9 rounded-lg" />
          ) : (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <AppLogo src={profile.logoDataUrl} alt={companyName} className="h-9 w-9 flex-shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <span className="font-inter font-bold text-base text-sidebar-accent-foreground tracking-tight block truncate">
                    {profile.companyName || 'RiskFlow'}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/70">Workspace</span>
                </div>
              </div>
              {isDrawer && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation"
                  autoFocus
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-white/8 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Nav Items */}
        <nav aria-label="Main navigation" className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const link = (
              <Link
                to={item.path}
                aria-label={isCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate?.()}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                  isActive
                    ? 'bg-[linear-gradient(135deg,rgba(59,130,246,0.95),rgba(99,102,241,0.88))] text-white shadow-[0_18px_45px_-24px_rgba(59,130,246,0.65)]'
                    : 'text-sidebar-foreground hover:bg-white/8 hover:text-white'
                )}
              >
                <item.icon className={cn('w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 motion-reduce:transition-none', isActive ? 'scale-105' : 'group-hover:scale-105')} aria-hidden="true" />
                {!isCollapsed && <span className="font-inter truncate">{item.label}</span>}
              </Link>
            );

            if (!isCollapsed) {
              return <React.Fragment key={item.path}>{link}</React.Fragment>;
            }

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {isCollapsed ? (
            <div className="flex justify-center pb-1">
              <CurrencySelector compact iconOnly />
            </div>
          ) : (
            <div className="px-1 pb-1">
              <CurrencySelector compact />
            </div>
          )}

          {!isDrawer && (
            <button
              type="button"
              onClick={() => setCollapsed?.(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={footerButtonClass}
            >
              {collapsed ? <ChevronRight className="w-[18px] h-[18px]" aria-hidden="true" /> : <ChevronLeft className="w-[18px] h-[18px]" aria-hidden="true" />}
              {!collapsed && <span className="font-inter">Collapse</span>}
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            title={isCollapsed ? 'Log out' : undefined}
            className={footerButtonClass}
          >
            <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
            {!isCollapsed && <span className="font-inter">Logout</span>}
          </button>
          {requiresPassword && (
            <button
              type="button"
              onClick={lockApp}
              aria-label="Lock app"
              title={isCollapsed ? 'Lock app' : undefined}
              className={footerButtonClass}
            >
              <Lock className="w-[18px] h-[18px]" aria-hidden="true" />
              {!isCollapsed && <span className="font-inter">Lock App</span>}
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
