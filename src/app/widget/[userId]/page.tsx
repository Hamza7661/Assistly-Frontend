'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useWidgetService } from '@/services';
import type { IntegrationSettings } from '@/models';

type BotMessage = { type: 'bot'; content: string; step?: string };
type WarnMessage = { type: 'warn' | 'error'; content: string };
type AnyMessage = BotMessage | WarnMessage | { type: 'user'; content: string };

export default function WidgetPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  const rawWs = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<AnyMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
   const [settings, setSettings] = useState<IntegrationSettings>({
     assistantName: 'Assistly Chatbot',
     greeting: '',
     primaryColor: '#00bc7d',
     chatbotImage: '',
     validateEmail: false,
     validatePhoneNumber: true
   });
  const [imageData, setImageData] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fullWsUrl = useMemo(() => {
    const base = rawWs.endsWith('/ws') ? rawWs : (rawWs.endsWith('/') ? `${rawWs}ws` : `${rawWs}/ws`);
    const url = new URL(base);
    url.searchParams.set('user_id', userId || 'PUBLIC_USER_ID');
    return url.toString();
  }, [rawWs, userId]);

  // Load integration settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!userId) return;
      try {
        const svc = await useWidgetService();
        const res = await svc.getIntegrationSettings(userId);
        const integration = res.data?.integration;
        
         if (integration) {
           setSettings({
             assistantName: integration.assistantName || 'Assistly Chatbot',
             greeting: integration.greeting || '',
             primaryColor: integration.primaryColor || '#00bc7d',
             chatbotImage: integration.chatbotImage?.filename || '',
             validateEmail: integration.validateEmail || false,
             validatePhoneNumber: integration.validatePhoneNumber || true
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
    
    loadSettings();
  }, [userId]);

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
        // Stop typing indicator for bot messages
        if ((msg as any).type === 'bot') {
          setIsTyping(false);
        }
      } catch (err) {
        setMessages((prev) => [...prev, { type: 'warn', content: 'Malformed message from server' }]);
        setIsTyping(false);
      }
    };
    ws.onclose = () => {
      setConnected(false);
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
    wsRef.current.send(JSON.stringify({ type: 'user', content: value }));
    setMessages((prev) => [...prev, { type: 'user', content: value }]);
    setIsTyping(true);
  };

  const send = () => {
    const text = input;
    sendText(text);
    setInput('');
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

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /<button>([\s\S]*?)<\/button>/gi; // match <button>text</button> pattern
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const chunk = text.slice(lastIndex, match.index).trim();
        if (chunk) parts.push(<span key={`t-${lastIndex}`}>{chunk}</span>);
      }
      const label = (match[1] || '').trim();
      if (label) {
        parts.push(
          <button
            key={`b-${match.index}`}
            className="block w-full text-left rounded-full text-white text-xs font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:translate-y-px transition mt-1 whitespace-normal break-words"
            style={{ 
              backgroundColor: settings.primaryColor || '#00bc7d',
              '--hover-color': (settings.primaryColor || '#00bc7d') + 'dd'
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = (settings.primaryColor || '#00bc7d') + 'dd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = settings.primaryColor || '#00bc7d';
            }}
            onClick={() => sendText(label)}
          >
            {label}
          </button>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      const rest = text.slice(lastIndex).trim();
      if (rest) parts.push(<span key={`t-${lastIndex}`}>{rest}</span>);
    }
    if (parts.length === 0) return text;
    return <div className="flex flex-wrap items-center gap-2">{parts}</div>;
  };

  if (!isOpen) {
    // Compact widget - inline message and chat button
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 sm:gap-3">
        {/* Chat message bubble - always visible in iframe */}
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-2 sm:p-3 max-w-xs relative">
          <div className="text-xs sm:text-sm text-gray-800">
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
            // Resize iframe to accommodate expanded widget
            resizeIframe(400);
          }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: settings.primaryColor || '#00bc7d' }}
          title={`Chat with ${settings.assistantName}`}
        >
          {imageData ? (
            <img 
              src={imageData} 
              alt="Chat" 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
            />
          ) : (
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
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
      <div className="fixed bottom-4 right-4 z-50 w-72 sm:w-96 h-80 sm:h-96 bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 flex flex-col max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]">
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
      <div className="flex-1 p-1 sm:p-2 overflow-auto custom-scrollbar space-y-4 text-sm sm:text-base">
        {messages.map((m, idx) => (
          <div key={idx} className={m.type === 'user' ? 'text-right' : ''}>
            <div 
              className={`inline-block px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg max-w-[95%] break-words ${
                m.type === 'user' 
                  ? 'text-white' 
                  : (m.type === 'bot' 
                    ? 'bg-gray-100 text-gray-800' 
                    : 'bg-yellow-50 text-yellow-800')
              }`}
              style={m.type === 'user' ? { backgroundColor: settings.primaryColor || '#00bc7d' } : {}}
            >
              {m.type === 'bot'
                ? renderBotContent(m.content)
                : (m.type === 'user'
                  ? m.content
                  : `${m.type.toUpperCase()}: ${m.content}`)}
            </div>
          </div>
        ))}
        {!messages.length && (
          <div className="text-gray-500 text-xs sm:text-sm">Connecting to chat...</div>
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
      <div className="p-2 sm:p-3 border-t flex gap-1 sm:gap-2">
        <input
          className="flex-1 border border-gray-300 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base"
          placeholder={connected ? 'Type your message...' : 'Connecting...'}
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


