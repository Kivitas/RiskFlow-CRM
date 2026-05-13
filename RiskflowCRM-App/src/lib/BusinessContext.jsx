import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { defaultBusinessProfile, migrateStorageEncryption } from '@/api/crmClient';

const STORAGE_KEY = 'riskflow_crm:business_profile:v1';
const SESSION_UNLOCK_KEY = 'riskflow_crm:session_unlocked';
const AI_GENERAL_UNLOCK_KEY = 'riskflow_crm:ai_general_unlocked';
const RELEASE_CLEAN_KEY = 'riskflow_crm:release_clean:v2';

const defaultProfile = defaultBusinessProfile;

const BusinessContext = createContext(null);

const runOneTimeReleaseClean = () => {
  if (typeof window === 'undefined' || window.localStorage.getItem(RELEASE_CLEAN_KEY) === 'true') {
    return;
  }

  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('riskflow_crm:'))
    .forEach((key) => window.localStorage.removeItem(key));
  Object.keys(window.sessionStorage)
    .filter((key) => key.startsWith('riskflow_crm:'))
    .forEach((key) => window.sessionStorage.removeItem(key));
  window.localStorage.setItem(RELEASE_CLEAN_KEY, 'true');
};

const readProfile = () => {
  if (typeof window === 'undefined') {
    return defaultProfile;
  }

  runOneTimeReleaseClean();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultProfile;
  }

  try {
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch {
    return defaultProfile;
  }
};

const writeProfile = (profile) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
};

const makeEncryptionKey = () => {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function BusinessProvider({ children }) {
  const [profile, setProfile] = useState(defaultProfile);
  const [isReady, setIsReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAiGeneralUnlocked, setIsAiGeneralUnlocked] = useState(false);

  useEffect(() => {
    const nextProfile = readProfile();
    setProfile(nextProfile);
    const unlocked = !nextProfile.appPassword || window.sessionStorage.getItem(SESSION_UNLOCK_KEY) === 'true';
    const generalUnlocked = !nextProfile.aiGeneralPassword || window.sessionStorage.getItem(AI_GENERAL_UNLOCK_KEY) === 'true';
    setIsUnlocked(unlocked);
    setIsAiGeneralUnlocked(generalUnlocked);
    setIsReady(true);
  }, []);

  const hasCompletedSetup = Boolean(profile.companyName?.trim());
  const requiresPassword = Boolean(profile.appPassword);

  const saveProfile = (updates) => {
    const previousProfile = profile;
    const nextProfile = {
      ...profile,
      ...updates,
      encryptionKey: updates.encryptionKey || profile.encryptionKey || makeEncryptionKey(),
    };

    if (
      previousProfile.encryptionKey !== nextProfile.encryptionKey ||
      previousProfile.enableLocalEncryption !== nextProfile.enableLocalEncryption
    ) {
      migrateStorageEncryption(previousProfile, nextProfile);
    }

    setProfile(nextProfile);
    writeProfile(nextProfile);

    if (!nextProfile.appPassword) {
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
      setIsUnlocked(true);
    }

    if (!nextProfile.aiGeneralPassword) {
      window.sessionStorage.setItem(AI_GENERAL_UNLOCK_KEY, 'true');
      setIsAiGeneralUnlocked(true);
    } else if (nextProfile.aiGeneralPassword !== profile.aiGeneralPassword) {
      window.sessionStorage.removeItem(AI_GENERAL_UNLOCK_KEY);
      setIsAiGeneralUnlocked(false);
    }

    return nextProfile;
  };

  const unlockApp = (password) => {
    if (!profile.appPassword) {
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
      setIsUnlocked(true);
      return { ok: true };
    }

    if (password === profile.appPassword) {
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
      setIsUnlocked(true);
      return { ok: true };
    }

    return { ok: false, message: 'Incorrect password' };
  };

  const lockApp = () => {
    window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    setIsUnlocked(false);
  };

  const clearPassword = () => {
    const nextProfile = { ...profile, appPassword: '' };
    setProfile(nextProfile);
    writeProfile(nextProfile);
    window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
    setIsUnlocked(true);
  };

  const unlockGeneralAi = (password) => {
    if (!profile.aiGeneralPassword) {
      window.sessionStorage.setItem(AI_GENERAL_UNLOCK_KEY, 'true');
      setIsAiGeneralUnlocked(true);
      return { ok: true };
    }

    if (password === profile.aiGeneralPassword) {
      window.sessionStorage.setItem(AI_GENERAL_UNLOCK_KEY, 'true');
      setIsAiGeneralUnlocked(true);
      return { ok: true };
    }

    return { ok: false, message: 'Incorrect AI chat password' };
  };

  const lockGeneralAi = () => {
    window.sessionStorage.removeItem(AI_GENERAL_UNLOCK_KEY);
    setIsAiGeneralUnlocked(false);
  };

  const value = useMemo(() => ({
    profile,
    isReady,
    hasCompletedSetup,
    requiresPassword,
    isUnlocked,
    isAiGeneralUnlocked,
    saveProfile,
    unlockApp,
    lockApp,
    clearPassword,
    unlockGeneralAi,
    lockGeneralAi,
  }), [profile, isReady, hasCompletedSetup, requiresPassword, isUnlocked, isAiGeneralUnlocked]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
