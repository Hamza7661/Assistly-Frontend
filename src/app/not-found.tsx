'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft, Search, Package, Settings } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  const quickLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, description: 'View your analytics and services' },
    { name: 'Packages', href: '/packages', icon: Package, description: 'Browse available packages' },
    { name: 'Settings', href: '/settings', icon: Settings, description: 'Manage your account' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="mx-auto h-32 w-32 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mb-6">
            <div className="text-6xl font-bold text-red-500">404</div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or you entered the wrong URL.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="p-4 bg-white rounded-lg border border-gray-200 hover:border-[#00bc7d] hover:shadow-lg transition-all duration-200 group"
              >
                <div className="w-12 h-12 bg-[#00bc7d] rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-[#00a06a] transition-colors">
                  <link.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{link.name}</h3>
                <p className="text-sm text-gray-500">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
          
          <Link href="/dashboard" className="btn-primary flex items-center justify-center">
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Link>
        </div>

        {/* Help Section */}
        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h3>
          <p className="text-blue-700 mb-4">
            If you're experiencing issues or need assistance, our support team is here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
              Contact Support
            </button>
            <button className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm">
              View Documentation
            </button>
          </div>
        </div>

        {/* Search Suggestion */}
        <div className="mt-8">
          <p className="text-sm text-gray-500 mb-2">Looking for something specific?</p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search for pages, features, or help..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bc7d] focus:border-transparent outline-none transition-all duration-200"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
