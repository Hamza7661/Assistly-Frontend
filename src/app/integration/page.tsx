'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ChromePicker } from 'react-color';
import { toast } from 'react-toastify';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationService } from '@/services';
import type { IntegrationSettings } from '@/models';

export default function IntegrationPage() {
  const { user } = useAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
  const userId = user?._id || 'PUBLIC_USER_ID';
  
  // Settings state
  const [settings, setSettings] = useState<IntegrationSettings>({
    chatbotImage: '',
    assistantName: '',
    companyName: '',
    greeting: '',
    primaryColor: '#00bc7d',
    validateEmail: false,
    validatePhoneNumber: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<IntegrationSettings | null>(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generate greeting preview
  const getGreetingPreview = () => {
    if (!settings.greeting) return '';
    const assistantName = settings.assistantName?.trim() || '{Your Assistant Name}';
    const companyName = settings.companyName?.trim() || '';
    
    let preview = settings.greeting.replace(/{assistantName}/g, assistantName);
    
    // If company name is provided, replace it
    if (companyName) {
      preview = preview.replace(/{companyName}/g, companyName);
    } else {
      // Remove company name phrases gracefully when company name is not provided
      preview = preview
        .replace(/\s+from\s+\{companyName\}/gi, '')
        .replace(/\s+at\s+\{companyName\}/gi, '')
        .replace(/\s+of\s+\{companyName\}/gi, '')
        .replace(/\s+with\s+\{companyName\}/gi, '')
        .replace(/\{companyName\}\s+/g, '')
        .replace(/\s+\{companyName\}/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+([.,!?])/g, '$1')
        .replace(/([.,!?])\s+([.,!?])/g, '$1$2');
    }
    
    return preview;
  };
  
  
  const greetingTemplates = [
    {
      name: 'Professional',
      text: 'Hi this is {assistantName} your virtual ai assistant from {companyName}. How can I help you today?'
    },
    {
      name: 'Friendly',
      text: 'Hello! I\'m {assistantName} from {companyName}. How can I assist you today?'
    },
    {
      name: 'Casual',
      text: 'Hey there! I\'m {assistantName}, your AI assistant at {companyName}. What can I do for you?'
    },
    {
      name: 'Simple',
      text: 'Hello! I\'m {assistantName}. How can I help you today?'
    }
  ];
  
  const applyTemplate = (template: string, index: number) => {
    updateSettings({ ...settings, greeting: template });
    setSelectedTemplateIndex(index);
  };
  
  // Check if current greeting matches any template
  useEffect(() => {
    const currentGreeting = settings.greeting?.trim() || '';
    const matchingIndex = greetingTemplates.findIndex(
      template => template.text.trim() === currentGreeting
    );
    setSelectedTemplateIndex(matchingIndex !== -1 ? matchingIndex : null);
  }, [settings.greeting]);
  
  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?._id) return;
      setLoading(true);
      setError('');
      try {
        const svc = await useIntegrationService();
        const res = await svc.getSettings();
        const integration = res.data?.integration;
        
        // Set image preview if there's an existing image
        if (integration?.chatbotImage?.hasImage && integration.chatbotImage.data) {
          const imageData = `data:${integration.chatbotImage.contentType};base64,${integration.chatbotImage.data}`;
          setImagePreview(imageData);
        }
        
        // Use Professional template as default if no greeting exists or if it's the old default
        const defaultGreeting = greetingTemplates[0].text; // Professional template
        const existingGreeting = integration?.greeting?.trim() || '';
        const oldDefaultGreeting = 'Hello! How can I help you today?';
        
        // Replace old default greeting with Professional template, or use Professional if empty
        const greeting = (existingGreeting === oldDefaultGreeting || !existingGreeting) 
          ? defaultGreeting 
          : existingGreeting;
        
        const loadedSettings = {
          chatbotImage: integration?.chatbotImage?.filename || '',
          assistantName: integration?.assistantName || '',
          companyName: integration?.companyName || '',
          greeting: greeting,
          primaryColor: integration?.primaryColor || '#00bc7d',
          validateEmail: integration?.validateEmail || false,
          validatePhoneNumber: integration?.validatePhoneNumber || false
        };
        
        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);
        setHasUnsavedChanges(false);
        
        // Check if loaded greeting matches any template
        const matchingIndex = greetingTemplates.findIndex(
          template => template.text.trim() === greeting.trim()
        );
        setSelectedTemplateIndex(matchingIndex !== -1 ? matchingIndex : null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [user?._id]);

  // Handle outside click to close color picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  const scriptSnippet = useMemo(() => {
    return `<script src="${appUrl}/widget.js" data-assistly-user-id="${userId}" data-assistly-base-url="${appUrl}"></script>`;
  }, [appUrl, userId]);
  
  const [copiedScript, setCopiedScript] = useState(false);
  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptSnippet);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 1200);
    } catch {}
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file: File) => {
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setSelectedFile(file);
    
    // Update settings (we'll send the file separately)
    updateSettings({ ...settings, chatbotImage: file.name });
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/webp') {
        processImageFile(file);
      }
    }
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSelectedFile(null);
    updateSettings({ ...settings, chatbotImage: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if settings have changed
  const checkForChanges = (newSettings: IntegrationSettings) => {
    if (!originalSettings) return false;
    
    return (
      newSettings.assistantName !== originalSettings.assistantName ||
      newSettings.companyName !== originalSettings.companyName ||
      newSettings.greeting !== originalSettings.greeting ||
      newSettings.primaryColor !== originalSettings.primaryColor ||
      Boolean(newSettings.validateEmail) !== Boolean(originalSettings.validateEmail) ||
      Boolean(newSettings.validatePhoneNumber) !== Boolean(originalSettings.validatePhoneNumber) ||
      newSettings.chatbotImage !== originalSettings.chatbotImage ||
      selectedFile !== null
    );
  };

  // Update settings and check for changes
  const updateSettings = (newSettings: IntegrationSettings) => {
    setSettings(newSettings);
    setHasUnsavedChanges(checkForChanges(newSettings));
  };

  const handleSaveSettings = async () => {
    if (!user?._id) return;
    setSaving(true);
    setError('');
    try {
      const svc = await useIntegrationService();
      await svc.updateSettings(settings, selectedFile || undefined);
      
      // Update original settings and clear unsaved changes
      setOriginalSettings(settings);
      setHasUnsavedChanges(false);
      setSelectedFile(null);
      
      // Show success toast
      toast.success('Settings saved successfully!');
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Integration</h1>
          <p className="text-gray-600 mb-8">Copy the integration code and configure your chatbot settings.</p>

          {/* Integration Code Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Code</h2>
            <p className="text-gray-600 mb-6">Copy and paste this JavaScript snippet into your website to embed the chatbot.</p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative">
              <button
                className="absolute top-2 right-2 text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:bg-gray-50"
                onClick={copyScript}
              >
                {copiedScript ? 'Copied' : 'Copy'}
              </button>
              <pre className="whitespace-pre-wrap break-all text-sm pr-16">
{scriptSnippet}
              </pre>
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Chatbot Settings</h2>
            
            {error && <div className="error-message mb-4">{error}</div>}
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Chatbot Image</label>
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors w-full h-32 flex items-center justify-center ${
                          isDragOver 
                            ? 'border-blue-400 bg-blue-50' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-gray-500">
                          {isDragOver ? (
                            <div>Drop image here</div>
                          ) : imagePreview ? (
                            <div>Click or drop to change image</div>
                          ) : (
                            <div>
                              <div className="text-lg mb-2">📁</div>
                              <div>Click to upload or drag & drop</div>
                              <div className="text-sm text-gray-400 mt-1">PNG, JPG, WebP up to 10MB</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {imagePreview && (
                      <div className="relative flex-shrink-0">
                        <img
                          src={imagePreview}
                          alt="Chatbot preview"
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assistant Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Your assistant name here"
                    value={settings.assistantName || ''}
                    onChange={(e) => updateSettings({ ...settings, assistantName: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter your company name"
                    value={settings.companyName || ''}
                    onChange={(e) => updateSettings({ ...settings, companyName: e.target.value })}
                  />
                </div>
                
                <div className="relative" ref={colorPickerRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-12 h-10 border border-gray-300 rounded-md"
                      style={{ backgroundColor: settings.primaryColor }}
                      onClick={() => setShowColorPicker(!showColorPicker)}
                    />
                    <input
                      type="text"
                      className="input-field flex-1 cursor-pointer"
                      value={settings.primaryColor || ''}
                      onChange={(e) => updateSettings({ ...settings, primaryColor: e.target.value })}
                      onClick={() => setShowColorPicker(true)}
                      placeholder="#10B981"
                      readOnly
                    />
                  </div>
                  {showColorPicker && (
                    <div className="absolute top-full left-0 z-10 mt-2">
                      <ChromePicker
                        color={settings.primaryColor}
                        onChange={(color: any) => updateSettings({ ...settings, primaryColor: color.hex })}
                      />
                    </div>
                  )}
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Greeting Message</label>
                  
                  {/* Example Templates */}
                  <div className="mb-3">
                    <p className="text-xs text-gray-600 mb-2">Quick templates:</p>
                    <div className="flex flex-wrap gap-2">
                      {greetingTemplates.map((template, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => applyTemplate(template.text, idx)}
                          className={`px-3 py-1.5 text-xs border rounded-md transition-colors ${
                            selectedTemplateIndex === idx
                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                              : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                          }`}
                        >
                          {template.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <textarea
                    className="input-field"
                    rows={4}
                    placeholder="Type your greeting message here, or use a template above..."
                    value={settings.greeting || ''}
                    onChange={(e) => updateSettings({ ...settings, greeting: e.target.value })}
                  />
                  
                  {/* Live Preview */}
                  {settings.greeting && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-900 mb-1">Preview (how it will appear to users):</p>
                      <p className="text-sm text-blue-800 italic">"{getGreetingPreview()}"</p>
                    </div>
                  )}
                  
                  {/* Helpful explanation */}
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-2">💡 How it works:</p>
                    <div className="space-y-1.5 text-xs text-gray-600">
                      {settings.assistantName ? (
                        <p>
                          • <span className="font-mono bg-white px-1 py-0.5 rounded text-blue-600">{'{assistantName}'}</span> will show as: 
                          <span className="font-semibold ml-1">"{settings.assistantName}"</span>
                        </p>
                      ) : (
                        <p>
                          • <span className="font-mono bg-white px-1 py-0.5 rounded text-blue-600">{'{assistantName}'}</span> will show as: 
                          <span className="font-semibold ml-1">&quot;{'{'}Your Assistant Name{'}'}&quot;</span> (fill in Assistant Name above)
                        </p>
                      )}
                      {settings.companyName ? (
                        <p>
                          • <span className="font-mono bg-white px-1 py-0.5 rounded text-blue-600">{'{companyName}'}</span> will show as: 
                          <span className="font-semibold ml-1">"{settings.companyName}"</span>
                        </p>
                      ) : (
                        <>
                          <p>
                            • <span className="font-mono bg-white px-1 py-0.5 rounded text-blue-600">{'{companyName}'}</span> will show as: 
                            <span className="font-semibold ml-1">&quot;{'{'}Your Company Name{'}'}&quot;</span> (fill in Company Name above)
                          </p>
                          <p className="mt-1.5">
                            • If Company Name is left empty, phrases like &quot;from {'{'}companyName{'}'}&quot; or &quot;at {'{'}companyName{'}'}&quot; will be automatically removed from the greeting.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Validation Settings */}
                <div className="md:col-span-2">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Validation Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Validate Email</label>
                        <p className="text-sm text-gray-500">Require valid email when users provide email addresses</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.validateEmail || false}
                          onChange={(e) => updateSettings({ ...settings, validateEmail: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Validate Phone Number</label>
                        <p className="text-sm text-gray-500">Require valid phone number when users provide phone numbers</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.validatePhoneNumber || false}
                          onChange={(e) => updateSettings({ ...settings, validatePhoneNumber: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-6 flex items-center">
              {hasUnsavedChanges && (
                <div className="text-sm text-amber-600 flex items-center gap-2 mr-auto">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  You have unsaved changes
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                {hasUnsavedChanges && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setSettings(originalSettings!);
                      setHasUnsavedChanges(false);
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    disabled={saving || loading}
                  >
                    Cancel
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={handleSaveSettings}
                  disabled={saving || loading || !hasUnsavedChanges}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


