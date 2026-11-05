import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  generateEncryptionKey,
  hashSecretForStorage,
  migrateLegacyProfileSecrets,
  migrateStorageEncryption,
  PROFILE_CHANGED_EVENT,
  readBusinessProfile,
  verifyPassword,
  writeBusinessProfile,
} from '@/api/crmClient';

const SESSION_UNLOCK_KEY = 'riskflow_crm:session_unlocked';
const AI_GENERAL_UNLOCK_KEY = 'riskflow_crm:ai_general_unlocked';
const RELEASE_CLEAN_KEY = 'riskflow_crm:release_clean:v2';
const STORAGE_KEY = 'riskflow_crm:business_profile:v1';

// Shown in password inputs in place of a stored secret. Saving a form that still holds this
// value keeps the existing hash. It is never hashed or persisted.
export const SECRET_PLACEHOLDER = '********';

const BusinessContext = createContext(null);

// Tail of the queue of profile saves (see saveProfile). Shared by every provider instance.
let profileSaveQueue = Promise.resolve();

const hasAppLock = (stored) => Boolean(stored.appPasswordHash || stored.appPassword);
const hasAiLock = (stored) => Boolean(stored.aiGeneralPasswordHash || stored.aiGeneralPassword);

// Compares input against a stored hash. Falls back to the legacy plaintext value only if
// the migration to hashes has not run for this profile.
const matchesSecret = (input, hash, legacyPlaintext) => {
  if (hash) {
    return verifyPassword(input, hash);
  }
  return Boolean(legacyPlaintext) && input === legacyPlaintext;
};

// Returns the new hash to store for a secret field in saveProfile.
// undefined: field not in the update, keep what is stored.
// SECRET_PLACEHOLDER: the form was left untouched, keep what is stored.
// empty: remove the lock. Anything else: hash the new value.
const resolveSecretHash = async (value, previousHash, previousLegacy) => {
  const keepExisting = async () => {
    if (previousHash) {
      return previousHash;
    }
    return previousLegacy ? hashSecretForStorage(previousLegacy) : '';
  };

  if (value === undefined || value === SECRET_PLACEHOLDER) {
    return keepExisting();
  }
  if (value === null || value === '') {
    return '';
  }
  return hashSecretForStorage(value);
};

// The profile object handed to the UI. Hashes are never exposed. Secret fields show
// a placeholder when a lock is set, so existing truthiness checks keep working.
const toPublicProfile = (stored) => {
  const publicProfile = { ...stored };
  delete publicProfile.appPasswordHash;
  delete publicProfile.aiGeneralPasswordHash;
  publicProfile.appPassword = hasAppLock(stored) ? SECRET_PLACEHOLDER : '';
  publicProfile.aiGeneralPassword = hasAiLock(stored) ? SECRET_PLACEHOLDER : '';
  return publicProfile;
};

