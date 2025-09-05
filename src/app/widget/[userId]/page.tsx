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

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'user', content: text }));
    setMessages((prev) => [...prev, { type: 'user', content: text }]);
    setInput('');
  };

  return (
    <div className="min-h-[560px] w-[360px] bg-white flex flex-col">
      <div className="p-3 border-b text-sm font-medium">Assistly Chatbot</div>
      <div className="flex-1 p-3 overflow-auto space-y-2 text-sm">
        {messages.map((m, idx) => (
          <div key={idx} className={m.type === 'user' ? 'text-right' : ''}>
            <div className={`inline-block px-3 py-2 rounded-lg ${m.type === 'user' ? 'bg-[#00bc7d] text-white' : (m.type === 'bot' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-50 text-yellow-800')}`}>
              {m.type === 'bot' || m.type === 'user' ? m.content : `${m.type.toUpperCase()}: ${m.content}`}
            </div>
            {'step' in m && m.step && (
              <div className="text-[10px] text-gray-500 mt-1">step: {m.step}</div>
            )}
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


