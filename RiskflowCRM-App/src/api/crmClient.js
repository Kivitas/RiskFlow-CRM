import CryptoJS from "crypto-js";

const STORAGE_PREFIX = "riskflow_crm";
const BUSINESS_PROFILE_KEY = `${STORAGE_PREFIX}:business_profile:v1`;
const SESSION_UNLOCK_KEY = `${STORAGE_PREFIX}:session_unlocked`;
const CURRENT_USER_KEY = `${STORAGE_PREFIX}:current_user_id`;
const MIGRATION_FLAG_KEY = `${STORAGE_PREFIX}:migration:v4`;

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

const readRecords = (entityName) => {
  if (!isBrowser) {
    return clone(initialData[entityName] || []);
  }

  ensureSeedData();
  const raw = window.localStorage.getItem(storageKey(entityName));
  return raw ? parseStoredValue(raw, initialData[entityName] || []) : [];
};

const writeRecords = (entityName, records) => {
  if (!isBrowser) {
    return;
  }
  window.localStorage.setItem(storageKey(entityName), serializeStoredValue(records));
};

const readBusinessProfile = () => {
  if (!isBrowser) {
    return clone(defaultBusinessProfile);
  }

  const raw = window.localStorage.getItem(BUSINESS_PROFILE_KEY);
  if (!raw) {
    return clone(defaultBusinessProfile);
  }

  try {
    const parsed = JSON.parse(raw);
    const encryptionKey = parsed.encryptionKey || parsed.workspaceEncryptionKey || "legacy-local-key";
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

const getEncryptionSecret = (profile = readBusinessProfile()) =>
  profile.encryptionKey || "legacy-local-key";

const serializeStoredValue = (value, profile = readBusinessProfile()) => {
  const json = JSON.stringify(value);
  if (!profile.enableLocalEncryption) {
    return json;
  }
  const encrypted = CryptoJS.AES.encrypt(json, getEncryptionSecret(profile)).toString();
  return `enc::${encrypted}`;
};

const parseStoredValue = (raw, fallback = []) => {
  if (!raw) {
    return clone(fallback);
  }

  try {
    if (!String(raw).startsWith("enc::")) {
      return JSON.parse(raw);
    }
    const bytes = CryptoJS.AES.decrypt(String(raw).slice(5), getEncryptionSecret());
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      return clone(fallback);
    }
    return JSON.parse(decrypted);
  } catch {
    return clone(fallback);
  }
};

const migrateStorageEncryption = (previousProfile, nextProfile) => {
  if (!isBrowser) {
    return;
  }
  ENTITY_NAMES.forEach((entityName) => {
    const key = storageKey(entityName);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return;
    }

    let records = [];
    try {
      if (String(raw).startsWith("enc::")) {
        const bytes = CryptoJS.AES.decrypt(String(raw).slice(5), getEncryptionSecret(previousProfile));
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        records = decrypted ? JSON.parse(decrypted) : [];
      } else {
        records = JSON.parse(raw);
      }
    } catch {
      records = [];
    }

    const nextRaw = nextProfile.enableLocalEncryption
      ? `enc::${CryptoJS.AES.encrypt(JSON.stringify(records), getEncryptionSecret(nextProfile)).toString()}`
      : JSON.stringify(records);
    window.localStorage.setItem(key, nextRaw);
  });
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

const nextDocumentNumber = (prefix, entityName) => {
  const records = readRecords(entityName);
  const existing = records
    .map((record) => Number(String(record.document_number || "").replace(/\D+/g, "")))
    .filter((value) => Number.isFinite(value));
  const next = (existing.length ? Math.max(...existing) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
};

const ensureOwnerUser = async () => {
  const users = readRecords("AppUser");
  const profile = readBusinessProfile();
  const ownerEmail = profile.adminEmail || profile.companyEmail || "";
  const ownerPassword = profile.adminPassword || "";
  const fullName = profile.adminName || "Admin";

  if (!profile.companyName || !ownerEmail || !ownerPassword) {
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
      return updatedBootstrapUser;
    }

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
  return owner;
};

const ensureDefaultWarehouse = () => {
  const warehouses = readRecords("Warehouse");
  if (warehouses.length > 0) {
    return warehouses[0];
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
    const records = readRecords(entityName).filter((record) => !isLegacyDemoRecord(entityName, record));
    writeRecords(entityName, records);
  });

  ensureDefaultWarehouse();
  await ensureOwnerUser();

  window.localStorage.setItem(MIGRATION_FLAG_KEY, "done");
};

async function hashPassword(password) {
  const input = String(password || "");
  if (!isBrowser || !window.crypto?.subtle) {
    return `plain:${input}`;
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

async function verifyPassword(password, storedHash) {
  if (!storedHash) {
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
      return `plain:${input}`;
    }
    const data = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  })();
  return legacyHash === storedHash;
}

const normalizeProduct = (data) => {
  const warehouse = readRecords("Warehouse").find((item) => item.id === data.warehouse_id) || ensureDefaultWarehouse();
  const stock = Number(data.stock_quantity || 0);
  const reorderLevel = Number(data.reorder_level || 0);
  const unitPrice = Number(data.unit_price || 0);
  const costPrice = Number(data.cost_price || 0);
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
    inventory_value: stock * costPrice,
  };
};

