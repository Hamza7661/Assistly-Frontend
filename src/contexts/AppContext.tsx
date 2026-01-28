'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { App, AppModel } from '@/models/App';
import { useAuth } from './AuthContext';

interface AppContextType {
  currentApp: App | null;
  apps: App[];
  setCurrentApp: (app: App | null) => void;
  switchApp: (appId: string) => Promise<void>;
  refreshApps: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [currentApp, setCurrentApp] = useState<App | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load apps and set current app
  const loadApps = async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    try {
      const { useAppService } = await import('@/services');
      const appService = await useAppService();
      const response = await appService.getApps();
      
      if (response.status === 'success' && response.data?.apps) {
        const loadedApps = response.data.apps.map((app: any) => new AppModel(app));
        setApps(loadedApps);

        // Get saved app ID from localStorage
        const savedAppId = localStorage.getItem('currentAppId');
        
        // Find the saved app or use the first app
        let appToSet: App | null = null;
        if (savedAppId) {
          appToSet = loadedApps.find(app => app.id === savedAppId) || null;
        }
        
        // If no saved app or saved app not found, use first app
        if (!appToSet && loadedApps.length > 0) {
          appToSet = loadedApps[0];
        }

        if (appToSet) {
          setCurrentApp(appToSet);
          localStorage.setItem('currentAppId', appToSet.id);
        } else {
          setCurrentApp(null);
          localStorage.removeItem('currentAppId');
        }
      }
    } catch (error) {
      console.error('Failed to load apps:', error);
      setApps([]);
      setCurrentApp(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load apps when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadApps();
    } else {
      setApps([]);
      setCurrentApp(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?._id]);

  const switchApp = async (appId: string) => {
    // Set localStorage first
    localStorage.setItem('currentAppId', appId);
    
    const app = apps.find(a => a.id === appId);
    if (app) {
      // App is already in the list, set it immediately
      setCurrentApp(app);
    } else {
      // App not in list yet, refresh apps
      // loadApps will read from localStorage and set the correct app
      await refreshApps();
    }
  };

  const refreshApps = async () => {
    await loadApps();
  };

  const handleSetCurrentApp = (app: App | null) => {
    setCurrentApp(app);
    if (app) {
      localStorage.setItem('currentAppId', app.id);
    } else {
      localStorage.removeItem('currentAppId');
    }
  };

  const value: AppContextType = {
    currentApp,
    apps,
    setCurrentApp: handleSetCurrentApp,
    switchApp,
    refreshApps,
    isLoading
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
