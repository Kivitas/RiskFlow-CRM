import CryptoJS from "crypto-js";
import { roundMoney } from "../lib/money.js";

const STORAGE_PREFIX = "riskflow_crm";
const BUSINESS_PROFILE_KEY = `${STORAGE_PREFIX}:business_profile:v1`;
const SESSION_UNLOCK_KEY = `${STORAGE_PREFIX}:session_unlocked`;
const CURRENT_USER_KEY = `${STORAGE_PREFIX}:current_user_id`;
const MIGRATION_FLAG_KEY = `${STORAGE_PREFIX}:migration:v4`;
// Latest raw copies of stored values, written before any rewrite or import.
const BACKUP_PREFIX = `${STORAGE_PREFIX}_backup`;
const BACKUP_PROFILE_NAME = "business_profile";
// Dispatched on window whenever the business profile is written, so React state can re-read it.
export const PROFILE_CHANGED_EVENT = "riskflow-crm:profile-changed";
// Only used to read/write records before a profile-specific key exists (legacy data).
const LEGACY_LOCAL_KEY = "legacy-local-key";

const ENTITY_NAMES = [
  "Contact",
  "Deal",
  "RiskAssessment",
  "OnboardingClient",
  "Activity",
  "Product",
  "Sale",
  "Supplier",
  "PurchaseOrder",
  "Expense",
  "AppUser",
  "Warehouse",
  "StockAdjustment",
  "Quote",
  "SalesOrder",
  "Payment",
  "ApprovalRequest",
  "AuditLog",
  "Notification",
  "Task",
];

const defaultBusinessProfile = {
  companyName: "",
  companyEmail: "",
  companyPhone: "",
  companyAddress: "",
  companyWebsite: "",
  industry: "",
  companySize: "",
  fiscalYearStart: "01",
  logoDataUrl: "",
  appPassword: "",
  appPasswordHash: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  taxRate: 0,
  quotePrefix: "QT",
  orderPrefix: "SO",
  invoicePrefix: "INV",
  paymentPrefix: "PAY",
  quoteApprovalThreshold: 25000,
  purchaseApprovalThreshold: 15000,
  expenseApprovalThreshold: 5000,
  aiProvider: "openai",
  openaiApiKey: "",
  openaiModel: "gpt-4.1-mini",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-sonnet-latest",
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
  aiGeneralPassword: "",
  aiGeneralPasswordHash: "",
  aiFocusModeDefault: true,
  aiUsageForUsers: true,
  gstNumber: "",
  vatNumber: "",
  panNumber: "",
  registrationNumber: "",
  invoiceFooterNote: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankSwift: "",
  enableLocalEncryption: true,
  encryptionKey: "",
};

const initialData = Object.fromEntries(ENTITY_NAMES.map((name) => [name, []]));

const legacyDemoIds = {
  Contact: new Set(["contact-1", "contact-2", "contact-3"]),
  Deal: new Set(["deal-1", "deal-2", "deal-3"]),
  RiskAssessment: new Set(["risk-1", "risk-2"]),
  OnboardingClient: new Set(["onboarding-1"]),
  Activity: new Set(["activity-1", "activity-2", "activity-3"]),
  Product: new Set(),
  Sale: new Set(),
  Supplier: new Set(),
  PurchaseOrder: new Set(),
  Expense: new Set(),
  AppUser: new Set(),
  Warehouse: new Set(),
  StockAdjustment: new Set(),
  Quote: new Set(),
  SalesOrder: new Set(),
  Payment: new Set(),
  ApprovalRequest: new Set(),
  AuditLog: new Set(),
  Notification: new Set(),
  Task: new Set(),
};

const ROLE_PERMISSIONS = {
  admin: ["*"],
  user: [
    "dashboard.view",
    "reports.view",
    "contacts.view",
    "contacts.manage",
    "deals.view",
    "deals.manage",
    "inventory.view",
    "inventory.manage",
    "procurement.view",
    "procurement.manage",
    "accounting.view",
    "saleshub.view",
    "onboarding.view",
    "onboarding.manage",
  ],
};

const isBrowser = typeof window !== "undefined";

const clone = (value) => JSON.parse(JSON.stringify(value));
const storageKey = (entityName) => `${STORAGE_PREFIX}:${entityName}`;
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const randomString = (length = 24) => {
  if (isBrowser && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, length);
  }
  return Math.random().toString(36).slice(2).padEnd(length, "x").slice(0, length);
};

const ensureSeedData = () => {
  if (!isBrowser) {
    return;
  }

  ENTITY_NAMES.forEach((entityName) => {
    const key = storageKey(entityName);
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, JSON.stringify(initialData[entityName]));
    }
  });
};

// Per-entity in-memory state for this page session.
// corruptEntities: entities whose stored value failed to decode. Reads return [] for them,
// and writes are refused (unless explicitly allowed) so the undecodable data is never overwritten.
// verifiedRaw: last raw value known to decode, so unchanged data is not re-decrypted on every write.
const corruptEntities = new Set();
const verifiedRaw = new Map();

const markVerified = (entityName, raw) => {
  verifiedRaw.set(entityName, raw);
  corruptEntities.delete(entityName);
};

const markCorrupt = (entityName, error) => {
  corruptEntities.add(entityName);
  verifiedRaw.delete(entityName);
  console.error(
    `[crmClient] Stored ${entityName} data could not be decoded. Reads show no records and writes are blocked until the data is restored or erased.`,
    error
  );
};

const assertWritable = (entityName, raw) => {
  if (!raw || verifiedRaw.get(entityName) === raw) {
    return;
  }
  try {
    parseStoredValue(raw);
    markVerified(entityName, raw);
  } catch (error) {
    markCorrupt(entityName, error);
    throw new Error(
      `Refusing to overwrite ${entityName} data because the stored copy could not be decoded. Restore a backup or erase the workspace before saving again.`
    );
  }
};

const readRecords = (entityName) => {
  if (!isBrowser) {
    return clone(initialData[entityName] || []);
  }

  ensureSeedData();
  const raw = window.localStorage.getItem(storageKey(entityName));
  if (!raw) {
    return [];
  }
  try {
    const records = parseStoredValue(raw);
    markVerified(entityName, raw);
    return records;
  } catch (error) {
    markCorrupt(entityName, error);
    return [];
  }
};

// Pass { overwriteCorrupt: true } only for explicit user actions that replace the data
// (import, clear operational data). Normal writes never overwrite undecodable data.
const writeRecords = (entityName, records, { overwriteCorrupt = false } = {}) => {
  if (!isBrowser) {
    return;
  }
  const key = storageKey(entityName);
  if (!overwriteCorrupt) {
    assertWritable(entityName, window.localStorage.getItem(key));
  }
  const serialized = serializeStoredValue(records);
  window.localStorage.setItem(key, serialized);
  markVerified(entityName, serialized);
};

export const readBusinessProfile = () => {
  if (!isBrowser) {
    return clone(defaultBusinessProfile);
  }

  const raw = window.localStorage.getItem(BUSINESS_PROFILE_KEY);
  if (!raw) {
    return clone(defaultBusinessProfile);
  }

  try {
    const parsed = JSON.parse(raw);
    // No fallback here: an empty key means "legacy profile", which migrateLegacyProfileSecrets fixes.
    const encryptionKey = parsed.encryptionKey || parsed.workspaceEncryptionKey || "";
    return {
      ...defaultBusinessProfile,
      ...parsed,
      encryptionKey,
      adminName: parsed.adminName || parsed.ownerName || "",
      adminEmail: parsed.adminEmail || parsed.ownerEmail || "",
      adminPassword: parsed.adminPassword || parsed.ownerPassword || "",
    };
  } catch {
    return clone(defaultBusinessProfile);
  }
};

export const writeBusinessProfile = (profile) => {
  if (!isBrowser) {
    return;
  }
  window.localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
};

// Local encryption is OBFUSCATION, not security. The AES key is stored in the same
// origin's localStorage as the records it protects, so anyone who can read that storage
// can decrypt them. It only stops casual reading of raw values; protect the device and
// browser profile for real confidentiality.
const getEncryptionSecret = (profile = readBusinessProfile()) =>
  profile.encryptionKey || LEGACY_LOCAL_KEY;

const decodeStoredValue = (raw, secret) => {
  const text = String(raw);
  if (!text.startsWith("enc::")) {
    return JSON.parse(text);
  }
  const decrypted = CryptoJS.AES.decrypt(text.slice(5), secret).toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error("decryption produced no data");
  }
  return JSON.parse(decrypted);
};

// Throws when the stored value cannot be decoded. Never substitute an empty list here:
// a later write would then overwrite the real data.
const parseStoredValue = (raw, secret = getEncryptionSecret()) => {
  let value;
  try {
    value = decodeStoredValue(raw, secret);
  } catch (error) {
    throw new Error(`Stored workspace data could not be decoded: ${error.message}`);
  }
  if (!Array.isArray(value)) {
    throw new Error("Stored workspace data is not a list of records.");
  }
  return value;
};

const serializeStoredValue = (value, profile = readBusinessProfile()) => {
  const json = JSON.stringify(value);
  if (!profile.enableLocalEncryption) {
    return json;
  }
  const encrypted = CryptoJS.AES.encrypt(json, getEncryptionSecret(profile)).toString();
  return `enc::${encrypted}`;
};