const updateProductInventoryValue = (product) => ({
  ...product,
  inventory_value: Number(product.stock_quantity || 0) * Number(product.cost_price || 0),
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

const normalizeQuote = (data) => {
  const profile = readBusinessProfile();
  const subtotal = Number(data.subtotal || 0);
  const taxRate = Number(data.tax_rate ?? profile.taxRate ?? 0);
  const taxAmount = Number(data.tax_amount ?? (subtotal * taxRate) / 100);
  const discountAmount = Number(data.discount_amount || 0);
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
    total_amount: Number(data.total_amount ?? subtotal + taxAmount - discountAmount),
    approval_status: data.approval_status || "not_required",
  };
};

const normalizeSalesOrder = (data) => {
  const profile = readBusinessProfile();
  const subtotal = Number(data.subtotal || 0);
  const taxRate = Number(data.tax_rate ?? profile.taxRate ?? 0);
  const taxAmount = Number(data.tax_amount ?? (subtotal * taxRate) / 100);
  const discountAmount = Number(data.discount_amount || 0);
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
    total_amount: Number(data.total_amount ?? subtotal + taxAmount - discountAmount),
  };
};

const normalizePayment = (data) => {
  const profile = readBusinessProfile();
  const amount = Number(data.amount || 0);
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }
  return {
    ...data,
    document_number: data.document_number || nextDocumentNumber(profile.paymentPrefix || "PAY", "Payment"),
    amount,
    payment_date: data.payment_date || today(),
    method: data.method || "bank_transfer",
    status: data.status || "received",
    reference_type: data.reference_type || "manual",
    reference_id: data.reference_type === "sales_order" ? data.reference_id || "" : "",
  };
};

const createSalePayload = (data, product) => {
  const quantity = Number(data.quantity || 0);
  const unitPrice = Number(data.unit_price ?? product.unit_price ?? 0);
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
    total_amount: quantity * unitPrice,
    sale_date: saleDate,
    payment_status: data.payment_status || "paid",
    channel: data.channel || "direct",
  };
};

const createPurchasePayload = (data, supplier, product) => {
  const quantity = Number(data.quantity || 0);
  const unitCost = Number(data.unit_cost ?? product.cost_price ?? 0);
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
    total_amount: quantity * unitCost,
    order_date: orderDate,
    expected_date: data.expected_date || orderDate,
    status: data.status || "ordered",
    payment_status: data.payment_status || "pending",
  };
};

