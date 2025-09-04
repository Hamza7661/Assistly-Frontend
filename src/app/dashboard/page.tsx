'use client';

import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  MessageSquare, 
  Mic, 
  Mail, 
  TrendingUp, 
  Users, 
  Zap, 
  Settings,
  Plus,
  BarChart3,
  Code,
  Crown
} from 'lucide-react';
import styles from './styles.module.css';

export default function DashboardPage() {
  const { user } = useAuth();

  // Sample data for charts
  const monthlyData = [
    { month: 'Jan', chatbots: 1200, voice: 800, emails: 450 },
    { month: 'Feb', chatbots: 1400, voice: 950, emails: 520 },
    { month: 'Mar', chatbots: 1100, voice: 700, emails: 380 },
    { month: 'Apr', chatbots: 1600, voice: 1100, emails: 600 },
    { month: 'May', chatbots: 1800, voice: 1300, emails: 720 },
    { month: 'Jun', chatbots: 2000, voice: 1500, emails: 850 }
  ];

  const serviceData = [
    { name: 'Chatbots', value: 45, color: '#3B82F6' },
    { name: 'Voice Agents', value: 35, color: '#10B981' },
    { name: 'Lead Generation', value: 20, color: '#8B5CF6' }
  ];

  return (
    <ProtectedRoute requirePackage={true}>
      <div className={styles.container}>
        <Navigation />
        <div className={styles.pageContainer}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900">Coming soon</h1>
              <p className="text-gray-500 mt-2">We’re building something awesome for your dashboard.</p>
            </div>
          </div>
          <div className="hidden">
          <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className={styles.welcomeSubtitle}>
            Here's what's happening with your virtual assistant services today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statInfo}>
                <div>
                  <p className={styles.statTitle}>Total Chatbot Queries</p>
                  <p className={styles.statValue}>12,847</p>
                </div>
                <div className={`${styles.statIcon} bg-blue-100`}>
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className={styles.statChange}>
              <TrendingUp className={`${styles.statChangeIcon} text-green-500`} />
              <span className={`${styles.statChangeText} text-green-600`}>+12.5%</span>
              <span className={styles.statChangeLabel}>from last month</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statInfo}>
                <div>
                  <p className={styles.statTitle}>Voice Minutes Used</p>
                  <p className={styles.statValue}>8,420</p>
                </div>
                <div className={`${styles.statIcon} bg-green-100`}>
                  <Mic className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className={styles.statChange}>
              <TrendingUp className={`${styles.statChangeIcon} text-green-500`} />
              <span className={`${styles.statChangeText} text-green-600`}>+8.3%</span>
              <span className={styles.statChangeLabel}>from last month</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statInfo}>
                <div>
                  <p className={styles.statTitle}>Lead Generation Emails</p>
                  <p className={styles.statValue}>3,245</p>
                </div>
                <div className={`${styles.statIcon} bg-purple-100`}>
                  <Mail className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className={styles.statChange}>
              <TrendingUp className={`${styles.statChangeIcon} text-green-500`} />
              <span className={`${styles.statChangeText} text-green-600`}>+15.2%</span>
              <span className={styles.statChangeLabel}>from last month</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={styles.statInfo}>
                <div>
                  <p className={styles.statTitle}>Active Users</p>
                  <p className={styles.statValue}>1,247</p>
                </div>
                <div className={`${styles.statIcon} bg-orange-100`}>
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
            <div className={styles.statChange}>
              <TrendingUp className={`${styles.statChangeIcon} text-green-500`} />
              <span className={`${styles.statChangeText} text-green-600`}>+5.8%</span>
              <span className={styles.statChangeLabel}>from last month</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className={styles.chartsSection}>
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Monthly Service Usage</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="chatbots" fill="#3B82F6" name="Chatbots" />
                <Bar dataKey="voice" fill="#10B981" name="Voice" />
                <Bar dataKey="emails" fill="#8B5CF6" name="Emails" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Service Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Services Overview */}
        <div className={styles.servicesSection}>
          <h3 className={styles.servicesTitle}>Your Services Overview</h3>
          <div className={styles.servicesGrid}>
            <div className={`${styles.serviceCard} ${styles.serviceCardBlue}`}>
              <div className={`${styles.serviceIcon} ${styles.serviceIconBlue}`}>
                <MessageSquare className={styles.serviceIconInner} />
              </div>
              <h4 className={styles.serviceTitle}>Chatbots</h4>
              <p className={styles.serviceDescription}>
                AI-powered chatbots for website integration and customer support
              </p>
            </div>

            <div className={`${styles.serviceCard} ${styles.serviceCardGreen}`}>
              <div className={`${styles.serviceIcon} ${styles.serviceIconGreen}`}>
                <Mic className={styles.serviceIconInner} />
              </div>
              <h4 className={styles.serviceTitle}>AI Voice Agents</h4>
              <p className={styles.serviceDescription}>
                Intelligent voice assistants for calls and voice interactions
              </p>
            </div>

            <div className={`${styles.serviceCard} ${styles.serviceCardPurple}`}>
              <div className={`${styles.serviceIcon} ${styles.serviceIconPurple}`}>
                <Mail className={styles.serviceIconInner} />
              </div>
              <h4 className={styles.serviceTitle}>Lead Generation</h4>
              <p className={styles.serviceDescription}>
                Automated email campaigns and lead nurturing systems
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.quickActionsSection}>
          <h3 className={styles.quickActionsTitle}>Quick Actions</h3>
          <div className={styles.quickActionsGrid}>
            <button className={styles.quickActionButton}>
              <Plus className={styles.quickActionIcon} />
              <span className={styles.quickActionText}>New Chatbot</span>
            </button>
            <button className={styles.quickActionButton}>
              <Mic className={styles.quickActionIcon} />
              <span className={styles.quickActionText}>Voice Agent</span>
            </button>
            <button className={styles.quickActionButton}>
              <Mail className={styles.quickActionIcon} />
              <span className={styles.quickActionText}>Email Campaign</span>
            </button>
            <button className={styles.quickActionButton}>
              <Settings className={styles.quickActionIcon} />
              <span className={styles.quickActionText}>Settings</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  </ProtectedRoute>
  );
}
