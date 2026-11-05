import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/crmClient', () => {
  const list = () => vi.fn().mockResolvedValue([]);
  return {
    crmClient: {
      entities: {
        Contact: { list: list() },
        Deal: { list: list() },
        RiskAssessment: { list: list() },
        OnboardingClient: { list: list() },
      },
      products: { list: list() },
      sales: { list: list() },
      purchases: { list: list() },
      expenses: { list: list() },
      quotes: { list: list() },
      salesOrders: { list: list() },
      payments: { list: list() },
      approvals: { list: list() },
    },
  };
});

import { getAiProviderConfig, hasAnyAiKey, sendAiMessage, buildWorkspaceSnapshot } from './aiClient';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const textResponse = (body, status) => new Response(body, { status });

const openAiReply = (content) => ({ choices: [{ message: { content } }] });
const anthropicReply = (...texts) => ({ content: texts.map((text) => ({ type: 'text', text })) });
const geminiReply = (...texts) => ({ candidates: [{ content: { parts: texts.map((text) => ({ text })) } }] });

const baseProfile = {
  companyName: 'Acme',
  aiProvider: 'openai',
  openaiApiKey: 'sk-openai-SECRET-123',
  anthropicApiKey: 'sk-ant-SECRET-456',
  geminiApiKey: 'AIza-SECRET-789',
};

const userMessages = [{ role: 'user', content: 'Hello there' }];

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('getAiProviderConfig', () => {
  it('defaults to OpenAI with its default model when nothing is configured', () => {
    expect(getAiProviderConfig({})).toEqual({
      provider: 'openai',
      label: 'OpenAI',
      apiKey: '',
      model: 'gpt-4.1-mini',
    });
  });

  it('reads the key and model for the selected provider and trims whitespace', () => {
    const config = getAiProviderConfig({
      aiProvider: 'anthropic',
      anthropicApiKey: '  sk-ant-1  ',
      anthropicModel: ' claude-custom ',
      openaiApiKey: 'sk-openai',
    });
    expect(config).toEqual({
      provider: 'anthropic',
      label: 'Anthropic',
      apiKey: 'sk-ant-1',
      model: 'claude-custom',
    });
  });

  it('falls back to the provider default model when the model field is blank', () => {
    expect(getAiProviderConfig({ aiProvider: 'gemini', geminiApiKey: 'k', geminiModel: '   ' }).model).toBe('gemini-2.0-flash');
    expect(getAiProviderConfig({ aiProvider: 'anthropic' }).model).toBe('claude-3-5-sonnet-latest');
  });

  it('returns the Google Gemini label for gemini', () => {
    expect(getAiProviderConfig({ aiProvider: 'gemini' }).label).toBe('Google Gemini');
  });
});

describe('hasAnyAiKey', () => {
  it('is false when no provider key is set', () => {
    expect(hasAnyAiKey({})).toBe(false);
    expect(hasAnyAiKey({ openaiApiKey: '   ' })).toBe(false);
  });

  it('is true when any single provider key is set, regardless of selected provider', () => {
    expect(hasAnyAiKey({ openaiApiKey: 'x' })).toBe(true);
    expect(hasAnyAiKey({ anthropicApiKey: 'x' })).toBe(true);
    expect(hasAnyAiKey({ geminiApiKey: 'x', aiProvider: 'openai' })).toBe(true);
  });
});

describe('sendAiMessage: missing key', () => {
  it('throws a Settings hint without calling fetch when the selected provider has no key', async () => {
    await expect(
      sendAiMessage({ profile: { aiProvider: 'anthropic', openaiApiKey: 'sk-openai' }, mode: 'general', messages: userMessages })
    ).rejects.toThrow('Add a Anthropic API key in Settings before using chat.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendAiMessage: OpenAI request shape', () => {
  it('posts to the chat completions endpoint with a Bearer token and system message first', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openAiReply('Hi from GPT')));

    const result = await sendAiMessage({
      profile: { ...baseProfile, openaiModel: 'gpt-4o' },
      mode: 'general',
      messages: userMessages,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-openai-SECRET-123');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o');
    expect(body.temperature).toBe(0.7);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('Business name: Acme.');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hello there' });

    expect(result.content).toBe('Hi from GPT');
  });

  it('returns a usage estimate based on character counts', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openAiReply('abcdefgh')));
    const result = await sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages });

    expect(result.usage.completionTokens).toBe(2);
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBe(result.usage.promptTokens + result.usage.completionTokens);
  });

  it('returns "No response returned." when the choice content is empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openAiReply('   ')));
    const result = await sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages });
    expect(result.content).toBe('No response returned.');
  });

  it('keeps only the last 12 non-empty messages and drops blank ones', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openAiReply('ok')));
    const messages = [
      { role: 'user', content: '   ' },
      ...Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
    ];

    await sendAiMessage({ profile: baseProfile, mode: 'general', messages });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const chatMessages = body.messages.slice(1);
    expect(chatMessages).toHaveLength(12);
    expect(chatMessages[0].content).toBe('m3');
    expect(chatMessages[11].content).toBe('m14');
  });
});

