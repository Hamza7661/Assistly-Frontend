'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useWidgetService } from '@/services';
import type { IntegrationSettings } from '@/models';
import { getCountryCode } from '@/utils/countryDetection';

type BotMessage = { type: 'bot'; content: string; step?: string };
type WarnMessage = { type: 'warn' | 'error'; content: string };
type ChannelBlockedMessage = { type: 'channel_blocked'; content: string; code?: string };
type ReviewPromptMessage = { type: 'review_prompt'; content: string; reviewUrl: string };
type UserFileMessage = { type: 'user'; content: string; fileInfo?: { filename: string; fileId: string; contentType: string } };
type AnyMessage =
  | BotMessage
  | WarnMessage
  | ChannelBlockedMessage
  | ReviewPromptMessage
  | UserFileMessage
  | { type: 'user'; content: string }
  | { type: 'user_replay'; content: string }
  | { type: 'session_complete' };

enum ChatbotUiMode {
  Basic = 'basic',
  Advanced = 'advanced',
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const MAX_RECONNECT_ATTEMPTS = 3;
/** Set when flow is done: booking confirmation shown, or non-booking JSON after all questions. Cleared on widget close/reload. */
const SESSION_FINISHED_STORAGE_SUFFIX = '__session_finished';

export default function WidgetPage() {
  const params = useParams<{ userId?: string; appId?: string }>();
  const searchParams = useSearchParams();
  // Support both appId (new) and userId (legacy)
  const appId = params?.appId || searchParams.get('appId');
  const userId = params?.userId || searchParams.get('userId');
  const identifier = appId || userId; // Prefer appId, fallback to userId for backward compatibility
  const countryFromUrl = searchParams.get('country');
  
  // Set transparent background for iframe
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);
  const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<AnyMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadEnabled, setFileUploadEnabled] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isIntentionalClose = useRef(false);
  const isOpenRef = useRef(false);

  const [settings, setSettings] = useState<IntegrationSettings>({
    assistantName: 'Assistly Chatbot',
    companyName: '',
    greeting: '',
    primaryColor: '#c01721',
    chatbotUiMode: ChatbotUiMode.Basic,
    chatbotImage: '',
    validateEmail: false,
    validatePhoneNumber: true
  });
  const [imageData, setImageData] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [countryCode, setCountryCode] = useState<string>('US');
  const [leadId, setLeadId] = useState<string | null>(null);
  const [clickedItems, setClickedItems] = useState<string[]>([]);
  const leadIdRef = useRef<string | null>(null);
  const clickedItemsRef = useRef<string[]>([]);
  useEffect(() => {
    leadIdRef.current = leadId;
  }, [leadId]);
  useEffect(() => {
    clickedItemsRef.current = clickedItems;
  }, [clickedItems]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<AnyMessage[]>([]);
  const replayDedupGuardRef = useRef(false);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [channelBlocked, setChannelBlocked] = useState(false);
  const [channelBlockedMessage, setChannelBlockedMessage] = useState<string | null>(null);
  const autoOpenedRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const blockedStateRef = useRef(false);
  const blockedRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resumeStorageKey = identifier ? `assistly_chat_resume_v1_${identifier}` : null;
  const conversationMetaStorageKey = resumeStorageKey ? `${resumeStorageKey}__meta` : null;
  const [widgetSessionId, setWidgetSessionId] = useState<string | null>(null);
  const [hasActiveConversation, setHasActiveConversation] = useState(false);
  const isAdvancedMode = settings.chatbotUiMode === ChatbotUiMode.Advanced;
  const hasUserResponded = useMemo(
    () => messages.some((m) => m.type === 'user' || m.type === 'user_replay'),
    [messages]
  );
  // "Started" means user interaction happened (typed/replied/selected option),
  // not just bot greeting/history replay.
  const hasConversationInProgress = (hasUserResponded || clickedItems.length > 0) && !sessionCompleted;
  const markUserInteracted = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    blockedStateRef.current = channelBlocked;
  }, [channelBlocked]);

  const normalizeBlockedMessage = (raw?: string | null) => {
    const fallback = 'Service is unavailable right now.';
    const cleaned = String(raw || '')
      .replace(/^CHANNEL_BLOCKED:\s*/i, '')
      .trim();
    return cleaned || fallback;
  };

  const formatGreetingText = useCallback((rawGreeting?: string) => {
    const assistantName = settings.assistantName?.trim() || 'our assistant';
    const companyName = settings.companyName?.trim() || '';
    const fallback = `Hi! I'm ${assistantName}${companyName ? ` from ${companyName}` : ''}. How can I assist you today?`;
    const source = (rawGreeting || '').trim() || fallback;

    let output = source.replace(/{assistantName}/gi, assistantName);
    if (companyName) {
      output = output.replace(/{companyName}/gi, companyName);
    } else {
      output = output
        .replace(/\s+from\s+\{companyName\}/gi, '')
        .replace(/\s+at\s+\{companyName\}/gi, '')
        .replace(/\s+of\s+\{companyName\}/gi, '')
        .replace(/\s+with\s+\{companyName\}/gi, '')
        .replace(/\{companyName\}/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+([.,!?])/g, '$1');
    }
    return output;
  }, [settings.assistantName, settings.companyName]);

  const persistConversationMeta = (meta: { active?: boolean; leadId?: string | null; clickedItems?: string[] }) => {
    if (!conversationMetaStorageKey || typeof window === 'undefined') return;
    try {
      const existingRaw = sessionStorage.getItem(conversationMetaStorageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const next = {
        ...existing,
        ...meta,
      };
      sessionStorage.setItem(conversationMetaStorageKey, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    if (!resumeStorageKey || typeof window === 'undefined') return;

    // Full page reload after a completed flow: start clean (same as closing the widget after complete)
    try {
      const finishedKey = `${resumeStorageKey}${SESSION_FINISHED_STORAGE_SUFFIX}`;
      if (sessionStorage.getItem(finishedKey) === '1') {
        sessionStorage.removeItem(finishedKey);
        sessionStorage.removeItem(`${resumeStorageKey}__msgs`);
        if (conversationMetaStorageKey) sessionStorage.removeItem(conversationMetaStorageKey);
        const newId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `wk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem(resumeStorageKey, newId);
        setWidgetSessionId(newId);
        setMessages([]);
        setLeadId(null);
        setClickedItems([]);
        setHasActiveConversation(false);
        setFileUploadEnabled(false);
        return;
      }
    } catch {}

    let id = sessionStorage.getItem(resumeStorageKey);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `wk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(resumeStorageKey, id);
    }
    setWidgetSessionId(id);

    if (conversationMetaStorageKey) {
      try {
        const rawMeta = sessionStorage.getItem(conversationMetaStorageKey);
        if (rawMeta) {
          const meta = JSON.parse(rawMeta) as {
            active?: boolean;
            leadId?: string | null;
            clickedItems?: string[];
          };
          const isActive = Boolean(meta.active);
          setHasActiveConversation(isActive);
          if (isActive && meta.leadId) setLeadId(meta.leadId);
          if (Array.isArray(meta.clickedItems)) setClickedItems(meta.clickedItems);
          if (isActive) {
            try {
              const rawMsgs = sessionStorage.getItem(`${resumeStorageKey}__msgs`);
              if (rawMsgs) {
                const parsed = JSON.parse(rawMsgs) as AnyMessage[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setMessages(parsed);
                }
              }
            } catch {}
          }
        }
      } catch {}
    }
  }, [resumeStorageKey, conversationMetaStorageKey]);

  const clearBlockedRetryTimer = () => {
    if (blockedRetryTimerRef.current) {
      clearInterval(blockedRetryTimerRef.current);
      blockedRetryTimerRef.current = null;
    }
  };

  // Do NOT depend on messages.length: after the first bot reply we persist __msgs, which would
  // flip this to true, change fullWsUrl (skip_history_replay=1), and reconnect the WebSocket —
  // the user's next tap can hit a closed socket (stuck chat). Snapshot is resume + active flag only.
  const skipHistoryReplay = useMemo(() => {
    if (typeof window === 'undefined' || !resumeStorageKey || !hasActiveConversation) return false;
    try {
      const raw = sessionStorage.getItem(`${resumeStorageKey}__msgs`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }, [resumeStorageKey, hasActiveConversation]);

  useEffect(() => {
    if (!resumeStorageKey || typeof window === 'undefined' || !hasActiveConversation) return;
    if (messages.length === 0) return;
    try {
      sessionStorage.setItem(`${resumeStorageKey}__msgs`, JSON.stringify(messages));
    } catch {}
  }, [messages, hasActiveConversation, resumeStorageKey]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const createInteractionLead = useCallback(async () => {
    if (!identifier) return;
    try {
      const svc = await useWidgetService();
      const json = await svc.createPublicLead(identifier, {
        appId: appId || undefined,
        status: 'interacting',
        location: { countryCode },
        initialInteraction: 'widget_opened',
        clickedItems: [],
        sourceChannel: 'web',
      });
      const id = json?.data?.lead?._id;
      if (id) {
        setLeadId(id);
        setHasActiveConversation(true);
        persistConversationMeta({ active: true, leadId: id, clickedItems: [] });
      }
    } catch {}
  }, [identifier, appId, countryCode]);

  const updateInteractionLead = async (payload: Record<string, unknown>) => {
    if (!identifier || !leadId) return;
    try {
      const svc = await useWidgetService();
      await svc.updatePublicLead(identifier, leadId, payload);
    } catch {}
  };

  /** New resume id + cleared sessionStorage + UI — server treats next WS as a brand-new session. */
  const resetChatToStart = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (
      !window.confirm(
        'Start over? This clears the chat and begins a new conversation from scratch.'
      )
    ) {
      return;
    }

    isIntentionalClose.current = true;
    clearReconnectTimer();
    clearBlockedRetryTimer();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (resumeStorageKey) {
      try {
        sessionStorage.removeItem(`${resumeStorageKey}${SESSION_FINISHED_STORAGE_SUFFIX}`);
        if (conversationMetaStorageKey) {
          sessionStorage.removeItem(conversationMetaStorageKey);
        }
        sessionStorage.removeItem(`${resumeStorageKey}__msgs`);
        const newId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `wk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem(resumeStorageKey, newId);
        setWidgetSessionId(newId);
      } catch {}
    }

    setMessages([]);
    setLeadId(null);
    setClickedItems([]);
    setHasActiveConversation(false);
    setFileUploadEnabled(false);
    setChatEnded(false);
    setChannelBlocked(false);
    setChannelBlockedMessage(null);
    setSessionCompleted(false);
    setConnectionError(null);
    setInput('');
    setIsTyping(true);
    reconnectAttemptsRef.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = '';

    void createInteractionLead();
    setConnectAttempt((c) => c + 1);
  }, [
    resumeStorageKey,
    conversationMetaStorageKey,
    createInteractionLead,
  ]);

  const fullWsUrl = useMemo(() => {
    const resolveDefaultWsBase = () => {
      const toWsProtocol = (proto: string) => (proto === 'https:' ? 'wss:' : 'ws:');
      if (typeof window !== 'undefined') {
        const fromApi = process.env.NEXT_PUBLIC_API_URL;
        if (fromApi && /^https?:\/\//i.test(fromApi)) {
          const apiUrl = new URL(fromApi);
          const basePath = apiUrl.pathname.replace(/\/api\/v\d+\/?$/i, '');
          return `${toWsProtocol(apiUrl.protocol)}//${apiUrl.host}${basePath}`;
        }
        return `${toWsProtocol(window.location.protocol)}//${window.location.host}`;
      }
      return 'ws://localhost:8000';
    };

    const wsBase = configuredWsUrl || resolveDefaultWsBase();
    const base = wsBase.endsWith('/ws') ? wsBase : (wsBase.endsWith('/') ? `${wsBase}ws` : `${wsBase}/ws`);
    const url = new URL(base);
    // Support both appId and userId for backward compatibility
    if (appId) {
      url.searchParams.set('app_id', appId);
    } else if (userId) {
      url.searchParams.set('user_id', userId);
    } else {
      url.searchParams.set('user_id', 'PUBLIC_USER_ID');
    }
    if (countryCode) {
      url.searchParams.set('country', countryCode.toUpperCase());
    }
    if (widgetSessionId) {
      url.searchParams.set('resume', widgetSessionId);
    }
    if (skipHistoryReplay) {
      url.searchParams.set('skip_history_replay', '1');
    }
    return url.toString();
  }, [configuredWsUrl, appId, userId, countryCode, widgetSessionId, skipHistoryReplay]);

  // Load integration settings and detect country
  useEffect(() => {
    const loadSettings = async () => {
      if (!identifier) return;
      try {
        const svc = await useWidgetService();
        // Public API is app-based only (GET /integration/public/apps/:appId). Path segment is appId.
        const res = await svc.getIntegrationSettingsByApp(identifier);
        const integration = res.data?.integration;
        
         if (integration) {
           setSettings({
             assistantName: integration.assistantName || 'Assistly Chatbot',
             companyName: integration.companyName || '',
             greeting: integration.greeting || '',
             primaryColor: integration.primaryColor || '#c01721',
             chatbotUiMode: integration.chatbotUiMode === ChatbotUiMode.Advanced ? ChatbotUiMode.Advanced : ChatbotUiMode.Basic,
             chatbotImage: integration.chatbotImage?.filename || '',
             validateEmail: integration.validateEmail || false,
             validatePhoneNumber: integration.validatePhoneNumber || true,
             leadTypeMessages: integration.leadTypeMessages || [],
             googleReviewEnabled: integration.googleReviewEnabled || false,
             googleReviewUrl: integration.googleReviewUrl ?? null
           });
          
          // Set image data if available
          if (integration.chatbotImage?.hasImage && integration.chatbotImage.data) {
            const imageDataUrl = `data:${integration.chatbotImage.contentType};base64,${integration.chatbotImage.data}`;
            setImageData(imageDataUrl);
          }
        }
      } catch (e) {
        console.error('Failed to load integration settings:', e);
      } finally {
        setSettingsLoaded(true);
      }
    };

    const detectCountry = async () => {
      try {
        // If country is provided in URL, use it first
        if (countryFromUrl) {
          setCountryCode(countryFromUrl.toUpperCase());
          return;
        }
        
        const countryResult = await getCountryCode();
        setCountryCode(countryResult.countryCode);
        console.log('Country detected:', countryResult);
      } catch (e) {
        console.error('Failed to detect country:', e);
        // Fallback to default country from env
        const defaultCountry = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'US';
        setCountryCode(defaultCountry);
      }
    };
    
    loadSettings();
    detectCountry();
  }, [identifier, countryFromUrl]);

  // Auto-open the widget after a 2-second delay once settings are loaded.
  // Bell sound is handled entirely by widget.js on the parent page — it queues
  // and fires on first real user activation (click / keydown / touch).
  useEffect(() => {
    if (!settingsLoaded || !widgetSessionId || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const timer = setTimeout(() => {
      // Prevent initial auto-open timer from overriding manual user action.
      if (isOpenRef.current || hasUserInteractedRef.current) return;
      setIsWidgetVisible(true);
      const selectedMode =
        settings.chatbotUiMode === ChatbotUiMode.Advanced
          ? ChatbotUiMode.Advanced
          : ChatbotUiMode.Basic;

      if (selectedMode === ChatbotUiMode.Advanced) {
        // Advanced mode: resume chat when conversation already started,
        // otherwise keep the branded home screen.
        if (hasConversationInProgress) {
          setIsOpen(true);
          sendWidgetState(true);
        } else {
          setIsOpen(false);
          sendWidgetState(false);
        }
        resizeIframe(600);
        return;
      }

      if (!hasActiveConversation) {
        setMessages([]);
        setConnected(false);
        setChatEnded(false);
        setSessionCompleted(false);
        setIsTyping(false);
        setFileUploadEnabled(false);
        setClickedItems([]);
      }
      setIsOpen(true);
      sendWidgetState(true);
      resizeIframe(600);
      if (!hasActiveConversation) {
        createInteractionLead();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [settingsLoaded, widgetSessionId, hasActiveConversation, hasConversationInProgress, createInteractionLead, settings.chatbotUiMode]);

  // WebSocket must not reconnect when leadId/clickedItems change (e.g. after a button tap),
  // or cleanup closes the socket before the bot reply is delivered.
  useEffect(() => {
    // Only connect when widget is opened
    if (!isOpen) return;
    
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(fullWsUrl);
    } catch (e) {
      setConnectionError('Unable to start chat connection.');
      setChatEnded(true);
      setConnected(false);
      setIsTyping(false);
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      // Guard: ignore events from a stale (already-replaced) WebSocket
      if (wsRef.current !== ws) return;
      isIntentionalClose.current = false;
      reconnectAttemptsRef.current = 0;
      clearReconnectTimer();
      clearBlockedRetryTimer();
      setChatEnded(false);
      setConnected(true);
      setIsReconnecting(false);
      setConnectionError(null);
      setChannelBlocked(false);
      setChannelBlockedMessage(null);
      setMessages((prev) => prev.filter((item) => item.type !== 'channel_blocked'));
      // If we already have rendered messages, treat early incoming frames as potential
      // transcript replay and dedupe by (type, content) until a new message arrives.
      replayDedupGuardRef.current = messagesRef.current.length > 0;
      // On reopen/resume, keep indicator off until a live bot turn actually starts.
      // Show typing immediately only for a brand-new chat with no prior messages.
      setIsTyping(messagesRef.current.length === 0);
    };
    ws.onmessage = (e) => {
      // Guard: ignore messages from a stale WebSocket
      if (wsRef.current !== ws) return;
      try {
        const msg = JSON.parse(e.data) as AnyMessage;
        const msgType = (msg as any).type;
        const msgContent = String((msg as { content?: string }).content || '');

        // On reopen/resume we may already have transcript in-memory. If backend replays
        // older lines, skip them so chat does not append duplicates.
        const isDuplicateOnResume = (type: string, content: string) => {
          if (!replayDedupGuardRef.current || !content) return false;
          return messagesRef.current.some((m) => {
            if (!('content' in m)) return false;
            const existingContent = String((m as { content?: string }).content || '');
            if (existingContent !== content) return false;
            if (type === 'user_replay') {
              return m.type === 'user_replay' || m.type === 'user';
            }
            return m.type === type;
          });
        };

        // Handle file upload enable signal (not a chat message)
        if (msgType === 'enable_file_upload') {
          setFileUploadEnabled(true);
          setHasActiveConversation(true);
          persistConversationMeta({
            active: true,
            leadId: leadIdRef.current,
            clickedItems: clickedItemsRef.current,
          });
          return;
        }

        // Flow complete (booking confirmed with details shown, or non-booking JSON after all questions).
        // Keep messages + same WebSocket; reset storage/UI only when user closes widget or reloads.
        if (msgType === 'session_complete') {
          if (typeof window !== 'undefined' && resumeStorageKey) {
            try {
              sessionStorage.setItem(`${resumeStorageKey}${SESSION_FINISHED_STORAGE_SUFFIX}`, '1');
            } catch {}
          }
          setSessionCompleted(true);
          setIsTyping(false);
          setFileUploadEnabled(false);
          return;
        }

        if (msgType === 'channel_blocked') {
          const blockedText = normalizeBlockedMessage(msgContent);
          setChannelBlocked(true);
          setChannelBlockedMessage(blockedText);
          setChatEnded(true);
          setIsTyping(false);
          setIsReconnecting(false);
          setConnectionError(null);
          clearReconnectTimer();
          setMessages((prev) => {
            if (prev.some((item) => item.type === 'channel_blocked')) return prev;
            return [...prev, { type: 'channel_blocked', content: blockedText, code: (msg as { code?: string }).code }];
          });
          return;
        }

        if (msgType === 'user_replay') {
          if (isDuplicateOnResume(msgType, msgContent)) return;
          setMessages((prev) => [...prev, { type: 'user_replay', content: String((msg as { content?: string }).content || '') }]);
          replayDedupGuardRef.current = false;
          setHasActiveConversation(true);
          persistConversationMeta({
            active: true,
            leadId: leadIdRef.current,
            clickedItems: clickedItemsRef.current,
          });
          return;
        }
        if (
          (msgType === 'bot' || msgType === 'review_prompt' || msgType === 'user')
          && isDuplicateOnResume(msgType, msgContent)
        ) {
          return;
        }
        setMessages((prev) => [...prev, msg]);
        if (msgType === 'bot' || msgType === 'review_prompt' || msgType === 'user') {
          replayDedupGuardRef.current = false;
        }
        if (msgType === 'bot' || msgType === 'review_prompt') {
          setHasActiveConversation(true);
          persistConversationMeta({
            active: true,
            leadId: leadIdRef.current,
            clickedItems: clickedItemsRef.current,
          });
        }
        if (msgType === 'warn' || msgType === 'error') {
          setIsTyping(false);
          return;
        }
        // Stop typing indicator for bot and review_prompt messages
        if (msgType === 'bot' || msgType === 'review_prompt') {
          setIsTyping(false);
        }
      } catch (err) {
        setMessages((prev) => [...prev, { type: 'warn', content: 'Malformed message from server' }]);
        setIsTyping(false);
      }
    };
    ws.onclose = () => {
      // Guard: ignore close events from a stale WebSocket (e.g. after a reconnect).
      // wsRef.current is set to null in cleanup before ws.close() is called, so a
      // stale onclose always sees wsRef.current !== ws and skips the state update.
      if (wsRef.current !== ws) return;
      setConnected(false);
      setIsTyping(false);
      if (blockedStateRef.current) {
        setIsReconnecting(false);
        setChatEnded(true);
        return;
      }
      // Only reconnect for unexpected closes, not controlled cleanup/reconnects
      if (!isIntentionalClose.current && isOpen) {
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          setIsReconnecting(true);
          clearReconnectTimer();
          const delay = Math.min(1000 * reconnectAttemptsRef.current, 3000);
          reconnectTimerRef.current = setTimeout(() => {
            setConnectAttempt((prev) => prev + 1);
          }, delay);
        } else {
          setIsReconnecting(false);
          setChatEnded(true);
          setConnectionError('Connection lost. Please try reconnecting.');
        }
      }
    };
    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setConnectionError('Unable to connect to chat server.');
    };

    return () => {
      isIntentionalClose.current = true;
      clearReconnectTimer();
      clearBlockedRetryTimer();
      wsRef.current = null; // Clear ref BEFORE close so stale onclose is ignored
      ws?.close();
    };
  }, [
    fullWsUrl,
    isOpen,
    connectAttempt,
    widgetSessionId,
    conversationMetaStorageKey,
    resumeStorageKey,
    skipHistoryReplay,
    createInteractionLead,
  ]);

  useEffect(() => {
    clearBlockedRetryTimer();
    if (!channelBlocked || !isOpen || !widgetSessionId) return;
    blockedRetryTimerRef.current = setInterval(() => {
      setIsReconnecting(true);
      setConnectAttempt((prev) => prev + 1);
    }, 15000);
    return () => clearBlockedRetryTimer();
  }, [channelBlocked, isOpen, widgetSessionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendText = (text: string, displayText?: string) => {
    const value = text.trim();
    if (!value || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ 
      type: 'user', 
      content: value,
      country: countryCode
    }));
    setMessages((prev) => [...prev, { type: 'user', content: (displayText || value) }]);
    setHasActiveConversation(true);
    persistConversationMeta({ active: true, leadId, clickedItems });
    if (displayText) {
      const nextClicked = [...clickedItems, displayText];
      setClickedItems(nextClicked);
      persistConversationMeta({ active: true, leadId, clickedItems: nextClicked });
      updateInteractionLead({
        initialInteraction: clickedItems.length === 0 ? displayText : undefined,
        clickedItems: nextClicked,
        status: 'in_progress',
      });
    }
    setIsTyping(true);
    // Hide the file upload button after the user sends any message — it will be re-shown
    // only if the bot explicitly asks for a file again via the enable_file_upload signal.
    setFileUploadEnabled(false);
  };

  const send = () => {
    const text = input;
    sendText(text);
    setInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (file.size > 25 * 1024 * 1024) {
      setMessages(prev => [...prev, { type: 'warn', content: 'File too large. Maximum size is 25MB.' } as WarnMessage]);
      return;
    }

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`${API_BASE}/chat-uploads/apps/${identifier}`, {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const { fileId, filename, contentType } = uploadData.data;

      // Show user-side file message
      const userMsg: UserFileMessage = {
        type: 'user',
        content: `📎 ${filename}`,
        fileInfo: { filename, fileId, contentType }
      };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      // Notify bot via WebSocket
      wsRef.current.send(JSON.stringify({
        type: 'file_upload',
        fileId,
        filename,
        contentType,
        downloadUrl: `${API_BASE}/chat-uploads/${fileId}`,
        country: countryCode
      }));
      // Hide the upload button after a file is submitted
      setFileUploadEnabled(false);
    } catch (err) {
      setMessages(prev => [...prev, { type: 'error', content: 'File upload failed. Please try again.' } as WarnMessage]);
    } finally {
      setIsUploadingFile(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Function to resize iframe based on widget state
  const resizeIframe = (height: number) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'resize-iframe',
        height: height
      }, '*');
    }
  };

  // Send widget state to parent
  const sendWidgetState = (isOpen: boolean) => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'widget-state',
        isOpen: isOpen
      }, '*');
    }
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!isWidgetVisible) {
      resizeIframe(100);
      return;
    }
    if (isOpen) return;
    resizeIframe(settings.chatbotUiMode === ChatbotUiMode.Advanced ? 600 : 100);
  }, [isOpen, isWidgetVisible, settingsLoaded, settings.chatbotUiMode]);

  /** After booking / all questions answered: clear cached thread when user closes widget (or on reload). */
  const applyCompletedFlowStorageReset = useCallback((): string | null => {
    if (!resumeStorageKey || typeof window === 'undefined') return null;
    try {
      const fk = `${resumeStorageKey}${SESSION_FINISHED_STORAGE_SUFFIX}`;
      if (sessionStorage.getItem(fk) !== '1') return null;
      sessionStorage.removeItem(fk);
      sessionStorage.removeItem(`${resumeStorageKey}__msgs`);
      if (conversationMetaStorageKey) sessionStorage.removeItem(conversationMetaStorageKey);
      const newId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `wk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(resumeStorageKey, newId);
      return newId;
    } catch {
      return null;
    }
  }, [resumeStorageKey, conversationMetaStorageKey]);

  const closeWidgetChrome = useCallback(() => {
    markUserInteracted();
    const newId = applyCompletedFlowStorageReset();
    if (newId) {
      setWidgetSessionId(newId);
      setMessages([]);
      setLeadId(null);
      setClickedItems([]);
      setHasActiveConversation(false);
      setFileUploadEnabled(false);
      setInput('');
      setIsTyping(false);
      setChatEnded(false);
      setSessionCompleted(false);
      setConnectionError(null);
      reconnectAttemptsRef.current = 0;
    }
    isIntentionalClose.current = true;
    setIsOpen(false);
    if (isAdvancedMode) {
      setIsWidgetVisible(false);
    }
    sendWidgetState(false);
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
    }
    resizeIframe(100);
  }, [applyCompletedFlowStorageReset, isAdvancedMode, markUserInteracted]);

  const openChatFromLauncher = useCallback(() => {
    markUserInteracted();
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(false);
    setConnectionError(null);
    setChatEnded(false);
    setIsOpen(true);
    sendWidgetState(true);
    resizeIframe(600);
    // Do not clear messages/state here; that can wipe a just-started thread
    // and cause a "connecting" limbo on launcher opens.
    if (!hasActiveConversation) {
      createInteractionLead();
    }
  }, [hasActiveConversation, createInteractionLead, markUserInteracted]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        closeWidgetChrome();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeWidgetChrome]);

  // Format inline bullet points (•) so each starts on a new line
  const formatBulletPoints = (str: string) => str.replace(/ • /g, '\n• ');

  const renderBoldSegments = (text: string, keyBase: string): React.ReactNode => {
    const re = /\*\*([^*]+)\*\*/g;
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        out.push(<span key={`${keyBase}-t-${i++}`}>{text.slice(last, m.index)}</span>);
      }
      out.push(
        <strong key={`${keyBase}-b-${i++}`} className="font-semibold">
          {m[1]}
        </strong>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      out.push(<span key={`${keyBase}-t-${i++}`}>{text.slice(last)}</span>);
    }
    return out.length > 0 ? out : text;
  };

  // Render **bold**, bullets, and URLs as clickable links
  const renderTextWithLinks = (str: string, keyPrefix: string): React.ReactNode => {
    const formatted = formatBulletPoints(str);
    const urlRegex = /https?:\/\/[^\s]+/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(formatted)) !== null) {
      if (urlMatch.index > lastIndex) {
        parts.push(
          <span key={`${keyPrefix}-pre-${urlMatch.index}`} className="whitespace-pre-wrap">
            {renderBoldSegments(formatted.slice(lastIndex, urlMatch.index), `${keyPrefix}-b-${urlMatch.index}`)}
          </span>
        );
      }
      const rawUrl = urlMatch[0];
      const href = rawUrl.replace(/[.,;?!)]+$/, '');
      parts.push(
        <a
          key={`${keyPrefix}-url-${urlMatch.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all hover:text-blue-800"
        >
          {rawUrl}
        </a>
      );
      lastIndex = urlMatch.index + rawUrl.length;
    }
    if (lastIndex < formatted.length) {
      parts.push(
        <span key={`${keyPrefix}-tail`} className="whitespace-pre-wrap">
          {renderBoldSegments(formatted.slice(lastIndex), `${keyPrefix}-tail`)}
        </span>
      );
    }
    if (parts.length === 0) {
      return (
        <span key={keyPrefix} className="whitespace-pre-wrap">
          {renderBoldSegments(formatted, `${keyPrefix}-only`)}
        </span>
      );
    }
    return (
      <span key={keyPrefix} className="whitespace-pre-wrap">
        {parts}
      </span>
    );
  };

  const CheckboxChoiceGroup = ({
    options,
    groupKey,
  }: {
    options: Array<{ value: string; label: string }>;
    groupKey: string;
  }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const toggle = (value: string) => {
      setSelected((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    };

    return (
      <div className="w-full rounded-lg border border-gray-200 bg-white/80 p-2 space-y-2">
        <p className="text-[11px] sm:text-xs text-gray-600">
          Select one or more options, then click Submit.
        </p>
        <div className="space-y-1">
          {options.map((opt, idx) => {
            const id = `${groupKey}-${idx}`;
            const isChecked = selected.includes(opt.value);
            return (
              <label key={id} htmlFor={id} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                <input
                  id={id}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(opt.value)}
                  className="rounded border-gray-300 text-[#c01721] focus:ring-[#c01721]"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          disabled={selected.length === 0}
          className="rounded-full text-white text-xs sm:text-sm font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: settings.primaryColor || '#c01721' } as React.CSSProperties}
          onClick={() => {
            // Join with newline so option texts that contain commas
            // are not confused with the multi-value separator.
            const payload = selected.join('\n');
            sendText(payload, payload);
          }}
        >
          Submit
        </button>
      </div>
    );
  };

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Matches:
    // <button>text</button>
    // <button value="val">text</button>
    // <checkbox value="val">text</checkbox>
    // <file url="..." name="filename">label</file>
    const regex = /<(button|file|checkbox)(?:\s+value=["']([^"']*)["'])?(?:\s+url=["']([^"']*)["'])?(?:\s+name=["']([^"']*)["'])?(?:\s+group=["']([^"']*)["'])?>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let pendingCheckboxes: Array<{ value: string; label: string }> = [];

    const flushCheckboxes = (keySeed: number) => {
      if (pendingCheckboxes.length === 0) return;
      parts.push(
        <CheckboxChoiceGroup
          key={`cb-${keySeed}`}
          groupKey={`cb-${keySeed}`}
          options={pendingCheckboxes}
        />
      );
      pendingCheckboxes = [];
    };
    
    while ((match = regex.exec(text)) !== null) {
      const tagName = match[1].toLowerCase();
      const gap = match.index > lastIndex ? text.slice(lastIndex, match.index) : '';
      const gapTrim = gap.trim();

      // Newlines/whitespace between consecutive <checkbox> tags must NOT flush — otherwise
      // each option becomes its own group (repeated hint + Submit per row).
      if (match.index > lastIndex) {
        const mergeIntoCheckboxGroup =
          tagName === 'checkbox' && pendingCheckboxes.length > 0 && gapTrim === '';
        if (!mergeIntoCheckboxGroup) {
          flushCheckboxes(match.index);
          if (gapTrim) {
            parts.push(renderTextWithLinks(gapTrim, `t-${lastIndex}`));
          }
        }
      }

      const buttonValue = match[2] || '';
      const fileUrl = match[3] || '';
      const fileName = match[4] || 'Download';
      const innerText = (match[6] || '').trim();

      if (tagName === 'file' && fileUrl) {
        flushCheckboxes(match.index);
        parts.push(
          <a
            key={`f-${match.index}`}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={fileName}
            className="flex items-center gap-2 rounded-lg text-white text-xs sm:text-sm font-medium px-3 py-2 shadow-sm mt-1 hover:opacity-90 transition"
            style={{ backgroundColor: settings.primaryColor || '#c01721' }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            {innerText || fileName}
          </a>
        );
      } else if (tagName === 'button' && innerText) {
        flushCheckboxes(match.index);
        const clickValue = buttonValue || innerText;
        parts.push(
          <button
            key={`b-${match.index}`}
            className="block w-full text-left rounded-full text-white text-xs sm:text-sm font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:translate-y-px transition mt-1 whitespace-normal break-words"
            style={{ 
              backgroundColor: settings.primaryColor || '#c01721',
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = (settings.primaryColor || '#c01721') + 'dd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = settings.primaryColor || '#c01721';
            }}
            onClick={() => sendText(clickValue, innerText)}
          >
            {innerText}
          </button>
        );
      } else if (tagName === 'checkbox' && innerText) {
        const checkboxValue = buttonValue || innerText;
        pendingCheckboxes.push({ value: checkboxValue, label: innerText });
      }
      lastIndex = match.index + match[0].length;
    }
    
    flushCheckboxes(lastIndex);
    if (lastIndex < text.length) {
      const rest = text.slice(lastIndex).trim();
      if (rest) parts.push(renderTextWithLinks(rest, `t-${lastIndex}`));
    }
    
    if (parts.length === 0) return renderTextWithLinks(text, 'only');
    return <div className="flex flex-wrap items-start gap-2">{parts}</div>;
  };

  const requiresOptionSelection = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.type !== 'bot') continue;
      const content = String(msg.content || '');
      return /<(button|checkbox)\b/i.test(content);
    }
    return false;
  }, [messages]);
  if (!isWidgetVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={() => {
            markUserInteracted();
            setIsWidgetVisible(true);
            if (isAdvancedMode && !hasConversationInProgress) {
              setIsOpen(false);
              sendWidgetState(false);
              resizeIframe(600);
              return;
            }
            setIsOpen(true);
            sendWidgetState(true);
            resizeIframe(600);
            if (!hasConversationInProgress) createInteractionLead();
          }}
          className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition flex items-center justify-center"
          style={{ backgroundColor: settings.primaryColor || '#c01721' }}
          title={`Open chat with ${settings.assistantName || 'assistant'}`}
          aria-label="Open chatbot"
        >
          {imageData ? (
            <img src={imageData} alt="Chatbot" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  if (!isOpen) {
    if (!settingsLoaded) return null;
    const isAdvancedLauncher = settings.chatbotUiMode === ChatbotUiMode.Advanced;

    if (isAdvancedLauncher) {
      return (
        <div className="fixed z-50 w-full h-full bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          <div
            className="px-4 pt-4 pb-6 text-white"
            style={{ backgroundColor: settings.primaryColor || '#c01721' }}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm overflow-hidden flex items-center justify-center">
                {imageData ? (
                  <img src={imageData} alt="Chatbot" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold" style={{ color: settings.primaryColor || '#c01721' }}>
                    {(settings.assistantName || 'A').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="text-white/90 text-lg leading-none px-1"
                onClick={closeWidgetChrome}
                aria-label="Close"
                title="Close"
              >
                ×
              </button>
            </div>
            <h2 className="mt-5 text-3xl font-semibold leading-tight">Hey there 👋</h2>
            <p className="mt-2 text-white/90 text-base leading-snug">
              Welcome to our website. Feel free to ask us anything.
            </p>
          </div>

          <div className="px-3 pt-5 relative z-10">
            <button
              type="button"
              onClick={openChatFromLauncher}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 bg-white flex items-center justify-between shadow-sm hover:shadow transition"
            >
              <span className="text-gray-700 font-medium">Chat with us</span>
              <span className="text-white rounded-full w-7 h-7 flex items-center justify-center" style={{ backgroundColor: settings.primaryColor || '#c01721' }}>
                ➤
              </span>
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white py-2 px-8 flex items-center justify-between text-xs">
            <div className="flex flex-col items-center gap-1">
              <span
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ backgroundColor: settings.primaryColor || '#c01721' }}
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
                </svg>
              </span>
              <span className="font-medium" style={{ color: settings.primaryColor || '#c01721' }}>Home</span>
            </div>
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-gray-700 hover:text-gray-900 transition-colors"
              onClick={openChatFromLauncher}
            >
              <span className="w-7 h-7 rounded-md flex items-center justify-center border border-gray-300 bg-white">
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-8 6l3-3h10a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="font-medium text-gray-700">Chat</span>
            </button>
          </div>
        </div>
      );
    }

    // Compact widget - inline message and chat button
    return (
      <>
        <style>{`
          @keyframes widget-ping {
            0% { transform: scale(1); opacity: 0.7; }
            70% { transform: scale(1.55); opacity: 0; }
            100% { transform: scale(1.55); opacity: 0; }
          }
          .widget-pulse::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            background: inherit;
            animation: widget-ping 1.4s ease-out infinite;
          }
        `}</style>
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 sm:gap-3">
          {/* Chat message bubble */}
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3 sm:p-4 max-w-sm relative">
            <div className="text-base sm:text-lg text-gray-800 font-semibold">
              Click here to chat
            </div>
            <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-t-4 border-b-4 border-l-white border-t-transparent border-b-transparent"></div>
          </div>

          {/* Chat button with pulse ring */}
          <div className="relative flex-shrink-0">
            <div
              className="widget-pulse w-16 h-16 sm:w-18 sm:h-18 rounded-full"
              style={{ backgroundColor: settings.primaryColor || '#c01721' }}
            />
            <button
              onClick={() => {
                markUserInteracted();
                if (!hasConversationInProgress) {
                  setMessages([]);
                  setConnected(false);
                  setChatEnded(false);
                  setChannelBlocked(false);
                  setChannelBlockedMessage(null);
                  setIsTyping(false);
                  setFileUploadEnabled(false);
                }
                setIsOpen(true);
                sendWidgetState(true);
                resizeIframe(600);
                if (!hasConversationInProgress) {
                  createInteractionLead();
                }
              }}
              className="absolute inset-0 w-full h-full rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
              style={{ backgroundColor: settings.primaryColor || '#c01721' }}
          title={`Chat with ${settings.assistantName}`}
        >
          {imageData ? (
            <img 
              src={imageData} 
              alt="Chat" 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover"
            />
          ) : (
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
          )}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Expanded chat widget
  return (
    <>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: ${settings.primaryColor || '#c01721'};
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      <div ref={widgetRef} className="fixed z-50 w-full h-full bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b text-sm sm:text-base font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isAdvancedMode && (
            <button
              type="button"
              onClick={() => {
                markUserInteracted();
                setIsOpen(false);
                sendWidgetState(false);
                resizeIframe(600);
              }}
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              title="Back to home"
              aria-label="Back to home"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div
            className="w-8 h-8 rounded-full shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ backgroundColor: settings.primaryColor || '#c01721' }}
          >
            {imageData ? (
              <img
                src={imageData}
                alt="Chatbot"
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
            )}
          </div>
          <span>{settings.assistantName}</span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={resetChatToStart}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            title="Start over — clear chat and begin again"
            aria-label="Start over — clear chat and begin again"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={closeWidgetChrome}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1.5 py-1 rounded-md hover:bg-gray-100"
            title="Close chat"
            aria-label="Close chat"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-3 sm:p-4 overflow-auto custom-scrollbar space-y-4 text-sm sm:text-base">
        {messages.map((m, idx) => {
          const isUserBubble = m.type === 'user' || m.type === 'user_replay';
          return (
          <div key={idx} className={`flex items-start gap-3 ${isUserBubble ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden ${isUserBubble ? 'w-9 h-9' : 'w-8 h-8'}`}>
              {isUserBubble ? (
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: settings.primaryColor || '#c01721' }}>
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              ) : (
                imageData ? (
                  <img 
                    src={imageData} 
                    alt="Chatbot" 
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                )
              )}
            </div>
            
            {/* Message bubble */}
            <div 
              className={`inline-block px-3 sm:px-4 py-2 sm:py-3 max-w-[85%] break-words relative ${
                isUserBubble
                  ? 'text-white rounded-lg' 
                  : (m.type === 'bot' || m.type === 'review_prompt'
                    ? 'bg-gray-100 text-gray-800 rounded-lg' 
                    : 'bg-yellow-50 text-yellow-800 rounded-lg')
              }`}
              style={isUserBubble ? { backgroundColor: settings.primaryColor || '#c01721' } : {}}
            >
              {m.type === 'bot'
                ? renderBotContent(m.content)
                : m.type === 'review_prompt'
                  ? (
                      <div className="space-y-2">
                        <p>{m.content}</p>
                        <a
                          href={(m as ReviewPromptMessage).reviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full text-white text-xs sm:text-sm font-medium px-3 py-2 shadow-sm hover:opacity-90 transition"
                          style={{ backgroundColor: settings.primaryColor || '#c01721' }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Leave a review
                        </a>
                      </div>
                    )
                  : isUserBubble
                    ? renderTextWithLinks(m.content, `u-${idx}`)
                    : `${m.type.toUpperCase()}: ${'content' in m ? m.content : ''}`}
              
              {/* Speech bubble tail */}
              {isUserBubble ? (
                <div 
                  className="absolute -right-2 top-2 w-0 h-0"
                  style={{ 
                    borderLeft: '12px solid ' + (settings.primaryColor || '#c01721'),
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent'
                  }}
                ></div>
              ) : (
                <div 
                  className="absolute -left-2 top-2 w-0 h-0"
                  style={{ 
                    borderRight: '12px solid ' + ((m.type === 'bot' || m.type === 'review_prompt') ? '#f3f4f6' : '#fef3c7'),
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent'
                  }}
                ></div>
              )}
            </div>
          </div>
        );
        })}
        {!messages.length && (
          <div className="flex flex-col items-center gap-2 text-center">
            {chatEnded ? (
              <>
                <div className="text-gray-400 text-sm">{channelBlocked ? 'Chat unavailable' : 'Connection lost.'}</div>
                <div className="text-gray-500 text-xs">
                  {channelBlocked
                    ? normalizeBlockedMessage(channelBlockedMessage)
                    : connectionError}
                </div>
                <button
                  onClick={() => {
                    clearReconnectTimer();
                    clearBlockedRetryTimer();
                    reconnectAttemptsRef.current = 0;
                    setIsReconnecting(false);
                    setConnectionError(null);
                    setChannelBlocked(false);
                    setChannelBlockedMessage(null);
                    setChatEnded(false);
                    setConnected(false);
                    setIsOpen(false);
                    setTimeout(() => setIsOpen(true), 100);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: settings.primaryColor || '#c01721' }}
                >
                  {channelBlocked ? 'Check again' : 'Reconnect'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 text-sm sm:text-base font-medium">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: settings.primaryColor || '#c01721' }}></div>
                {isReconnecting ? 'Reconnecting to chat...' : 'Connecting to chat...'}
              </div>
            )}
          </div>
        )}
        {isTyping && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-2 sm:p-3 border-t flex gap-1 sm:gap-2 items-center">
        {/* Hidden file input - only rendered when upload is enabled */}
        {fileUploadEnabled && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={!connected || isUploadingFile}
          />
        )}
        {/* File upload button - only shown when backend requests a file */}
        {fileUploadEnabled && (
          <button
            title="Attach a file"
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || isUploadingFile}
            className="p-1.5 sm:p-2 rounded border border-gray-300 text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition shrink-0"
          >
            {isUploadingFile ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
        )}
        <input
          className="flex-1 border border-gray-300 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base"
          placeholder={
            channelBlocked
              ? 'Service is unavailable right now.'
              : !connected
                ? (chatEnded ? 'Chat ended' : 'Connecting...')
              : (sessionCompleted
                  ? 'Chat completed - Click Reset to start again.'
                  : (requiresOptionSelection ? 'Please select from the options above' : 'Type a message...'))
          }
          disabled={!connected || requiresOptionSelection || sessionCompleted || channelBlocked}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !sessionCompleted) send(); }}
        />
        <button 
          className="text-white text-sm sm:text-base px-2 sm:px-4 py-1.5 sm:py-2 rounded font-medium disabled:opacity-50 whitespace-nowrap" 
          style={{ backgroundColor: settings.primaryColor || '#c01721' }}
          onClick={sessionCompleted ? resetChatToStart : send}
          disabled={sessionCompleted ? false : (!connected || requiresOptionSelection || channelBlocked)}
        >
          {sessionCompleted ? 'Reset' : 'Send'}
        </button>
      </div>

      {/* Powered by UpZilo */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 border-t border-gray-100 bg-white">
        <span className="text-[10px] text-gray-400 font-medium tracking-wide">Powered by</span>
        <a
          href="https://upzilo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
          title="UpZilo"
        >
          <img src="/upzilo-logo.png" alt="UpZilo" className="h-4 w-auto" />
          <span className="text-[11px] font-semibold text-gray-500">UpZilo</span>
        </a>
      </div>
      </div>
    </>
  );
}