// Clears the legacy one-time reset. It must never wipe a workspace that already has a profile.
const runOneTimeReleaseClean = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.localStorage.getItem(STORAGE_KEY)) {
    return;
  }
  if (window.localStorage.getItem(RELEASE_CLEAN_KEY) === 'true') {
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

export function BusinessProvider({ children }) {
  // Internal state: the stored profile, including hashes. UI gets toPublicProfile(stored).
  const [stored, setStored] = useState(() => readBusinessProfile());
  const [isReady, setIsReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isAiGeneralUnlocked, setIsAiGeneralUnlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      runOneTimeReleaseClean();
      try {
        await migrateLegacyProfileSecrets();
      } catch (error) {
        // Legacy plaintext locks still count as locks (see hasAppLock), so the app stays locked.
        console.error('Failed to upgrade legacy workspace secrets', error);
      }
      if (cancelled) {
        return;
      }

      const next = readBusinessProfile();
      setStored(next);
      setIsUnlocked(!hasAppLock(next) || window.sessionStorage.getItem(SESSION_UNLOCK_KEY) === 'true');
      setIsAiGeneralUnlocked(!hasAiLock(next) || window.sessionStorage.getItem(AI_GENERAL_UNLOCK_KEY) === 'true');
      setIsReady(true);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Other modules (e.g. crmClient removing the admin's plaintext password) write the profile
  // directly. Re-read it so this state never goes stale.
  useEffect(() => {
    const syncFromStorage = () => setStored(readBusinessProfile());
    window.addEventListener(PROFILE_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, syncFromStorage);
  }, []);

  // Another tab on the same origin saved or erased the profile. The storage event only fires
  // in the other tabs, so this does not loop back into this tab's own writes.
  useEffect(() => {
    const syncFromOtherTab = (event) => {
      if (event.key === null || event.key === STORAGE_KEY) {
        setStored(readBusinessProfile());
      }
    };
    window.addEventListener('storage', syncFromOtherTab);
    return () => window.removeEventListener('storage', syncFromOtherTab);
  }, []);

  const profile = useMemo(() => toPublicProfile(stored), [stored]);
  const hasCompletedSetup = Boolean(profile.companyName?.trim());
  const requiresPassword = hasAppLock(stored);

  // Async: hashing secrets uses PBKDF2. Callers should `await` it before reading the result.
  // Accepts plaintext appPassword / aiGeneralPassword and hashes them here.
  // Saves run one at a time. Each one reads the stored profile only after earlier saves and
  // the legacy upgrade have finished, so a slow PBKDF2 hash in one save cannot write back a
  // stale copy of the profile (which could also bring back a plaintext admin password).
  const saveProfile = useCallback((updates = {}) => {
    const runSave = async () => {
      try {
        await migrateLegacyProfileSecrets();
      } catch (error) {
        console.error('Failed to upgrade legacy workspace secrets', error);
      }
      const previous = readBusinessProfile();

      const appPasswordHash = await resolveSecretHash(updates.appPassword, previous.appPasswordHash, previous.appPassword);
      const aiGeneralPasswordHash = await resolveSecretHash(
        updates.aiGeneralPassword,
        previous.aiGeneralPasswordHash,
        previous.aiGeneralPassword
      );

      const next = {
        ...previous,
        ...updates,
        appPassword: '',
        aiGeneralPassword: '',
        appPasswordHash,
        aiGeneralPasswordHash,
        encryptionKey: updates.encryptionKey || previous.encryptionKey || generateEncryptionKey(),
      };

      if (
        previous.encryptionKey !== next.encryptionKey ||
        previous.enableLocalEncryption !== next.enableLocalEncryption
      ) {
        // Re-encrypts records (with a backup first) before the new profile is written.
        migrateStorageEncryption(previous, next);
      }

      writeBusinessProfile(next);
      setStored(next);

      if (!hasAppLock(next)) {
        window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
        setIsUnlocked(true);
      }

      if (!hasAiLock(next)) {
        window.sessionStorage.setItem(AI_GENERAL_UNLOCK_KEY, 'true');
        setIsAiGeneralUnlocked(true);
      } else if (previous.aiGeneralPasswordHash !== next.aiGeneralPasswordHash) {
        window.sessionStorage.removeItem(AI_GENERAL_UNLOCK_KEY);
        setIsAiGeneralUnlocked(false);
      }

      return toPublicProfile(next);
    };

    const run = profileSaveQueue.then(runSave);
    profileSaveQueue = run.catch(() => {});
    return run;
  }, []);

  // Checks the app lock password without changing lock state.
  // A check that cannot run (for example Web Crypto unavailable) counts as not matching.
  const verifyAppLockPassword = useCallback(async (password) => {
    const current = readBusinessProfile();
    if (!hasAppLock(current)) {
      return true;
    }
    try {
      return await matchesSecret(password, current.appPasswordHash, current.appPassword);
    } catch (error) {
      console.error('Could not check the app lock password', error);
      return false;
    }
  }, []);

  const unlockApp = useCallback(async (password) => {
    const current = readBusinessProfile();
    if (!hasAppLock(current)) {
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
      setIsUnlocked(true);
      return { ok: true };
    }

    let matched;
    try {
      matched = await matchesSecret(password, current.appPasswordHash, current.appPassword);
    } catch (error) {
      console.error('Could not check the app lock password', error);
      return { ok: false, message: 'Could not check the password in this browser.' };
    }

    if (matched) {
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
      setIsUnlocked(true);
      return { ok: true };
    }

    return { ok: false, message: 'Incorrect password' };
  }, []);

  const lockApp = useCallback(() => {
    window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    setIsUnlocked(false);
  }, []);

  const clearPassword = useCallback(() => {
    const next = { ...readBusinessProfile(), appPassword: '', appPasswordHash: '' };
    writeBusinessProfile(next);
    setStored(next);
    window.sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
    setIsUnlocked(true);
  }, []);

  // Async, like unlockApp. Callers must `await` the result.
  const unlockGeneralAi = useCallback(async (password) => {
    const current = readBusinessProfile();
    if (!hasAiLock(current)) {
      window.sessionStorage.setItem(AI_GENERAL_UNLOCK_KEY, 'true');
      setIsAiGeneralUnlocked(true);
      return { ok: true };
    }

    let matched;
    try {
      matched = await matchesSecret(password, current.aiGeneralPasswordHash, current.aiGeneralPassword);
    } catch (error) {
      console.error('Could not check the AI chat password', error);
      return { ok: false, message: 'Could not check the password in this browser.' };
    }

    if (matched) {
      window.sessionStorage.setItem(AI_GENERAL_UNLOCK_KEY, 'true');
      setIsAiGeneralUnlocked(true);
      return { ok: true };
    }

    return { ok: false, message: 'Incorrect AI chat password' };
  }, []);

  const lockGeneralAi = useCallback(() => {
    window.sessionStorage.removeItem(AI_GENERAL_UNLOCK_KEY);
    setIsAiGeneralUnlocked(false);
  }, []);

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
    verifyAppLockPassword,
    unlockGeneralAi,
    lockGeneralAi,
  }), [
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
    verifyAppLockPassword,
    unlockGeneralAi,
    lockGeneralAi,
  ]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
