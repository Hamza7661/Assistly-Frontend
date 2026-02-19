'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { 
  Home, 
  FileText,
  Plug,
  ClipboardList,
  Database,
  Users,
  User,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Settings,
  MessageCircle
} from 'lucide-react';

interface MenuItem {
  name: string;
  href?: string;
  icon: any;
  subItems?: MenuItem[];
}

const navigation: MenuItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  {
    name: 'Content Management',
    icon: Database,
    subItems: [
      { name: 'Training Data', href: '/questionnare', icon: Database },
      { name: 'Service Plans', href: '/treatment-plans', icon: ClipboardList },
      { name: 'Conversation Flows', href: '/chatbot-workflow', icon: FileText },
    ]
  },
  {
    name: 'Business Operations',
    icon: Briefcase,
    subItems: [
      { name: 'Leads', href: '/leads', icon: Users },
    ]
  },
  {
    name: 'Settings',
    icon: Settings,
    subItems: [
      { name: 'Chat Settings', href: '/settings/chatbot', icon: MessageCircle },
      { name: 'Account Settings', href: '/settings', icon: User },
    ]
  },
  { name: 'Integration', href: '/integration', icon: Plug },
];

const hiddenTabs = new Set(['Packages']);

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);
  
  // Show expanded state when sidebar is open OR when hovered
  const isExpanded = isSidebarOpen || isHovered;

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuName)) {
        newSet.delete(menuName);
      } else {
        newSet.add(menuName);
      }
      return newSet;
    });
  };

  const isMenuExpandedState = (menuName: string) => expandedMenus.has(menuName);

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  // Auto-expand menus if current page is a sub-item
  useEffect(() => {
    navigation.forEach((item) => {
      if (item.subItems) {
        const hasActiveSubItem = item.subItems.some(
          subItem => pathname === subItem.href || (subItem.href && pathname.startsWith(subItem.href + '/'))
        );
        if (hasActiveSubItem) {
          setExpandedMenus(prev => new Set(prev).add(item.name));
        }
      }
    });
  }, [pathname]);

  return (
    <aside 
      className="w-full bg-white border-r border-gray-200 h-full flex flex-col overflow-x-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navigation.map((item) => {
          if (hiddenTabs.has(item.name)) return null;
          
          if (item.subItems && item.subItems.length > 0) {
            const isSubMenuExpanded = isMenuExpandedState(item.name);
            const hasActiveSubItem = item.subItems.some(
              subItem => pathname === subItem.href || (subItem.href && pathname.startsWith(subItem.href + '/'))
            );
            
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    hasActiveSubItem 
                      ? 'bg-green-50 text-[#00bc7d]' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-[#00bc7d]'
                  }`}
                  title={item.name}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {isExpanded && <span className="truncate ml-3" title={item.name}>{item.name}</span>}
                  </div>
                  {isExpanded && (
                    isSubMenuExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 ml-2" />
                    )
                  )}
                </button>
                
                {isExpanded && isSubMenuExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.subItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href || (subItem.href && pathname.startsWith(subItem.href + '/') && !item.subItems!.some(s => s.href !== subItem.href && s.href && pathname.startsWith(s.href)));
                      return (
                        <button
                          key={subItem.name}
                          onClick={() => handleNavigation(subItem.href!)}
                          className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                            isSubActive 
                              ? 'bg-green-50 text-[#00bc7d] font-medium' 
                              : 'text-gray-600 hover:bg-gray-50 hover:text-[#00bc7d]'
                          }`}
                          title={subItem.name}
                        >
                          <subItem.icon className="h-4 w-4 flex-shrink-0" />
                          {isExpanded && <span className="truncate ml-3" title={subItem.name}>{subItem.name}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else {
            const isActive = pathname === item.href || (item.href && pathname.startsWith(item.href + '/'));
            return (
              <button
                key={item.name}
                onClick={() => item.href && handleNavigation(item.href)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? 'bg-green-50 text-[#00bc7d]' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-[#00bc7d]'
                }`}
                aria-current={isActive ? 'page' : undefined}
                title={item.name}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span className="truncate ml-3" title={item.name}>{item.name}</span>}
              </button>
            );
          }
        })}
      </nav>
    </aside>
  );
}
