'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';

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
  const wsRef = useRef<WebSocket | null>(null);

  const fullWsUrl = useMemo(() => {
    const base = rawWs.endsWith('/ws') ? rawWs : (rawWs.endsWith('/') ? `${rawWs}ws` : `${rawWs}/ws`);
    const url = new URL(base);
    url.searchParams.set('user_id', userId || 'PUBLIC_USER_ID');
    return url.toString();
  }, [rawWs, userId]);

  useEffect(() => {
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
      // Optional: greet
      ws!.send(JSON.stringify({ type: 'user', content: 'Hi' }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as AnyMessage;
        setMessages((prev) => [...prev, msg]);
        if ((msg as WarnMessage).type === 'warn' || (msg as WarnMessage).type === 'error') return;
      } catch (err) {
        setMessages((prev) => [...prev, { type: 'warn', content: 'Malformed message from server' }]);
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
  }, [fullWsUrl]);

  const sendText = (text: string) => {
    const value = text.trim();
    if (!value || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'user', content: value }));
    setMessages((prev) => [...prev, { type: 'user', content: value }]);
  };

  const send = () => {
    const text = input;
    sendText(text);
    setInput('');
  };

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /#button#([\s\S]*?)#button#/gi; // case-insensitive, match across lines
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
            className="inline-flex items-center rounded-full bg-[#00bc7d] text-white text-xs font-medium px-3 py-1.5 shadow-sm hover:bg-[#00a56f] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#00bc7d] active:translate-y-px transition mr-2 mt-1 whitespace-normal break-words"
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

  return (
    <div className="min-h-[560px] w-[360px] bg-white flex flex-col">
      <div className="p-3 border-b text-sm font-medium">Assistly Chatbot</div>
      <div className="flex-1 p-3 overflow-auto thin-scrollbar space-y-2 text-sm">
        {messages.map((m, idx) => (
          <div key={idx} className={m.type === 'user' ? 'text-right' : ''}>
            <div className={`inline-block px-3 py-2 rounded-lg ${m.type === 'user' ? 'bg-[#00bc7d] text-white' : (m.type === 'bot' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-50 text-yellow-800')}`}>
              {m.type === 'bot'
                ? renderBotContent(m.content)
                : (m.type === 'user'
                  ? m.content
                  : `${m.type.toUpperCase()}: ${m.content}`)}
            </div>
            {/* step is intentionally not displayed */}
          </div>
        ))}
        {!messages.length && (
          <div className="text-gray-500 text-sm">Connecting to chat...</div>
        )}
      </div>
      <div className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder={connected ? 'Type your message...' : 'Connecting...'}
          disabled={!connected}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn-primary text-sm" onClick={send} disabled={!connected}>Send</button>
      </div>
    </div>
  );
}


