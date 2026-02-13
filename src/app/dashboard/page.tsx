'use client';

import { ProtectedRoute } from '@/components';
import AppsPage from '@/app/apps/page';

export default function DashboardPage() {
  return (
    <ProtectedRoute requirePackage={true} hideLoader>
      <AppsPage />
    </ProtectedRoute>
  );
}
