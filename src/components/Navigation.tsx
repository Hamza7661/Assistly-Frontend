'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import AppSelector from './AppSelector';
import Logo from './Logo';
import Sidebar from './Sidebar';
import { 
  Menu, 
  X, 
  LogOut, 
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Navigation() {
  const { user, logout } = useAuth();
  const { isOpen: isSidebarOpen, toggle: toggleSidebar } = useSidebar();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsMobileMenuOpen(false);
    setIsMobileSidebarOpen(false);
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
    <>
      {/* Top Bar with App Selector */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo and Sidebar Toggle */}
            <div className="flex items-center">
              {/* Desktop sidebar toggle */}
              <button
                onClick={toggleSidebar}
                className="hidden lg:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md mr-3"
                aria-label="Toggle sidebar"
              >
                {isSidebarOpen ? (
                  <ChevronLeft className="h-6 w-6" />
                ) : (
                  <ChevronRight className="h-6 w-6" />
                )}
              </button>
              
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md mr-3"
              >
                {isMobileSidebarOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              
              <div 
                onClick={() => handleNavigation('/dashboard')}
                className="cursor-pointer hover:opacity-80 transition-opacity flex items-center"
              >
                <Logo width={140} height={42} />
              </div>
            </div>

            {/* Center: App Selector (Desktop) */}
            <div className="hidden lg:flex items-center flex-1 justify-center px-4">
              <AppSelector />
            </div>

            {/* Right: User Menu */}
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
                      Account Settings
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
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`hidden lg:block fixed top-16 bottom-0 z-30 overflow-y-auto overflow-x-hidden bg-white border-r border-gray-200 transition-all duration-300 ease-in-out group ${
        isSidebarOpen ? 'left-0 w-64' : 'left-0 w-16 hover:w-64'
      }`}>
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-16 bottom-0 z-50 w-64">
            <Sidebar />
          </div>
        </>
      )}

      {/* Mobile App Selector (shown when sidebar is closed) */}
      {!isMobileSidebarOpen && (
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <AppSelector />
        </div>
      )}
    </>
  );
}
