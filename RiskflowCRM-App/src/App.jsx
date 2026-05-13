import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { BusinessProvider, useBusiness } from '@/lib/BusinessContext';
import { ConfirmProvider } from '@/lib/ConfirmContext';
import { CurrencyProvider } from '@/lib/CurrencyContext';
import UserNotRegisteredError from '@/Components/UserNotRegistered';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import Deals from '@/pages/Deals';
import RiskManagement from '@/pages/RiskManagement';
import Reports from '@/pages/Reports';
import Onboarding from '@/pages/Onboarding';
import ContactDetail from '@/pages/ContactDetail';
import OnboardingDetail from '@/pages/OnboardingDetail';
import Inventory from '@/pages/Inventory';
import Settings from '@/pages/Settings';
import Procurement from '@/pages/Procurement';
import Accounting from '@/pages/Accounting';
import SetupScreen from '@/Components/setup/SetupScreen';
import LockScreen from '@/Components/setup/LockScreen';
import LoginScreen from '@/Components/setup/LoginScreen';
import Workspace from '@/pages/Workspace';
import SalesHub from '@/pages/SalesHub';
import DataCenter from '@/pages/DataCenter';

const PermissionRoute = ({ permission, children }) => {
  const { can } = useAuth();

  if (!permission || can(permission)) {
    return children;
  }

  return <PageNotFound />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError } = useAuth();
  const { isReady, hasCompletedSetup, requiresPassword, isUnlocked } = useBusiness();

  // Show loading spinner while checking app public settings or auth
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

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/risk" element={<RiskManagement />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/onboarding/:id" element={<OnboardingDetail />} />
        <Route path="/inventory" element={<PermissionRoute permission="inventory.view"><Inventory /></PermissionRoute>} />
        <Route path="/procurement" element={<PermissionRoute permission="procurement.view"><Procurement /></PermissionRoute>} />
        <Route path="/accounting" element={<PermissionRoute permission="accounting.view"><Accounting /></PermissionRoute>} />
        <Route path="/sales" element={<PermissionRoute permission="saleshub.view"><SalesHub /></PermissionRoute>} />
        <Route path="/workspace" element={<PermissionRoute permission="workspace.view"><Workspace /></PermissionRoute>} />
        <Route path="/data-center" element={<PermissionRoute permission="workspace.view"><DataCenter /></PermissionRoute>} />
        <Route path="/settings" element={<PermissionRoute permission="settings.view"><Settings /></PermissionRoute>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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
