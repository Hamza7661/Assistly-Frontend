'use client';

import { useMemo, useState } from 'react';
import { ProtectedRoute, NoAppEmptyState } from '@/components';
import Navigation from '@/components/Navigation';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';

export default function IntegrationPage() {
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
  const appId = currentApp?.id || '';

  const scriptSnippet = useMemo(() => {
    return `<script src="${appUrl}/widget.js" data-assistly-app-id="${appId}" data-assistly-base-url="${appUrl}"></script>`;
  }, [appUrl, appId]);

  const [copiedScript, setCopiedScript] = useState(false);
  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptSnippet);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1200);
    } catch {}
  };

  if (isLoadingApp) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00bc7d]"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!currentApp || !appId) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <NoAppEmptyState
                title="Configure Your Chatbot Integration"
                description="Create or select an app first to get the integration code and connect to other platforms."
              />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Integration</h1>
            <p className="text-gray-600 mb-8">Copy the integration code and connect your chatbot to other tools.</p>

            {/* Integration Code Section */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Code</h2>
              <p className="text-gray-600 mb-6">Copy and paste this JavaScript snippet into your website to embed the chatbot.</p>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative">
                <button
                  className="absolute top-2 right-2 text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
                  onClick={copyScript}
                >
                  {copiedScript ? 'Copied' : 'Copy'}
                </button>
                <pre className="whitespace-pre-wrap break-all text-sm pr-16">
                  {scriptSnippet}
                </pre>
              </div>
            </div>

            {/* Integrate with */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Integrate with</h2>
              <p className="text-gray-600 mb-6">Connect your chatbot to these platforms (more coming soon).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Slack', desc: 'Send leads and notifications to Slack', logo: '/integrations/slack.svg', comingSoon: true },
                  { name: 'Salesforce', desc: 'Sync leads and conversations to Salesforce', logo: '/integrations/salesforce.svg', comingSoon: true },
                  { name: 'Zoho', desc: 'Integrate with Zoho CRM and products', logo: '/integrations/zoho.svg', comingSoon: true },
                  { name: 'Act!', desc: 'Connect to Act! CRM', logo: '/integrations/act.svg', comingSoon: true },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center opacity-90"
                  >
                    <div className="w-12 h-12 mb-3 flex items-center justify-center rounded-lg bg-gray-50 overflow-hidden shrink-0 relative">
                      <img
                        src={item.logo}
                        alt=""
                        className="w-8 h-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-400" aria-hidden>
                        {item.name.charAt(0)}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                    {item.comingSoon && (
                      <span className="mt-3 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Coming soon</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
