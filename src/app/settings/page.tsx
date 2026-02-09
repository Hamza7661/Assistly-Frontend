'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { User } from '@/models';
import { 
  User as UserIcon, 
  Shield, 
  Bell, 
  CreditCard, 
  Globe,
  LogOut,
  Save,
  Edit3,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });

  useEffect(() => {
    if (!user) {
      router.push('/signin');
    } else {
      // Debug: Log user object to check for twilioPhoneNumber
      console.log('User object:', user);
      console.log('Twilio Phone Number:', user.twilioPhoneNumber);
      
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
      });
      setIsLoading(false);
    }
  }, [user, router]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?._id) {
      setError('User not found');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const { useAuthService } = await import('@/services');
      const authService = await useAuthService();
      
      // Prepare update data
      const updateData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
      };

      console.log('Updating user profile:', { userId: user._id, updateData });
      
      const response = await authService.updateUserProfile(user._id, updateData);

      if (response.status === 'success') {
        const { User } = await import('@/models/User');
        const updatedUser = new User(response.data.user);
        console.log('User updated successfully:', { 
          userId: updatedUser._id,
          userData: updatedUser 
        });
        updateUser(updatedUser);
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        console.error('Update failed:', response);
        setError(response.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className="content-wrapper sidebar-closed flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00bc7d]"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h1>
            <p className="text-gray-600 mb-8">Manage your profile, security, and preferences.</p>
        {/* Profile Section */}
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <UserIcon className="h-5 w-5 mr-2 text-[#00bc7d]" />
              Profile Information
            </h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary flex items-center"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Profile
              </button>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  className="input-field"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                />
              ) : (
                <p className="text-gray-900">{formData.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  className="input-field"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                />
              ) : (
                <p className="text-gray-900">{formData.lastName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              {isEditing ? (
                <input
                  type="email"
                  className="input-field"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              ) : (
                <p className="text-gray-900">{formData.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  className="input-field"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                />
              ) : (
                <p className="text-gray-900">{formData.phoneNumber}</p>
              )}
            </div>

            {user?.twilioPhoneNumber && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assigned Business Phone Number
                </label>
                <p className="text-gray-900">{user.twilioPhoneNumber}</p>
              </div>
            )}
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Account Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center mb-4">
              <Shield className="h-5 w-5 mr-2 text-[#00bc7d]" />
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Change Password</div>
                <div className="text-sm text-gray-500">Update your account password</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Two-Factor Authentication</div>
                <div className="text-sm text-gray-500">Add an extra layer of security</div>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center mb-4">
              <Bell className="h-5 w-5 mr-2 text-[#00bc7d]" />
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Email Notifications</div>
                <div className="text-sm text-gray-500">Manage email preferences</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Push Notifications</div>
                <div className="text-sm text-gray-500">Configure push alerts</div>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center mb-4">
              <CreditCard className="h-5 w-5 mr-2 text-[#00bc7d]" />
              <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
            </div>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Payment Methods</div>
                <div className="text-sm text-gray-500">Manage your payment options</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Billing History</div>
                <div className="text-sm text-gray-500">View past invoices</div>
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center mb-4">
              <Globe className="h-5 w-5 mr-2 text-[#00bc7d]" />
              <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>
            </div>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Language</div>
                <div className="text-sm text-gray-500">Set your preferred language</div>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="font-medium text-gray-900">Time Zone</div>
                <div className="text-sm text-gray-500">Configure your time zone</div>
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="relative overflow-hidden rounded-xl border border-red-200/80 bg-gradient-to-br from-red-50 to-rose-50/80 shadow-sm">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-400 to-red-600" aria-hidden />
          <div className="p-6 pl-7">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
            </div>
            <p className="text-sm text-red-700/90 mb-6 max-w-xl">
              Irreversible actions. Once you delete your account, there is no going back. Please be certain.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-red-700 bg-white border border-red-300 hover:bg-red-50 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
