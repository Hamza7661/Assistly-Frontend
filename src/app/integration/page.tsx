'use client';

import { useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function IntegrationPage() {
  const { user } = useAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const userId = user?._id || 'PUBLIC_USER_ID';
  const snippet = useMemo(() => {
    const src = `${appUrl}/widget/${userId}`;
    return `<iframe src="${src}" width="360" height="560" frameborder="0" style="position:absolute;bottom:0;right:1rem;border:1px solid #e5e7eb;border-radius:12px;" allow="clipboard-write; clipboard-read"></iframe>`;
  }, [appUrl, userId]);
  const scriptSnippet = useMemo(() => {
    const src = `${appUrl}/widget/${userId}`;
    return `<script>(function(){var f=document.createElement('iframe');f.src='${src}';f.width='360';f.height='560';f.frameBorder='0';f.allow='clipboard-write; clipboard-read';f.style.cssText='position:absolute;bottom:0;right:1rem;border:1px solid #e5e7eb;border-radius:12px;';document.body.appendChild(f);})();</script>`;
  }, [appUrl, userId]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  const [copiedScript, setCopiedScript] = useState(false);
  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptSnippet);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1200);
    } catch {}
  };

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Integration</h1>
          <p className="text-gray-600 mb-6">Copy and paste this code snippet into your website to embed the chatbot.</p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative">
            <button
              className="absolute top-2 right-2 text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
              onClick={copy}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <pre className="whitespace-pre-wrap break-all text-sm pr-16">
{snippet}
            </pre>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            This iframe renders a minimal chatbot UI and connects to your bot over WebSocket.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6 relative">
            <button
              className="absolute top-2 right-2 text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
              onClick={copyScript}
            >
              {copiedScript ? 'Copied' : 'Copy'}
            </button>
            <div className="text-sm font-medium text-gray-700 mb-2">Attach via script</div>
            <pre className="whitespace-pre-wrap break-all text-sm pr-16">
{scriptSnippet}
            </pre>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


