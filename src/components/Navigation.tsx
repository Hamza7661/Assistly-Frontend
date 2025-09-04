'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Menu, 
  X, 
  Home, 
  Package, 
  Settings, 
  LogOut, 
  User,
  ChevronDown
} from 'lucide-react';

export default function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Questionnare', href: '/questionnare', icon: User },
    { name: 'Packages', href: '/packages', icon: Package },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Hide specific tabs via inline style (display: none)
  const hiddenTabs = new Set(['Packages', 'Settings']);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileMenuOpen(false);
  };

  // Close user menu on outside click
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isUserMenuOpen]);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center">
            <div className="h-8 w-8 bg-[#00bc7d] rounded-full flex items-center justify-center mr-4">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <div className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className="text-gray-600 hover:text-[#00bc7d] px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
                  style={hiddenTabs.has(item.name) ? { display: 'none' } : undefined}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00bc7d]"
              >
                <div className="h-8 w-8 bg-[#00bc7d] rounded-full flex items-center justify-center mr-2">
                  <span className="text-sm font-bold text-white">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
                <span className="hidden md:block text-gray-700 font-medium">
                  {user?.firstName} {user?.lastName}
                </span>
                <ChevronDown className="hidden md:block h-4 w-4 ml-1 text-gray-400" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <button
                    onClick={() => {
                      handleNavigation('/settings');
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden ml-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#00bc7d]"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                className="text-gray-600 hover:text-[#00bc7d] hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center w-full text-left"
                style={hiddenTabs.has(item.name) ? { display: 'none' } : undefined}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </button>
            ))}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={() => {
                  handleNavigation('/settings');
                  setIsMobileMenuOpen(false);
                }}
                className="text-gray-600 hover:text-[#00bc7d] hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center w-full text-left"
              >
                <User className="h-5 w-5 mr-3" />
                Profile Settings
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="text-gray-600 hover:text-[#00bc7d] hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center w-full text-left"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
