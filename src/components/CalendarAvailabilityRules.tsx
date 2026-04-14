'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAvailabilityService } from '@/services';
import { integrationService } from '@/services/integrationService';
import type { AvailabilityDayUTC, AvailabilityExceptionItem, DayOfWeek } from '@/models/Availability';
import { toast } from 'react-toastify';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_OPTIONS = [15, 30, 60] as const;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalTime(utcHHmm: string): string {
  const [h, m] = utcHHmm.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function toUTCTime(localHHmm: string): string {
  const [h, m] = localHHmm.split(':').map(Number);
  const dLocal = new Date();
  dLocal.setHours(h, m, 0, 0);
  return `${dLocal.getUTCHours().toString().padStart(2, '0')}:${dLocal.getUTCMinutes().toString().padStart(2, '0')}`;
}

function getMonthDays(year: number, month: number): { date: string; day: number; isCurrentMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevLast = new Date(prevYear, prevMonth + 1, 0).getDate();
  const result: { date: string; day: number; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = prevLast - startPad + i + 1;
    result.push({ date: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    result.push({ date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true });
  }
  const remaining = 42 - result.length;
  for (let i = 0; i < remaining; i++) {
    const d = i + 1;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    result.push({ date: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
  }
  return result;
}

interface CalendarAvailabilityRulesProps {
  appId: string;
  defaultExpanded?: boolean;
  /** When set, only the matching section is rendered (for use inside a dialog). */
  dialogMode?: 'availability' | 'exceptions';
  /** Called when the user closes the dialog (e.g. Close button). */
  onClose?: () => void;
}

export default function CalendarAvailabilityRules({ appId, defaultExpanded = false, dialogMode, onClose }: CalendarAvailabilityRulesProps) {
  const browserTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [days, setDays] = useState<AvailabilityDayUTC[]>([]);
  const [originalDays, setOriginalDays] = useState<AvailabilityDayUTC[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [savingSlotMinutes, setSavingSlotMinutes] = useState(false);
  const [exceptions, setExceptions] = useState<Record<string, AvailabilityExceptionItem>>({});
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [customSlots, setCustomSlots] = useState<Array<{ start: string; end: string }>>([{ start: '09:00', end: '17:00' }]);
  const [exceptionNotAvailable, setExceptionNotAvailable] = useState(false);
  const [exceptionAllDay, setExceptionAllDay] = useState(false);
  const [exceptionLabel, setExceptionLabel] = useState('');
  const [editingExistingException, setEditingExistingException] = useState(false);

  const getSyncStatusMeta = (status?: AvailabilityExceptionItem['syncStatus']) => {
    switch (status) {
      case 'synced':
        return { label: 'Synced', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'failed':
        return { label: 'Sync failed', className: 'text-red-700 bg-red-50 border-red-200' };
      case 'pending':
        return { label: 'Sync pending', className: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'skipped':
        return { label: 'Sync skipped', className: 'text-gray-700 bg-gray-100 border-gray-200' };
      default:
        return { label: 'Not synced', className: 'text-gray-700 bg-gray-100 border-gray-200' };
    }
  };

  const sortedDays = useMemo(() => {
    if (days.length === 0) return [] as AvailabilityDayUTC[];
    const rest = days.slice(1);
    const sunday = days[0];
    return [...rest, sunday];
  }, [days]);

  const load = useCallback(async () => {
    if (!appId) return;
    try {
      const [availRes, intRes] = await Promise.all([
        useAvailabilityService().then((s) => s.getByApp(appId)),
        integrationService.getSettings(appId),
      ]);
      const list = availRes.data?.availability ?? [];
      const map = new Map<number, AvailabilityDayUTC>();
      list.forEach((d: AvailabilityDayUTC) => map.set(d.dayOfWeek, d));
      const full: AvailabilityDayUTC[] = Array.from({ length: 7 }, (_, i) => {
        const dow = i as DayOfWeek;
        const existing = map.get(dow);
        return existing ? { ...existing, allDay: !!existing.allDay } : { dayOfWeek: dow, slots: [], allDay: false } as AvailabilityDayUTC;
      });
      setDays(full);
      setOriginalDays(full);
      const min = intRes.data?.integration?.calendarSlotMinutes;
      if (min === 15 || min === 30 || min === 60) setSlotMinutes(min);
    } catch {
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  const loadExceptions = useCallback(async () => {
    if (!appId) return;
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const svc = await useAvailabilityService();
      const res = await svc.getExceptions(appId, from, to);
      const map: Record<string, AvailabilityExceptionItem> = {};
      (res.data?.exceptions ?? []).forEach((ex: AvailabilityExceptionItem) => { map[ex.date] = ex; });
      setExceptions(map);
    } catch {
      toast.error('Failed to load exceptions');
    }
  }, [appId, year, month]);

  useEffect(() => {
    if ((exceptionsOpen || dialogMode === 'exceptions') && appId) loadExceptions();
  }, [exceptionsOpen, dialogMode, appId, loadExceptions]);

  const monthDays = getMonthDays(year, month);
  const selectedException = selectedDate ? exceptions[selectedDate] : null;

  useEffect(() => {
    if (selectedDate) {
      setCustomSlots([{ start: '09:00', end: '17:00' }]);
      setExceptionNotAvailable(false);
      setExceptionAllDay(false);
      setExceptionLabel('');
      setEditingExistingException(false);
    }
  }, [selectedDate]);
  const hasPending = useMemo(() => {
    const n = (arr: AvailabilityDayUTC[]) => arr.map((d) => ({ dayOfWeek: d.dayOfWeek, allDay: !!(d as any).allDay, slots: (d as any).allDay ? [] : d.slots.map((s) => ({ start: s.start, end: s.end })) }));
    return JSON.stringify(n(days)) !== JSON.stringify(n(originalDays));
  }, [days, originalDays]);

  const handleSlotMinutesChange = async (value: number) => {
    if (!appId) return;
    setSavingSlotMinutes(true);
    try {
      await integrationService.updateSettings(appId, { calendarSlotMinutes: value });
      setSlotMinutes(value);
      toast.success('Slot length updated');
    } catch {
      toast.error('Failed to update slot length');
    } finally {
      setSavingSlotMinutes(false);
    }
  };

  const addSlot = (dayIndex: number) => {
    setDays((prev) => {
      const d = prev[dayIndex];
      if (!d) return prev;
      const last = d.slots[d.slots.length - 1];
      const newStart = last ? toLocalTime(last.end) : '09:00';
      const [h, m] = newStart.split(':').map(Number);
      const endM = h * 60 + m + 60;
      const newEnd = `${String(Math.floor(endM / 60) % 24).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
      return prev.map((day, i) =>
        i === dayIndex ? { ...day, allDay: false, slots: [...day.slots, { start: toUTCTime(newStart), end: toUTCTime(newEnd) }] } as any : day
      );
    });
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, slots: d.slots.filter((_, si) => si !== slotIndex) } : d)));
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: 'start' | 'end', localHHmm: string) => {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, slots: d.slots.map((s, si) => (si === slotIndex ? { ...s, [field]: toUTCTime(localHHmm) } : s)) } : d
      )
    );
  };

  const saveAll = async () => {
    if (!appId) return;
    setSaving(true);
    try {
      const svc = await useAvailabilityService();
      const outgoingDays = days.map((d) => ({ dayOfWeek: d.dayOfWeek, allDay: !!(d as any).allDay, slots: (d as any).allDay ? [] : d.slots }));
      await svc.bulkReplaceForApp(appId, { days: outgoingDays as any });
      setOriginalDays(days);
      toast.success('Availability saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveException = async (
    dateStr: string,
    payload: { allDayOff?: boolean; overrideAllDay?: boolean; slots?: Array<{ start: string; end: string }>; label?: string | null }
  ) => {
    if (!appId) return;
    try {
      const svc = await useAvailabilityService();
      await svc.putException(appId, { date: dateStr, timezone: browserTimezone, ...payload });
      setExceptions((prev) => ({ ...prev, [dateStr]: { date: dateStr, timezone: browserTimezone, ...payload } }));
      setSelectedDate(null);
      toast.success('Exception saved');
    } catch {
      toast.error('Failed to save exception');
    }
  };

  const saveExceptionsBulk = async (
    dates: string[],
    payload: { allDayOff?: boolean; overrideAllDay?: boolean; slots?: Array<{ start: string; end: string }>; label?: string | null }
  ) => {
    if (!appId || dates.length === 0) return;
    try {
      const svc = await useAvailabilityService();
      await svc.putExceptionsBulk(appId, {
        exceptions: dates.map((date) => ({ date, timezone: browserTimezone, ...payload }))
      });
      setExceptions((prev) => {
        const next = { ...prev };
        dates.forEach((date) => {
          next[date] = { date, timezone: browserTimezone, ...payload };
        });
        return next;
      });
      setSelectedDate(null);
      setSelectedDates([]);
      toast.success(`Exceptions saved for ${dates.length} date${dates.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to save exceptions');
    }
  };

  const removeException = async (dateStr: string) => {
    if (!appId) return;
    try {
      const svc = await useAvailabilityService();
      await svc.deleteException(appId, dateStr);
      setExceptions((prev) => {
        const next = { ...prev };
        delete next[dateStr];
        return next;
      });
      setSelectedDate(null);
      toast.success('Exception removed');
    } catch {
      toast.error('Failed to remove exception');
    }
  };

  const removeExceptionsBulk = async (dates: string[]) => {
    if (!appId || dates.length === 0) return;
    try {
      const svc = await useAvailabilityService();
      await Promise.all(dates.map((date) => svc.deleteException(appId, date)));
      setExceptions((prev) => {
        const next = { ...prev };
        dates.forEach((date) => delete next[date]);
        return next;
      });
      setSelectedDate(null);
      setSelectedDates([]);
      toast.success(`Exceptions removed for ${dates.length} date${dates.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to remove selected exceptions');
    }
  };

  const retryExceptionSync = async (dateStr: string) => {
    if (!appId) return;
    try {
      const svc = await useAvailabilityService();
      await svc.retryExceptionSync(appId, dateStr);
      await loadExceptions();
      toast.success('Sync retried');
    } catch {
      toast.error('Failed to retry sync');
    }
  };

  const handleDateClick = (date: string) => {
    if (!multiSelectMode) {
      setSelectedDate(date);
      setSelectedDates([date]);
      return;
    }
    setSelectedDate(date);
    setSelectedDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  };

  if (dialogMode === 'availability') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Slot length</label>
          <select value={slotMinutes} onChange={(e) => handleSlotMinutesChange(Number(e.target.value))} disabled={savingSlotMinutes} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
            {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          {savingSlotMinutes && <span className="text-xs text-gray-500">Saving…</span>}
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-800 mb-1">Weekly schedule</h4>
          <p className="text-xs text-gray-500 mb-2">This schedule repeats every week. Use date exceptions for one-off changes.</p>
          {loading ? (
            <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#c01721] border-t-transparent" /></div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {sortedDays.map((d) => {
                const di = d.dayOfWeek;
                return (
                  <div key={d.dayOfWeek} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border-b border-gray-100 last:border-b-0 items-center bg-gray-50/50">
                    <div className="md:col-span-2 font-medium text-gray-800 text-sm">{dayLabels[d.dayOfWeek]}</div>
                    <div className="md:col-span-10 space-y-3">
                      <label className="inline-flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={!!(d as any).allDay} onChange={(e) => setDays((prev) => prev.map((day, idx) => (idx === di ? { ...day, allDay: e.target.checked } as any : day)))} className="sr-only peer" />
                        <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                        <span className="text-sm text-gray-700 font-medium">All day</span>
                      </label>
                      {!((d as any).allDay) && (
                        <div className="space-y-2 mt-2">
                          {d.slots.map((s, si) => (
                            <div key={si} className="flex items-center gap-2 flex-wrap">
                              <input type="time" value={toLocalTime(s.start)} onChange={(e) => updateSlot(di, si, 'start', e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                              <span className="text-gray-500 text-sm">–</span>
                              <input type="time" value={toLocalTime(s.end)} onChange={(e) => updateSlot(di, si, 'end', e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                              <button type="button" onClick={() => removeSlot(di, si)} className="p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Remove slot" aria-label="Remove slot"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          ))}
                          <div className="pt-1"><button type="button" onClick={() => addSlot(di)} className="text-sm text-[#c01721] hover:underline font-medium">+ Add slot</button></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="p-3 bg-white flex justify-end gap-2">
                {hasPending && <span className="text-xs text-amber-600 self-center">Unsaved changes</span>}
                <button type="button" onClick={saveAll} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#00bc7d] text-white text-sm hover:bg-[#00a06a] disabled:opacity-50">{saving ? 'Saving…' : 'Save schedule'}</button>
                {onClose && <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (dialogMode === 'exceptions') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }} className="text-sm px-2 py-1 border rounded">Prev</button>
            <span className="text-sm font-medium">{MONTH_NAMES[month]} {year}</span>
            <button type="button" onClick={() => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }} className="text-sm px-2 py-1 border rounded">Next</button>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={multiSelectMode}
                onChange={(e) => {
                  const on = e.target.checked;
                  setMultiSelectMode(on);
                  setSelectedDates(on && selectedDate ? [selectedDate] : []);
                }}
                className="sr-only peer"
              />
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
              <span className="text-sm text-gray-700 font-medium">Multi-date</span>
            </label>
            {multiSelectMode && selectedDates.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDates([])}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map(({ date, day, isCurrentMonth }) => {
            const ex = exceptions[date];
            const isSelected = multiSelectMode ? selectedDates.includes(date) : selectedDate === date;
            return (
              <button key={date} type="button" onClick={() => handleDateClick(date)} className={`py-1.5 rounded text-sm ${isCurrentMonth ? 'bg-white text-gray-900' : 'text-gray-400 bg-gray-100'} ${isSelected ? 'ring-2 ring-[#c01721]' : ''}`}>
                {day}
                {ex && (
                  <span className={`block w-1 h-1 rounded-full mx-auto mt-0.5 ${
                    ex.syncStatus === 'failed'
                      ? 'bg-red-500'
                      : ex.syncStatus === 'pending'
                        ? 'bg-amber-500'
                        : 'bg-[#00bc7d]'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
        {selectedDate && (
          <div className="mt-4 p-4 bg-white border rounded-lg shadow-sm w-full min-w-0 overflow-visible">
            <p className="text-sm font-medium text-gray-800 mb-3">
              {multiSelectMode && selectedDates.length > 1 ? `${selectedDates.length} selected dates` : selectedDate}
            </p>
            {selectedException && !editingExistingException && !(multiSelectMode && selectedDates.length > 1) ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  {selectedException.allDayOff && 'Not available'}
                  {selectedException.overrideAllDay && 'All day available'}
                  {selectedException.slots?.length ? `Custom: ${selectedException.slots.map((s) => `${s.start}-${s.end}`).join(', ')}` : ''}
                </p>
                {selectedException.label && (
                  <p className="text-xs text-gray-700">
                    Label: <span className="font-medium">{selectedException.label}</span>
                  </p>
                )}
                <div className={`inline-flex items-center text-[11px] px-2 py-1 rounded border ${getSyncStatusMeta(selectedException.syncStatus).className}`}>
                  {getSyncStatusMeta(selectedException.syncStatus).label}
                </div>
                {selectedException.syncStatus === 'failed' && selectedException.syncError && (
                  <p className="text-[11px] text-red-600 break-words">{selectedException.syncError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExceptionNotAvailable(!!selectedException.allDayOff);
                      setExceptionAllDay(!!selectedException.overrideAllDay);
                      setCustomSlots(
                        selectedException.slots && selectedException.slots.length > 0
                          ? selectedException.slots
                          : [{ start: '09:00', end: '17:00' }]
                      );
                      setExceptionLabel(selectedException.label || '');
                      setEditingExistingException(true);
                    }}
                    className="text-xs px-2 py-1.5 border rounded hover:bg-blue-50 text-blue-700 border-blue-200"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => removeException(selectedDate)} className="inline-flex items-center gap-1.5 text-xs px-2 py-1.5 border rounded hover:bg-red-50 text-red-600 border-red-200" title="Remove exception" aria-label="Remove exception"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                  {selectedException.syncStatus === 'failed' && (
                    <button
                      type="button"
                      onClick={() => retryExceptionSync(selectedDate)}
                      className="text-xs px-2 py-1.5 border rounded hover:bg-amber-50 text-amber-700 border-amber-200"
                    >
                      Retry sync
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedDate(null)} className="text-xs px-2 py-1.5 border rounded hover:bg-gray-50">Close</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full min-w-0">
                <div className="flex flex-wrap items-center gap-6">
                  <label className="inline-flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={exceptionNotAvailable} onChange={(e) => { const on = e.target.checked; setExceptionNotAvailable(on); if (on) setExceptionAllDay(false); }} className="sr-only peer" />
                    <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                    <span className="text-sm text-gray-700 font-medium">Not available</span>
                  </label>
                  <label className="inline-flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={exceptionAllDay} onChange={(e) => { const on = e.target.checked; setExceptionAllDay(on); if (on) setExceptionNotAvailable(false); }} className="sr-only peer" />
                    <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                    <span className="text-sm text-gray-700 font-medium">All day</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Label (optional)</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={exceptionLabel}
                    onChange={(e) => setExceptionLabel(e.target.value)}
                    placeholder="e.g. Vacation, Team meeting"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
                {!exceptionNotAvailable && !exceptionAllDay && (
                  <div className="space-y-3 pt-2 w-full min-w-0">
                    <p className="text-xs text-gray-500">Custom time slots for this date:</p>
                    {customSlots.map((slot, idx) => (
                      <div key={idx} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-2 items-center w-full">
                        <input type="time" value={slot.start} onChange={(e) => setCustomSlots((s) => s.map((x, i) => (i === idx ? { ...x, start: e.target.value } : x)))} className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-0 w-full" />
                        <span className="text-gray-500 text-sm shrink-0">–</span>
                        <input type="time" value={slot.end} onChange={(e) => setCustomSlots((s) => s.map((x, i) => (i === idx ? { ...x, end: e.target.value } : x)))} className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-0 w-full" />
                        <button type="button" onClick={() => setCustomSlots((s) => s.filter((_, i) => i !== idx))} className="p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0" title="Remove slot" aria-label="Remove slot"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <div className="pt-2"><button type="button" onClick={() => setCustomSlots((s) => [...s, { start: '09:00', end: '17:00' }])} className="text-sm text-[#c01721] hover:underline font-medium">+ Add slot</button></div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={async () => {
                      const label = exceptionLabel.trim() || null;
                      const payload = exceptionNotAvailable
                        ? { allDayOff: true, label }
                        : exceptionAllDay
                          ? { overrideAllDay: true, label }
                          : { slots: customSlots, label };
                      if (multiSelectMode && selectedDates.length > 1) await saveExceptionsBulk(selectedDates, payload);
                      else await saveException(selectedDate, payload);
                      loadExceptions();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#00bc7d] text-white text-sm hover:bg-[#00a06a]"
                  >
                    {multiSelectMode && selectedDates.length > 1 ? `Save for ${selectedDates.length} dates` : 'Save'}
                  </button>
                  {multiSelectMode && selectedDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExceptionsBulk(selectedDates)}
                      className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Remove selected
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedDate(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                </div>
              </div>
            )}
          </div>
        )}
        {onClose && <div className="pt-4 border-t border-gray-200 flex justify-end"><button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button></div>}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 mt-4 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Availability rules
      </button>
      <p className="text-xs text-gray-500 mt-0.5 ml-6">Set which days and times you’re available for appointments.</p>

      {expanded && (
        <div className="mt-4 ml-0 space-y-6">
          {/* Slot length */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Slot length</label>
            <select
              value={slotMinutes}
              onChange={(e) => handleSlotMinutesChange(Number(e.target.value))}
              disabled={savingSlotMinutes}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            >
              {SLOT_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
            {savingSlotMinutes && <span className="text-xs text-gray-500">Saving…</span>}
          </div>

          {/* Weekly schedule */}
          <div>
            <h4 className="text-sm font-medium text-gray-800 mb-1">Weekly schedule</h4>
            <p className="text-xs text-gray-500 mb-2">This schedule repeats every week. Use date exceptions below for one-off changes.</p>
            {loading ? (
              <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#c01721] border-t-transparent" /></div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {sortedDays.map((d) => {
                  const di = d.dayOfWeek;
                  return (
                    <div key={d.dayOfWeek} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border-b border-gray-100 last:border-b-0 items-center bg-gray-50/50">
                      <div className="md:col-span-2 font-medium text-gray-800 text-sm">{dayLabels[d.dayOfWeek]}</div>
                      <div className="md:col-span-10 space-y-3">
                        <label className="inline-flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!(d as any).allDay}
                            onChange={(e) => setDays((prev) => prev.map((day, idx) => (idx === di ? { ...day, allDay: e.target.checked } as any : day)))}
                            className="sr-only peer"
                          />
                          <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                          <span className="text-sm text-gray-700 font-medium">All day</span>
                        </label>
                        {!((d as any).allDay) && (
                          <div className="space-y-2 mt-2">
                            {d.slots.map((s, si) => (
                              <div key={si} className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="time"
                                  value={toLocalTime(s.start)}
                                  onChange={(e) => updateSlot(di, si, 'start', e.target.value)}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                                />
                                <span className="text-gray-500 text-sm">–</span>
                                <input
                                  type="time"
                                  value={toLocalTime(s.end)}
                                  onChange={(e) => updateSlot(di, si, 'end', e.target.value)}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSlot(di, si)}
                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Remove slot"
                                  aria-label="Remove slot"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <div className="pt-1">
                              <button type="button" onClick={() => addSlot(di)} className="text-sm text-[#c01721] hover:underline font-medium">+ Add slot</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="p-3 bg-white flex justify-end gap-2">
                  {hasPending && <span className="text-xs text-amber-600 self-center">Unsaved changes</span>}
                  <button type="button" onClick={saveAll} disabled={saving} className="px-3 py-1.5 rounded-lg bg-[#00bc7d] text-white text-sm hover:bg-[#00a06a] disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save schedule'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Date exceptions */}
          <div>
            <button type="button" onClick={() => setExceptionsOpen((o) => !o)} className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              {exceptionsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Date exceptions
            </button>
            {exceptionsOpen && (
              <div className="mt-3 ml-0 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }} className="text-sm px-2 py-1 border rounded">Prev</button>
                    <span className="text-sm font-medium">{MONTH_NAMES[month]} {year}</span>
                    <button type="button" onClick={() => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }} className="text-sm px-2 py-1 border rounded">Next</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={multiSelectMode}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setMultiSelectMode(on);
                          setSelectedDates(on && selectedDate ? [selectedDate] : []);
                        }}
                        className="sr-only peer"
                      />
                      <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                      <span className="text-sm text-gray-700 font-medium">Multi-date</span>
                    </label>
                    {multiSelectMode && selectedDates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDates([])}
                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
                  {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(({ date, day, isCurrentMonth }) => {
                    const ex = exceptions[date];
                    const isSelected = multiSelectMode ? selectedDates.includes(date) : selectedDate === date;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => handleDateClick(date)}
                        className={`py-1.5 rounded text-sm ${isCurrentMonth ? 'bg-white text-gray-900' : 'text-gray-400 bg-gray-100'} ${isSelected ? 'ring-2 ring-[#c01721]' : ''}`}
                      >
                        {day}
                        {ex && (
                          <span className={`block w-1 h-1 rounded-full mx-auto mt-0.5 ${
                            ex.syncStatus === 'failed'
                              ? 'bg-red-500'
                              : ex.syncStatus === 'pending'
                                ? 'bg-amber-500'
                                : 'bg-[#00bc7d]'
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedDate && (
                  <div className="mt-4 p-4 bg-white border rounded-lg shadow-sm">
                    <p className="text-sm font-medium text-gray-800 mb-3">
                      {multiSelectMode && selectedDates.length > 1 ? `${selectedDates.length} selected dates` : selectedDate}
                    </p>
                    {selectedException && !editingExistingException && !(multiSelectMode && selectedDates.length > 1) ? (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-600">
                          {selectedException.allDayOff && 'Not available'}
                          {selectedException.overrideAllDay && 'All day available'}
                          {selectedException.slots?.length ? `Custom: ${selectedException.slots.map((s) => `${s.start}-${s.end}`).join(', ')}` : ''}
                        </p>
                        <div className={`inline-flex items-center text-[11px] px-2 py-1 rounded border ${getSyncStatusMeta(selectedException.syncStatus).className}`}>
                          {getSyncStatusMeta(selectedException.syncStatus).label}
                        </div>
                        {selectedException.syncStatus === 'failed' && selectedException.syncError && (
                          <p className="text-[11px] text-red-600 break-words">{selectedException.syncError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setExceptionNotAvailable(!!selectedException.allDayOff);
                              setExceptionAllDay(!!selectedException.overrideAllDay);
                              setCustomSlots(
                                selectedException.slots && selectedException.slots.length > 0
                                  ? selectedException.slots
                                  : [{ start: '09:00', end: '17:00' }]
                              );
                              setExceptionLabel(selectedException.label || '');
                              setEditingExistingException(true);
                            }}
                            className="text-xs px-2 py-1.5 border rounded hover:bg-blue-50 text-blue-700 border-blue-200"
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => removeException(selectedDate)} className="inline-flex items-center gap-1.5 text-xs px-2 py-1.5 border rounded hover:bg-red-50 text-red-600 border-red-200" title="Remove exception" aria-label="Remove exception">
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                          {selectedException.syncStatus === 'failed' && (
                            <button
                              type="button"
                              onClick={() => retryExceptionSync(selectedDate)}
                              className="text-xs px-2 py-1.5 border rounded hover:bg-amber-50 text-amber-700 border-amber-200"
                            >
                              Retry sync
                            </button>
                          )}
                          <button type="button" onClick={() => setSelectedDate(null)} className="text-xs px-2 py-1.5 border rounded hover:bg-gray-50">Close</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-6">
                          <label className="inline-flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exceptionNotAvailable}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setExceptionNotAvailable(on);
                                if (on) setExceptionAllDay(false);
                              }}
                              className="sr-only peer"
                            />
                            <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                            <span className="text-sm text-gray-700 font-medium">Not available</span>
                          </label>
                          <label className="inline-flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exceptionAllDay}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setExceptionAllDay(on);
                                if (on) setExceptionNotAvailable(false);
                              }}
                              className="sr-only peer"
                            />
                            <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#00bc7d] peer-checked:after:translate-x-5 peer-focus:outline-none" />
                            <span className="text-sm text-gray-700 font-medium">All day</span>
                          </label>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">Label (optional)</label>
                          <input
                            type="text"
                            maxLength={80}
                            value={exceptionLabel}
                            onChange={(e) => setExceptionLabel(e.target.value)}
                            placeholder="e.g. Vacation, Team meeting"
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          />
                        </div>
                        {!exceptionNotAvailable && !exceptionAllDay && (
                          <div className="space-y-3 pt-2 w-full min-w-0">
                            <p className="text-xs text-gray-500">Custom time slots for this date:</p>
                            {customSlots.map((slot, idx) => (
                              <div key={idx} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-2 items-center w-full">
                                <input type="time" value={slot.start} onChange={(e) => setCustomSlots((s) => s.map((x, i) => (i === idx ? { ...x, start: e.target.value } : x)))} className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-0 w-full" />
                                <span className="text-gray-500 text-sm shrink-0">–</span>
                                <input type="time" value={slot.end} onChange={(e) => setCustomSlots((s) => s.map((x, i) => (i === idx ? { ...x, end: e.target.value } : x)))} className="border border-gray-300 rounded px-2 py-1.5 text-sm min-w-0 w-full" />
                                <button type="button" onClick={() => setCustomSlots((s) => s.filter((_, i) => i !== idx))} className="p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0" title="Remove slot" aria-label="Remove slot">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <div className="pt-2">
                              <button type="button" onClick={() => setCustomSlots((s) => [...s, { start: '09:00', end: '17:00' }])} className="text-sm text-[#c01721] hover:underline font-medium">+ Add slot</button>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={async () => {
                              const label = exceptionLabel.trim() || null;
                              const payload = exceptionNotAvailable
                                ? { allDayOff: true, label }
                                : exceptionAllDay
                                  ? { overrideAllDay: true, label }
                                  : { slots: customSlots, label };
                              if (multiSelectMode && selectedDates.length > 1) await saveExceptionsBulk(selectedDates, payload);
                              else await saveException(selectedDate, payload);
                              setEditingExistingException(false);
                              loadExceptions();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#00bc7d] text-white text-sm hover:bg-[#00a06a]"
                          >
                            {multiSelectMode && selectedDates.length > 1 ? `Save for ${selectedDates.length} dates` : 'Save'}
                          </button>
                          {multiSelectMode && selectedDates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeExceptionsBulk(selectedDates)}
                              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                            >
                              Remove selected
                            </button>
                          )}
                          {selectedException && (
                            <button
                              type="button"
                              onClick={() => setEditingExistingException(false)}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          )}
                          <button type="button" onClick={() => setSelectedDate(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
