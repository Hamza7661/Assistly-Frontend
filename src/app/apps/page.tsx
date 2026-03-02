'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService, useIntegrationService, useLeadService, useChatbotWorkflowService } from '@/services';
import { useQuestionnareService } from '@/services';
import { QuestionnareType } from '@/enums/QuestionnareType';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Clock, Building2, Phone, Power, PowerOff, LayoutList, Layers, GitBranch, Users, ExternalLink, MessageCircle, Plug, User, ClipboardList, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import ConfirmModal from '@/components/ConfirmModal';

type AppStats = { leadTypes: number; services: number; workflows: number; leads: number };

export default function AppsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { apps, currentApp, switchApp, refreshApps } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(true);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);
  const [restoringAppId, setRestoringAppId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [allApps, setAllApps] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    appId: string | null;
    appName: string;
    app?: any;
    otherAppsWithSameNumber?: any[];
  }>({
    isOpen: false,
    appId: null,
    appName: '',
    app: undefined,
    otherAppsWithSameNumber: []
  });
  const [deleteTransferToAppId, setDeleteTransferToAppId] = useState<string | null>(null);
  const [appStats, setAppStats] = useState<AppStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load stats for the current (selected) app
  useEffect(() => {
    const appId = currentApp?.id;
    if (!appId) {
      setAppStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    (async () => {
      try {
        const [integrationSvc, questionnareSvc, workflowSvc, leadSvc] = await Promise.all([
          useIntegrationService(),
          useQuestionnareService(),
          useChatbotWorkflowService(),
          useLeadService()
        ]);
        const [integrationRes, plansRes, workflowsRes, leadsRes] = await Promise.all([
          integrationSvc.getSettings(appId),
          questionnareSvc.list(appId, QuestionnareType.SERVICE_PLAN),
          workflowSvc.list(appId, true),
          leadSvc.listByApp(appId, { limit: 1, page: 1 })
        ]);
        if (cancelled) return;
        const leadTypes = (integrationRes?.data?.integration?.leadTypeMessages ?? []).length;
        const services = plansRes?.data?.faqs?.length ?? plansRes?.data?.count ?? 0;
        // Parent workflows only (isRoot), exclude inactive/deleted
        const workflowList = workflowsRes?.data?.workflows ?? [];
        const workflows = workflowList.filter(
          (w: any) => w?.isRoot === true && w?.isActive !== false
        ).length;
        // Backend returns total in data.pagination.total for app-scoped leads
        const leadsData = leadsRes?.data as { pagination?: { total: number }; count?: number; leads?: unknown[] } | undefined;
        const leads =
          leadsData?.pagination?.total ??
          leadsData?.count ??
          (Array.isArray(leadsData?.leads) ? leadsData.leads.length : 0) ??
          0;
        setAppStats({ leadTypes, services, workflows, leads });
      } catch {
        if (!cancelled) setAppStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentApp?.id]);

  useEffect(() => {
    const loadApps = async () => {
      setIsLoading(true);
      try {
        const appService = await useAppService();
        const response = await appService.getApps(showInactive);
        if (response.status === 'success' && response.data?.apps) {
          setAllApps(response.data.apps);
          // Also refresh context apps
          await refreshApps();
        }
      } catch (err) {
        console.error('Failed to load apps:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadApps();
  }, [showInactive]);

  useEffect(() => {
    if (apps.length === 0 && !showInactive) {
      refreshApps().finally(() => setIsLoading(false));
    } else if (!showInactive) {
      setIsLoading(false);
    }
  }, [apps.length, showInactive]);

  // Count apps per WhatsApp number: show "Use this number" button when multiple apps share the number and this one doesn't use it yet
  const appsToShow = showInactive ? allApps : apps;
  const countByWhatsAppNumber = useMemo(() => {
    const map = new Map<string, number>();
    appsToShow.forEach((app: any) => {
      const num = (app.whatsappNumber || app.twilioPhoneNumber)?.trim?.();
      if (num) map.set(num, (map.get(num) || 0) + 1);
    });
    return map;
  }, [appsToShow]);

  // Group apps by phone number for display
  const appsGroupedByNumber = useMemo(() => {
    const groupMap = new Map<string, any[]>();
    const noNumberKey = '__no_number__';
    appsToShow.forEach((app: any) => {
      const num = (app.whatsappNumber || app.twilioPhoneNumber)?.trim?.();
      const key = num || noNumberKey;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(app);
    });
    // Order: numbers first (sort by number string), then "No number" last
    const entries: { number: string; apps: any[] }[] = [];
    groupMap.forEach((apps, key) => {
      entries.push({ number: key === noNumberKey ? noNumberKey : key, apps });
    });
    entries.sort((a, b) => {
      if (a.number === noNumberKey) return 1;
      if (b.number === noNumberKey) return -1;
      return a.number.localeCompare(b.number);
    });
    return entries;
  }, [appsToShow]);

  const handleDeleteClick = (appId: string, appName: string) => {
    const app = appsToShow.find((a: any) => (a.id === appId || a._id === appId));
    const num = (app?.whatsappNumber || app?.twilioPhoneNumber)?.trim?.();
    const otherAppsWithSameNumber =
      app?.usesTwilioNumber && num
        ? appsToShow.filter(
            (a: any) =>
              a.id !== appId &&
              a._id !== appId &&
              a.isActive !== false &&
              ((a.whatsappNumber || a.twilioPhoneNumber)?.trim?.() === num)
          )
        : [];
    setConfirmDelete({
      isOpen: true,
      appId,
      appName,
      app,
      otherAppsWithSameNumber
    });
    if (otherAppsWithSameNumber.length === 1) {
      setDeleteTransferToAppId(otherAppsWithSameNumber[0].id || otherAppsWithSameNumber[0]._id);
    } else {
      setDeleteTransferToAppId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.appId) return;

    const appId = confirmDelete.appId;
    const transferToId = confirmDelete.otherAppsWithSameNumber?.length
      ? deleteTransferToAppId || (confirmDelete.otherAppsWithSameNumber.length === 1 ? confirmDelete.otherAppsWithSameNumber[0].id || confirmDelete.otherAppsWithSameNumber[0]._id : null)
      : null;

    setConfirmDelete({ isOpen: false, appId: null, appName: '', app: undefined, otherAppsWithSameNumber: [] });
    setDeleteTransferToAppId(null);
    setDeletingAppId(appId);
    try {
      const appService = await useAppService();
      if (transferToId) {
        await appService.setUsesTwilioNumber(transferToId);
      }
      const response = await appService.deleteApp(appId);
      
      if (response.status === 'success') {
        toast.success('App deleted successfully');
        await refreshApps();
        // Reload all apps to update the list
        const allAppsResponse = await appService.getApps(showInactive);
        if (allAppsResponse.status === 'success' && allAppsResponse.data?.apps) {
          setAllApps(allAppsResponse.data.apps);
        }
        // If deleted app was current app, switch to first available app
        if (currentApp?.id === appId) {
          const remainingApps = apps.filter(a => a.id !== appId);
          if (remainingApps.length > 0) {
            await switchApp(remainingApps[0].id);
          } else {
            // No apps left, redirect to create page
            router.push('/apps/create');
          }
        }
      } else {
        toast.error(response.message || 'Failed to delete app');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete app');
    } finally {
      setDeletingAppId(null);
    }
  };

  const handleSetAsCurrent = async (appId: string) => {
    try {
      const app = appsToShow.find((a: any) => a.id === appId || a._id === appId);
      if (app?.whatsappNumber?.trim?.()) {
        const appService = await useAppService();
        await appService.setUsesTwilioNumber(appId);
      }
      await switchApp(appId);
      await refreshApps();
      toast.success('App set as current; it will now receive leads and use this number for flows.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to set app as current');
    }
  };

  const handleToggleAppStatus = async (appId: string, currentStatus: boolean) => {
    setTogglingAppId(appId);
    try {
      const appService = await useAppService();
      const response = await appService.updateApp(appId, { isActive: !currentStatus });
      
      if (response.status === 'success') {
        toast.success(`App ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
        
        // If disabling the current app, switch to first available active app
        if (currentStatus && currentApp?.id === appId) {
          const allAppsResponse = await appService.getApps(true);
          if (allAppsResponse.status === 'success' && allAppsResponse.data?.apps) {
            const activeApps = allAppsResponse.data.apps.filter((a: any) => a.isActive && a.id !== appId);
            if (activeApps.length > 0) {
              await switchApp(activeApps[0].id);
            } else {
              // No active apps left, redirect to create page
              router.push('/apps/create');
            }
          }
        }
        
        await refreshApps();
        // Reload all apps to update the list
        const allAppsResponse = await appService.getApps(showInactive);
        if (allAppsResponse.status === 'success' && allAppsResponse.data?.apps) {
          setAllApps(allAppsResponse.data.apps);
        }
      } else {
        toast.error(response.message || 'Failed to update app status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update app status');
    } finally {
      setTogglingAppId(null);
    }
  };

  const handleRestoreApp = async (appId: string) => {
    setRestoringAppId(appId);
    try {
      const appService = await useAppService();
      const response = await appService.restoreApp(appId);
      if (response.status === 'success') {
        toast.success('App restored successfully');
        await refreshApps();
        const allAppsResponse = await appService.getApps(showInactive);
        if (allAppsResponse.status === 'success' && allAppsResponse.data?.apps) {
          setAllApps(allAppsResponse.data.apps);
        }
      } else {
        const msg = response.message || 'Failed to restore app';
        const isNameConflict = msg.includes('already exists');
        isNameConflict ? toast.warning(msg) : toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to restore app';
      const isNameConflict = err.response?.status === 409 || msg.includes('already exists');
      isNameConflict ? toast.warning(msg) : toast.error(msg);
    } finally {
      setRestoringAppId(null);
    }
  };

  const getIndustryLabel = (industryValue: string) => {
    return INDUSTRIES_LIST.find(i => i.value === industryValue)?.label || industryValue;
  };

  const getWhatsAppStatusBadge = (status?: string, hasNumber?: boolean) => {
    // When a number is given, show Registered (not Pending)
    const effectiveStatus = hasNumber && (status === 'pending' || !status) ? 'registered' : status;
    switch (effectiveStatus) {
      case 'registered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            Registered
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  // Stat card colours
  const statCards = [
    { label: 'Lead Types',        value: appStats?.leadTypes  ?? 0, icon: LayoutList, href: '/settings/chatbot',    iconBg: 'bg-[#f0fdf9]',   iconColor: 'text-[#00bc7d]', linkLabel: 'Manage' },
    { label: 'Services',          value: appStats?.services   ?? 0, icon: Layers,     href: '/treatment-plans',     iconBg: 'bg-blue-50',      iconColor: 'text-blue-500',  linkLabel: 'Manage' },
    { label: 'Active Workflows',  value: appStats?.workflows  ?? 0, icon: GitBranch,  href: '/chatbot-workflow',    iconBg: 'bg-violet-50',    iconColor: 'text-violet-500',linkLabel: 'Manage' },
    { label: 'Total Leads',       value: appStats?.leads      ?? 0, icon: Users,      href: '/leads',               iconBg: 'bg-amber-50',     iconColor: 'text-amber-500', linkLabel: 'View' },
  ];

  const quickLinks = [
    { href: '/settings/chatbot',   icon: MessageCircle, label: 'Chat Settings' },
    { href: '/integration',        icon: Plug,          label: 'Integration' },
    { href: '/leads',              icon: Users,         label: 'Leads' },
    { href: '/treatment-plans',    icon: ClipboardList, label: 'Service Plans' },
    { href: '/chatbot-workflow',   icon: FileText,      label: 'Conversation Flows' },
    { href: '/settings',           icon: User,          label: 'Account Settings' },
  ];

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Apps</h1>
                  <p className="text-gray-500 mt-1 text-sm">Each app has its own number, flows, and leads.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm animate-pulse">
                    <div className="h-1.5 bg-gray-100" />
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-200" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-28 rounded bg-gray-200" />
                          <div className="h-3 w-20 rounded bg-gray-100" />
                        </div>
                      </div>
                      <div className="h-9 w-full rounded-lg bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
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

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Apps</h1>
                <p className="text-gray-500 mt-1 text-sm">Each app has its own WhatsApp number, flows, plans, and leads.</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-sm text-gray-600">Show inactive</span>
                  <button
                    type="button"
                    onClick={() => setShowInactive(!showInactive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00bc7d] focus:ring-offset-2 ${
                      showInactive ? 'bg-[#00bc7d]' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={showInactive}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showInactive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <button
                  onClick={() => router.push('/apps/create')}
                  className="btn-primary flex items-center gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  New App
                </button>
              </div>
            </div>

            {/* ── Stat cards ──────────────────────────────────────────── */}
            {currentApp && (
              <div className="mb-8">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Overview · <span className="text-gray-600 normal-case font-medium tracking-normal">{currentApp.name}</span>
                </p>
                {statsLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-pulse flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-gray-100 shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-3 w-20 rounded bg-gray-100" />
                          <div className="h-6 w-10 rounded bg-gray-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {statCards.map(({ label, value, icon: Icon, href, iconBg, iconColor, linkLabel }) => (
                      <a
                        key={label}
                        href={href}
                        className="bg-white border border-gray-200 rounded-xl p-3 sm:p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex items-center gap-2 sm:gap-4 group"
                      >
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-500 truncate">{label}</p>
                          <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-300 group-hover:text-gray-400 shrink-0 self-start mt-1 hidden sm:block" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── App cards ───────────────────────────────────────────── */}
            {(() => {
              const appsToShow = showInactive ? allApps : apps;
              return appsToShow.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {showInactive ? 'No inactive apps' : 'No apps yet'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    {showInactive ? 'All your apps are currently active.' : 'Create your first app to get started.'}
                  </p>
                  {!showInactive && (
                    <button
                      onClick={() => router.push('/apps/create')}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Your First App
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {appsToShow.map((app: any) => {
                            const num = (app.whatsappNumber || app.twilioPhoneNumber)?.trim?.();
                            const sameNumberCount = num ? (countByWhatsAppNumber.get(num) || 0) : 0;
                            const isDashboardCurrent = currentApp?.id === app.id;
                            const initials = app.name?.charAt(0)?.toUpperCase() || '?';

                            return (
                              <div
                                key={app.id || app._id}
                                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
                                  isDashboardCurrent ? 'border-[#00bc7d] border-2' : 'border-gray-200'
                                } ${!app.isActive ? 'opacity-60' : ''}`}
                              >
                                {/* Accent top bar */}
                                <div className={`h-1.5 ${isDashboardCurrent ? 'bg-[#00bc7d]' : app.deletedAt ? 'bg-red-300' : !app.isActive ? 'bg-gray-300' : 'bg-gray-100'}`} />

                                <div className="p-5">
                                  {/* App avatar + name + badges */}
                                  <div className="flex items-start gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 ${isDashboardCurrent ? 'bg-[#00bc7d]' : 'bg-gray-700'}`}>
                                      {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
                                      <p className="text-xs text-gray-500 mt-0.5">{getIndustryLabel(app.industry)}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      {isDashboardCurrent && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#00bc7d] text-white">
                                          Current
                                        </span>
                                      )}
                                      {app.deletedAt ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Deleted</span>
                                      ) : !app.isActive ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>
                                      ) : !isDashboardCurrent ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                          Active
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  {/* WhatsApp number pill */}
                                  {num ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg mb-4">
                                      <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                      <span className="text-sm font-mono text-gray-700 truncate flex-1">{num}</span>
                                      {getWhatsAppStatusBadge(app.whatsappNumberStatus, !!num)}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg mb-4">
                                      <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                      <span className="text-xs text-amber-600">No WhatsApp number</span>
                                    </div>
                                  )}

                                  {/* Description */}
                                  {app.description && (
                                    <p className="text-xs text-gray-400 line-clamp-2 mb-4">{app.description}</p>
                                  )}

                                  {/* Actions */}
                                  <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                                    {!app.usesTwilioNumber && app.isActive && !app.deletedAt && sameNumberCount > 1 && (
                                      <button onClick={() => handleSetAsCurrent(app.id)} className="btn-secondary text-xs flex-1 py-1.5">
                                        Use this number
                                      </button>
                                    )}
                                    {app.deletedAt ? (
                                      <button
                                        onClick={() => handleRestoreApp(app.id)}
                                        disabled={restoringAppId === app.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-800 hover:bg-green-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        <Power className="h-3.5 w-3.5" /> Restore
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-1 ml-auto">
                                        <button
                                          onClick={() => handleToggleAppStatus(app.id, app.isActive)}
                                          disabled={togglingAppId === app.id}
                                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                            app.isActive
                                              ? 'text-orange-500 hover:bg-orange-50'
                                              : 'text-green-600 hover:bg-green-50'
                                          }`}
                                          title={app.isActive ? 'Disable app' : 'Enable app'}
                                        >
                                          {app.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                        </button>
                                        <button
                                          onClick={() => router.push(`/apps/${app.id}/edit`)}
                                          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                                          title="Edit app"
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteClick(app.id, app.name)}
                                          disabled={deletingAppId === app.id}
                                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                          title="Delete app"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                </div>
              );
            })()}

            {/* ── Quick links ─────────────────────────────────────────── */}
            <div className="mt-10 pt-8 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Quick Links</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {quickLinks.map(({ href, icon: Icon, label }) => (
                  <a
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-[#00bc7d] hover:bg-[#f0fdf9] text-center transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#dcfcef] flex items-center justify-center transition-colors">
                      <Icon className="h-4 w-4 text-gray-500 group-hover:text-[#00bc7d] transition-colors" />
                    </div>
                    <span className="text-xs text-gray-600 group-hover:text-[#00895c] font-medium leading-tight">{label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          onClose={() => {
            setConfirmDelete({ isOpen: false, appId: null, appName: '', app: undefined, otherAppsWithSameNumber: [] });
            setDeleteTransferToAppId(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete App"
          message={
            confirmDelete.otherAppsWithSameNumber?.length === 1
              ? `${confirmDelete.otherAppsWithSameNumber[0].name} will use this number for leads and flows. Are you sure you want to delete "${confirmDelete.appName}"? This action cannot be undone.`
              : confirmDelete.otherAppsWithSameNumber && confirmDelete.otherAppsWithSameNumber.length > 1
                ? `Choose which app should use this number, then confirm. Are you sure you want to delete "${confirmDelete.appName}"? This action cannot be undone.`
                : `Are you sure you want to delete "${confirmDelete.appName}"? This action cannot be undone. All associated data including workflows, FAQs, and leads will be permanently deleted.`
          }
          confirmText="Delete App"
          cancelText="Cancel"
          confirmButtonClass="btn-danger"
          isLoading={deletingAppId === confirmDelete.appId}
          confirmDisabled={
            (confirmDelete.otherAppsWithSameNumber?.length ?? 0) > 1 && !deleteTransferToAppId
          }
        >
          {confirmDelete.otherAppsWithSameNumber && confirmDelete.otherAppsWithSameNumber.length > 1 && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">App that will use this number</span>
              <select
                value={deleteTransferToAppId || ''}
                onChange={(e) => setDeleteTransferToAppId(e.target.value || null)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#00bc7d] focus:outline-none focus:ring-1 focus:ring-[#00bc7d]"
              >
                <option value="">Select an app...</option>
                {confirmDelete.otherAppsWithSameNumber.map((a: any) => (
                  <option key={a.id || a._id} value={a.id || a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </ConfirmModal>
      </div>
    </ProtectedRoute>
  );
}
