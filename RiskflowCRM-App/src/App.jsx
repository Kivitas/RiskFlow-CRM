import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import AccessDenied from '@/components/shared/AccessDenied';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { BusinessProvider, useBusiness } from '@/lib/BusinessContext';
import { ConfirmProvider } from '@/lib/ConfirmContext';
import { CurrencyProvider } from '@/lib/CurrencyContext';
import UserNotRegisteredError from '@/components/UserNotRegistered';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import RouteFallback from '@/components/shared/RouteFallback';
import SetupScreen from '@/components/setup/SetupScreen';
import LockScreen from '@/components/setup/LockScreen';
import LoginScreen from '@/components/setup/LoginScreen';

// Route-level pages are code-split so the initial bundle only carries the shell.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Contacts = lazy(() => import('@/pages/Contacts'));
const Deals = lazy(() => import('@/pages/Deals'));
const RiskManagement = lazy(() => import('@/pages/RiskManagement'));
const Reports = lazy(() => import('@/pages/Reports'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const ContactDetail = lazy(() => import('@/pages/ContactDetail'));
const OnboardingDetail = lazy(() => import('@/pages/OnboardingDetail'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Settings = lazy(() => import('@/pages/Settings'));
const Procurement = lazy(() => import('@/pages/Procurement'));
const Accounting = lazy(() => import('@/pages/Accounting'));
const Workspace = lazy(() => import('@/pages/Workspace'));
const SalesHub = lazy(() => import('@/pages/SalesHub'));
const DataCenter = lazy(() => import('@/pages/DataCenter'));

// Document titles keyed by top-level route segment ('/' for the dashboard).
const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/contacts': 'Contacts',
  '/deals': 'Deals',
  '/risk': 'Risk Management',
  '/reports': 'Reports',
  '/onboarding': 'Onboarding',
  '/sales': 'Sales Ops',
  '/inventory': 'Inventory',
  '/procurement': 'Procurement',
  '/accounting': 'Accounting',
  '/workspace': 'Workspace',
  '/data-center': 'Data Center',
  '/settings': 'Settings',
};

const RouteTitle = () => {
  const { pathname } = useLocation();
  const segment = `/${pathname.split('/')[1] ?? ''}`;
  useDocumentTitle(ROUTE_TITLES[segment] ?? 'Page Not Found');
  return null;
};

// Wraps each page inside the AppLayout Outlet so a crash or slow chunk stays
// within the content area and the sidebar keeps working. Keyed by pathname so
// the boundary resets on navigation.
const RoutePage = ({ children }) => {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
};

const PermissionRoute = ({ permission, children }) => {
  const { can } = useAuth();

  if (!permission || can(permission)) {
    return children;
  }

  return <AccessDenied />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError } = useAuth();
  const { isReady, hasCompletedSetup, requiresPassword, isUnlocked } = useBusiness();

  if (isLoadingPublicSettings || isLoadingAuth || !isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasCompletedSetup) {
    return <SetupScreen />;
  }

  if (requiresPassword && !isUnlocked) {
    return <LockScreen />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    if (authError.type === 'unknown') {
      return <LoginScreen />;
    }
  }

  if (!isLoadingAuth && !isLoadingPublicSettings && !isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <>
    <RouteTitle />
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<RoutePage><Dashboard /></RoutePage>} />
        <Route path="/contacts" element={<RoutePage><Contacts /></RoutePage>} />
        <Route path="/contacts/:id" element={<RoutePage><ContactDetail /></RoutePage>} />
        <Route path="/deals" element={<RoutePage><Deals /></RoutePage>} />
        <Route path="/risk" element={<RoutePage><RiskManagement /></RoutePage>} />
        <Route path="/reports" element={<RoutePage><Reports /></RoutePage>} />
        <Route path="/onboarding" element={<RoutePage><Onboarding /></RoutePage>} />
        <Route path="/onboarding/:id" element={<RoutePage><OnboardingDetail /></RoutePage>} />
        <Route path="/inventory" element={<RoutePage><PermissionRoute permission="inventory.view"><Inventory /></PermissionRoute></RoutePage>} />
        <Route path="/procurement" element={<RoutePage><PermissionRoute permission="procurement.view"><Procurement /></PermissionRoute></RoutePage>} />
        <Route path="/accounting" element={<RoutePage><PermissionRoute permission="accounting.view"><Accounting /></PermissionRoute></RoutePage>} />
        <Route path="/sales" element={<RoutePage><PermissionRoute permission="saleshub.view"><SalesHub /></PermissionRoute></RoutePage>} />
        <Route path="/workspace" element={<RoutePage><PermissionRoute permission="workspace.view"><Workspace /></PermissionRoute></RoutePage>} />
        <Route path="/data-center" element={<RoutePage><PermissionRoute permission="workspace.view"><DataCenter /></PermissionRoute></RoutePage>} />
        <Route path="/settings" element={<RoutePage><PermissionRoute permission="settings.view"><Settings /></PermissionRoute></RoutePage>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </>
  );
};


function App() {
  return (
    <BusinessProvider>
      <ConfirmProvider>
        <AuthProvider>
          <CurrencyProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthenticatedApp />
              </Router>
              <Toaster />
            </QueryClientProvider>
          </CurrencyProvider>
        </AuthProvider>
      </ConfirmProvider>
    </BusinessProvider>
  );
}

export default App;