// Copies the latest raw values (encrypted or plain, exactly as stored) to riskflow_crm_backup:<name>.
// Only the most recent copy is kept. The profile is included because encrypted records
// cannot be read back without the key that lives in the profile.
const backupRawValues = () => {
  if (!isBrowser) {
    return;
  }
  ENTITY_NAMES.forEach((entityName) => {
    const raw = window.localStorage.getItem(storageKey(entityName));
    if (raw !== null) {
      window.localStorage.setItem(`${BACKUP_PREFIX}:${entityName}`, raw);
    }
  });
  const rawProfile = window.localStorage.getItem(BUSINESS_PROFILE_KEY);
  if (rawProfile !== null) {
    window.localStorage.setItem(`${BACKUP_PREFIX}:${BACKUP_PROFILE_NAME}`, rawProfile);
  }
};

// Re-encrypts every entity from the previous profile's secret to the next one.
// Entities that cannot be decoded with the previous secret are left byte-for-byte untouched.
const migrateStorageEncryption = (previousProfile, nextProfile) => {
  if (!isBrowser) {
    return;
  }
  backupRawValues();
  ENTITY_NAMES.forEach((entityName) => {
    const key = storageKey(entityName);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return;
    }

    let records;
    try {
      records = parseStoredValue(raw, getEncryptionSecret(previousProfile));
    } catch (error) {
      markCorrupt(entityName, error);
      return;
    }

    const nextRaw = serializeStoredValue(records, nextProfile);
    window.localStorage.setItem(key, nextRaw);
    markVerified(entityName, nextRaw);
  });
};

export const generateEncryptionKey = () => {
  if (isBrowser && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// Upgrades profiles written by older builds:
// - plaintext appPassword / aiGeneralPassword become PBKDF2 hashes;
// - a profile without its own encryption key gets a random one, and its records are re-encrypted.
// Concurrent callers share one run so the key is never generated twice.
let legacySecretMigration = null;

const migrateLegacyProfileSecretsNow = async () => {
  if (!isBrowser || !window.localStorage.getItem(BUSINESS_PROFILE_KEY)) {
    return;
  }

  const previous = readBusinessProfile();
  const next = { ...previous };
  let changed = false;

  if (previous.appPassword && !previous.appPasswordHash) {
    next.appPasswordHash = await hashSecretForStorage(previous.appPassword);
    next.appPassword = "";
    changed = true;
  }

  if (previous.aiGeneralPassword && !previous.aiGeneralPasswordHash) {
    next.aiGeneralPasswordHash = await hashSecretForStorage(previous.aiGeneralPassword);
    next.aiGeneralPassword = "";
    changed = true;
  }

  if (!previous.encryptionKey && previous.companyName) {
    // The records were encrypted with the shared legacy key. Move them to a per-workspace key.
    next.encryptionKey = generateEncryptionKey();
    migrateStorageEncryption(previous, next);
    changed = true;
  }

  if (changed) {
    writeBusinessProfile(next);
  }
};

export const migrateLegacyProfileSecrets = () => {
  if (!legacySecretMigration) {
    legacySecretMigration = migrateLegacyProfileSecretsNow().finally(() => {
      legacySecretMigration = null;
    });
  }
  return legacySecretMigration;
};

const getCurrentUserId = () => (isBrowser ? window.sessionStorage.getItem(CURRENT_USER_KEY) : null);

const setCurrentUserId = (id) => {
  if (!isBrowser) {
    return;
  }

  if (id) {
    window.sessionStorage.setItem(CURRENT_USER_KEY, id);
    window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "true");
  } else {
    window.sessionStorage.removeItem(CURRENT_USER_KEY);
  }
};

const createTimestampedRecord = (data) => ({
  ...data,
  id: crypto.randomUUID(),
  created_date: nowIso(),
  updated_date: nowIso(),
});

const updateTimestampedRecord = (record, patch) => ({
  ...record,
  ...patch,
  updated_date: nowIso(),
});

const requireRecord = (records, id, entityName) => {
  const record = records.find((item) => item.id === id);
  if (!record) {
    throw new Error(`${entityName} record not found`);
  }
  return record;
};

const isLegacyDemoRecord = (entityName, record) => Boolean(legacyDemoIds[entityName]?.has(record?.id));

const sortRecords = (records, sortBy) => {
  if (!sortBy) {
    return records;
  }

  const descending = sortBy.startsWith("-");
  const field = descending ? sortBy.slice(1) : sortBy;
  return [...records].sort((left, right) => {
    const a = left?.[field];
    const b = right?.[field];
    if (a === b) {
      return 0;
    }
    if (a == null) {
      return 1;
    }
    if (b == null) {
      return -1;
    }
    if (typeof a === "number" && typeof b === "number") {
      return descending ? b - a : a - b;
    }
    return descending ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
  });
};

const listEntityRecords = (entityName, sortBy, limit) => {
  const records = sortRecords(readRecords(entityName), sortBy);
  return typeof limit === "number" ? records.slice(0, limit) : records;
};

const can = (user, permission) => {
  const permissions = ROLE_PERMISSIONS[user?.role] || [];
  return permissions.includes("*") || permissions.includes(permission);
};

const countActiveAdmins = (users) =>
  users.filter((user) => user.role === "admin" && user.status !== "inactive").length;

const getCurrentUser = () => {
  const userId = getCurrentUserId();
  if (!userId) {
    return null;
  }
  return readRecords("AppUser").find((user) => user.id === userId) || null;
};

const recordAudit = ({ action, entityType, entityId, entityLabel, details }) => {
  const actor = getCurrentUser();
  const auditLogs = readRecords("AuditLog");
  auditLogs.unshift(
    createTimestampedRecord({
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel || "",
      actor_id: actor?.id || "system",
      actor_name: actor?.full_name || "System",
      details: details || "",
    })
  );
  writeRecords("AuditLog", auditLogs.slice(0, 500));
};

// Sign-in and sign-out must not fail because the audit log cannot be written (for example when
// it is undecodable). The session change still goes through, so the failure is only logged.
const recordAuditBestEffort = (entry) => {
  try {
    recordAudit(entry);
  } catch (error) {
    console.error("Audit log entry could not be written", error);
  }
};

const createNotification = ({ title, message, type = "info", targetRole = "all", targetUserId = "" }) => {
  const notifications = readRecords("Notification");
  notifications.unshift(
    createTimestampedRecord({
      title,
      message,
      type,
      target_role: targetRole,
      target_user_id: targetUserId,
      read: false,
    })
  );
  writeRecords("Notification", notifications.slice(0, 200));
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Highest number ever issued for an entity. Kept in plain localStorage (not encrypted) so that
// numbers are never reused after a record is deleted.
const docCounterKey = (entityName) => `${STORAGE_PREFIX}:doc_counter:${entityName}`;

const readDocCounter = (entityName) => {
  if (!isBrowser) {
    return 0;
  }
  const value = Number(window.localStorage.getItem(docCounterKey(entityName)));
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
};

const nextDocumentNumber = (prefix, entityName) => {
  // Only exact "PREFIX-<digits>" values count. Malformed document numbers are ignored.
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const existingMax = readRecords(entityName).reduce((max, record) => {
    const match = pattern.exec(String(record.document_number || ""));
    const value = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(value) && value > max ? value : max;
  }, 0);
  const next = Math.max(readDocCounter(entityName), existingMax) + 1;
  if (isBrowser) {
    window.localStorage.setItem(docCounterKey(entityName), String(next));
  }
  return `${prefix}-${String(next).padStart(4, "0")}`;
};

// The admin password is only needed to create or update the AppUser record.
// Once that has been done, remove the plaintext copy from the stored profile.
const scrubPlaintextAdminPassword = () => {
  const profile = readBusinessProfile();
  if (!profile.adminPassword) {
    return;
  }
  writeBusinessProfile({ ...profile, adminPassword: "", ownerPassword: "" });
};

const ensureOwnerUser = async () => {
  const users = readRecords("AppUser");
  const profile = readBusinessProfile();
  const ownerEmail = profile.adminEmail || profile.companyEmail || "";
  const ownerPassword = profile.adminPassword || "";
  const fullName = profile.adminName || "Admin";

  if (!profile.companyName || !ownerEmail || !ownerPassword) {
    // Only drop the plaintext copy when a real owner account already exists. A lone bootstrap
    // placeholder still needs the password to be replaced once setup completes.
    const isBootstrapPlaceholder =
      users.length === 1 && users[0].email === "admin@riskflowcrm.local";
    if (users.length > 0 && !isBootstrapPlaceholder) {
      scrubPlaintextAdminPassword();
    }
    return users[0] || null;
  }

  if (users.length > 0) {
    if (
      users.length === 1 &&
      users[0].email === "admin@riskflowcrm.local" &&
      ownerEmail &&
      ownerPassword
    ) {
      const [firstName, ...rest] = fullName.split(" ");
      const updatedBootstrapUser = updateTimestampedRecord(users[0], {
        email: ownerEmail.toLowerCase(),
        full_name: fullName,
        first_name: firstName || "Admin",
        last_name: rest.join(" ") || "",
        password_hash: await hashPassword(ownerPassword),
        role: "admin",
        ai_enabled: true,
        status: "active",
      });
      writeRecords("AppUser", [updatedBootstrapUser]);
      scrubPlaintextAdminPassword();
      return updatedBootstrapUser;
    }

    scrubPlaintextAdminPassword();
    return users[0];
  }

  const [firstName, ...rest] = fullName.split(" ");
  const owner = createTimestampedRecord({
    email: ownerEmail.toLowerCase(),
    full_name: fullName,
    first_name: firstName || "Workspace",
    last_name: rest.join(" ") || "Admin",
    role: "admin",
    ai_enabled: true,
    password_hash: await hashPassword(ownerPassword),
    status: "active",
  });

  writeRecords("AppUser", [owner]);
  recordAudit({
    action: "bootstrap_admin",
    entityType: "AppUser",
    entityId: owner.id,
    entityLabel: owner.full_name,
    details: "Created initial admin account from workspace settings.",
  });
  scrubPlaintextAdminPassword();
  return owner;
};

const ensureDefaultWarehouse = () => {
  const warehouses = readRecords("Warehouse");
  if (warehouses.length > 0) {
    return warehouses[0];
  }
  if (corruptEntities.has("Warehouse")) {
    // Undecodable stored warehouses: return an unsaved placeholder instead of overwriting them.
    return { id: "", name: "Main Warehouse", code: "MAIN", location: "", manager_name: "", status: "active" };
  }

  const defaultWarehouse = createTimestampedRecord({
    name: "Main Warehouse",
    code: "MAIN",
    location: "Primary stock room",
    manager_name: "",
    status: "active",
  });
  writeRecords("Warehouse", [defaultWarehouse]);
  return defaultWarehouse;
};

const migrateLegacyDemoData = async () => {
  if (!isBrowser || window.localStorage.getItem(MIGRATION_FLAG_KEY) === "done") {
    return;
  }

  ENTITY_NAMES.forEach((entityName) => {
    const records = readRecords(entityName);
    if (corruptEntities.has(entityName)) {
      return; // Never overwrite data that could not be decoded.
    }
    writeRecords(entityName, records.filter((record) => !isLegacyDemoRecord(entityName, record)));
  });

  ensureDefaultWarehouse();
  await ensureOwnerUser();

  window.localStorage.setItem(MIGRATION_FLAG_KEY, "done");
};

export async function hashPassword(password) {
  const input = String(password || "");
  if (!isBrowser || !window.crypto?.subtle) {
    // Never fall back to storing the password in clear text.
    throw new Error("Secure password hashing is not available in this browser");
  }
  const salt = randomString(24);
  const iterations = 150000;
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(input),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hash = Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

// Hash for a workspace secret (app lock, AI chat password). Refuses to store the
// "plain:" fallback that hashPassword returns when Web Crypto is unavailable.
export const hashSecretForStorage = async (value) => {
  const hash = await hashPassword(value);
  if (hash.startsWith("plain:")) {
    throw new Error("Secure password hashing is not available in this browser context.");
  }
  return hash;
};

export async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }
  // Plaintext hashes are never accepted, whatever the browser supports.
  if (String(storedHash).startsWith("plain:")) {
    return false;
  }

  if (String(storedHash).startsWith("pbkdf2$")) {
    if (!isBrowser || !window.crypto?.subtle) {
      return false;
    }
    const [, iterationText, salt, expected] = String(storedHash).split("$");
    const iterations = Number(iterationText || 150000);
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(String(password || "")),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt || ""),
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );
    const hash = Array.from(new Uint8Array(bits))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return hash === expected;
  }

  const legacyHash = await (async () => {
    const input = String(password || "");
    if (!isBrowser || !window.crypto?.subtle) {
      return null;
    }
    const data = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  })();
  return legacyHash !== null && legacyHash === storedHash;
}

