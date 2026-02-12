'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService } from '@/services';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Clock, Building2, Phone, Power, PowerOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import ConfirmModal from '@/components/ConfirmModal';

export default function AppsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { apps, currentApp, switchApp, refreshApps } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(true);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);
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
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="loading-spinner"></div>
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
                                    {app.isActive && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                      </span>
                                    )}
                                    {!app.isActive && (
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
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="This app receives leads and flows for this number">
                                        Uses this number
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
                                {!app.usesTwilioNumber && app.isActive && sameNumberCount > 1 && (
                                  <button
                                    onClick={() => handleSetAsCurrent(app.id)}
                                    className="btn-secondary text-sm flex-1"
                                  >
                                    Use this number
                                  </button>
                                )}
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
