'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2, Bell, X } from 'lucide-react';
import { ProtectedRoute, NoAppEmptyState, ConfirmModal } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useLeadService, useIntegrationService } from '@/services';
import type { Lead } from '@/models/Lead';
import { toast } from 'react-toastify';

export default function LeadsPage() {
  const { user } = useAuth();
  const { currentApp, isLoading: isLoadingApp } = useApp();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState<number | null>(null);

  const [q, setQ] = useState('');
  const [leadType] = useState('');
  const [serviceType] = useState('');
  const [sortBy] = useState('leadDateTime');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Lead | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lead | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // WebSocket for real-time updates
  const [wsConnected, setWsConnected] = useState(false);
  const [newLeadNotification, setNewLeadNotification] = useState<Lead | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Integration settings for button colors
  const [primaryColor, setPrimaryColor] = useState('#00bc7d');

  // Load integration settings for primary color
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentApp?.id) return;
      try {
        const svc = await useIntegrationService();
        const res = await svc.getSettings(currentApp.id);
        const integration = res.data?.integration;
        if (integration?.primaryColor) {
          setPrimaryColor(integration.primaryColor);
        }
      } catch (e) {
        console.error('Failed to load integration settings:', e);
      }
    };
    loadSettings();
  }, [currentApp?.id]);

  // Load leads data
  useEffect(() => {
    const load = async () => {
      if (!currentApp?.id) return;
      setLoading(true);
      setError('');
      try {
        const svc = await useLeadService();
        const res = await svc.listByApp(currentApp.id, {
          page, limit,
          q: q || undefined,
          leadType: leadType || undefined,
          serviceType: serviceType || undefined,
          sortBy: sortBy || undefined,
          sortOrder,
        });
        setItems(res.data?.leads || []);
        const totalCount = res.data?.pagination?.total ?? res.data?.count;
        setTotal(typeof totalCount === 'number' ? totalCount : null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load leads');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentApp?.id, page, limit, q, leadType, serviceType, sortBy, sortOrder]);

  // Socket.IO connection for real-time lead updates
  useEffect(() => {
    if (!currentApp?.id) return;

    // Connect to same port as API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const baseUrl = apiUrl.replace('/api/v1', '');

    // Import Socket.IO client dynamically
    import('socket.io-client').then(({ io }) => {
      const socket = io(baseUrl);
      wsRef.current = socket;

      socket.on('connect', () => {
        setWsConnected(true);
        console.log('Socket.IO connected for leads updates');
        
        // Join the user room
        socket.emit('join', user._id);
      });

      socket.on('new_lead', (data) => {
        const newLead = data.lead as Lead;
        
        // Add new lead to the beginning of the list
        setItems(prevItems => [newLead, ...prevItems]);
        
        // Show notification
        setNewLeadNotification(newLead);
        
        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setNewLeadNotification(null);
        }, 5000);
        
        // Update total count
        setTotal(prev => prev !== null ? prev + 1 : 1);
      });

      socket.on('disconnect', () => {
        setWsConnected(false);
        console.log('Socket.IO disconnected for leads updates');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        setWsConnected(false);
      });

    }).catch((error) => {
      console.error('Failed to load Socket.IO client:', error);
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [user?._id]);

  // Format inline bullet points (•) so each starts on a new line
  const formatBulletPoints = (str: string) => str.replace(/ • /g, '\n• ');

  // Render text with URLs as clickable links (opens in new tab)
  const renderTextWithLinks = (str: string, keyPrefix: string): React.ReactNode => {
    const formatted = formatBulletPoints(str);
    const urlRegex = /https?:\/\/[^\s]+/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(formatted)) !== null) {
      if (urlMatch.index > lastIndex) {
        parts.push(formatted.slice(lastIndex, urlMatch.index));
      }
      const rawUrl = urlMatch[0];
      const href = rawUrl.replace(/[.,;?!)]+$/, '');
      parts.push(
        <a
          key={`${keyPrefix}-url-${urlMatch.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all hover:text-blue-800"
        >
          {rawUrl}
        </a>
      );
      lastIndex = urlMatch.index + rawUrl.length;
    }
    if (lastIndex < formatted.length) {
      parts.push(formatted.slice(lastIndex));
    }
    if (parts.length === 0) return formatted;
    return <span key={keyPrefix} className="whitespace-pre-wrap">{parts}</span>;
  };

  const renderBotContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Updated regex to handle both formats:
    // 1. <button>text</button> (simple format)
    // 2. <button value="something">text</button> (with value attribute)
    const regex = /<button(?:\s+value=["']([^"']*)["'])?>([\s\S]*?)<\/button>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const chunk = text.slice(lastIndex, match.index).trim();
        if (chunk) parts.push(renderTextWithLinks(chunk, `t-${lastIndex}`));
      }
      
      // Extract button text and value
      const buttonValue = match[1] || ''; // value attribute
      const buttonText = (match[2] || '').trim(); // text content
      
      if (buttonText) {
        // Use button value if available, otherwise use button text
        const clickValue = buttonValue || buttonText;
        
        parts.push(
          <button
            key={`b-${match.index}`}
            className="block w-full text-left rounded-full text-white text-xs sm:text-sm font-medium px-3 sm:px-3 py-2 sm:py-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 active:translate-y-px transition mt-1 whitespace-normal break-words"
            style={{ 
              backgroundColor: primaryColor,
              '--hover-color': primaryColor + 'dd'
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor + 'dd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = primaryColor;
            }}
            disabled
          >
            {buttonText}
          </button>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      const rest = text.slice(lastIndex).trim();
      if (rest) parts.push(renderTextWithLinks(rest, `t-${lastIndex}`));
    }
    
    if (parts.length === 0) return renderTextWithLinks(text, 'only');
    return <div className="flex flex-wrap items-start gap-2">{parts}</div>;
  };

  const openView = (lead: Lead) => { setViewItem(lead); setIsViewOpen(true); };
  const closeView = () => { setIsViewOpen(false); setViewItem(null); };

  const openEdit = (lead: Lead) => { setEditItem(lead); setIsEditOpen(true); };
  const closeEdit = () => { setIsEditOpen(false); setEditItem(null); };

  const openConfirm = (id: string) => { setDeleteId(id); setIsConfirmOpen(true); };
  const closeConfirm = () => { setIsConfirmOpen(false); setDeleteId(null); };

  const submitEdit = async () => {
    if (!editItem?._id) return;
    setSaving(true);
    setError('');
    try {
      const svc = await useLeadService();
      const payload: Partial<Lead> = {
        title: editItem.title,
        summary: editItem.summary,
        description: editItem.description,
        leadName: editItem.leadName,
        leadPhoneNumber: editItem.leadPhoneNumber,
        leadEmail: editItem.leadEmail,
        leadType: editItem.leadType,
        serviceType: editItem.serviceType,
      };
      await svc.update(editItem._id, payload);
      // reload current page
      const res = await svc.listByApp(currentApp!.id, { page, limit, q: q || undefined, leadType: leadType || undefined, serviceType: serviceType || undefined, sortBy: sortBy || undefined, sortOrder });
      setItems(res.data?.leads || []);
      setTotal(typeof res.data?.count === 'number' ? res.data.count : total);
      setIsEditOpen(false);
      setEditItem(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      const svc = await useLeadService();
      await svc.remove(id);
      let targetPage = page;
      if (items.length === 1 && page > 1) targetPage = page - 1;
      const res = currentApp?.id
        ? await svc.listByApp(currentApp.id, { page: targetPage, limit, q: q || undefined, leadType: leadType || undefined, serviceType: serviceType || undefined, sortBy: sortBy || undefined, sortOrder })
        : await svc.listByUser(user!._id, { page: targetPage, limit, q: q || undefined, leadType: leadType || undefined, serviceType: serviceType || undefined, sortBy: sortBy || undefined, sortOrder });
      setItems(res.data?.leads || []);
      setPage(targetPage);
      setTotal(typeof res.data?.count === 'number' ? res.data.count : total);
      setIsConfirmOpen(false);
      setDeleteId(null);
      toast.success('Lead deleted successfully');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete lead');
      toast.error(e?.message || 'Failed to delete lead');
    } finally {
      setSaving(false);
    }
  };

  // Show loading spinner while apps are loading
  if (isLoadingApp) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#00bc7d]"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Show empty state if no app is selected (after loading completes)
  if (!currentApp || !currentApp.id) {
    return (
      <ProtectedRoute>
        <div className="bg-white min-h-screen">
          <Navigation />
          <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <NoAppEmptyState
                title="View and Manage Your Leads"
                description="Create an app first to start capturing and managing leads from your chatbot. Each app tracks leads independently with industry-specific lead types and categorization."
              />
            </div>
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
            <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-600">Browse, filter, view, edit or delete your captured leads.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
            <div className="grid grid-cols-1 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Search</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="e.g. implant" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
              </div>
            </div>
          </div>

          {error && <div className="error-message mb-4">{error}</div>}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            {loading ? (
              <div className="p-6 flex items-center justify-center"><div className="loading-spinner"></div></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-3">Title</th>
                    <th className="p-3">Lead type</th>
                    <th className="p-3">Service type</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(l => (
                    <tr key={l._id} className="border-b last:border-b-0">
                      <td className="p-3">{l.title}</td>
                      <td className="p-3">{l.leadType || '-'}</td>
                      <td className="p-3">{l.serviceType || '-'}</td>
                      <td className="p-3">{l.leadDateTime ? new Date(l.leadDateTime).toLocaleString() : '-'}</td>
                      <td className="p-3 flex gap-2">
                        <button aria-label="View lead" title="View" className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 hover:bg-gray-50" onClick={() => openView(l)}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button aria-label="Edit lead" title="Edit" className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 hover:bg-gray-50" onClick={() => openEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button aria-label="Delete lead" title="Delete" className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 hover:bg-gray-50" onClick={() => openConfirm(l._id!)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td className="p-8 text-gray-500 text-center" colSpan={5}>No leads</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {page}{total !== null && total >= 0 ? ` of ${Math.max(1, Math.ceil(total / limit))}` : ''}</div>
            <div className="flex items-center gap-2">
              <select className="border border-gray-300 rounded px-2 py-1 text-xs h-8" value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button aria-label="Previous page" className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button aria-label="Next page" className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 disabled:opacity-50" disabled={(total !== null ? page >= Math.max(1, Math.ceil(total / limit)) : items.length < limit) || loading} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isViewOpen && viewItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={closeView}></div>
              <div className="relative bg-white w-full max-w-3xl rounded-lg shadow-lg border border-gray-200 p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Lead details</h2>
                  <button className="text-gray-500" onClick={closeView}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Title</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.title}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead name</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadName || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead phone</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadPhoneNumber || '-'}</div>
                  </div>
                  <div className="text-sm md:col-span-2">
                    <div className="text-gray-700 font-medium mb-1">Lead email</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadEmail || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead type</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadType || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Service type</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.serviceType || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Summary</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">{viewItem.summary || '-'}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Description</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">{viewItem.description || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Lead date</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.leadDateTime ? new Date(viewItem.leadDateTime).toLocaleString() : '-'}</div>
                  </div>
                  {viewItem.history && viewItem.history.length > 0 && (
                    <div className="md:col-span-2 text-sm">
                      <div className="text-gray-700 font-medium mb-2">Conversation History</div>
                      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 max-h-96 overflow-y-auto pb-6">
                        <div className="space-y-3">
                          {viewItem.history.map((message, index) => (
                            <div
                              key={index}
                              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                  message.role === 'user'
                                    ? 'text-white'
                                    : 'bg-white text-gray-800 border border-gray-200'
                                }`}
                                style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
                              >
                                <div className="text-xs font-semibold mb-1 opacity-80">
                                  {message.role === 'user' ? 'Customer' : 'Assistant'}
                                </div>
                                {message.role === 'assistant'
                                  ? renderBotContent(message.content)
                                  : <div className="whitespace-pre-wrap text-sm">{message.content}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="btn-secondary" onClick={closeView}>Close</button>
                </div>
              </div>
            </div>
          )}

          {isEditOpen && editItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={closeEdit}></div>
              <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Edit lead</h2>
                  <button className="text-gray-500" onClick={closeEdit}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="border border-gray-300 rounded px-3 py-2 md:col-span-2" placeholder="Title" value={editItem.title} onChange={(e) => setEditItem({ ...editItem, title: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Lead name" value={editItem.leadName || ''} onChange={(e) => setEditItem({ ...editItem, leadName: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Lead phone number" value={editItem.leadPhoneNumber || ''} onChange={(e) => setEditItem({ ...editItem, leadPhoneNumber: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2 md:col-span-2" placeholder="Lead email" value={editItem.leadEmail || ''} onChange={(e) => setEditItem({ ...editItem, leadEmail: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Lead type" value={editItem.leadType || ''} onChange={(e) => setEditItem({ ...editItem, leadType: e.target.value })} />
                  <input className="border border-gray-300 rounded px-3 py-2" placeholder="Service type" value={editItem.serviceType || ''} onChange={(e) => setEditItem({ ...editItem, serviceType: e.target.value })} />
                  <textarea className="w-full border border-gray-300 rounded px-3 py-2 md:col-span-2" rows={3} placeholder="Summary" value={editItem.summary || ''} onChange={(e) => setEditItem({ ...editItem, summary: e.target.value })}></textarea>
                  <textarea className="w-full border border-gray-300 rounded px-3 py-2 md:col-span-2" rows={4} placeholder="Description" value={editItem.description || ''} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}></textarea>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={closeEdit}>Cancel</button>
                  <button className="btn-primary" onClick={submitEdit} disabled={saving}>{saving ? 'Saving...' : 'Update'}</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={closeConfirm}
            onConfirm={() => deleteId && remove(deleteId)}
            title="Delete Lead"
            message={(() => {
              const lead = deleteId ? items.find(l => l._id === deleteId) : null;
              const label = lead ? [lead.title, lead.leadName].filter(Boolean).join(' – ').trim() || 'Lead' : 'this lead';
              return `Are you sure you want to delete ${label ? `"${label}"` : 'this lead'}? This action cannot be undone.`;
            })()}
            confirmText="Delete Lead"
            cancelText="Cancel"
            confirmButtonClass="btn-danger"
            isLoading={saving}
          />

          {/* New Lead Notification */}
          {newLeadNotification && (
            <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Bell className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">New Lead Captured!</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>{newLeadNotification.title}</strong>
                    {newLeadNotification.leadName && (
                      <span> from {newLeadNotification.leadName}</span>
                    )}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        openView(newLeadNotification);
                        setNewLeadNotification(null);
                      }}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setNewLeadNotification(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setNewLeadNotification(null)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