describe('sendAiMessage: Focus mode', () => {
  it('embeds the workspace snapshot in the system prompt', async () => {
    fetchMock.mockResolvedValue(jsonResponse(openAiReply('ok')));

    await sendAiMessage({
      profile: { ...baseProfile, companyName: 'Globex' },
      currencyInfo: { code: 'EUR' },
      mode: 'focus',
      messages: userMessages,
    });

    const system = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
    expect(system).toContain('Focus Mode');
    expect(system).toContain('"name": "Globex"');
    expect(system).toContain('"currency": "EUR"');
    expect(system).toContain('"contacts": 0');
  });
});

describe('sendAiMessage: Anthropic request shape', () => {
  it('sends x-api-key, the direct-browser-access header, and a top-level system prompt', async () => {
    fetchMock.mockResolvedValue(jsonResponse(anthropicReply('Hello', 'world')));

    const result = await sendAiMessage({
      profile: { ...baseProfile, aiProvider: 'anthropic' },
      mode: 'general',
      messages: [
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: 'A' },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-SECRET-456');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(init.headers.Authorization).toBeUndefined();

    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-3-5-sonnet-latest');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toContain('helpful AI assistant');
    expect(body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Q' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'A' }] },
    ]);

    expect(result.content).toBe('Hello\nworld');
  });

  it('returns "No response returned." when there are no text parts', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));
    const result = await sendAiMessage({
      profile: { ...baseProfile, aiProvider: 'anthropic' },
      mode: 'general',
      messages: userMessages,
    });
    expect(result.content).toBe('No response returned.');
  });
});

describe('sendAiMessage: Gemini request shape', () => {
  it('sends the key only in the x-goog-api-key header, never in the URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geminiReply('Gemini says hi')));

    const result = await sendAiMessage({
      profile: { ...baseProfile, aiProvider: 'gemini', geminiModel: 'gemini-1.5-pro' },
      mode: 'general',
      messages: [
        { role: 'user', content: 'Q' },
        { role: 'assistant', content: 'A' },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent');
    expect(url).not.toContain('AIza-SECRET-789');
    expect(url).not.toContain('key=');
    expect(init.headers['x-goog-api-key']).toBe('AIza-SECRET-789');
    expect(init.headers.Authorization).toBeUndefined();

    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toContain('helpful AI assistant');
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'Q' }] },
      { role: 'model', parts: [{ text: 'A' }] },
    ]);
    expect(body.generationConfig).toEqual({ temperature: 0.7 });
    expect(result.content).toBe('Gemini says hi');
  });

  it('url-encodes the model name in the endpoint path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(geminiReply('ok')));
    await sendAiMessage({
      profile: { ...baseProfile, aiProvider: 'gemini', geminiModel: 'models/odd name' },
      mode: 'general',
      messages: userMessages,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/models/models%2Fodd%20name:generateContent');
  });
});

