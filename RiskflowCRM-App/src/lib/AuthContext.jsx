import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { crmClient, initializeCrmData } from '@/api/crmClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      await initializeCrmData();
      setAppPublicSettings({
        id: 'riskflow-crm',
        public_settings: {
          auth_required: true,
        },
      });
      await checkUserAuth();
      setIsLoadingPublicSettings(false);
    } catch (error) {
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await crmClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);
      setAuthChecked(true);
      if (error.message === 'auth_required') {
        setAuthError(null);
        return;
      }
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to initialize session',
      });
    }
  };

  const login = async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await crmClient.auth.login(email, password);
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return { ok: true };
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);
      setAuthError({
        type: 'invalid_credentials',
        message: error.message || 'Unable to sign in',
      });
      return { ok: false, message: error.message || 'Unable to sign in' };
    }
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await crmClient.auth.logout();
    setAuthError(null);
  };

  const navigateToLogin = () => {
    setAuthError(null);
  };

  const can = (permission) => crmClient.permissions.can(permission);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    appPublicSettings,
    authChecked,
    login,
    logout,
    navigateToLogin,
    checkUserAuth,
    checkAppState,
    can,
  }), [
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    appPublicSettings,
    authChecked,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
