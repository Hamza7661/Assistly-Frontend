'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { ChevronDown, Building2, Plus, Check } from 'lucide-react';
import { INDUSTRIES_LIST } from '@/enums/Industry';

export default function AppSelector() {
  const router = useRouter();
  const { currentApp, apps, switchApp, isLoading } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSwitchApp = async (appId: string) => {
    await switchApp(appId);
    setIsOpen(false);
  };

  const getIndustryLabel = (industryValue: string) => {
    return INDUSTRIES_LIST.find(i => i.value === industryValue)?.label || industryValue;
  };

  if (isLoading) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">
        Loading apps...
      </div>
    );
  }

  if (!currentApp && apps.length === 0) {
    return (
      <button
        onClick={() => router.push('/apps/create')}
        className="px-3 py-2 text-sm font-medium text-[#00bc7d] hover:text-[#00a86b] flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Create App
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#00bc7d] hover:bg-gray-50 rounded-md transition-colors border border-gray-200 hover:border-[#00bc7d]"
        title={currentApp ? `Current app: ${currentApp.name} (${getIndustryLabel(currentApp.industry)})` : 'Select an app'}
      >
        <Building2 className="h-4 w-4 text-[#00bc7d]" />
        <span className="max-w-[140px] truncate font-semibold">
          {currentApp?.name || 'Select App'}
        </span>
        {currentApp && (
          <>
            <span className="hidden lg:block text-xs text-gray-500 max-w-[100px] truncate">
              ({getIndustryLabel(currentApp.industry)})
            </span>
            <span className="hidden xl:block px-2 py-0.5 text-xs font-medium bg-[#00bc7d] text-white rounded-full">
              Active
            </span>
          </>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">My Apps</div>
          </div>
          
          {apps.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No apps yet
            </div>
          ) : (
            apps.map((app) => (
              <button
                key={app.id}
                onClick={() => handleSwitchApp(app.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 ${
                  currentApp?.id === app.id ? 'bg-green-50 text-[#00bc7d]' : 'text-gray-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{app.name}</div>
                  <div className="text-xs text-gray-500 truncate">{getIndustryLabel(app.industry)}</div>
                </div>
                {currentApp?.id === app.id && (
                  <Check className="h-4 w-4 text-[#00bc7d] flex-shrink-0 ml-2" />
                )}
              </button>
            ))
          )}

          <div className="border-t border-gray-200 mt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/apps/create');
              }}
              className="w-full text-left px-3 py-2 text-sm text-[#00bc7d] hover:bg-green-50 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New App
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/apps');
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Manage Apps
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