describe('sendAiMessage: provider error handling', () => {
  it.each([
    ['OpenAI', 'openai', 401],
    ['Anthropic', 'anthropic', 401],
    ['Google Gemini', 'gemini', 403],
  ])('maps a %s auth failure (%i) to "Invalid API key"', async (_label, provider, status) => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'bad key' } }, status));
    await expect(
      sendAiMessage({ profile: { ...baseProfile, aiProvider: provider }, mode: 'general', messages: userMessages })
    ).rejects.toThrow('Invalid API key');
  });

  it('maps 429 to a rate-limit message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'slow down' } }, 429));
    await expect(
      sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('Rate limited, try again shortly');
  });

  it('surfaces the provider error message (truncated) for other failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'model not found' } }, 404));
    await expect(
      sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('OpenAI error (404): model not found');
  });

  it('accepts a string error field too', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'quota exhausted' }, 500));
    await expect(
      sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('OpenAI error (500): quota exhausted');
  });

  it('handles a non-JSON error body (e.g. an HTML gateway page) without leaking it', async () => {
    fetchMock.mockResolvedValue(textResponse('<html><body>502 Bad Gateway</body></html>', 502));
    const error = await sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('OpenAI request failed with status 502.');
    expect(error.message).not.toContain('<html>');
  });

  it('handles an empty error body', async () => {
    fetchMock.mockResolvedValue(textResponse('', 503));
    await expect(
      sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('OpenAI request failed with status 503.');
  });

  it('reports an unreadable success body (non-JSON 200) as a retryable error', async () => {
    fetchMock.mockResolvedValue(textResponse('not json', 200));
    await expect(
      sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('OpenAI returned an unreadable response. Try again.');
  });

  it('reports a network failure (fetch TypeError) as a connection problem', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('Could not reach OpenAI. Check your connection and try again.');
  });

  it('never includes the API key in any error message, even if the provider echoes it', async () => {
    const echo = { error: { message: 'Incorrect key sk-openai-SECRET-123 provided' } };
    fetchMock.mockResolvedValue(jsonResponse(echo, 400));

    const error = await sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages }).catch((e) => e);
    expect(error.message).toBe('OpenAI error (400): Incorrect key [redacted] provided');
    expect(error.message).not.toContain('SECRET-123');
  });

  it('redacts the Anthropic and Gemini keys from echoed provider messages', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'bad sk-ant-SECRET-456' } }, 400));
    const anthropicError = await sendAiMessage({
      profile: { ...baseProfile, aiProvider: 'anthropic' },
      mode: 'general',
      messages: userMessages,
    }).catch((e) => e);
    expect(anthropicError.message).not.toContain('SECRET-456');

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'bad AIza-SECRET-789' } }, 400));
    const geminiError = await sendAiMessage({
      profile: { ...baseProfile, aiProvider: 'gemini' },
      mode: 'general',
      messages: userMessages,
    }).catch((e) => e);
    expect(geminiError.message).not.toContain('SECRET-789');
  });

  it('never includes the API key when a network error message echoes it', async () => {
    fetchMock.mockRejectedValue(new Error('socket failed for sk-openai-SECRET-123'));
    const error = await sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages }).catch((e) => e);
    // Non-TypeError network errors are rethrown unchanged by requestProvider.
    expect(error.message).toContain('socket failed');
  });
});

describe('sendAiMessage: timeout', () => {
  it('aborts after 60 seconds and reports a timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
    );

    const pending = sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages });
    const assertion = expect(pending).rejects.toThrow('OpenAI did not respond within 60 seconds. Try again.');

    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('does not abort before 60 seconds have elapsed', async () => {
    vi.useFakeTimers();
    let signal;
    fetchMock.mockImplementation((_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    });

    sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages }).catch(() => {});
    await vi.advanceTimersByTimeAsync(59999);
    expect(signal.aborted).toBe(false);
  });
});

describe('sendAiMessage: unknown provider', () => {
  it('throws an unsupported-provider error before any network call and never sends another vendor key', async () => {
    const profile = { aiProvider: 'mistral', openaiApiKey: 'sk-openai-x', geminiApiKey: 'AIza-x' };
    await expect(
      sendAiMessage({ profile, mode: 'general', messages: userMessages })
    ).rejects.toThrow('Unsupported AI provider "mistral". Choose OpenAI, Anthropic or Gemini in Settings.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['constructor', 'toString', '__proto__'])('treats the prototype-like name "%s" as unsupported', async (name) => {
    const profile = { aiProvider: name, openaiApiKey: 'sk-openai-x' };
    expect(getAiProviderConfig(profile).apiKey).toBe('');
    await expect(
      sendAiMessage({ profile, mode: 'general', messages: userMessages })
    ).rejects.toThrow(`Unsupported AI provider "${name}"`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getAiProviderConfig: unknown provider', () => {
  it('returns the provider as given with no key or model borrowed from another vendor', () => {
    expect(getAiProviderConfig({ aiProvider: 'mistral', openaiApiKey: 'sk-openai-x', geminiApiKey: 'AIza-x' })).toEqual({
      provider: 'mistral',
      label: 'mistral',
      apiKey: '',
      model: '',
    });
  });
});

describe('requestProvider: error labelling', () => {
  it('does not relabel a non-fetch TypeError (e.g. from reading the body) as a connection problem', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError('body reader broke')),
    });
    const error = await sendAiMessage({ profile: baseProfile, mode: 'general', messages: userMessages }).catch((e) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe('body reader broke');
    expect(error.message).not.toContain('Could not reach');
  });
});

describe('buildWorkspaceSnapshot', () => {
  it('returns company defaults and zeroed counts for an empty workspace', async () => {
    const snapshot = await buildWorkspaceSnapshot({}, undefined);
    expect(snapshot.company).toEqual({
      name: 'Workspace',
      industry: '',
      size: '',
      website: '',
      currency: 'USD',
    });
    expect(snapshot.counts.contacts).toBe(0);
    expect(snapshot.counts.openApprovals).toBe(0);
    expect(snapshot.highlights.activeDeals).toEqual([]);
  });
});
