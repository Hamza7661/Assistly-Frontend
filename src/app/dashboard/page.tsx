'use client';

import { ProtectedRoute } from '@/components';
import AppsPage from '@/app/apps/page';

export default function DashboardPage() {
  return (
    <ProtectedRoute hideLoader>
      <AppsPage />
    </ProtectedRoute>
  );
}
