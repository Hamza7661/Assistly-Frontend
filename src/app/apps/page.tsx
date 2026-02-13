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
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Clock, Building2, Phone, Power, PowerOff, LayoutList, Layers, GitBranch, Users, ExternalLink, DollarSign, MessageCircle, Plug, User, ClipboardList, FileText } from 'lucide-react';
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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My Apps</h1>
                  <p className="text-gray-600 mt-2">Manage your apps. Each app has its own industry, flows, plans, and integrations.</p>
                </div>
              </div>
              <div className="min-h-[40vh] flex items-center justify-center">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm animate-pulse">
                      <div className="h-5 w-24 rounded bg-gray-200 mb-3" />
                      <div className="h-4 w-full rounded bg-gray-100 mb-2" />
                      <div className="h-4 w-3/4 rounded bg-gray-100 mb-4" />
                      <div className="h-9 w-20 rounded bg-gray-100" />
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

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Apps</h1>
              <p className="text-gray-600 mt-2">Manage your apps. Each app has its own industry, flows, plans, and integrations.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show inactive apps</span>
                <button
                  type="button"
                  onClick={() => setShowInactive(!showInactive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00bc7d] focus:ring-offset-2 ${
                    showInactive ? 'bg-[#00bc7d]' : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={showInactive}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showInactive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <button
                onClick={() => router.push('/apps/create')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Create New App
              </button>
            </div>
          </div>

          {/* Stat cards for selected app */}
          {currentApp && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-500 mb-3">
                Stats for <span className="text-gray-900">{currentApp.name}</span>
              </h2>
              {statsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col animate-pulse">
                      <div className="flex items-center gap-2 text-gray-400 mb-1">
                        <div className="h-5 w-5 rounded bg-gray-200" />
                        <div className="h-4 w-20 rounded bg-gray-200" />
                      </div>
                      <div className="h-8 w-12 rounded bg-gray-200 mt-2" />
                      <div className="h-4 w-10 rounded bg-gray-100 mt-3" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Lead types */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <LayoutList className="h-5 w-5" />
                      <span className="text-sm font-medium">Lead types</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      {appStats?.leadTypes ?? 0}
                    </div>
                    <a
                      href="/settings/chatbot"
                      className="mt-3 text-sm font-medium text-[#00bc7d] hover:text-[#00a870] inline-flex items-center gap-1"
                    >
                      Add
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {/* Services */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Layers className="h-5 w-5" />
                      <span className="text-sm font-medium">Services</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      {appStats?.services ?? 0}
                    </div>
                    <a
                      href="/treatment-plans"
                      className="mt-3 text-sm font-medium text-[#00bc7d] hover:text-[#00a870] inline-flex items-center gap-1"
                    >
                      Add
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {/* Workflows */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <GitBranch className="h-5 w-5" />
                      <span className="text-sm font-medium">Workflows in use</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      {appStats?.workflows ?? 0}
                    </div>
                    <a
                      href="/chatbot-workflow"
                      className="mt-3 text-sm font-medium text-[#00bc7d] hover:text-[#00a870] inline-flex items-center gap-1"
                    >
                      Add
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {/* Leads */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <Users className="h-5 w-5" />
                      <span className="text-sm font-medium">Leads</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">
                      {appStats?.leads ?? 0}
                    </div>
                    <a
                      href="/leads"
                      className="mt-3 text-sm font-medium text-[#00bc7d] hover:text-[#00a870] inline-flex items-center gap-1"
                    >
                      See
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {(() => {
            const appsToShow = showInactive ? allApps : apps;
            return appsToShow.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {showInactive ? 'No inactive apps' : 'No apps yet'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {showInactive ? 'All your apps are active' : 'Create your first app to get started'}
                </p>
                {!showInactive && (
                  <button
                    onClick={() => router.push('/apps/create')}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Create Your First App
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {appsGroupedByNumber.map(({ number: groupNumber, apps: groupApps }) => {
                  const isNoNumber = groupNumber === '__no_number__';
                  return (
                    <section key={isNoNumber ? 'no-number' : groupNumber}>
                      <div className="flex items-center gap-2 mb-4">
                        <Phone className="h-5 w-5 text-gray-500" />
                        <h2 className="text-base font-semibold text-gray-800">
                          {isNoNumber ? 'No number' : groupNumber}
                        </h2>
                        {!isNoNumber && groupApps.length > 1 && (
                          <span className="text-sm text-gray-500">
                            ({groupApps.length} apps)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groupApps.map((app: any) => {
                          const num = (app.whatsappNumber || app.twilioPhoneNumber)?.trim?.();
                          const sameNumberCount = num ? (countByWhatsAppNumber.get(num) || 0) : 0;
                          const isDashboardCurrent = currentApp?.id === app.id;
                          const usesThisNumber = !!num && !!app.usesTwilioNumber;
                          return (
                            <div
                              key={app.id || app._id}
                              className={`border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow ${
                                isDashboardCurrent ? 'border-[#00bc7d] border-2' : 'border-gray-200'
                              } ${!app.isActive ? 'opacity-60' : ''}`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="text-lg font-semibold text-gray-900">{app.name}</h3>
                                    {app.isActive && !app.deletedAt && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                      </span>
                                    )}
                                    {app.deletedAt && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Deleted
                                      </span>
                                    )}
                                    {!app.isActive && !app.deletedAt && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                        Inactive
                                      </span>
                                    )}
                                    {isDashboardCurrent && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#00bc7d] text-white">
                                        Current app
                                      </span>
                                    )}
                                    {usesThisNumber && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="This app is using this number for leads and flows">
                                        Using this number
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Building2 className="h-4 w-4" />
                                  <span>{getIndustryLabel(app.industry)}</span>
                                </div>
                                {num && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone className="h-4 w-4" />
                                    <span className="truncate">{num}</span>
                                    {getWhatsAppStatusBadge(app.whatsappNumberStatus, !!num)}
                                  </div>
                                )}
                                {app.description && (
                                  <p className="text-sm text-gray-500 line-clamp-2">{app.description}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                                {!app.usesTwilioNumber && app.isActive && !app.deletedAt && sameNumberCount > 1 && (
                                  <button
                                    onClick={() => handleSetAsCurrent(app.id)}
                                    className="btn-secondary text-sm flex-1"
                                  >
                                    Use this number
                                  </button>
                                )}
                                {app.deletedAt && (
                                  <button
                                    onClick={() => handleRestoreApp(app.id)}
                                    disabled={restoringAppId === app.id}
                                    className="p-2 rounded disabled:opacity-50 text-green-600 hover:text-green-900 hover:bg-green-50"
                                    title="Restore app"
                                  >
                                    <Power className="h-4 w-4" />
                                  </button>
                                )}
                                {!app.deletedAt && (
                                  <>
                                    <button
                                      onClick={() => handleToggleAppStatus(app.id, app.isActive)}
                                      disabled={togglingAppId === app.id}
                                      className={`p-2 rounded disabled:opacity-50 ${
                                        app.isActive
                                          ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                                          : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                      }`}
                                      title={app.isActive ? 'Disable app' : 'Enable app'}
                                    >
                                      {app.isActive ? (
                                        <PowerOff className="h-4 w-4" />
                                      ) : (
                                        <Power className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => router.push(`/apps/${app.id}/edit`)}
                                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                      title="Edit app"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClick(app.id, app.name)}
                                      disabled={deletingAppId === app.id}
                                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded disabled:opacity-50"
                                      title="Delete app"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            );
          })()}

          {/* Quick links */}
          <div className="mt-10 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Quick links</h3>
            <div className="flex flex-wrap gap-3">
              <a href="/pricing" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <DollarSign className="h-4 w-4" />
                Pricing
              </a>
              <a href="/settings/chatbot" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <MessageCircle className="h-4 w-4" />
                Chatbot settings
              </a>
              <a href="/settings" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <User className="h-4 w-4" />
                Account settings
              </a>
              <a href="/integration" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <Plug className="h-4 w-4" />
                Integration
              </a>
              <a href="/leads" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <Users className="h-4 w-4" />
                Leads
              </a>
              <a href="/treatment-plans" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <ClipboardList className="h-4 w-4" />
                Service plans
              </a>
              <a href="/chatbot-workflow" className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-[#00bc7d] transition-colors">
                <FileText className="h-4 w-4" />
                Conversation flows
              </a>
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
