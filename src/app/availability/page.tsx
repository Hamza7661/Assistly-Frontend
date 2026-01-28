'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navigation from '@/components/Navigation';
import { ProtectedRoute } from '@/components';
import { toast } from 'react-toastify';
import { useAvailabilityService } from '@/services';
import type { AvailabilityDayUTC, AvailabilitySlotUTC, DayOfWeek } from '@/models/Availability';
import styles from './styles.module.css';
import { useAuth } from '@/contexts/AuthContext';

const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toLocalTime(utcHHmm: string): string {
  const [h, m] = utcHHmm.split(':').map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function toUTCTime(localHHmm: string): string {
  const [h, m] = localHHmm.split(':').map(Number);
  const dLocal = new Date();
  dLocal.setHours(h, m, 0, 0);
  const hh = dLocal.getUTCHours().toString().padStart(2, '0');
  const mm = dLocal.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function format24To12(hhmm: string): string {
  if (!hhmm) return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h < 12 ? 'AM' : 'PM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function parseLocalInputTo24(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!match) {
    // Assume already in 24h HH:mm
    return trimmed;
  }
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridian = match[3]?.toUpperCase();
  if (meridian) {
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
  }
  const hh = hour.toString().padStart(2, '0');
  const mm = minute.toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function addMinutesLocal(hhmm: string, minutesToAdd: number): string {
  const [hStr, mStr] = hhmm.split(':');
  let total = Number(hStr) * 60 + Number(mStr) + minutesToAdd;
  if (total >= 24 * 60) {
    // clamp to end of day
    return '23:59';
  }
  if (total < 0) total = 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export default function AvailabilityPage() {
  const { user } = useAuth();
  const { isOpen: isSidebarOpen } = useSidebar();
  const [days, setDays] = useState<AvailabilityDayUTC[]>([]);
  const [originalDays, setOriginalDays] = useState<AvailabilityDayUTC[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sortedDays = useMemo(() => {
    if (days.length === 0) return [] as AvailabilityDayUTC[];
    const rest = days.slice(1); // Mon..Sat
    const sunday = days[0];
    return [...rest, sunday]; // Sunday at bottom
  }, [days]);

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return; // wait for user id to exist
      try {
        const svc = await useAvailabilityService();
        const res = await svc.getByUser(user._id);
        const list = res.data?.availability ?? [];
        // Ensure all 7 days exist, Sunday (0) to Saturday (6)
        const map = new Map<number, AvailabilityDayUTC>();
        list.forEach(d => map.set(d.dayOfWeek, d));
        const full: AvailabilityDayUTC[] = Array.from({ length: 7 }, (_, i) => {
          const dow = i as DayOfWeek;
          const existing = map.get(dow);
          return existing ? { ...existing, allDay: !!existing.allDay } : { dayOfWeek: dow, slots: [], allDay: false } as AvailabilityDayUTC;
        });
        setDays(full);
        setOriginalDays(full);
      } catch (e: any) {
        setError(e?.message || 'Failed to load availability');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?._id]);

  const addSlot = (dayIndex: number) => {
    setDays(prev => {
      const next = prev.map((d, i) => {
        if (i !== dayIndex) return d;
        if (d.slots.length > 0) {
          const last = d.slots[d.slots.length - 1];
          const prevEndLocal = toLocalTime(last.end);
          if (prevEndLocal === '00:00') {
            return d;
          }
          const newStartLocal = prevEndLocal;
          const newEndLocal = addMinutesLocal(prevEndLocal, 60);
          if (hhmmToMinutes(newStartLocal) < hhmmToMinutes(toLocalTime(last.end))) {
            toast.error('Start time cannot be earlier than previous slot end');
            return d;
          }
          const startUTC = toUTCTime(newStartLocal);
          const endUTC = toUTCTime(newEndLocal);
          return { ...d, allDay: false, slots: [...d.slots, { start: startUTC, end: endUTC }] } as any;
        }
        return { ...d, allDay: false, slots: [...d.slots, { start: toUTCTime('09:00'), end: toUTCTime('17:00') }] } as any;
      });
      // If blocked (12:00 AM), show a brief toast
      const lastSlot = prev[dayIndex]?.slots?.[prev[dayIndex].slots.length - 1];
      if (lastSlot) {
        const endLocal = toLocalTime(lastSlot.end);
        if (endLocal === '00:00') {
          toast.info('Cannot add another slot after 12:00 AM');
        }
      }
      return next;
    });
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setDays(prev => prev.map((d, i) => i === dayIndex ? { ...d, slots: d.slots.filter((_, si) => si !== slotIndex) } : d));
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: 'start' | 'end', localInput: string): boolean => {
    const local24 = parseLocalInputTo24(localInput);
    if (field === 'start' && slotIndex > 0) {
      try {
        const prevEndLocal = toLocalTime(days[dayIndex].slots[slotIndex - 1].end);
        if (hhmmToMinutes(local24) < hhmmToMinutes(prevEndLocal)) {
          toast.error('Start time cannot be earlier than previous slot end');
          return false;
        }
      } catch {}
    }
    if (field === 'end') {
      try {
        const startLocal = toLocalTime(days[dayIndex].slots[slotIndex].start);
        if (hhmmToMinutes(local24) <= hhmmToMinutes(startLocal)) {
          toast.error('End time must be after start time');
          return false;
        }
      } catch {}
    }
    const utc = toUTCTime(local24);
    setDays(prev => prev.map((d, i) => i === dayIndex ? { ...d, slots: d.slots.map((s, si) => si === slotIndex ? { ...s, [field]: utc } : s) } : d));
    return true;
  };

  const saveAll = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const svc = await useAvailabilityService();
      const outgoingDays = days.map(d => ({
        dayOfWeek: d.dayOfWeek,
        allDay: !!(d as any).allDay,
        slots: (d as any).allDay ? [] : d.slots,
      }));
      await svc.bulkReplace({ days: outgoingDays as any });
      setMessage('Availability saved');
      setOriginalDays(days);
    } catch (e: any) {
      setError(e?.message || 'Failed to save availability');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const hasPending = useMemo(() => {
    const normalize = (arr: AvailabilityDayUTC[]) => arr.map(d => ({
      dayOfWeek: d.dayOfWeek,
      allDay: !!(d as any).allDay,
      slots: (d as any).allDay ? [] : d.slots.map(s => ({ start: s.start, end: s.end }))
    }));
    try {
      return JSON.stringify(normalize(days)) !== JSON.stringify(normalize(originalDays));
    } catch {
      return false;
    }
  }, [days, originalDays]);

  return (
    <ProtectedRoute>
      <div className={styles.container}>
        <Navigation />
        <div className={`content-wrapper ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className={styles.pageContainer}>
          <h1 className={styles.title}>Availability</h1>
          <p className={styles.subtitle}>Set your weekly available appointments</p>

          {error && <div className="error-message mb-4">{error}</div>}
          {message && <div className="success-message mb-4">{message}</div>}
          {hasPending && !saving && (
            <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Pending changes. Please click Save All to save.
            </div>
          )}

          {loading ? (
            <div className="min-h-[200px] flex items-center justify-center"><div className="loading-spinner"></div></div>
          ) : (
            <div className={styles.table}>
              {sortedDays.map((d) => {
                const di = d.dayOfWeek; // original index
                return (
                <div key={d.dayOfWeek} className={styles.dayRow}>
                  <div className={styles.dayLabel}>{dayLabels[d.dayOfWeek]}</div>
                  <div className={styles.slotsColumn}>
                    <div className="flex items-center gap-3 mb-2">
                      <label htmlFor={`allday-${d.dayOfWeek}`} className="inline-flex items-center cursor-pointer">
                        <input
                          id={`allday-${d.dayOfWeek}`}
                          type="checkbox"
                          className="sr-only peer"
                          checked={Boolean((d as any).allDay)}
                          onChange={(e) => setDays(prev => prev.map((day, idx) => idx === di ? { ...day, allDay: e.target.checked } as any : day))}
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full relative transition-colors peer-focus:outline-none peer-checked:bg-[#00bc7d] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:bg-white after:border after:border-gray-300 after:rounded-full after:transition-transform peer-checked:after:translate-x-5"></div>
                        <span className="ml-3 text-sm text-gray-700 font-bold">All day available</span>
                      </label>
                    </div>
                    {!((d as any).allDay) && d.slots.map((s, si) => (
                      <SlotRow
                        key={si}
                        startDisplay={format24To12(toLocalTime(s.start))}
                        endDisplay={format24To12(toLocalTime(s.end))}
                        onChangeStart={(val) => updateSlot(di, si, 'start', val)}
                        onChangeEnd={(val) => updateSlot(di, si, 'end', val)}
                        onRemove={() => removeSlot(di, si)}
                      />
                    ))}
                    <button onClick={() => addSlot(di)} className="btn-secondary mt-2">Add slot</button>
                  </div>
                </div>
              );})}
              <div className={styles.actionsRow}>
                <button onClick={saveAll} className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save All'}</button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function SlotRow({ startDisplay, endDisplay, onChangeStart, onChangeEnd, onRemove }: { startDisplay: string; endDisplay: string; onChangeStart: (val: string) => boolean; onChangeEnd: (val: string) => boolean; onRemove: () => void }) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const startApiRef = useRef<any>(null);
  const endApiRef = useRef<any>(null);
  const onStartCbRef = useRef(onChangeStart);
  const onEndCbRef = useRef(onChangeEnd);
  const startOpenedRef = useRef(false);
  const endOpenedRef = useRef(false);
  const lastValidStartLocalRef = useRef<string>(parseLocalInputTo24(startDisplay || ''));
  const lastValidEndLocalRef = useRef<string>(parseLocalInputTo24(endDisplay || ''));

  useEffect(() => { onStartCbRef.current = onChangeStart; }, [onChangeStart]);
  useEffect(() => { onEndCbRef.current = onChangeEnd; }, [onChangeEnd]);

  // Initialize pickers once
  useEffect(() => {
    let startFocus: any;
    let startClick: any;
    let endFocus: any;
    let endClick: any;
    let startDocClick: any;
    let endDocClick: any;
    (async () => {
      const mod = await import('analogue-time-picker');
      if (startRef.current && !startApiRef.current) {
        const init24 = parseLocalInputTo24(startRef.current.value || '09:00');
        const [ih, im] = init24.split(':').map(Number);
        startApiRef.current = mod.timePickerInput({ inputElement: startRef.current, mode: 12, width: '280px', time: { hour: ih, minute: im } });
        startFocus = () => { startOpenedRef.current = true; };
        startClick = () => { startOpenedRef.current = true; };
        // Library OK click
        try {
          startApiRef.current?.onOk?.((h: number, m: number) => {
            if (!startOpenedRef.current) return;
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const val24 = `${hh}:${mm}`;
            const ok = onStartCbRef.current(val24);
            if (ok) {
              lastValidStartLocalRef.current = val24;
            } else {
              // revert input and picker to last valid time
              const disp = format24To12(lastValidStartLocalRef.current);
              if (startRef.current) startRef.current.value = disp;
              const [rvh, rvm] = lastValidStartLocalRef.current.split(':').map(Number);
              startApiRef.current?.setTime?.(rvh, rvm, true);
            }
            startOpenedRef.current = false;
          });
        } catch {}
        startRef.current.addEventListener('focus', startFocus);
        startRef.current.addEventListener('click', startClick);
        // Fallback: detect clicking OK button in the overlay
        startDocClick = (e: MouseEvent) => {
          if (!startOpenedRef.current) return;
          const target = e.target as HTMLElement | null;
          let el: HTMLElement | null = target;
          let isOk = false;
          while (el) {
            if (el.tagName === 'BUTTON' && (el as HTMLElement).textContent?.trim().toLowerCase() === 'ok') {
              isOk = true;
              break;
            }
            el = el.parentElement;
          }
          if (isOk) {
            const picked = startApiRef.current?.getTime?.();
            if (picked && typeof picked.hour === 'number' && typeof picked.minute === 'number') {
              const hh = String(picked.hour).padStart(2, '0');
              const mm = String(picked.minute).padStart(2, '0');
              const val24 = `${hh}:${mm}`;
              const ok = onStartCbRef.current(val24);
              if (ok) {
                lastValidStartLocalRef.current = val24;
              } else {
                const disp = format24To12(lastValidStartLocalRef.current);
                if (startRef.current) startRef.current.value = disp;
                const [rvh, rvm] = lastValidStartLocalRef.current.split(':').map(Number);
                startApiRef.current?.setTime?.(rvh, rvm, true);
              }
            }
            startOpenedRef.current = false;
          }
        };
        document.addEventListener('click', startDocClick, true);
      }
      if (endRef.current && !endApiRef.current) {
        const init24 = parseLocalInputTo24(endRef.current.value || '17:00');
        const [ih, im] = init24.split(':').map(Number);
        endApiRef.current = mod.timePickerInput({ inputElement: endRef.current, mode: 12, width: '280px', time: { hour: ih, minute: im } });
        endFocus = () => { endOpenedRef.current = true; };
        endClick = () => { endOpenedRef.current = true; };
        try {
          endApiRef.current?.onOk?.((h: number, m: number) => {
            if (!endOpenedRef.current) return;
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const val24 = `${hh}:${mm}`;
            const ok = onEndCbRef.current(val24);
            if (ok) {
              lastValidEndLocalRef.current = val24;
            } else {
              const disp = format24To12(lastValidEndLocalRef.current);
              if (endRef.current) endRef.current.value = disp;
              const [rvh, rvm] = lastValidEndLocalRef.current.split(':').map(Number);
              endApiRef.current?.setTime?.(rvh, rvm, true);
            }
            endOpenedRef.current = false;
          });
        } catch {}
        endRef.current.addEventListener('focus', endFocus);
        endRef.current.addEventListener('click', endClick);
        endDocClick = (e: MouseEvent) => {
          if (!endOpenedRef.current) return;
          const target = e.target as HTMLElement | null;
          let el: HTMLElement | null = target;
          let isOk = false;
          while (el) {
            if (el.tagName === 'BUTTON' && (el as HTMLElement).textContent?.trim().toLowerCase() === 'ok') {
              isOk = true;
              break;
            }
            el = el.parentElement;
          }
          if (isOk) {
            const picked = endApiRef.current?.getTime?.();
            if (picked && typeof picked.hour === 'number' && typeof picked.minute === 'number') {
              const hh = String(picked.hour).padStart(2, '0');
              const mm = String(picked.minute).padStart(2, '0');
              const val24 = `${hh}:${mm}`;
              const ok = onEndCbRef.current(val24);
              if (ok) {
                lastValidEndLocalRef.current = val24;
              } else {
                const disp = format24To12(lastValidEndLocalRef.current);
                if (endRef.current) endRef.current.value = disp;
                const [rvh, rvm] = lastValidEndLocalRef.current.split(':').map(Number);
                endApiRef.current?.setTime?.(rvh, rvm, true);
              }
            }
            endOpenedRef.current = false;
          }
        };
        document.addEventListener('click', endDocClick, true);
      }
    })();
    return () => {
      if (startRef.current && startFocus) startRef.current.removeEventListener('focus', startFocus);
      if (startRef.current && startClick) startRef.current.removeEventListener('click', startClick);
      if (startDocClick) document.removeEventListener('click', startDocClick, true);
      if (endRef.current && endFocus) endRef.current.removeEventListener('focus', endFocus);
      if (endRef.current && endClick) endRef.current.removeEventListener('click', endClick);
      if (endDocClick) document.removeEventListener('click', endDocClick, true);
      startApiRef.current?.dispose?.();
      endApiRef.current?.dispose?.();
      startApiRef.current = null;
      endApiRef.current = null;
    };
  }, []);

  // Keep uncontrolled input in sync when props change and reflect in picker
  useEffect(() => {
    if (startRef.current) startRef.current.value = startDisplay;
    const v24 = parseLocalInputTo24(startDisplay || '09:00');
    const [h, m] = v24.split(':').map(Number);
    startApiRef.current?.setTime?.(h, m, true);
  }, [startDisplay]);
  useEffect(() => {
    if (endRef.current) endRef.current.value = endDisplay;
    const v24 = parseLocalInputTo24(endDisplay || '17:00');
    const [h, m] = v24.split(':').map(Number);
    endApiRef.current?.setTime?.(h, m, true);
  }, [endDisplay]);

  return (
    <div className={styles.slotRow}>
      <input ref={startRef} defaultValue={startDisplay} className={styles.timeInput} onKeyDown={(e) => e.stopPropagation()} />
      <span className={styles.toSep}>to</span>
      <input ref={endRef} defaultValue={endDisplay} className={styles.timeInput} onKeyDown={(e) => e.stopPropagation()} />
      <button onClick={onRemove} className="btn-secondary ml-2">Remove</button>
    </div>
  );
}


