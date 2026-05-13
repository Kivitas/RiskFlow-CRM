import { crmClient } from '@/api/crmClient';

const PROVIDER_CONFIG = {
  openai: {
    keyField: 'openaiApiKey',
    modelField: 'openaiModel',
    defaultModel: 'gpt-4.1-mini',
    label: 'OpenAI',
  },
  anthropic: {
    keyField: 'anthropicApiKey',
    modelField: 'anthropicModel',
    defaultModel: 'claude-3-5-sonnet-latest',
    label: 'Anthropic',
  },
  gemini: {
    keyField: 'geminiApiKey',
    modelField: 'geminiModel',
    defaultModel: 'gemini-2.0-flash',
    label: 'Google Gemini',
  },
};

const toTrimmed = (value) => String(value || '').trim();
const toLower = (value) => String(value || '').trim().toLowerCase();

export const getAiProviderConfig = (profile) => {
  const provider = profile.aiProvider || 'openai';
  const meta = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.openai;
  return {
    provider,
    label: meta.label,
    apiKey: toTrimmed(profile[meta.keyField]),
    model: toTrimmed(profile[meta.modelField]) || meta.defaultModel,
  };
};

const summariseRecords = (records, mapper, limit = 5) => records.slice(0, limit).map(mapper);

export async function buildWorkspaceSnapshot(profile, currencyInfo) {
  const [
    contacts,
    deals,
    risks,
    onboarding,
    products,
    sales,
    purchaseOrders,
    expenses,
    quotes,
    salesOrders,
    payments,
    approvals,
  ] = await Promise.all([
    crmClient.entities.Contact.list(),
    crmClient.entities.Deal.list(),
    crmClient.entities.RiskAssessment.list(),
    crmClient.entities.OnboardingClient.list(),
    crmClient.products.list(),
    crmClient.sales.list('-sale_date', 20),
    crmClient.purchases.list('-order_date', 20),
    crmClient.expenses.list('-expense_date', 20),
    crmClient.quotes.list('-quote_date', 20),
    crmClient.salesOrders.list('-order_date', 20),
    crmClient.payments.list('-payment_date', 20),
    crmClient.approvals.list('-created_date', 20),
  ]);

  const activeDeals = deals.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage));
  const lowStock = products.filter((product) => product.status === 'active' && Number(product.stock_quantity || 0) <= Number(product.reorder_level || 0));
  const openApprovals = approvals.filter((approval) => approval.status === 'pending');

  return {
    company: {
      name: profile.companyName || 'Workspace',
      industry: profile.industry || '',
      size: profile.companySize || '',
      website: profile.companyWebsite || '',
      currency: currencyInfo?.code || 'USD',
    },
    counts: {
      contacts: contacts.length,
      customers: contacts.filter((contact) => contact.status === 'customer').length,
      deals: deals.length,
      activeDeals: activeDeals.length,
      risks: risks.length,
      highRisks: risks.filter((risk) => ['critical', 'high'].includes(risk.severity)).length,
      onboarding: onboarding.length,
      products: products.length,
      lowStock: lowStock.length,
      sales: sales.length,
      purchaseOrders: purchaseOrders.length,
      expenses: expenses.length,
      quotes: quotes.length,
      orders: salesOrders.length,
      payments: payments.length,
      openApprovals: openApprovals.length,
    },
    highlights: {
      activeDeals: summariseRecords(activeDeals, (deal) => ({
        name: deal.title || deal.name || 'Untitled deal',
        stage: deal.stage || '',
        value: Number(deal.value || 0),
      })),
      lowStockProducts: summariseRecords(lowStock, (product) => ({
        name: product.name || '',
        stock: Number(product.stock_quantity || 0),
        reorderLevel: Number(product.reorder_level || 0),
      })),
      recentSales: summariseRecords(sales, (sale) => ({
        product: sale.product_name || '',
        customer: sale.customer_name || '',
        amount: Number(sale.total_amount || 0),
        status: sale.payment_status || '',
      })),
      openApprovals: summariseRecords(openApprovals, (approval) => ({
        type: approval.request_type || '',
        amount: Number(approval.amount || 0),
        status: approval.status || '',
      })),
    },
  };
}

const buildFocusSystemPrompt = (snapshot) => `
You are RiskFlow Workspace AI running in Focus Mode.
You may only answer using the workspace data and business operations context provided below.
If the user asks for unrelated general knowledge, news, entertainment, or anything outside this workspace, refuse briefly and say Focus Mode only supports the in-app workspace.
Keep answers concise, operational, and actionable.

Workspace snapshot:
${JSON.stringify(snapshot, null, 2)}
`.trim();

const buildGeneralSystemPrompt = (profile) => `
You are a helpful AI assistant available inside the RiskFlow workspace.
You can answer general questions, writing tasks, brainstorming, and business help.
Be concise and practical.
Business name: ${profile.companyName || 'Workspace'}.
`.trim();

const normalizeMessages = (messages) =>
  messages
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').trim(),
    }))
    .filter((message) => message.content);

async function callOpenAI({ apiKey, model, systemPrompt, messages }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenAI request failed');
  }

  return data?.choices?.[0]?.message?.content?.trim() || 'No response returned.';
}

async function callAnthropic({ apiKey, model, systemPrompt, messages }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((message) => ({
        role: message.role,
        content: [{ type: 'text', text: message.content }],
      })),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Anthropic request failed');
  }

  return (data?.content || [])
    .map((part) => part?.text || '')
    .join('\n')
    .trim() || 'No response returned.';
}

async function callGemini({ apiKey, model, systemPrompt, messages }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: 0.7,
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Gemini request failed');
  }

  return (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('\n')
    .trim() || 'No response returned.';
}

export async function sendAiMessage({ profile, currencyInfo, mode, messages }) {
  const providerConfig = getAiProviderConfig(profile);
  if (!providerConfig.apiKey) {
    throw new Error(`Add a ${providerConfig.label} API key in Settings before using chat.`);
  }

  const normalizedMessages = normalizeMessages(messages).slice(-12);
  const systemPrompt = mode === 'focus'
    ? buildFocusSystemPrompt(await buildWorkspaceSnapshot(profile, currencyInfo))
    : buildGeneralSystemPrompt(profile);

  let content = '';
  if (providerConfig.provider === 'openai') {
    content = await callOpenAI({
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      systemPrompt,
      messages: normalizedMessages,
    });
  } else if (providerConfig.provider === 'anthropic') {
    content = await callAnthropic({
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      systemPrompt,
      messages: normalizedMessages,
    });
  } else {
    content = await callGemini({
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      systemPrompt,
      messages: normalizedMessages,
    });
  }

  const promptChars = systemPrompt.length + normalizedMessages.reduce((sum, message) => sum + message.content.length, 0);
  const completionChars = content.length;
  return {
    content,
    usage: {
      promptTokens: Math.ceil(promptChars / 4),
      completionTokens: Math.ceil(completionChars / 4),
      totalTokens: Math.ceil((promptChars + completionChars) / 4),
    },
  };
}

export const hasAnyAiKey = (profile) =>
  Boolean(
    toLower(profile.openaiApiKey) ||
    toLower(profile.anthropicApiKey) ||
    toLower(profile.geminiApiKey)
  );