const createApprovalIfNeeded = ({ entityType, entityId, title, amount, threshold, requestedRole = "admin" }) => {
  const numericAmount = Number(amount || 0);
  if (numericAmount <= Number(threshold || 0)) {
    return "approved";
  }

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
  return "pending";
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
  const collectedAmount = relatedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalAmount = Number(orders[orderIndex].total_amount || 0);
  const balanceDue = Math.max(0, totalAmount - collectedAmount);
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

  const paymentPayload = normalizePayment({
    reference_type: "sale",
    reference_id: saleRecord.id,
    customer_name: saleRecord.customer_name,
    amount: saleRecord.total_amount,
    payment_date: saleRecord.sale_date || today(),
    method: relatedPayments[0]?.method || "cash",
    status: "received",
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

const removeContactRelations = (contact) => {
  const fullName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  writeRecords(
    "Deal",
    readRecords("Deal").filter((deal) => deal.contact_id !== contact.id && deal.contact_name !== fullName)
  );
  writeRecords(
    "Activity",
    readRecords("Activity").filter((activity) => activity.related_id !== contact.id && activity.contact_name !== fullName)
  );
  writeRecords(
    "Quote",
    readRecords("Quote").filter((quote) => quote.contact_id !== contact.id && quote.customer_name !== fullName)
  );
  writeRecords(
    "SalesOrder",
    readRecords("SalesOrder").filter((order) => order.contact_id !== contact.id && order.customer_name !== fullName)
  );
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
      recordAudit({
        action: "login",
        entityType: "AppUser",
        entityId: user.id,
        entityLabel: user.full_name,
        details: "User signed in to the workspace.",
      });
      return clone(user);
    },
    async logout() {
      const user = getCurrentUser();
      if (isBrowser) {
        window.sessionStorage.removeItem(CURRENT_USER_KEY);
      }
      if (user) {
        recordAudit({
          action: "logout",
          entityType: "AppUser",
          entityId: user.id,
          entityLabel: user.full_name,
          details: "User signed out of the workspace.",
        });
      }
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
      const updated = updateProductInventoryValue(
        normalizeProduct(updateTimestampedRecord(products[index], data))
      );
      products[index] = updated;
      writeRecords("Product", products);
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
      writeRecords("Product", readRecords("Product").filter((item) => item.id !== id));
      writeRecords("Sale", readRecords("Sale").filter((sale) => sale.product_id !== id));
      writeRecords("PurchaseOrder", readRecords("PurchaseOrder").filter((order) => order.product_id !== id));
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
      const products = readRecords("Product");
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
      writeRecords("Supplier", readRecords("Supplier").filter((item) => item.id !== id));
      writeRecords("PurchaseOrder", readRecords("PurchaseOrder").filter((order) => order.supplier_id !== id));
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
      const approvalStatus = createApprovalIfNeeded({
        entityType: "PurchaseOrder",
        entityId: "pending",
        title: `Purchase order for ${payload.product_name}`,
        amount: payload.total_amount,
        threshold: readBusinessProfile().purchaseApprovalThreshold,
      });
      const purchaseOrder = createTimestampedRecord({ ...payload, approval_status: approvalStatus });
      if (payload.status === "received") {
        adjustProductStock(products, payload.product_id, payload.quantity);
        writeRecords("Product", products);
      }
      const purchaseOrders = readRecords("PurchaseOrder");
      purchaseOrders.unshift(purchaseOrder);
      writeRecords("PurchaseOrder", purchaseOrders);
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
      if (previousOrder.status === "received") {
        adjustProductStock(products, previousOrder.product_id, -Number(previousOrder.quantity || 0));
      }
      const supplier = requireRecord(suppliers, data.supplier_id || previousOrder.supplier_id, "Supplier");
      const product = requireRecord(products, data.product_id || previousOrder.product_id, "Product");
      const payload = createPurchasePayload({ ...previousOrder, ...data }, supplier, product);
      if (payload.status === "received") {
        adjustProductStock(products, payload.product_id, payload.quantity);
      }
      writeRecords("Product", products);
      purchaseOrders[index] = updateTimestampedRecord(previousOrder, payload);
      writeRecords("PurchaseOrder", purchaseOrders);
      recordAudit({ action: "update", entityType: "PurchaseOrder", entityId: id, entityLabel: purchaseOrders[index].product_name });
      return clone(purchaseOrders[index]);
    },
    async delete(id) {
      const purchaseOrders = readRecords("PurchaseOrder");
      const purchaseOrder = requireRecord(purchaseOrders, id, "PurchaseOrder");
      writeRecords("PurchaseOrder", purchaseOrders.filter((order) => order.id !== id));
      if (purchaseOrder.status === "received") {
        const products = readRecords("Product");
        adjustProductStock(products, purchaseOrder.product_id, -Number(purchaseOrder.quantity || 0));
        writeRecords("Product", products);
      }
      recordAudit({ action: "delete", entityType: "PurchaseOrder", entityId: id, entityLabel: purchaseOrder.product_name });
      return { success: true };
    },
  },
  expenses: {
    async list(sortBy, limit) {
      return listEntityRecords("Expense", sortBy, limit);
    },
    async create(data) {
      const approvalStatus = createApprovalIfNeeded({
        entityType: "Expense",
        entityId: "pending",
        title: data.title || "Expense entry",
        amount: data.amount,
        threshold: readBusinessProfile().expenseApprovalThreshold,
      });
      const expenses = readRecords("Expense");
      const record = createTimestampedRecord({ ...normalizeExpense(data), approval_status: approvalStatus });
      expenses.unshift(record);
      writeRecords("Expense", expenses);
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
      const approvalStatus = createApprovalIfNeeded({
        entityType: "Quote",
        entityId: "pending",
        title: payload.title || payload.customer_name || "Quote",
        amount: payload.total_amount,
        threshold: readBusinessProfile().quoteApprovalThreshold,
      });
      const record = createTimestampedRecord({ ...payload, approval_status: approvalStatus });
      quotes.unshift(record);
      writeRecords("Quote", quotes);
      recordAudit({ action: "create", entityType: "Quote", entityId: record.id, entityLabel: record.document_number });
      return clone(record);
    },
    async update(id, data) {
      const quotes = readRecords("Quote");
      const index = quotes.findIndex((quote) => quote.id === id);
      if (index === -1) {
        throw new Error("Quote record not found");
      }
      quotes[index] = updateTimestampedRecord(quotes[index], normalizeQuote({ ...quotes[index], ...data }));
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
      orders[index] = updateTimestampedRecord(orders[index], normalizeSalesOrder({ ...orders[index], ...data }));
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
      payments[index] = updateTimestampedRecord(payments[index], normalizePayment({ ...payments[index], ...data }));
      writeRecords("Payment", payments);
      syncSalesOrderPayments(payments[index].reference_id);
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
      const requests = readRecords("ApprovalRequest");
      const index = requests.findIndex((request) => request.id === id);
      if (index === -1) {
        throw new Error("Approval request not found");
      }
      const actor = getCurrentUser();
      requests[index] = updateTimestampedRecord(requests[index], {
        status: decision,
        decision_note: note,
        decided_by_id: actor?.id || "",
        decided_by_name: actor?.full_name || "System",
      });
      writeRecords("ApprovalRequest", requests);
      const request = requests[index];
      const targetRecords = readRecords(request.entity_type);
      const targetIndex = targetRecords.findIndex((item) => item.id === request.entity_id);
      if (targetIndex >= 0) {
        targetRecords[targetIndex] = updateTimestampedRecord(targetRecords[targetIndex], {
          approval_status: decision,
        });
        writeRecords(request.entity_type, targetRecords);
      }
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
      return {
        profile: readBusinessProfile(),
        exported_at: nowIso(),
        version: 1,
        payload,
      };
    },
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
      return { success: true };
    },
    async importAll(snapshot) {
      if (!snapshot?.payload) {
        throw new Error("Invalid backup file");
      }
      ENTITY_NAMES.forEach((entityName) => {
        writeRecords(entityName, clone(snapshot.payload[entityName] || []));
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
      ].forEach((entityName) => writeRecords(entityName, []));
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

export const initializeCrmData = async () => {
  ensureSeedData();
  ensureDefaultWarehouse();
  await migrateLegacyDemoData();
};

export { defaultBusinessProfile, migrateStorageEncryption };
