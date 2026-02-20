'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useWidgetService } from '@/services';
import type { IntegrationSettings } from '@/models';
import { getCountryCode } from '@/utils/countryDetection';

type BotMessage = { type: 'bot'; content: string; step?: string };
type WarnMessage = { type: 'warn' | 'error'; content: string };
type ReviewPromptMessage = { type: 'review_prompt'; content: string; reviewUrl: string };
type UserFileMessage = { type: 'user'; content: string; fileInfo?: { filename: string; fileId: string; contentType: string } };
type AnyMessage = BotMessage | WarnMessage | ReviewPromptMessage | UserFileMessage | { type: 'user'; content: string };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

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
  const rawWs = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<AnyMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle click outside to close widget
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only respond to left mouse button clicks (button 0)
      if (event.button === 0 && isOpen && widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        sendWidgetState(false);
        if (wsRef.current) {
          wsRef.current.close();
        }
        resizeIframe(100);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  const [settings, setSettings] = useState<IntegrationSettings>({
    assistantName: 'Assistly Chatbot',
    greeting: '',
    primaryColor: '#00bc7d',
    chatbotImage: '',
    validateEmail: false,
    validatePhoneNumber: true
  });
  const [imageData, setImageData] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string>('US');
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fullWsUrl = useMemo(() => {
    const base = rawWs.endsWith('/ws') ? rawWs : (rawWs.endsWith('/') ? `${rawWs}ws` : `${rawWs}/ws`);
    const url = new URL(base);
    // Support both appId and userId for backward compatibility
    if (appId) {
      url.searchParams.set('app_id', appId);
    } else if (userId) {
      url.searchParams.set('user_id', userId);
    } else {
      url.searchParams.set('user_id', 'PUBLIC_USER_ID');
    }
    url.searchParams.set('country', countryCode);
    return url.toString();
  }, [rawWs, appId, userId, countryCode]);

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
             greeting: integration.greeting || '',
             primaryColor: integration.primaryColor || '#00bc7d',
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
      }
    };

    const detectCountry = async () => {
      try {
        // If country is provided in URL, use it first
        if (countryFromUrl) {
          setCountryCode(countryFromUrl.toUpperCase());
          console.log('Country from URL:', countryFromUrl);
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

  useEffect(() => {
    // Only connect when widget is opened
    if (!isOpen) return;
    
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(fullWsUrl);
    } catch (e) {
      setMessages((prev) => [...prev, { type: 'error', content: 'Failed to initialize websocket' } as WarnMessage]);
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      // Let backend handle the initial greeting flow
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as AnyMessage;
        setMessages((prev) => [...prev, msg]);
        if ((msg as WarnMessage).type === 'warn' || (msg as WarnMessage).type === 'error') {
          setIsTyping(false);
          return;
        }
        // Stop typing indicator for bot and review_prompt messages
        if ((msg as any).type === 'bot' || (msg as any).type === 'review_prompt') {
          setIsTyping(false);
        }
      } catch (err) {
        setMessages((prev) => [...prev, { type: 'warn', content: 'Malformed message from server' }]);
        setIsTyping(false);
      }
    };
    ws.onclose = () => {
      setConnected(false);
      setChatEnded(true);
    };
    ws.onerror = () => {
      setMessages((prev) => [...prev, { type: 'error', content: 'WebSocket error' }]);
    };

    return () => {
      ws?.close();
      wsRef.current = null;
    };
  }, [fullWsUrl, isOpen, settings.greeting]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendText = (text: string) => {
    const value = text.trim();
    if (!value || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ 
      type: 'user', 
      content: value,
      country: countryCode 
    }));
    setMessages((prev) => [...prev, { type: 'user', content: value }]);
    setIsTyping(true);
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

  // Format inline bullet points (•) so each starts on a new line
  const formatBulletPoints = (str: string) => str.replace(/ • /g, '\n• ');

  // Render text with URLs as clickable links (opens in new tab)
  const renderTextWithLinks = (str: string, keyPrefix: string): React.ReactNode => {
    const formatted = formatBulletPoints(str);
    const urlRegex = /https?:\/\/[^\s]+/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(formatted)) !== null) {
      if (urlMatch.index > lastIndex) {
        parts.push(formatted.slice(lastIndex, urlMatch.index));
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
      parts.push(formatted.slice(lastIndex));
    }
    if (parts.length === 0) return formatted;
    return <span key={keyPrefix} className="whitespace-pre-wrap">{parts}</span>;
  };

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Matches:
    // <button>text</button>
    // <button value="val">text</button>
    // <file url="..." name="filename">label</file>
    const regex = /<(button|file)(?:\s+value=["']([^"']*)["'])?(?:\s+url=["']([^"']*)["'])?(?:\s+name=["']([^"']*)["'])?>([\s\S]*?)<\/\1>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const chunk = text.slice(lastIndex, match.index).trim();
        if (chunk) parts.push(renderTextWithLinks(chunk, `t-${lastIndex}`));
      }
      
      const tagName = match[1].toLowerCase();
      const buttonValue = match[2] || '';
      const fileUrl = match[3] || '';
      const fileName = match[4] || 'Download';
      const innerText = (match[5] || '').trim();

      if (tagName === 'file' && fileUrl) {
        parts.push(
          <a
            key={`f-${match.index}`}
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={fileName}
            className="flex items-center gap-2 rounded-lg text-white text-xs sm:text-sm font-medium px-3 py-2 shadow-sm mt-1 hover:opacity-90 transition"
            style={{ backgroundColor: settings.primaryColor || '#00bc7d' }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            {innerText || fileName}
          </a>
        );
      } else if (tagName === 'button' && innerText) {
        const clickValue = buttonValue || innerText;
        parts.push(
          <button
            key={`b-${match.index}`}
            className="block w-full text-left rounded-full text-white text-xs sm:text-sm font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:translate-y-px transition mt-1 whitespace-normal break-words"
            style={{ 
              backgroundColor: settings.primaryColor || '#00bc7d',
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = (settings.primaryColor || '#00bc7d') + 'dd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = settings.primaryColor || '#00bc7d';
            }}
            onClick={() => sendText(clickValue)}
          >
            {innerText}
          </button>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      const rest = text.slice(lastIndex).trim();
      if (rest) parts.push(renderTextWithLinks(rest, `t-${lastIndex}`));
    }
    
    if (parts.length === 0) return renderTextWithLinks(text, 'only');
    return <div className="flex flex-wrap items-start gap-2">{parts}</div>;
  };

  if (!isOpen) {
    // Compact widget - inline message and chat button
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 sm:gap-3">
        {/* Chat message bubble - always visible in iframe */}
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3 sm:p-4 max-w-sm relative">
          <div className="text-base sm:text-lg text-gray-800 font-semibold">
            Click here to chat
          </div>
          {/* Arrow pointing to the button */}
          <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2 w-0 h-0 border-l-4 border-t-4 border-b-4 border-l-white border-t-transparent border-b-transparent"></div>
        </div>
        
        {/* Chat button */}
        <button
          onClick={() => {
            // Opening widget - clear messages and start fresh
            setMessages([]);
            setConnected(false);
            setIsTyping(false);
            setIsOpen(true);
            sendWidgetState(true);
            // Resize iframe to accommodate expanded widget
            resizeIframe(600);
          }}
          className="w-16 h-16 sm:w-18 sm:h-18 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: settings.primaryColor || '#00bc7d' }}
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
          background-color: ${settings.primaryColor || '#00bc7d'};
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
          {imageData && (
            <img 
              src={imageData} 
              alt="Chatbot" 
              className="w-6 h-6 rounded-full object-cover"
            />
          )}
          <span>{settings.assistantName}</span>
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            sendWidgetState(false);
            // Close WebSocket connection when closing widget
            if (wsRef.current) {
              wsRef.current.close();
            }
            // Resize iframe back to compact size
            resizeIframe(100);
          }}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ×
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-3 sm:p-4 overflow-auto custom-scrollbar space-y-4 text-sm sm:text-base">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex items-start gap-3 ${m.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden ${m.type === 'user' ? 'w-9 h-9' : 'w-8 h-8'}`}>
              {m.type === 'user' ? (
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: settings.primaryColor || '#00bc7d' }}>
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
                m.type === 'user' 
                  ? 'text-white rounded-lg' 
                  : (m.type === 'bot' || m.type === 'review_prompt'
                    ? 'bg-gray-100 text-gray-800 rounded-lg' 
                    : 'bg-yellow-50 text-yellow-800 rounded-lg')
              }`}
              style={m.type === 'user' ? { backgroundColor: settings.primaryColor || '#00bc7d' } : {}}
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
                          style={{ backgroundColor: settings.primaryColor || '#00bc7d' }}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Write a review on Google
                        </a>
                      </div>
                    )
                  : (m.type === 'user'
                    ? m.content
                    : `${m.type.toUpperCase()}: ${m.content}`)}
              
              {/* Speech bubble tail */}
              {m.type === 'user' ? (
                <div 
                  className="absolute -right-2 top-2 w-0 h-0"
                  style={{ 
                    borderLeft: '12px solid ' + (settings.primaryColor || '#00bc7d'),
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent'
                  }}
                ></div>
              ) : (
                <div 
                  className="absolute -left-2 top-2 w-0 h-0"
                  style={{ 
                    borderRight: '12px solid ' + (m.type === 'bot' || m.type === 'review_prompt' ? '#f3f4f6' : '#fef3c7'),
                    borderTop: '12px solid transparent',
                    borderBottom: '12px solid transparent'
                  }}
                ></div>
              )}
            </div>
          </div>
        ))}
        {!messages.length && (
          <div className="text-gray-500 text-sm sm:text-base font-medium">Connecting to chat...</div>
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
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
          className="hidden"
          onChange={handleFileUpload}
          disabled={!connected || isUploadingFile}
        />
        {/* File upload button */}
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
        <input
          className="flex-1 border border-gray-300 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base"
          placeholder={connected ? 'Type a message or attach a file...' : (chatEnded ? 'Chat ended' : 'Connecting...')}
          disabled={!connected}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button 
          className="text-white text-sm sm:text-base px-2 sm:px-4 py-1.5 sm:py-2 rounded font-medium disabled:opacity-50 whitespace-nowrap" 
          style={{ backgroundColor: settings.primaryColor || '#00bc7d' }}
          onClick={send} 
          disabled={!connected}
        >
          Send
        </button>
      </div>
      </div>
    </>
  );
}