const normalizeProduct = (data) => {
  const warehouse = readRecords("Warehouse").find((item) => item.id === data.warehouse_id) || ensureDefaultWarehouse();
  const stock = Number(data.stock_quantity || 0);
  const reorderLevel = Number(data.reorder_level || 0);
  const unitPrice = roundMoney(data.unit_price || 0);
  const costPrice = roundMoney(data.cost_price || 0);
  return {
    ...data,
    name: String(data.name || "").trim(),
    sku: String(data.sku || "").trim().toUpperCase(),
    stock_quantity: stock,
    reorder_level: reorderLevel,
    unit_price: unitPrice,
    cost_price: costPrice,
    status: data.status || "active",
    warehouse_id: data.warehouse_id || warehouse.id,
    warehouse_name: data.warehouse_name || warehouse.name,
    inventory_value: roundMoney(stock * costPrice),
  };
};

const updateProductInventoryValue = (product) => ({
  ...product,
  inventory_value: roundMoney(Number(product.stock_quantity || 0) * Number(product.cost_price || 0)),
});

const ensureUniqueProductSku = (products, sku, excludeId = null) => {
  const normalizedSku = String(sku || "").trim().toUpperCase();
  if (!normalizedSku) {
    throw new Error("SKU is required");
  }
  const duplicate = products.find(
    (product) => product.sku === normalizedSku && product.id !== excludeId
  );
  if (duplicate) {
    throw new Error(`A product with SKU "${normalizedSku}" already exists`);
  }
};

const normalizeSupplier = (data) => ({
  ...data,
  status: data.status || "active",
  payment_terms: data.payment_terms || "Net 30",
});

const normalizeExpense = (data) => ({
  ...data,
  amount: Number(data.amount || 0),
  category: data.category || "operations",
  expense_date: data.expense_date || today(),
  payment_status: data.payment_status || "paid",
});

const normalizeWarehouse = (data) => ({
  ...data,
  code: (data.code || "").toUpperCase(),
  status: data.status || "active",
});

// Merges a patch into a quote or sales order. When the amounts that drive the totals change, any
// stored tax_amount / total_amount that the patch does not supply is dropped, so it is derived again.
const withRecomputedTotals = (existing, patch) => {
  const merged = { ...existing, ...patch };
  const touchesTotals = ["subtotal", "tax_rate", "discount_amount"].some((key) => patch[key] !== undefined);
  if (touchesTotals) {
    if (patch.tax_amount === undefined) {
      delete merged.tax_amount;
    }
    if (patch.total_amount === undefined) {
      delete merged.total_amount;
    }
  }
  return merged;
};

// Shared totals rule for quotes and sales orders: tax and total are derived from
// subtotal, tax_rate and discount unless the caller supplies them explicitly.
const computeDocumentTotals = (data, profile) => {
  const subtotal = roundMoney(data.subtotal || 0);
  const taxRate = Number(data.tax_rate ?? profile.taxRate ?? 0);
  const taxAmount = roundMoney(data.tax_amount ?? (subtotal * taxRate) / 100);
  const discountAmount = roundMoney(data.discount_amount || 0);
  const totalAmount = roundMoney(data.total_amount ?? subtotal + taxAmount - discountAmount);
  return { subtotal, taxRate, taxAmount, discountAmount, totalAmount };
};

const normalizeQuote = (data) => {
  const profile = readBusinessProfile();
  const { subtotal, taxRate, taxAmount, discountAmount, totalAmount } = computeDocumentTotals(data, profile);
  return {
    ...data,
    document_number: data.document_number || nextDocumentNumber(profile.quotePrefix || "QT", "Quote"),
    quote_date: data.quote_date || today(),
    valid_until: data.valid_until || today(),
    status: data.status || "draft",
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    approval_status: data.approval_status || "not_required",
  };
};

const normalizeSalesOrder = (data) => {
  const profile = readBusinessProfile();
  const { subtotal, taxRate, taxAmount, discountAmount, totalAmount } = computeDocumentTotals(data, profile);
  return {
    ...data,
    document_number: data.document_number || nextDocumentNumber(profile.orderPrefix || "SO", "SalesOrder"),
    order_date: data.order_date || today(),
    due_date: data.due_date || today(),
    status: data.status || "draft",
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total_amount: totalAmount,
  };
};

const normalizePayment = (data) => {
  const profile = readBusinessProfile();
  const amount = roundMoney(data.amount || 0);
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }
  const referenceType = data.reference_type || "manual";
  return {
    ...data,
    document_number: data.document_number || nextDocumentNumber(profile.paymentPrefix || "PAY", "Payment"),
    amount,
    payment_date: data.payment_date || today(),
    method: data.method || "bank_transfer",
    status: data.status || "received",
    reference_type: referenceType,
    // Sale payments must keep their sale id, otherwise syncSalePayments cannot find them again.
    reference_id: referenceType === "sales_order" || referenceType === "sale" ? data.reference_id || "" : "",
  };
};

const createSalePayload = (data, product) => {
  const quantity = Number(data.quantity || 0);
  const unitPrice = roundMoney(data.unit_price ?? product.unit_price ?? 0);
  const saleDate = data.sale_date || today();
  if (product.status !== "active") {
    throw new Error("Only active products can be sold");
  }
  if (quantity <= 0) {
    throw new Error("Sale quantity must be greater than zero");
  }
  if (Number(product.stock_quantity || 0) < quantity) {
    throw new Error("Not enough stock available for this sale");
  }
  return {
    ...data,
    product_id: product.id,
    product_name: product.name,
    warehouse_id: product.warehouse_id || "",
    warehouse_name: product.warehouse_name || "",
    quantity,
    unit_price: unitPrice,
    total_amount: roundMoney(quantity * unitPrice),
    sale_date: saleDate,
    payment_status: data.payment_status || "paid",
    channel: data.channel || "direct",
  };
};

const createPurchasePayload = (data, supplier, product) => {
  const quantity = Number(data.quantity || 0);
  const unitCost = roundMoney(data.unit_cost ?? product.cost_price ?? 0);
  const orderDate = data.order_date || today();
  if (supplier.status !== "active") {
    throw new Error("Only active suppliers can be used for purchase orders");
  }
  if (product.status === "discontinued") {
    throw new Error("Discontinued products cannot be added to purchase orders");
  }
  if (quantity <= 0) {
    throw new Error("Purchase quantity must be greater than zero");
  }
  if (unitCost < 0) {
    throw new Error("Unit cost cannot be negative");
  }
  return {
    ...data,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    product_id: product.id,
    product_name: product.name,
    warehouse_id: product.warehouse_id || "",
    warehouse_name: product.warehouse_name || "",
    quantity,
    unit_cost: unitCost,
    total_amount: roundMoney(quantity * unitCost),
    order_date: orderDate,
    expected_date: data.expected_date || orderDate,
    status: data.status || "ordered",
    payment_status: data.payment_status || "pending",
  };
};

