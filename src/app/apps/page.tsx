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
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; appId: string | null; appName: string }>({
    isOpen: false,
    appId: null,
    appName: ''
  });

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

  // Count apps per WhatsApp number: only show "Set as Current" when the same number is used by multiple apps
  const appsToShow = showInactive ? allApps : apps;
  const countByWhatsAppNumber = useMemo(() => {
    const map = new Map<string, number>();
    appsToShow.forEach((app: any) => {
      const num = app.whatsappNumber?.trim?.();
      if (num) map.set(num, (map.get(num) || 0) + 1);
    });
    return map;
  }, [appsToShow]);

  const handleDeleteClick = (appId: string, appName: string) => {
    setConfirmDelete({
      isOpen: true,
      appId,
      appName
    });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.appId) return;

    const appId = confirmDelete.appId;
    setConfirmDelete({ isOpen: false, appId: null, appName: '' });
    setDeletingAppId(appId);
    try {
      const appService = await useAppService();
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
    await switchApp(appId);
    toast.success('App switched successfully');
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

  const getWhatsAppStatusBadge = (status?: string) => {
    switch (status) {
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {appsToShow.map((app: any) => {
                  // Find the app from context if available to get full model
                  const appModel = apps.find(a => a.id === app.id) || app;
                  const num = app.whatsappNumber?.trim?.();
                  const sameNumberCount = num ? (countByWhatsAppNumber.get(num) || 0) : 0;
                  const isCurrentForSharedNumber = currentApp?.id === app.id && sameNumberCount > 1;
                  return (
                <div
                  key={app.id || app._id}
                  className={`border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow ${
                    isCurrentForSharedNumber ? 'border-[#00bc7d] border-2' : 'border-gray-200'
                  } ${!app.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
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
                      </div>
                      {isCurrentForSharedNumber && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#00bc7d] text-white">
                          Current App
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <span>{getIndustryLabel(app.industry)}</span>
                    </div>
                    
                    {app.whatsappNumber && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span className="truncate">{app.whatsappNumber}</span>
                        {getWhatsAppStatusBadge(app.whatsappNumberStatus)}
                      </div>
                    )}

                    {app.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{app.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    {currentApp?.id !== app.id && app.isActive && sameNumberCount > 1 && (
                      <button
                        onClick={() => handleSetAsCurrent(app.id)}
                        className="btn-secondary text-sm flex-1"
                      >
                        Set as Current
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
            );
          })()}
          </div>
        </div>

        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete({ isOpen: false, appId: null, appName: '' })}
          onConfirm={handleDeleteConfirm}
          title="Delete App"
          message={`Are you sure you want to delete "${confirmDelete.appName}"? This action cannot be undone. All associated data including workflows, FAQs, and leads will be permanently deleted.`}
          confirmText="Delete App"
          cancelText="Cancel"
          confirmButtonClass="btn-danger"
          isLoading={deletingAppId === confirmDelete.appId}
        />
      </div>
    </ProtectedRoute>
  );
}
