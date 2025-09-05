'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { ProtectedRoute } from '@/components';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppointmentService } from '@/services';
import type { Appointment } from '@/models/Appointment';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [form, setForm] = useState<Appointment>({ title: '', description: '', startAt: '', endAt: '' });
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [lastValidStartLocal, setLastValidStartLocal] = useState('');
  const [lastValidEndLocal, setLastValidEndLocal] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Appointment | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return;
      setLoading(true);
      setError('');
      try {
        const svc = await useAppointmentService();
        const res = await svc.listByUser(user._id, {
          page, limit,
          q: q || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
        });
        setItems(res.data?.appointments || []);
        setTotal(typeof res.data?.count === 'number' ? res.data.count : null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?._id, page, limit, q, from, to]);

  const resetForm = () => {
    setForm({ title: '', description: '', startAt: '', endAt: '' });
    setEditingId(null);
    setError('');
    setStartLocal('');
    setEndLocal('');
    setLastValidStartLocal('');
    setLastValidEndLocal('');
  };

  const submit = async () => {
    if (!user?._id) return;
    if (!form.title || !startLocal || !endLocal) {
      setError('Title, start, and end are required');
      return;
    }
    if (new Date(startLocal).getTime() >= new Date(endLocal).getTime()) {
      setError('End must be after start');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const svc = await useAppointmentService();
      const payload: Appointment = {
        title: form.title,
        description: form.description,
        startAt: new Date(startLocal).toISOString(),
        endAt: new Date(endLocal).toISOString(),
      };
      if (editingId) await svc.update(editingId, payload); else await svc.create(payload);
      const res = await svc.listByUser(user._id, { page, limit, q: q || undefined, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined });
      setItems(res.data?.appointments || []);
      setTotal(typeof res.data?.count === 'number' ? res.data.count : total);
      resetForm();
      setIsModalOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      const svc = await useAppointmentService();
      await svc.remove(id);
      // After deletion, optimistically reload current page; if empty and page>1, go back one page
      let targetPage = page;
      if (items.length === 1 && page > 1) targetPage = page - 1;
      const res = await svc.listByUser(user!._id, { page: targetPage, limit, q: q || undefined, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined });
      setItems(res.data?.appointments || []);
      setPage(targetPage);
      setTotal(typeof res.data?.count === 'number' ? res.data.count : total);
      setIsConfirmOpen(false);
      setDeleteId(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete appointment');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => { resetForm(); setIsModalOpen(true); };
  const openEdit = (a: Appointment) => {
    setEditingId(a._id || null);
    setForm({ title: a.title, description: a.description, startAt: a.startAt, endAt: a.endAt });
    const isoToLocal = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${hh}:${mm}`;
    };
    const sLocal = isoToLocal(a.startAt);
    const eLocal = isoToLocal(a.endAt);
    setStartLocal(sLocal);
    setEndLocal(eLocal);
    setLastValidStartLocal(sLocal);
    setLastValidEndLocal(eLocal);
    setIsModalOpen(true);
  };
  const openView = (a: Appointment) => { setViewItem(a); setIsViewOpen(true); };
  const openConfirm = (id: string) => { setDeleteId(id); setIsConfirmOpen(true); };
  const closeConfirm = () => { setIsConfirmOpen(false); setDeleteId(null); };

  return (
    <ProtectedRoute>
      <div className="bg-white min-h-screen">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
              <p className="text-gray-600">Create and manage your appointments.</p>
            </div>
            <button className="btn-primary" onClick={openCreate}>Add appointment</button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Search</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2" placeholder="e.g. consult" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2" type="datetime-local" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input className="w-full border border-gray-300 rounded px-3 py-2" type="datetime-local" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
              </div>
            </div>
          </div>

          {error && <div className="error-message mb-4">{error}</div>}

          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => setIsModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{editingId ? 'Edit appointment' : 'New appointment'}</h2>
                  <button className="text-gray-500" onClick={() => setIsModalOpen(false)}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="border border-gray-300 rounded px-3 py-2 md:col-span-2" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  <div className="md:col-span-2">
                    <textarea className="w-full border border-gray-300 rounded px-3 py-2" rows={4} placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
                  </div>
                  <input
                    className="border border-gray-300 rounded px-3 py-2"
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) => {
                      setStartLocal(e.target.value);
                    }}
                    onBlur={() => {
                      if (!startLocal) { setLastValidStartLocal(''); return; }
                      if (endLocal && new Date(startLocal).getTime() >= new Date(endLocal).getTime()) {
                        toast.error('Start must be before end');
                        setStartLocal(lastValidStartLocal);
                        return;
                      }
                      setLastValidStartLocal(startLocal);
                    }}
                  />
                  <input
                    className="border border-gray-300 rounded px-3 py-2"
                    type="datetime-local"
                    value={endLocal}
                    onChange={(e) => {
                      setEndLocal(e.target.value);
                    }}
                    onBlur={() => {
                      if (!endLocal) { setLastValidEndLocal(''); return; }
                      if (startLocal && new Date(endLocal).getTime() <= new Date(startLocal).getTime()) {
                        toast.error('End must be after start');
                        setEndLocal(lastValidEndLocal);
                        return;
                      }
                      setLastValidEndLocal(endLocal);
                    }}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            {loading ? (
              <div className="p-6 flex items-center justify-center"><div className="loading-spinner"></div></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-3">Title</th>
                    <th className="p-3">Start</th>
                    <th className="p-3">End</th>
                    <th className="p-3 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(a => (
                    <tr key={a._id} className="border-b last:border-b-0">
                      <td className="p-3">{a.title}</td>
                      <td className="p-3">{new Date(a.startAt).toLocaleString()}</td>
                      <td className="p-3">{new Date(a.endAt).toLocaleString()}</td>
                      <td className="p-3 flex gap-2">
                        <button
                          aria-label="View appointment"
                          title="View"
                          className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 hover:bg-gray-50"
                          onClick={() => openView(a)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          aria-label="Edit appointment"
                          title="Edit"
                          className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 hover:bg-gray-50"
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label="Delete appointment"
                          title="Delete"
                          className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 hover:bg-gray-50"
                          onClick={() => openConfirm(a._id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td className="p-8 text-gray-500 text-center" colSpan={4}>No appointments</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page}{total !== null && total >= 0 ? ` of ${Math.max(1, Math.ceil(total / limit))}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <select className="border border-gray-300 rounded px-2 py-1 text-xs h-8" value={limit} onChange={(e) => { setPage(1); setLimit(parseInt(e.target.value, 10)); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button
                aria-label="Previous page"
                className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                aria-label="Next page"
                className="inline-flex items-center justify-center border border-gray-300 rounded-md h-8 w-8 text-gray-700 disabled:opacity-50"
                disabled={(total !== null ? page >= Math.max(1, Math.ceil(total / limit)) : items.length < limit) || loading}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {isConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={closeConfirm}></div>
              <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg border border-gray-200 p-5">
                <h3 className="font-semibold mb-2">Delete appointment?</h3>
                <p className="text-sm text-gray-600 mb-4">This action cannot be undone.</p>
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary" onClick={closeConfirm}>Cancel</button>
                  <button className="btn-primary" onClick={() => deleteId && remove(deleteId)} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</button>
                </div>
              </div>
            </div>
          )}
          {isViewOpen && viewItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => setIsViewOpen(false)}></div>
              <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Appointment details</h2>
                  <button className="text-gray-500" onClick={() => setIsViewOpen(false)}>✕</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Title</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{viewItem.title}</div>
                  </div>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-gray-700 font-medium mb-1">Description</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50 whitespace-pre-wrap">{viewItem.description || '-'}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">Start</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{new Date(viewItem.startAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-gray-700 font-medium mb-1">End</div>
                    <div className="border border-gray-200 rounded px-3 py-2 bg-gray-50">{new Date(viewItem.endAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="btn-secondary" onClick={() => setIsViewOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}


