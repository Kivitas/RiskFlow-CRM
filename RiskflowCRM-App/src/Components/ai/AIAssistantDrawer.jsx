import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  BrainCircuit,
  KeyRound,
  Lock,
  MessageSquarePlus,
  Shield,
  Sparkles,
  Unlock,
  WandSparkles,
} from 'lucide-react';
import { useBusiness } from '@/lib/BusinessContext';
import { useAuth } from '@/lib/AuthContext';
import { getAiProviderConfig, sendAiMessage } from '@/lib/aiClient';
import { useCurrency } from '@/lib/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const starterMessages = {
  focus: [
    'Which deals need attention this week?',
    'Summarize low stock and approvals.',
    'Where is cashflow getting blocked?',
  ],
  general: [
    'Draft a professional follow-up email.',
    'Explain gross margin in simple terms.',
    'Help me brainstorm a sales pitch.',
  ],
};

const providerTone = {
  openai: 'from-emerald-500 to-teal-500',
  anthropic: 'from-orange-500 to-amber-500',
  gemini: 'from-blue-500 to-violet-500',
};

function MessageBubble({ message }) {
  const isAssistant = message.role === 'assistant';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn('flex', isAssistant ? 'justify-start' : 'justify-end')}
    >
      <div
        className={cn(
          'max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-sm',
          isAssistant
            ? 'border border-slate-200 bg-white text-slate-700'
            : 'bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] text-white'
        )}
      >
        {isAssistant ? (
          <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-2 prose-li:my-0 prose-strong:text-slate-900">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function AIAssistantDrawer() {
  const { profile, isAiGeneralUnlocked, unlockGeneralAi, lockGeneralAi } = useBusiness();
  const { user } = useAuth();
  const { currencyInfo } = useCurrency();
  const providerConfig = useMemo(() => getAiProviderConfig(profile), [profile]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(profile.aiFocusModeDefault ? 'focus' : 'general');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: profile.aiFocusModeDefault
        ? 'Focus Mode is ready. Ask about contacts, pipeline, risk, inventory, procurement, or finance inside this workspace.'
        : 'General Chat is ready. Ask anything once your provider key is configured.',
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [usage, setUsage] = useState({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    setMode(profile.aiFocusModeDefault ? 'focus' : 'general');
  }, [profile.aiFocusModeDefault]);

  const keyAvailable = Boolean(providerConfig.apiKey);
  const generalLocked = mode === 'general' && profile.aiGeneralPassword && !isAiGeneralUnlocked;
  const aiDisabledForUser = user?.role !== 'admin' && (profile.aiUsageForUsers === false || user?.ai_enabled === false);

  const handleUnlock = () => {
    const result = unlockGeneralAi(unlockPassword);
    if (!result.ok) {
      setUnlockError(result.message);
      return;
    }
    setUnlockPassword('');
    setUnlockError('');
    toast({ title: 'General chat unlocked', description: 'You can now ask broader questions in this session.' });
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: nextMode === 'focus'
          ? 'Focus Mode is on. I will stay inside the workspace context only.'
          : 'General Chat is on. You can ask broader questions here.',
      },
    ]);
  };

  const handleStarter = (text) => {
    setPrompt(text);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isSending) {
      return;
    }
    if (!keyAvailable) {
      toast({ title: 'AI key required', description: 'Add an API key in Settings before opening chat.', variant: 'destructive' });
      return;
    }
    if (aiDisabledForUser) {
      toast({ title: 'AI disabled', description: 'An admin disabled AI access for this user.', variant: 'destructive' });
      return;
    }
    if (generalLocked) {
      toast({ title: 'General chat locked', description: 'Unlock general chat with the admin-set password first.', variant: 'destructive' });
      return;
    }

    const userMessage = { id: crypto.randomUUID(), role: 'user', content: nextPrompt };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setPrompt('');
    setIsSending(true);

    try {
      const response = await sendAiMessage({
        profile,
        currencyInfo,
        mode,
        messages: nextMessages,
      });
      setUsage((current) => ({
        promptTokens: current.promptTokens + (response.usage?.promptTokens || 0),
        completionTokens: current.completionTokens + (response.usage?.completionTokens || 0),
        totalTokens: current.totalTokens + (response.usage?.totalTokens || 0),
      }));
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: response.content },
      ]);
    } catch (error) {
      toast({ title: 'AI request failed', description: error.message || 'The provider request could not be completed.', variant: 'destructive' });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I could not complete that request.\n\n${error.message || 'Provider request failed.'}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_24px_60px_-22px_rgba(29,78,216,0.55)]"
      >
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
          <Bot className="h-5 w-5" />
          <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
        </div>
        <div className="text-left">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-100">AI Workspace</p>
          <p className="text-sm">Open assistant</p>
        </div>
      </motion.button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full border-l border-slate-200 bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_22%,#ffffff_100%)] p-0 sm:max-w-[560px]">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 bg-white/80 px-6 py-5 backdrop-blur-sm">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm', providerTone[providerConfig.provider] || providerTone.openai)}>
                    <WandSparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <SheetTitle className="text-xl tracking-tight text-slate-950">AI Assistant</SheetTitle>
                    <SheetDescription className="mt-1 text-sm text-slate-500">
                      Powered by {providerConfig.label} using a key stored locally in this browser.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('focus')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    mode === 'focus' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Focus Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('general')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    mode === 'general' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600'
                  )}
                >
                  <BrainCircuit className="h-4 w-4" />
                  General Chat
                </button>
                {mode === 'general' && profile.aiGeneralPassword && (
                  <button
                    type="button"
                    onClick={lockGeneralAi}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600"
                  >
                    <Lock className="h-4 w-4" />
                    Lock
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-4">
              {!keyAvailable ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white px-8 text-center">
                  <KeyRound className="h-10 w-10 text-slate-400" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">Add a provider key first</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Open Settings, choose an AI provider, and add an API key. Once saved, chat becomes available here.
                  </p>
                </div>
              ) : aiDisabledForUser ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white px-8 text-center">
                  <Lock className="h-10 w-10 text-slate-500" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">AI is disabled for this user</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    An admin disabled AI access for your account or for all non-admin users in this workspace.
                  </p>
                </div>
              ) : generalLocked ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-white px-8 text-center">
                  <Lock className="h-10 w-10 text-slate-500" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">General chat is locked</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    The admin set a password for general conversation. Focus Mode remains available without unlocking.
                  </p>
                  <div className="mt-5 w-full max-w-sm space-y-3">
                    <Input
                      type="password"
                      value={unlockPassword}
                      onChange={(event) => {
                        setUnlockPassword(event.target.value);
                        setUnlockError('');
                      }}
                      placeholder="Enter AI chat password"
                      className="h-11 rounded-xl"
                    />
                    {unlockError ? <p className="text-sm text-red-500">{unlockError}</p> : null}
                    <Button className="w-full rounded-xl" onClick={handleUnlock}>
                      <Unlock className="mr-2 h-4 w-4" />
                      Unlock General Chat
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {starterMessages[mode].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleStarter(item)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        {item}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setMessages([
                          {
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: mode === 'focus'
                              ? 'Focus Mode is on. I will stay inside the workspace context only.'
                              : 'General Chat is on. You can ask broader questions here.',
                          },
                        ]);
                        setUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      Clear chat
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.22)]">
                    <ScrollArea className="h-full px-4 py-4">
                      <AnimatePresence initial={false}>
                        <div className="space-y-4">
                          {messages.map((message) => (
                            <MessageBubble key={message.id} message={message} />
                          ))}
                          {isSending ? (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-start"
                            >
                              <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-blue-500" />
                                  Thinking...
                                </div>
                              </div>
                            </motion.div>
                          ) : null}
                          <div ref={endRef} />
                        </div>
                      </AnimatePresence>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-2">
                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={mode === 'focus' ? 'Ask about the workspace, deals, stock, approvals, or reports...' : 'Ask anything...'}
                    className="min-h-[96px] resize-none border-0 bg-transparent px-3 py-3 text-sm shadow-none focus-visible:ring-0"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSubmit(event);
                      }
                    }}
                    disabled={!keyAvailable || generalLocked || isSending}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    <p>
                    {mode === 'focus'
                      ? 'Focus Mode stays inside RiskFlow workspace data.'
                      : 'General Chat can answer broader questions using the selected provider.'}
                    </p>
                    <p className="mt-1">
                      Approx tokens: {usage.totalTokens.toLocaleString()} total
                      {' '}({usage.promptTokens.toLocaleString()} prompt / {usage.completionTokens.toLocaleString()} completion)
                    </p>
                  </div>
                  <Button type="submit" className="rounded-xl px-5" disabled={!keyAvailable || generalLocked || isSending || !prompt.trim()}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
