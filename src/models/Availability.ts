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


