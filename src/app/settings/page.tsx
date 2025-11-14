'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/models';
import { 
  ArrowLeft, 
  User as UserIcon, 
  Shield, 
  Bell, 
  CreditCard, 
  Globe,
  LogOut,
  Save,
  Edit3,
  Building2
} from 'lucide-react';
import { INDUSTRIES_LIST } from '@/enums/Industry';

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
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
    professionDescription: '',
    industry: '',
  });

  useEffect(() => {
    if (!user) {
      router.push('/signin');
    } else {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        professionDescription: user.professionDescription || '',
        industry: user.industry || '',
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

    // Validate required fields - only require industry if it's not already set
    if (!formData.industry || formData.industry.trim() === '') {
      // Check if user already has an industry set
      if (!user?.industry) {
        setError('Industry is required. Please select an industry.');
        return;
      }
      // If user has industry but formData is empty, keep the existing one
      formData.industry = user.industry;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const { useAuthService } = await import('@/services');
      const authService = await useAuthService();
      
      // Prepare update data - only include industry if it has a value
      const updateData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        professionDescription: formData.professionDescription,
      };

      // Only include industry if it's not empty AND user doesn't already have one set
      // Once industry is set, it cannot be changed
      if (!user.industry && formData.industry && formData.industry.trim() !== '') {
        updateData.industry = formData.industry.trim();
      } else if (user.industry && formData.industry !== user.industry) {
        // Prevent changing industry if already set
        setError('Industry cannot be changed once set. Please contact support if you need to update it.');
        setIsSaving(false);
        return;
      }

      console.log('Updating user profile:', { userId: user._id, updateData });
      
      const response = await authService.updateUserProfile(user._id, updateData);

      if (response.status === 'success') {
        const { User } = await import('@/models/User');
        const updatedUser = new User(response.data.user);
        console.log('User updated successfully:', { 
          userId: updatedUser._id, 
          industry: updatedUser.industry,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00bc7d]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors mr-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-8 w-8 bg-[#00bc7d] rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-white">A</span>
              </div>
              <h1 className="ml-3 text-xl font-semibold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profession Description
              </label>
              {isEditing ? (
                <textarea
                  className="input-field"
                  rows={3}
                  value={formData.professionDescription}
                  onChange={(e) => handleInputChange('professionDescription', e.target.value)}
                  placeholder="Describe your profession or business"
                />
              ) : (
                <p className="text-gray-900">{formData.professionDescription || 'Not provided'}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Industry {!formData.industry && <span className="text-red-500">*</span>}
              </label>
              {isEditing ? (
                <div>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    <select
                      className={`w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00bc7d] focus:border-transparent outline-none transition-all duration-200 ${formData.industry ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      value={formData.industry}
                      onChange={(e) => handleInputChange('industry', e.target.value)}
                      required={!formData.industry}
                      disabled={!!formData.industry}
                      title={formData.industry ? 'Industry cannot be changed once set' : ''}
                    >
                      <option value="">Select your industry</option>
                      {INDUSTRIES_LIST.map((industry) => (
                        <option key={industry.value} value={industry.value}>
                          {industry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.industry && (
                    <p className="text-xs text-gray-500 mt-1">
                      Industry cannot be changed once set. Contact support if you need to update it.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-900">
                  {formData.industry 
                    ? INDUSTRIES_LIST.find(i => i.value === formData.industry)?.label || formData.industry
                    : 'Not set'}
                </p>
              )}
            </div>
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
        <div className="card border-red-200 bg-red-50">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-red-700 mb-2">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button className="btn-secondary border-red-300 text-red-700 hover:bg-red-100">
                Delete Account
              </button>
            </div>
            <div className="pt-4 border-t border-red-200">
              <button
                onClick={handleLogout}
                className="btn-secondary border-red-300 text-red-700 hover:bg-red-100 flex items-center"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
