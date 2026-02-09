'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAppService } from '@/services';
import { INDUSTRIES_LIST } from '@/enums/Industry';
import {
  Building2,
  Phone,
  Plus,
  ExternalLink,
  DollarSign,
  Edit2,
  LayoutGrid
} from 'lucide-react';
import styles from './styles.module.css';

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [allApps, setAllApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?._id) {
      loadApps();
      if (!user?.industry) {
        reloadUser();
      }
    }
  }, [user?._id, user?.industry]);

  const reloadUser = async () => {
    try {
      const { useAuthService } = await import('@/services');
      const { User } = await import('@/models/User');
      const authService = await useAuthService();
      const response = await authService.getCurrentUser();
      if (response.status === 'success') {
        updateUser(new User(response.data.user));
      }
    } catch (e) {
      console.error('Failed to reload user:', e);
    }
  };

  const loadApps = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }
    try {
      const appService = await useAppService();
      const response = await appService.getApps(true);
      if (response.status === 'success' && response.data?.apps) {
        setAllApps(response.data.apps);
      }
    } catch (e) {
      console.error('Failed to load apps:', e);
    } finally {
      setLoading(false);
    }
  };

  const getIndustryLabel = (industryValue: string) => {
    return INDUSTRIES_LIST.find((i) => i.value === industryValue)?.label || industryValue;
  };

  if (loading) {
    return (
      <ProtectedRoute requirePackage={true}>
        <div className={styles.container}>
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className={styles.pageContainer}>
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
    <ProtectedRoute requirePackage={true}>
      <div className={styles.container}>
        <Navigation />
        <div className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
          <div className={styles.pageContainer}>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-2">Overview of your apps and quick actions</p>
            </div>

            {/* Your Apps */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <LayoutGrid className="h-6 w-6 text-gray-700" />
                  Your Apps
                </h2>
                <a
                  href="/apps"
                  className="text-sm font-medium text-[#00bc7d] hover:text-[#00a870] inline-flex items-center gap-1"
                >
                  Manage apps
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {allApps.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No apps yet</h3>
                  <p className="text-gray-600 mb-4">Create your first app to get started with flows, FAQs, and integrations.</p>
                  <a href="/apps/create" className="btn-primary inline-flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Create Your First App
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allApps.map((app: any) => (
                    <div
                      key={app.id || app._id}
                      className={`bg-white rounded-lg shadow-md p-6 border ${!app.isActive ? 'opacity-75 border-gray-200' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{app.name}</h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            app.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {app.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          <span>{getIndustryLabel(app.industry)}</span>
                        </div>
                        {app.whatsappNumber && (
                          <div className="flex items-center gap-2 truncate">
                            <Phone className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{app.whatsappNumber}</span>
                          </div>
                        )}
                        {app.description && (
                          <p className="text-gray-500 line-clamp-2">{app.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <a
                          href={`/apps/${app.id || app._id}/edit`}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </a>
                        <a
                          href="/apps"
                          className="inline-flex items-center gap-1 py-2 px-3 rounded-lg text-sm font-medium text-[#00bc7d] hover:bg-green-50"
                        >
                          View all
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pricing & Subscription link */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50">
                      <DollarSign className="h-6 w-6 text-[#00bc7d]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Pricing & Subscription</h2>
                      <p className="text-sm text-gray-600">View your plan, manage billing, and upgrade</p>
                    </div>
                  </div>
                  <a
                    href="/pricing"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to Pricing
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