// Pure threshold check. Returns the approval_status a new record should start with.
const initialApprovalStatus = (amount, threshold) =>
  roundMoney(amount) <= Number(threshold || 0) ? "approved" : "pending";

const isApprovedStatus = (status) => status === "approved" || status === "not_required";

// A purchase order holds stock only when it is received and approved. Records written before
// stock_applied existed fall back to their status, which is how stock was applied back then.
const purchaseStockApplied = (order) =>
  typeof order.stock_applied === "boolean"
    ? order.stock_applied
    : order.status === "received";

// Creates the approval request for an entity that already exists (so entityId is its real id).
const createApprovalRequest = ({ entityType, entityId, title, amount, threshold, requestedRole = "admin" }) => {
  const numericAmount = roundMoney(amount);
  const requests = readRecords("ApprovalRequest");
  requests.unshift(
    createTimestampedRecord({
      entity_type: entityType,
      entity_id: entityId,
      title,
      amount: numericAmount,
      threshold: Number(threshold || 0),
      requested_role: requestedRole,
      status: "pending",
      decision_note: "",
    })
  );
  writeRecords("ApprovalRequest", requests);
  createNotification({
    title: "Approval required",
    message: `${title} requires approval before completion.`,
    type: "warning",
    targetRole: requestedRole,
  });
};

