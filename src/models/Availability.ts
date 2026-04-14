export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun ... 6=Sat

export interface AvailabilitySlotUTC {
  start: string; // HH:mm in UTC
  end: string;   // HH:mm in UTC
}

export interface AvailabilityDayUTC {
  dayOfWeek: DayOfWeek;
  slots: AvailabilitySlotUTC[];
  allDay?: boolean;
}

export interface AvailabilityListResponse {
  status: string;
  data: {
    availability: AvailabilityDayUTC[];
  };
}

export interface AvailabilityBulkRequest {
  days: AvailabilityDayUTC[];
}

/** Date-based exception to weekly availability (YYYY-MM-DD). */
export interface AvailabilityExceptionItem {
  date: string;
  timezone?: string;
  allDayOff?: boolean;
  overrideAllDay?: boolean;
  slots?: Array<{ start: string; end: string }>;
  label?: string | null;
  syncStatus?: 'idle' | 'pending' | 'synced' | 'failed' | 'skipped';
  syncError?: string | null;
  lastSyncedAt?: string | null;
  syncAttempts?: number;
}

export interface AvailabilityExceptionsResponse {
  status: string;
  data: { exceptions: AvailabilityExceptionItem[] };
}

export interface AvailabilityExceptionUpsertRequest {
  date: string;
  timezone?: string;
  allDayOff?: boolean;
  overrideAllDay?: boolean;
  slots?: Array<{ start: string; end: string }>;
  label?: string | null;
}

export interface AvailabilityExceptionsBulkRequest {
  exceptions: AvailabilityExceptionItem[];
}


