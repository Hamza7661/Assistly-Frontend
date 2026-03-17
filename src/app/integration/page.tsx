'use client';

import { useMemo, useState, useEffect } from 'react';
import { ProtectedRoute, NoAppEmptyState } from '@/components';
import Navigation from '@/components/Navigation';
import CalendarAvailabilityRules from '@/components/CalendarAvailabilityRules';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { integrationService } from '@/services/integrationService';
import { X } from 'lucide-react';

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const ChatbotIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H7.828a2 2 0 00-1.414.586l-2.12 2.12A1 1 0 012 20V6a2 2 0 012-2z"/>
    <path fill="white" d="M7 9h10M7 12h7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function IntegrationPage() {
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
  const appId = currentApp?.id || '';
  const whatsappNumber = currentApp?.whatsappNumber || '';

  const scriptSnippet = useMemo(() => {
    return `<script src="${appUrl}/widget.js" data-assistly-app-id="${appId}" data-assistly-base-url="${appUrl}"></script>`;
  }, [appUrl, appId]);

  const whatsappScriptSnippet = useMemo(() => {
    if (!whatsappNumber) return '';
    return `<script src="${appUrl}/whatsapp-widget.js" data-whatsapp-number="${whatsappNumber}" data-message="Hello! I'd like to chat."></script>`;
  }, [appUrl, whatsappNumber]);

  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [integration, setIntegration] = useState<{ calendarConnected?: boolean; calendarProvider?: string | null; calendarAccountEmail?: string | null } | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [exceptionsDialogOpen, setExceptionsDialogOpen] = useState(false);

  useEffect(() => {
    if (!appId) return;
    integrationService.getSettings(appId).then((res) => {
      setIntegration(res.data?.integration ?? null);
    }).catch(() => setIntegration(null));
  }, [appId]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const calendar = params.get('calendar');
    if (calendar === 'connected' || calendar === 'error') {
      setCalendarError(calendar === 'error' ? 'Could not connect calendar.' : null);
      if (appId) {
        integrationService.getSettings(appId).then((res) => setIntegration(res.data?.integration ?? null)).catch(() => {});
      }
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/integration');
    }
  }, [appId]);

  const handleConnectCalendar = async () => {
    if (!appId) return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const url = await integrationService.getCalendarAuthUrl(appId);
      if (url) window.location.href = url;
      else setCalendarError('Could not get calendar auth URL.');
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Failed to start calendar connection.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!appId) return;
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      await integrationService.disconnectCalendar(appId);
      setIntegration((prev) => (prev ? { ...prev, calendarConnected: false, calendarProvider: null, calendarAccountEmail: null } : null));
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Failed to disconnect.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptSnippet);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1200);
    } catch {}
  };

  const copyWhatsappScript = async () => {
    try {
      await navigator.clipboard.writeText(whatsappScriptSnippet);
      setCopiedWhatsapp(true);
      setTimeout(() => setCopiedWhatsapp(false), 1200);
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
            <p className="text-gray-600 mb-8">Embed your chatbot and WhatsApp button on any website with a single line of code.</p>

            {/* Chatbot Widget Script */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00bc7d] text-white shrink-0">
                  <ChatbotIcon />
                </span>
                <h2 className="text-lg font-semibold text-gray-900">Chatbot Widget Script</h2>
              </div>
              <p className="text-gray-600 mb-6 ml-11">
                Embed the live chat widget on your website. Visitors can start a conversation directly from any page.
              </p>

              {/* Script snippet */}
              <div className="ml-11">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">
                    Paste this snippet before the closing <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code> tag of your website:
                  </p>
                  <button
                    className="shrink-0 ml-4 text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 transition-colors"
                    onClick={copyScript}
                  >
                    {copiedScript ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                  <pre className="whitespace-pre text-sm text-gray-800 font-mono">
                    {scriptSnippet}
                  </pre>
                </div>
              </div>
            </div>

            {/* WhatsApp Widget Script */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] text-white shrink-0">
                  <WhatsAppIcon />
                </span>
                <h2 className="text-lg font-semibold text-gray-900">WhatsApp Button Script</h2>
              </div>
              <p className="text-gray-600 mb-6 ml-11">
                Add a floating WhatsApp button to your website. Visitors click it and are taken straight to a chat with your number.
              </p>

              {whatsappNumber ? (
                <>
                  {/* Preview */}
                  <div className="ml-11 mb-5 flex items-center gap-3 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#25D366] text-white shrink-0 shadow-sm">
                      <WhatsAppIcon />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">Connected number</p>
                      <p className="text-sm text-gray-500 font-mono">{whatsappNumber}</p>
                    </div>
                    <a
                      href={`https://wa.me/${whatsappNumber.replace(/[^\d+]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-xs font-medium text-[#25D366] hover:underline"
                    >
                      Test link ↗
                    </a>
                  </div>

                  {/* Script snippet */}
                  <div className="ml-11">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600">
                        Paste this snippet before the closing <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code> tag of your website:
                      </p>
                      <button
                        className="shrink-0 ml-4 text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50 transition-colors"
                        onClick={copyWhatsappScript}
                      >
                        {copiedWhatsapp ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                      <pre className="whitespace-pre text-sm text-gray-800 font-mono">
                        {whatsappScriptSnippet}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <div className="ml-11 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800">No WhatsApp number configured</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Add a WhatsApp number to your app to generate the script.{' '}
                      <a href="/apps" className="underline font-medium hover:text-amber-900">Go to Apps →</a>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Calendar – fixed interface: same fields for all providers (Google, Outlook, Calendly) */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <h2 className="text-lg font-semibold text-gray-900">Calendar</h2>
              </div>
              <p className="text-gray-600 mb-6 ml-11">
                Connect a calendar so the chatbot and WhatsApp can show availability and book appointments.
              </p>
              <div className="ml-11">
                {calendarError && (
                  <p className="text-sm text-red-600 mb-3">{calendarError}</p>
                )}
                {integration?.calendarConnected ? (
                  <div className="space-y-4">
                    {/* Connection status row: badge left, Disconnect right */}
                    <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          <span className="text-sm font-medium text-gray-900">
                            Connected ({integration.calendarProvider === 'google_calendar' ? 'Google Calendar' : integration.calendarProvider || 'Calendar'})
                          </span>
                        </div>
                        {integration.calendarAccountEmail && (
                          <p className="text-sm text-gray-500 font-mono pl-3">{integration.calendarAccountEmail}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectCalendar}
                        disabled={calendarLoading}
                        className="text-sm border border-red-200 rounded-lg px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors shrink-0"
                      >
                        {calendarLoading ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                    {/* Availability section: label + two actions */}
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Availability</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAvailabilityDialogOpen(true)}
                          className="text-sm border border-blue-200 rounded-lg px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          Availability rules
                        </button>
                        <button
                          type="button"
                          onClick={() => setExceptionsDialogOpen(true)}
                          className="text-sm border border-blue-200 rounded-lg px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          Date exceptions
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-sm text-gray-600">Not connected</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectCalendar}
                      disabled={calendarLoading}
                      className="text-sm rounded-lg px-4 py-2 bg-[#00bc7d] text-white hover:bg-[#00a36d] disabled:opacity-50"
                    >
                      {calendarLoading ? 'Connecting…' : 'Connect Google Calendar'}
                    </button>
                    <span className="text-xs text-gray-500">Outlook &amp; Calendly coming soon.</span>
                  </div>
                )}
              </div>
              {availabilityDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setAvailabilityDialogOpen(false)}>
                  <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Availability rules</h3>
                      <button type="button" onClick={() => setAvailabilityDialogOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" aria-label="Close">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="p-6">
                      <CalendarAvailabilityRules appId={appId} dialogMode="availability" onClose={() => setAvailabilityDialogOpen(false)} />
                    </div>
                  </div>
                </div>
              )}
              {exceptionsDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setExceptionsDialogOpen(false)}>
                  <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative min-w-0">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Date exceptions</h3>
                      <button type="button" onClick={() => setExceptionsDialogOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" aria-label="Close">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="p-6 min-w-0">
                      <CalendarAvailabilityRules appId={appId} dialogMode="exceptions" onClose={() => setExceptionsDialogOpen(false)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Integrate with */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Integrate with</h2>
              <p className="text-gray-600 mb-6">Sync leads and conversations with your favourite CRM and business tools. More integrations on the way.</p>
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