const syncSalesOrderPayments = (orderId) => {
  if (!orderId) {
    return null;
  }

  const orders = readRecords("SalesOrder");
  const orderIndex = orders.findIndex((order) => order.id === orderId);
  if (orderIndex === -1) {
    return null;
  }

  const relatedPayments = readRecords("Payment").filter(
    (payment) => payment.reference_type === "sales_order" && payment.reference_id === orderId
  );
  const collectedAmount = roundMoney(relatedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const totalAmount = roundMoney(orders[orderIndex].total_amount || 0);
  const balanceDue = roundMoney(Math.max(0, totalAmount - collectedAmount));
  const paymentStatus = collectedAmount <= 0 ? "unpaid" : balanceDue <= 0 ? "paid" : "partial";
  const nextStatus =
    orders[orderIndex].status === "cancelled"
      ? "cancelled"
      : paymentStatus === "paid"
        ? "completed"
        : orders[orderIndex].status === "draft"
          ? "draft"
          : "confirmed";

  orders[orderIndex] = updateTimestampedRecord(orders[orderIndex], {
    collected_amount: collectedAmount,
    balance_due: balanceDue,
    payment_status: paymentStatus,
    status: nextStatus,
  });
  writeRecords("SalesOrder", orders);
  return orders[orderIndex];
};

const syncSalePayments = (saleRecord) => {
  if (!saleRecord?.id) {
    return null;
  }

  const payments = readRecords("Payment");
  const relatedPayments = payments.filter(
    (payment) => payment.reference_type === "sale" && payment.reference_id === saleRecord.id
  );

  if (saleRecord.payment_status !== "paid") {
    if (relatedPayments.length > 0) {
      writeRecords(
        "Payment",
        payments.filter((payment) => !(payment.reference_type === "sale" && payment.reference_id === saleRecord.id))
      );
    }
    return null;
  }

  // Passing the existing document number stops an update from consuming a new number.
  const paymentPayload = normalizePayment({
    reference_type: "sale",
    reference_id: saleRecord.id,
    customer_name: saleRecord.customer_name,
    amount: saleRecord.total_amount,
    payment_date: saleRecord.sale_date || today(),
    method: relatedPayments[0]?.method || "cash",
    status: "received",
    document_number: relatedPayments[0]?.document_number,
  });

  let nextPayments;
  if (relatedPayments.length === 0) {
    nextPayments = [createTimestampedRecord(paymentPayload), ...payments];
  } else {
    const primaryPayment = relatedPayments[0];
    const updatedPayment = updateTimestampedRecord(primaryPayment, {
      ...paymentPayload,
      document_number: primaryPayment.document_number,
    });
    nextPayments = payments
      .filter((payment) => !(payment.reference_type === "sale" && payment.reference_id === saleRecord.id))
      .concat(updatedPayment);
  }

  writeRecords("Payment", nextPayments);
  return paymentPayload;
};

const adjustProductStock = (products, productId, delta) => {
  const index = products.findIndex((item) => item.id === productId);
  if (index === -1) {
    throw new Error("Product record not found");
  }
  const nextQuantity = Number(products[index].stock_quantity || 0) + Number(delta || 0);
  if (nextQuantity < 0) {
    throw new Error("Stock quantity cannot go below zero");
  }
  products[index] = updateProductInventoryValue(
    updateTimestampedRecord(products[index], {
      stock_quantity: nextQuantity,
    })
  );
  return products[index];
};

// Only links by id are removed. Matching on names would also delete records that belong to
// a different contact who happens to share the same name.
const removeContactRelations = (contact) => {
  const unlinked = (entityName, field) => {
    const records = readRecords(entityName);
    const kept = records.filter((record) => record[field] !== contact.id);
    if (kept.length !== records.length) {
      writeRecords(entityName, kept);
    }
  };
  unlinked("Deal", "contact_id");
  unlinked("Activity", "related_id");
  unlinked("Quote", "contact_id");
  unlinked("SalesOrder", "contact_id");
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const createEntityStore = (entityName) => ({
  async list(sortBy, limit) {
    return listEntityRecords(entityName, sortBy, limit);
  },
  async create(data) {
    const records = readRecords(entityName);
    const record = createTimestampedRecord(data);
    records.push(record);
    writeRecords(entityName, records);
    recordAudit({ action: "create", entityType: entityName, entityId: record.id, entityLabel: record.name || record.title || record.id });
    return clone(record);
  },
  async update(id, data) {
    const records = readRecords(entityName);
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) {
      throw new Error(`${entityName} record not found`);
    }
    records[index] = updateTimestampedRecord(records[index], data);
    writeRecords(entityName, records);
    recordAudit({ action: "update", entityType: entityName, entityId: id, entityLabel: records[index].name || records[index].title || id });
    return clone(records[index]);
  },
  async delete(id) {
    writeRecords(
      entityName,
      readRecords(entityName).filter((record) => record.id !== id)
    );
    recordAudit({ action: "delete", entityType: entityName, entityId: id, entityLabel: id });
    return { success: true };
  },
});

const entities = {
  Contact: createEntityStore("Contact"),
  Deal: createEntityStore("Deal"),
  RiskAssessment: createEntityStore("RiskAssessment"),
  OnboardingClient: createEntityStore("OnboardingClient"),
  Activity: createEntityStore("Activity"),
  Product: createEntityStore("Product"),
  Sale: createEntityStore("Sale"),
  Supplier: createEntityStore("Supplier"),
  PurchaseOrder: createEntityStore("PurchaseOrder"),
  Expense: createEntityStore("Expense"),
  AppUser: createEntityStore("AppUser"),
  Warehouse: createEntityStore("Warehouse"),
  StockAdjustment: createEntityStore("StockAdjustment"),
  Quote: createEntityStore("Quote"),
  SalesOrder: createEntityStore("SalesOrder"),
  Payment: createEntityStore("Payment"),
  ApprovalRequest: createEntityStore("ApprovalRequest"),
  AuditLog: createEntityStore("AuditLog"),
  Notification: createEntityStore("Notification"),
  Task: createEntityStore("Task"),
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Validates a backup snapshot and returns the records for every known entity.
// Unknown entity keys are ignored. Missing entities import as an empty list.
const parseBackupPayload = (snapshot) => {
  if (!isPlainObject(snapshot) || !isPlainObject(snapshot.payload)) {
    throw new Error('Invalid backup file: expected an object with a "payload" section.');
  }

  const result = {};
  ENTITY_NAMES.forEach((entityName) => {
    const value = snapshot.payload[entityName];
    if (value === undefined) {
      result[entityName] = [];
      return;
    }
    if (!Array.isArray(value)) {
      throw new Error(`Invalid backup file: "${entityName}" must be a list of records.`);
    }
    value.forEach((record, index) => {
      if (!isPlainObject(record) || typeof record.id !== "string" || !record.id) {
        throw new Error(`Invalid backup file: ${entityName} record #${index + 1} has no string "id".`);
      }
    });
    result[entityName] = clone(value);
  });

  const hasActiveAdmin = result.AppUser.some((user) => user.role === "admin" && user.status !== "inactive");
  if (!hasActiveAdmin) {
    throw new Error("Invalid backup file: it must include at least one active admin user.");
  }

  return result;
};

export const crmClient = {
  permissions: {
    can(permission) {
      return can(getCurrentUser(), permission);
    },
    rolePermissions: ROLE_PERMISSIONS,
  },
  auth: {
    async me() {
      await ensureOwnerUser();
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("auth_required");
      }
      const user = readRecords("AppUser").find((item) => item.id === userId);
      if (!user || user.status === "inactive") {
        setCurrentUserId(null);
        throw new Error("auth_required");
      }
      return clone(user);
    },
    async login(email, password) {
      await ensureOwnerUser();
      const users = readRecords("AppUser");
      const user = users.find((item) => item.email?.toLowerCase() === String(email || "").toLowerCase());
      if (!user || user.status === "inactive") {
        throw new Error("Invalid email or password");
      }
      if (!(await verifyPassword(password, user.password_hash))) {
        throw new Error("Invalid email or password");
      }
      setCurrentUserId(user.id);
      recordAuditBestEffort({
        action: "login",
        entityType: "AppUser",
        entityId: user.id,
        entityLabel: user.full_name,
        details: "User signed in to the workspace.",
      });
      return clone(user);
    },
    async logout() {
      // Record the audit entry before clearing the user id, so the actor is still resolved.
      // App lock state is intentionally left alone: signing out does not lock the workspace.
      const user = getCurrentUser();
      if (user) {
        recordAuditBestEffort({
          action: "logout",
          entityType: "AppUser",
          entityId: user.id,
          entityLabel: user.full_name,
          details: "User signed out of the workspace.",
        });
      }
      setCurrentUserId(null);
    },
  },
  entities,
  contacts: {
    async delete(id) {
      const contacts = readRecords("Contact");
      const contact = requireRecord(contacts, id, "Contact");
      writeRecords("Contact", contacts.filter((item) => item.id !== id));
      removeContactRelations(contact);
      recordAudit({ action: "delete", entityType: "Contact", entityId: id, entityLabel: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() });
      return { success: true };
    },
  },
  users: {
    async list(sortBy, limit) {
      return listEntityRecords("AppUser", sortBy || "full_name", limit);
    },
    async create(data) {
      const users = readRecords("AppUser");
      const email = String(data.email || "").toLowerCase();
      if (users.some((user) => user.email === email)) {
        throw new Error("A user with this email already exists");
      }
      const record = createTimestampedRecord({
        ...data,
        email,
        role: data.role || "user",
        ai_enabled: data.ai_enabled !== false,
        status: data.status || "active",
        password_hash: await hashPassword(data.password || "changeme123"),
      });
      users.push(record);
      writeRecords("AppUser", users);
      recordAudit({ action: "create", entityType: "AppUser", entityId: record.id, entityLabel: record.full_name });
      createNotification({
        title: "New team member added",
        message: `${record.full_name} can now access the workspace.`,
        type: "info",
        targetRole: "admin",
      });
      return clone(record);
    },
    async update(id, data) {
      const users = readRecords("AppUser");
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) {
        throw new Error("User record not found");
      }
      const currentUser = users[index];
      const patch = { ...data };
      if (patch.email) {
        patch.email = String(patch.email).toLowerCase();
        if (users.some((user) => user.id !== id && user.email === patch.email)) {
          throw new Error("A user with this email already exists");
        }
      }
      if (patch.password) {
        patch.password_hash = await hashPassword(patch.password);
        delete patch.password;
      }
      const nextUser = updateTimestampedRecord(currentUser, patch);
      const nextUsers = users.map((user) => (user.id === id ? nextUser : user));
      if (currentUser.role === "admin" && countActiveAdmins(nextUsers) === 0) {
        throw new Error("At least one active admin is required");
      }
      users[index] = nextUser;
      writeRecords("AppUser", users);
      recordAudit({ action: "update", entityType: "AppUser", entityId: id, entityLabel: users[index].full_name });
      return clone(users[index]);
    },
    async delete(id) {
      const currentUserId = getCurrentUserId();
      if (id === currentUserId) {
        throw new Error("You cannot delete the active user");
      }
      const users = readRecords("AppUser");
      const user = requireRecord(users, id, "AppUser");
      if (user.role === "admin" && countActiveAdmins(users) <= 1) {
        throw new Error("At least one active admin is required");
      }
      writeRecords("AppUser", users.filter((item) => item.id !== id));
      recordAudit({ action: "delete", entityType: "AppUser", entityId: id, entityLabel: user.full_name });
      return { success: true };
    },
  },
  warehouses: {
    async list(sortBy, limit) {
      return listEntityRecords("Warehouse", sortBy || "name", limit);
    },
    async create(data) {
      const warehouses = readRecords("Warehouse");
      const record = createTimestampedRecord(normalizeWarehouse(data));
      warehouses.push(record);
      writeRecords("Warehouse", warehouses);
      recordAudit({ action: "create", entityType: "Warehouse", entityId: record.id, entityLabel: record.name });
      return clone(record);
    },
    async update(id, data) {
      const warehouses = readRecords("Warehouse");
      const index = warehouses.findIndex((warehouse) => warehouse.id === id);
      if (index === -1) {
        throw new Error("Warehouse record not found");
      }
      warehouses[index] = updateTimestampedRecord(warehouses[index], normalizeWarehouse(data));
      writeRecords("Warehouse", warehouses);
      const products = readRecords("Product").map((product) =>
        product.warehouse_id === id
          ? updateTimestampedRecord(product, { warehouse_name: warehouses[index].name })
          : product
      );
      writeRecords("Product", products);
      recordAudit({ action: "update", entityType: "Warehouse", entityId: id, entityLabel: warehouses[index].name });
      return clone(warehouses[index]);
    },
    async delete(id) {
      const warehouses = readRecords("Warehouse");
      if (warehouses.length === 1) {
        throw new Error("At least one warehouse is required");
      }
      const assignedProducts = readRecords("Product").filter((product) => product.warehouse_id === id);
      if (assignedProducts.length > 0) {
        throw new Error("Move products out of this warehouse before deleting it");
      }
      const warehouse = requireRecord(warehouses, id, "Warehouse");
      writeRecords("Warehouse", warehouses.filter((item) => item.id !== id));
      recordAudit({ action: "delete", entityType: "Warehouse", entityId: id, entityLabel: warehouse.name });
      return { success: true };
    },
  },
  stockAdjustments: {
    async list(sortBy, limit) {
      return listEntityRecords("StockAdjustment", sortBy || "-adjustment_date", limit);
    },
    async create(data) {
      const products = readRecords("Product");
      const product = requireRecord(products, data.product_id, "Product");
      const quantity = Number(data.quantity || 0);
      if (quantity === 0) {
        throw new Error("Adjustment quantity cannot be zero");
      }
      adjustProductStock(products, product.id, quantity);
      writeRecords("Product", products);
      const adjustment = createTimestampedRecord({
        ...data,
        quantity,
        product_name: product.name,
        adjustment_date: data.adjustment_date || today(),
        warehouse_id: product.warehouse_id || "",
        warehouse_name: product.warehouse_name || "",
      });
      const adjustments = readRecords("StockAdjustment");
      adjustments.unshift(adjustment);
      writeRecords("StockAdjustment", adjustments);
      recordAudit({ action: "stock_adjustment", entityType: "Product", entityId: product.id, entityLabel: product.name, details: `Adjusted stock by ${quantity}.` });
      return clone(adjustment);
    },
  },
  products: {
    async list(sortBy, limit) {
      return listEntityRecords("Product", sortBy, limit);
    },
    async create(data) {
      const products = readRecords("Product");
      ensureUniqueProductSku(products, data.sku);
      const record = createTimestampedRecord(normalizeProduct(data));
      products.push(record);
      writeRecords("Product", products);
      recordAudit({ action: "create", entityType: "Product", entityId: record.id, entityLabel: record.name });
      return clone(record);
    },
    async update(id, data) {
      const products = readRecords("Product");
      const index = products.findIndex((product) => product.id === id);
      if (index === -1) {
        throw new Error("Product record not found");
      }
      ensureUniqueProductSku(products, data.sku ?? products[index].sku, id);
      const previous = products[index];
      const updated = updateProductInventoryValue(
        normalizeProduct(updateTimestampedRecord(previous, data))
      );
      products[index] = updated;
      writeRecords("Product", products);
      const stockDelta = Number(updated.stock_quantity) - Number(previous.stock_quantity || 0);
      if (stockDelta !== 0) {
        const adjustments = readRecords("StockAdjustment");
        adjustments.unshift(
          createTimestampedRecord({
            product_id: id,
            product_name: updated.name,
            quantity: stockDelta,
            reason: "Manual edit",
            adjustment_date: today(),
            warehouse_id: updated.warehouse_id || "",
            warehouse_name: updated.warehouse_name || "",
          })
        );
        writeRecords("StockAdjustment", adjustments);
      }
      writeRecords(
        "Sale",
        readRecords("Sale").map((sale) =>
          sale.product_id === id
            ? updateTimestampedRecord(sale, { product_name: updated.name, warehouse_id: updated.warehouse_id, warehouse_name: updated.warehouse_name })
            : sale
        )
      );
      writeRecords(
        "PurchaseOrder",
        readRecords("PurchaseOrder").map((order) =>
          order.product_id === id
            ? updateTimestampedRecord(order, { product_name: updated.name, warehouse_id: updated.warehouse_id, warehouse_name: updated.warehouse_name })
            : order
        )
      );
      recordAudit({ action: "update", entityType: "Product", entityId: id, entityLabel: updated.name });
      return clone(updated);
    },
    async delete(id) {
      const product = requireRecord(readRecords("Product"), id, "Product");
      // Sales and purchase orders are financial history. Check before any write so nothing is removed on refusal.
      const hasHistory =
        readRecords("Sale").some((sale) => sale.product_id === id) ||
        readRecords("PurchaseOrder").some((order) => order.product_id === id);
      if (hasHistory) {
        throw new Error("This product has sales or purchase history. Mark it as discontinued/inactive instead.");
      }
      writeRecords("Product", readRecords("Product").filter((item) => item.id !== id));
      writeRecords("StockAdjustment", readRecords("StockAdjustment").filter((adjustment) => adjustment.product_id !== id));
      recordAudit({ action: "delete", entityType: "Product", entityId: id, entityLabel: product.name });
      return { success: true };
    },
  },
  sales: {
    async list(sortBy, limit) {
      return listEntityRecords("Sale", sortBy, limit);
    },
    async create(data) {
      const products = readRecords("Product");
      const product = requireRecord(products, data.product_id, "Product");
      const payload = createSalePayload(data, product);
      const sale = createTimestampedRecord(payload);
      adjustProductStock(products, product.id, -sale.quantity);
      writeRecords("Product", products);
      const sales = readRecords("Sale");
      sales.unshift(sale);
      writeRecords("Sale", sales);
      syncSalePayments(sale);
      recordAudit({ action: "create", entityType: "Sale", entityId: sale.id, entityLabel: sale.product_name });
      return clone(sale);
    },
    async update(id, data) {
      const sales = readRecords("Sale");
      const saleIndex = sales.findIndex((item) => item.id === id);
      if (saleIndex === -1) {
        throw new Error("Sale record not found");
      }
      const previousSale = sales[saleIndex];
      // Work on a copy: every check runs against it, so a thrown error leaves the stored products untouched.
      const products = clone(readRecords("Product"));
      adjustProductStock(products, previousSale.product_id, previousSale.quantity);
      const nextProduct = requireRecord(products, data.product_id || previousSale.product_id, "Product");
      const payload = createSalePayload({ ...previousSale, ...data, product_id: nextProduct.id }, nextProduct);
      adjustProductStock(products, nextProduct.id, -payload.quantity);
      writeRecords("Product", products);
      sales[saleIndex] = updateTimestampedRecord(previousSale, payload);
      writeRecords("Sale", sales);
      syncSalePayments(sales[saleIndex]);
      recordAudit({ action: "update", entityType: "Sale", entityId: id, entityLabel: sales[saleIndex].product_name });
      return clone(sales[saleIndex]);
    },
    async delete(id) {
      const sales = readRecords("Sale");
      const sale = requireRecord(sales, id, "Sale");
      writeRecords("Sale", sales.filter((item) => item.id !== id));
      const products = readRecords("Product");
      adjustProductStock(products, sale.product_id, sale.quantity);
      writeRecords("Product", products);
      writeRecords("Payment", readRecords("Payment").filter((payment) => !(payment.reference_type === "sale" && payment.reference_id === id)));
      recordAudit({ action: "delete", entityType: "Sale", entityId: id, entityLabel: sale.product_name });
      return { success: true };
    },
  },
  suppliers: {
    async list(sortBy, limit) {
      return listEntityRecords("Supplier", sortBy, limit);
    },
    async create(data) {
      const suppliers = readRecords("Supplier");
      const record = createTimestampedRecord(normalizeSupplier(data));
      suppliers.push(record);
      writeRecords("Supplier", suppliers);
      recordAudit({ action: "create", entityType: "Supplier", entityId: record.id, entityLabel: record.name });
      return clone(record);
    },
    async update(id, data) {
      const suppliers = readRecords("Supplier");
      const index = suppliers.findIndex((supplier) => supplier.id === id);
      if (index === -1) {
        throw new Error("Supplier record not found");
      }
      suppliers[index] = updateTimestampedRecord(suppliers[index], normalizeSupplier(data));
      writeRecords("Supplier", suppliers);
      writeRecords(
        "PurchaseOrder",
        readRecords("PurchaseOrder").map((order) =>
          order.supplier_id === id ? updateTimestampedRecord(order, { supplier_name: suppliers[index].name }) : order
        )
      );
      recordAudit({ action: "update", entityType: "Supplier", entityId: id, entityLabel: suppliers[index].name });
      return clone(suppliers[index]);
    },
    async delete(id) {
      const supplier = requireRecord(readRecords("Supplier"), id, "Supplier");
      if (readRecords("PurchaseOrder").some((order) => order.supplier_id === id)) {
        throw new Error("This supplier has purchase order history. Mark it as inactive instead.");
      }
      writeRecords("Supplier", readRecords("Supplier").filter((item) => item.id !== id));
      recordAudit({ action: "delete", entityType: "Supplier", entityId: id, entityLabel: supplier.name });
      return { success: true };
    },
  },
  purchases: {
    async list(sortBy, limit) {
      return listEntityRecords("PurchaseOrder", sortBy, limit);
    },
    async create(data) {
      const supplier = requireRecord(readRecords("Supplier"), data.supplier_id, "Supplier");
      const products = readRecords("Product");
      const product = requireRecord(products, data.product_id, "Product");
      const payload = createPurchasePayload(data, supplier, product);
      const approvalStatus = initialApprovalStatus(payload.total_amount, readBusinessProfile().purchaseApprovalThreshold);
      const stockApplied = payload.status === "received" && isApprovedStatus(approvalStatus);
      // Record first, so the approval request can point at its real id.
      const purchaseOrder = createTimestampedRecord({ ...payload, approval_status: approvalStatus, stock_applied: stockApplied });
      if (stockApplied) {
        adjustProductStock(products, payload.product_id, payload.quantity);
        writeRecords("Product", products);
      }
      const purchaseOrders = readRecords("PurchaseOrder");
      purchaseOrders.unshift(purchaseOrder);
      writeRecords("PurchaseOrder", purchaseOrders);
      if (approvalStatus === "pending") {
        createApprovalRequest({
          entityType: "PurchaseOrder",
          entityId: purchaseOrder.id,
          title: `Purchase order for ${payload.product_name}`,
          amount: payload.total_amount,
          threshold: readBusinessProfile().purchaseApprovalThreshold,
        });
      }
      recordAudit({ action: "create", entityType: "PurchaseOrder", entityId: purchaseOrder.id, entityLabel: purchaseOrder.product_name });
      return clone(purchaseOrder);
    },
    async update(id, data) {
      const purchaseOrders = readRecords("PurchaseOrder");
      const index = purchaseOrders.findIndex((order) => order.id === id);
      if (index === -1) {
        throw new Error("Purchase order record not found");
      }
      const previousOrder = purchaseOrders[index];
      const suppliers = readRecords("Supplier");
      const products = readRecords("Product");
      // Approval state is owned by approvals.decide, so a patch cannot change it.
      const supplier = requireRecord(suppliers, data.supplier_id || previousOrder.supplier_id, "Supplier");
      const product = requireRecord(products, data.product_id || previousOrder.product_id, "Product");
      const merged = { ...previousOrder, ...data, approval_status: previousOrder.approval_status };
      const payload = createPurchasePayload(merged, supplier, product);
      const wasApplied = purchaseStockApplied(previousOrder);
      const isApplied = payload.status === "received" && isApprovedStatus(payload.approval_status);

      // All checks have run; now apply the stock change to a copy and only then store it.
      const nextProducts = clone(products);
      if (wasApplied) {
        adjustProductStock(nextProducts, previousOrder.product_id, -Number(previousOrder.quantity || 0));
      }
      if (isApplied) {
        adjustProductStock(nextProducts, payload.product_id, payload.quantity);
      }
      writeRecords("Product", nextProducts);
      purchaseOrders[index] = updateTimestampedRecord(previousOrder, { ...payload, stock_applied: isApplied });
      writeRecords("PurchaseOrder", purchaseOrders);
      recordAudit({ action: "update", entityType: "PurchaseOrder", entityId: id, entityLabel: purchaseOrders[index].product_name });
      return clone(purchaseOrders[index]);
    },
    async delete(id) {
      const purchaseOrders = readRecords("PurchaseOrder");
      const purchaseOrder = requireRecord(purchaseOrders, id, "PurchaseOrder");
      if (purchaseStockApplied(purchaseOrder)) {
        const products = readRecords("Product");
        adjustProductStock(products, purchaseOrder.product_id, -Number(purchaseOrder.quantity || 0));
        writeRecords("Product", products);
      }
      writeRecords("PurchaseOrder", purchaseOrders.filter((order) => order.id !== id));
      recordAudit({ action: "delete", entityType: "PurchaseOrder", entityId: id, entityLabel: purchaseOrder.product_name });
      return { success: true };
    },
  },
  expenses: {
    async list(sortBy, limit) {
      return listEntityRecords("Expense", sortBy, limit);
    },
    async create(data) {
      const expense = normalizeExpense(data);
      const threshold = readBusinessProfile().expenseApprovalThreshold;
      const approvalStatus = initialApprovalStatus(expense.amount, threshold);
      // Record first, so the approval request can point at its real id.
      const record = createTimestampedRecord({ ...expense, approval_status: approvalStatus });
      const expenses = readRecords("Expense");
      expenses.unshift(record);
      writeRecords("Expense", expenses);
      if (approvalStatus === "pending") {
        createApprovalRequest({
          entityType: "Expense",
          entityId: record.id,
          title: record.title || "Expense entry",
          amount: record.amount,
          threshold,
        });
      }
      recordAudit({ action: "create", entityType: "Expense", entityId: record.id, entityLabel: record.title });
      return clone(record);
    },
    async update(id, data) {
      const expenses = readRecords("Expense");
      const index = expenses.findIndex((expense) => expense.id === id);
      if (index === -1) {
        throw new Error("Expense record not found");
      }
      expenses[index] = updateTimestampedRecord(expenses[index], normalizeExpense(data));
      writeRecords("Expense", expenses);
      recordAudit({ action: "update", entityType: "Expense", entityId: id, entityLabel: expenses[index].title });
      return clone(expenses[index]);
    },
    async delete(id) {
      const expense = requireRecord(readRecords("Expense"), id, "Expense");
      writeRecords("Expense", readRecords("Expense").filter((item) => item.id !== id));
      recordAudit({ action: "delete", entityType: "Expense", entityId: id, entityLabel: expense.title });
      return { success: true };
    },
  },
  quotes: {
    async list(sortBy, limit) {
      return listEntityRecords("Quote", sortBy || "-quote_date", limit);
    },
    async create(data) {
      const quotes = readRecords("Quote");
      const payload = normalizeQuote(data);
      const threshold = readBusinessProfile().quoteApprovalThreshold;
      const approvalStatus = initialApprovalStatus(payload.total_amount, threshold);
      // Record first, so the approval request can point at its real id.
      const record = createTimestampedRecord({ ...payload, approval_status: approvalStatus });
      quotes.unshift(record);
      writeRecords("Quote", quotes);
      if (approvalStatus === "pending") {
        createApprovalRequest({
          entityType: "Quote",
          entityId: record.id,
          title: payload.title || payload.customer_name || "Quote",
          amount: payload.total_amount,
          threshold,
        });
      }
      recordAudit({ action: "create", entityType: "Quote", entityId: record.id, entityLabel: record.document_number });
      return clone(record);
    },
    async update(id, data) {
      const quotes = readRecords("Quote");
      const index = quotes.findIndex((quote) => quote.id === id);
      if (index === -1) {
        throw new Error("Quote record not found");
      }
      quotes[index] = updateTimestampedRecord(quotes[index], normalizeQuote(withRecomputedTotals(quotes[index], data)));
      writeRecords("Quote", quotes);
      recordAudit({ action: "update", entityType: "Quote", entityId: id, entityLabel: quotes[index].document_number });
      return clone(quotes[index]);
    },
    async delete(id) {
      const quote = requireRecord(readRecords("Quote"), id, "Quote");
      writeRecords("Quote", readRecords("Quote").filter((item) => item.id !== id));
      recordAudit({ action: "delete", entityType: "Quote", entityId: id, entityLabel: quote.document_number });
      return { success: true };
    },
    async convertToOrder(id) {
      const quote = requireRecord(readRecords("Quote"), id, "Quote");
      const salesOrders = readRecords("SalesOrder");
      const alreadyConverted =
        quote.status === "accepted" ||
        quote.status === "converted" ||
        salesOrders.some((item) => item.quote_id === id);
      if (alreadyConverted) {
        throw new Error("This quote has already been converted to an order");
      }
      if (quote.approval_status === "pending" || quote.approval_status === "rejected") {
        throw new Error("This quote cannot be converted until it is approved");
      }
      const order = createTimestampedRecord(
        normalizeSalesOrder({
          title: quote.title,
          contact_id: quote.contact_id,
          customer_name: quote.customer_name,
          quote_id: quote.id,
          subtotal: quote.subtotal,
          tax_rate: quote.tax_rate,
          tax_amount: quote.tax_amount,
          discount_amount: quote.discount_amount,
          total_amount: quote.total_amount,
          notes: quote.notes,
          status: "confirmed",
        })
      );
      salesOrders.unshift(order);
      writeRecords("SalesOrder", salesOrders);
      writeRecords(
        "Quote",
        readRecords("Quote").map((item) =>
          item.id === id ? updateTimestampedRecord(item, { status: "accepted" }) : item
        )
      );
      recordAudit({ action: "convert", entityType: "Quote", entityId: id, entityLabel: quote.document_number, details: `Converted to sales order ${order.document_number}.` });
      createNotification({
        title: "Quote converted",
        message: `${quote.document_number} was converted to ${order.document_number}.`,
        type: "success",
      });
      return clone(order);
    },
  },
  salesOrders: {
    async list(sortBy, limit) {
      return listEntityRecords("SalesOrder", sortBy || "-order_date", limit);
    },
    async create(data) {
      const orders = readRecords("SalesOrder");
      const record = createTimestampedRecord(normalizeSalesOrder(data));
      orders.unshift(record);
      writeRecords("SalesOrder", orders);
      syncSalesOrderPayments(record.id);
      recordAudit({ action: "create", entityType: "SalesOrder", entityId: record.id, entityLabel: record.document_number });
      return clone(requireRecord(readRecords("SalesOrder"), record.id, "SalesOrder"));
    },
    async update(id, data) {
      const orders = readRecords("SalesOrder");
      const index = orders.findIndex((order) => order.id === id);
      if (index === -1) {
        throw new Error("Sales order record not found");
      }
      orders[index] = updateTimestampedRecord(orders[index], normalizeSalesOrder(withRecomputedTotals(orders[index], data)));
      writeRecords("SalesOrder", orders);
      syncSalesOrderPayments(id);
      recordAudit({ action: "update", entityType: "SalesOrder", entityId: id, entityLabel: orders[index].document_number });
      return clone(requireRecord(readRecords("SalesOrder"), id, "SalesOrder"));
    },
    async delete(id) {
      const order = requireRecord(readRecords("SalesOrder"), id, "SalesOrder");
      writeRecords("SalesOrder", readRecords("SalesOrder").filter((item) => item.id !== id));
      writeRecords("Payment", readRecords("Payment").filter((payment) => !(payment.reference_type === "sales_order" && payment.reference_id === id)));
      recordAudit({ action: "delete", entityType: "SalesOrder", entityId: id, entityLabel: order.document_number });
      return { success: true };
    },
  },
  payments: {
    async list(sortBy, limit) {
      return listEntityRecords("Payment", sortBy || "-payment_date", limit);
    },
    async create(data) {
      const payments = readRecords("Payment");
      const record = createTimestampedRecord(normalizePayment(data));
      payments.unshift(record);
      writeRecords("Payment", payments);
      if (record.reference_type === "sales_order") {
        syncSalesOrderPayments(record.reference_id);
      }
      recordAudit({ action: "create", entityType: "Payment", entityId: record.id, entityLabel: record.document_number });
      return clone(record);
    },
    async update(id, data) {
      const payments = readRecords("Payment");
      const index = payments.findIndex((payment) => payment.id === id);
      if (index === -1) {
        throw new Error("Payment record not found");
      }
      const previous = payments[index];
      const next = updateTimestampedRecord(previous, normalizePayment({ ...previous, ...data }));
      payments[index] = next;
      writeRecords("Payment", payments);
      // Resync both the order the payment came from and the one it now belongs to.
      const linked = [previous, next].filter((payment) => payment.reference_id);
      new Set(linked.filter((payment) => payment.reference_type === "sales_order").map((payment) => payment.reference_id))
        .forEach((orderId) => syncSalesOrderPayments(orderId));
      // Sale payments are derived from their sale, so re-derive them from the sale they point at.
      const sales = readRecords("Sale");
      new Set(linked.filter((payment) => payment.reference_type === "sale").map((payment) => payment.reference_id))
        .forEach((saleId) => {
          const sale = sales.find((item) => item.id === saleId);
          if (sale) {
            syncSalePayments(sale);
          }
        });
      recordAudit({ action: "update", entityType: "Payment", entityId: id, entityLabel: payments[index].document_number });
      return clone(payments[index]);
    },
    async delete(id) {
      const payment = requireRecord(readRecords("Payment"), id, "Payment");
      writeRecords("Payment", readRecords("Payment").filter((item) => item.id !== id));
      if (payment.reference_type === "sales_order") {
        syncSalesOrderPayments(payment.reference_id);
      }
      recordAudit({ action: "delete", entityType: "Payment", entityId: id, entityLabel: payment.document_number });
      return { success: true };
    },
  },
  approvals: {
    async list(sortBy, limit) {
      return listEntityRecords("ApprovalRequest", sortBy || "-created_date", limit);
    },
    async decide(id, decision, note = "") {
      if (decision !== "approved" && decision !== "rejected") {
        throw new Error('Approval decision must be "approved" or "rejected"');
      }
      const requests = readRecords("ApprovalRequest");
      const index = requests.findIndex((request) => request.id === id);
      if (index === -1) {
        throw new Error("Approval request not found");
      }
      const actor = getCurrentUser();
      const request = updateTimestampedRecord(requests[index], {
        status: decision,
        decision_note: note,
        decided_by_id: actor?.id || "",
        decided_by_name: actor?.full_name || "System",
      });
      // Work out every change first, so a refused stock change leaves the request pending.
      const targetRecords = readRecords(request.entity_type);
      const targetIndex = targetRecords.findIndex((item) => item.id === request.entity_id);
      let nextProducts = null;
      let nextTarget = null;
      if (targetIndex >= 0) {
        const target = targetRecords[targetIndex];
        nextTarget = updateTimestampedRecord(target, { approval_status: decision });
        if (request.entity_type === "PurchaseOrder") {
          // Stock follows the order: held only while it is received and approved.
          const shouldApply = decision === "approved" && target.status === "received";
          const wasApplied = purchaseStockApplied(target);
          nextTarget.stock_applied = shouldApply;
          if (shouldApply !== wasApplied) {
            nextProducts = clone(readRecords("Product"));
            const quantity = Number(target.quantity || 0);
            adjustProductStock(nextProducts, target.product_id, shouldApply ? quantity : -quantity);
          }
        }
      }
      if (nextProducts) {
        writeRecords("Product", nextProducts);
      }
      if (nextTarget) {
        targetRecords[targetIndex] = nextTarget;
        writeRecords(request.entity_type, targetRecords);
      }
      requests[index] = request;
      writeRecords("ApprovalRequest", requests);
      recordAudit({
        action: `approval_${decision}`,
        entityType: request.entity_type,
        entityId: request.entity_id,
        entityLabel: request.title,
        details: note,
      });
      createNotification({
        title: decision === "approved" ? "Request approved" : "Request rejected",
        message: `${request.title} was ${decision}.`,
        type: decision === "approved" ? "success" : "error",
      });
      return clone(requests[index]);
    },
  },
  notifications: {
    async list(sortBy, limit) {
      const user = getCurrentUser();
      const notifications = listEntityRecords("Notification", sortBy || "-created_date", limit);
      return notifications.filter((notification) => {
        if (notification.target_user_id) {
          return notification.target_user_id === user?.id;
        }
        if (!notification.target_role || notification.target_role === "all") {
          return true;
        }
        return notification.target_role === user?.role;
      });
    },
    async markRead(id) {
      const notifications = readRecords("Notification");
      const index = notifications.findIndex((notification) => notification.id === id);
      if (index === -1) {
        throw new Error("Notification not found");
      }
      notifications[index] = updateTimestampedRecord(notifications[index], { read: true });
      writeRecords("Notification", notifications);
      return clone(notifications[index]);
    },
  },
  audit: {
    async list(sortBy, limit) {
      return listEntityRecords("AuditLog", sortBy || "-created_date", limit);
    },
  },
  tasks: {
    async list(sortBy, limit) {
      return listEntityRecords("Task", sortBy || "-due_date", limit);
    },
    async create(data) {
      const tasks = readRecords("Task");
      const record = createTimestampedRecord({
        ...data,
        status: data.status || "open",
        priority: data.priority || "medium",
        due_date: data.due_date || today(),
      });
      tasks.unshift(record);
      writeRecords("Task", tasks);
      recordAudit({ action: "create", entityType: "Task", entityId: record.id, entityLabel: record.title });
      return clone(record);
    },
    async update(id, data) {
      const tasks = readRecords("Task");
      const index = tasks.findIndex((task) => task.id === id);
      if (index === -1) {
        throw new Error("Task record not found");
      }
      tasks[index] = updateTimestampedRecord(tasks[index], data);
      writeRecords("Task", tasks);
      recordAudit({ action: "update", entityType: "Task", entityId: id, entityLabel: tasks[index].title });
      return clone(tasks[index]);
    },
    async delete(id) {
      const task = requireRecord(readRecords("Task"), id, "Task");
      writeRecords("Task", readRecords("Task").filter((item) => item.id !== id));
      recordAudit({ action: "delete", entityType: "Task", entityId: id, entityLabel: task.title });
      return { success: true };
    },
  },
  backups: {
    async exportAll() {
      const payload = Object.fromEntries(ENTITY_NAMES.map((entityName) => [entityName, readRecords(entityName)]));
      if (corruptEntities.size > 0) {
        // An export would contain empty lists for these entities and could later overwrite real data on import.
        throw new Error(`Cannot export: stored data for ${[...corruptEntities].join(", ")} could not be decoded.`);
      }
      // Profile secrets that are never needed to restore a workspace are left out of the backup:
      // the app lock and AI chat password hashes, and any leftover plaintext passwords.
      // AI API keys are still exported (existing behaviour, so a restored profile keeps working),
      // so treat backup files as secrets. AppUser records keep their password hashes so imported
      // accounts can still sign in.
      const exportableProfile = readBusinessProfile();
      [
        "appPasswordHash",
        "aiGeneralPasswordHash",
        "appPassword",
        "aiGeneralPassword",
        "adminPassword",
        "ownerPassword",
      ].forEach((key) => {
        delete exportableProfile[key];
      });
      return {
        profile: exportableProfile,
        exported_at: nowIso(),
        version: 1,
        payload,
      };
    },
    // NOTE: the name is kept for compatibility, but browser storage cannot be securely erased.
    // Overwriting values only replaces what the browser's storage layer currently exposes; it does
    // not guarantee the previous bytes are gone from disk, flash, or browser caches. This removes
    // the app's keys so the data is no longer readable by the app.
    async secureErase({ passes = 3 } = {}) {
      const count = Math.max(1, Number(passes || 1));
      const businessProfile = readBusinessProfile();

      for (let pass = 0; pass < count; pass += 1) {
        ENTITY_NAMES.forEach((entityName) => {
          const phantomRows = Array.from({ length: 12 }, (_, index) => ({
            id: `erase-${pass}-${entityName}-${index}-${randomString(12)}`,
            phantom: true,
            entity: entityName,
            created_date: nowIso(),
            updated_date: nowIso(),
            noise: randomString(96),
          }));
          window.localStorage.setItem(
            storageKey(entityName),
            serializeStoredValue(phantomRows, businessProfile)
          );
        });
      }

      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith(STORAGE_PREFIX)) {
          window.localStorage.removeItem(key);
        }
      });
      window.sessionStorage.removeItem(CURRENT_USER_KEY);
      window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
      corruptEntities.clear();
      verifiedRaw.clear();
      return { success: true };
    },
    async importAll(snapshot) {
      // Validate everything before touching storage.
      const records = parseBackupPayload(snapshot);
      // Keep the current data (raw) so a bad import can be recovered by hand.
      backupRawValues();
      ENTITY_NAMES.forEach((entityName) => {
        writeRecords(entityName, records[entityName], { overwriteCorrupt: true });
      });
      recordAudit({
        action: "import",
        entityType: "Backup",
        entityId: "workspace",
        entityLabel: "Workspace backup",
        details: "Imported data snapshot into the workspace.",
      });
      return { success: true };
    },
    async clearOperationalData() {
      [
        "Contact",
        "Deal",
        "RiskAssessment",
        "OnboardingClient",
        "Activity",
        "Product",
        "Sale",
        "Supplier",
        "PurchaseOrder",
        "Expense",
        "Warehouse",
        "StockAdjustment",
        "Quote",
        "SalesOrder",
        "Payment",
        "ApprovalRequest",
        "AuditLog",
        "Notification",
        "Task",
      ].forEach((entityName) => writeRecords(entityName, [], { overwriteCorrupt: true }));
      ensureDefaultWarehouse();
      await ensureOwnerUser();
      recordAudit({
        action: "clear_data",
        entityType: "Workspace",
        entityId: "workspace",
        entityLabel: "Operational data",
        details: "Cleared workspace records while preserving profile settings.",
      });
      return { success: true };
    },
  },
  files: {
    async upload(file) {
      const fileUrl = await fileToDataUrl(file);
      return { fileUrl };
    },
  },
};

