import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import AIAssistantDrawer from '@/components/ai/AIAssistantDrawer';
import AppLogo from '@/components/shared/AppLogo';
import { useBusiness } from '@/lib/BusinessContext';
import { cn } from '@/lib/utils';

const SIDEBAR_STORAGE_KEY = 'riskflow_crm_ui:sidebar_collapsed';
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeCollapsed(value) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Storage may be unavailable (private mode, blocked site data); ignore.
  }
}

export default function AppLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { profile } = useBusiness();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const companyName = profile.companyName || 'RiskFlow';

  useEffect(() => {
    storeCollapsed(collapsed);
  }, [collapsed]);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close the drawer if the viewport grows to the desktop layout.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = (event) => {
      if (event.matches) setMobileOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // While the drawer is open (aria-modal): Escape closes it, Tab stays inside it, and body scroll is locked.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const insideDrawer = drawerRef.current.contains(active);
      if (event.shiftKey && (active === first || !insideDrawer)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !insideDrawer)) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const closeDrawer = useCallback(() => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const drawerSlide = reduceMotion ? { x: 0 } : { x: '-100%' };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.10),transparent_22%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_18%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_48%,#f1f5f9_100%)] font-inter">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="app-drawer"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <AppLogo src={profile.logoDataUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-lg" />
        <span className="min-w-0 truncate text-sm font-bold tracking-tight text-slate-900">{companyName}</span>
      </header>

      {/* Desktop sidebar (lg and up) */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <React.Fragment key="mobile-nav">
            <motion.div
              key="backdrop"
              aria-hidden="true"
              onClick={closeDrawer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
            />
            <motion.div
              key="drawer"
              ref={drawerRef}
              id="app-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={drawerSlide}
              animate={{ x: 0 }}
              exit={drawerSlide}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar variant="drawer" onClose={closeDrawer} onNavigate={closeDrawer} />
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          'min-h-screen min-w-0 outline-none transition-[margin] duration-300 motion-reduce:transition-none',
          collapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        )}
      >
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="p-4 sm:p-6 lg:p-8 max-w-[1600px]"
        >
          <Outlet />
        </motion.div>
      </main>
      <AIAssistantDrawer />
    </div>
  );
}