// Payments for paid Sales used to be saved with an empty reference_id (normalizePayment dropped it),
// so syncSalePayments could not find them and created duplicates. This links the orphaned payments
// to their sale when the match is unambiguous and removes duplicate sale payments (keeping the earliest).
const SALE_PAYMENT_MIGRATION_KEY = `${STORAGE_PREFIX}:migration:sale_payments:v1`;

const migrateSalePayments = () => {
  if (!isBrowser || window.localStorage.getItem(SALE_PAYMENT_MIGRATION_KEY) === "done") {
    return;
  }

  const sales = readRecords("Sale");
  const payments = readRecords("Payment");
  if (corruptEntities.has("Sale") || corruptEntities.has("Payment")) {
    return; // Never rewrite undecodable data; retry on the next start.
  }

  const normalizeDate = (value) => String(value || "").slice(0, 10);
  const sameMoney = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.005;
  const sameText = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

  // 1. Link orphaned sale payments, only when both the payment and the sale match exactly one counterpart.
  const matchedSaleId = new Map(); // payment record -> sale id
  const paymentsBySale = new Map(); // sale id -> payment records
  payments
    .filter((payment) => payment.reference_type === "sale" && !payment.reference_id)
    .forEach((payment) => {
      const candidates = sales.filter(
        (sale) =>
          sameMoney(sale.total_amount, payment.amount) &&
          sameText(sale.customer_name, payment.customer_name) &&
          normalizeDate(sale.sale_date) === normalizeDate(payment.payment_date)
      );
      if (candidates.length !== 1) {
        return;
      }
      const saleId = candidates[0].id;
      matchedSaleId.set(payment, saleId);
      paymentsBySale.set(saleId, [...(paymentsBySale.get(saleId) || []), payment]);
    });

  // A sale claimed by several orphaned payments is ambiguous, so none of them are linked.
  matchedSaleId.forEach((saleId, payment) => {
    if (paymentsBySale.get(saleId).length > 1) {
      matchedSaleId.delete(payment);
    }
  });

  const linked = payments.map((payment) =>
    matchedSaleId.has(payment)
      ? updateTimestampedRecord(payment, { reference_id: matchedSaleId.get(payment) })
      : payment
  );

  // 2. Remove duplicate sale payments that share a sale id, keeping the earliest created one.
  const keepers = new Map(); // sale id -> record to keep
  const duplicates = new Set();
  linked.forEach((payment) => {
    if (payment.reference_type !== "sale" || !payment.reference_id) {
      return;
    }
    const current = keepers.get(payment.reference_id);
    if (!current) {
      keepers.set(payment.reference_id, payment);
      return;
    }
    const isEarlier = String(payment.created_date || "") < String(current.created_date || "");
    duplicates.add(isEarlier ? current : payment);
    if (isEarlier) {
      keepers.set(payment.reference_id, payment);
    }
  });

  const next = linked.filter((payment) => !duplicates.has(payment));
  if (matchedSaleId.size > 0 || duplicates.size > 0) {
    writeRecords("Payment", next);
  }
  window.localStorage.setItem(SALE_PAYMENT_MIGRATION_KEY, "done");
};

export const initializeCrmData = async () => {
  await migrateLegacyProfileSecrets();
  ensureSeedData();
  ensureDefaultWarehouse();
  await migrateLegacyDemoData();
  migrateSalePayments();
};

export { defaultBusinessProfile, migrateStorageEncryption };
