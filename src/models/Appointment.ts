export interface Appointment {
  _id?: string;
  title: string;
  description?: string;
  startAt: string; // ISO UTC
  endAt: string;   // ISO UTC
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppointmentListResponse {
  status: string;
  data: {
    appointments: Appointment[];
    count?: number;
    page?: number;
    limit?: number;
  };
}

export interface AppointmentResponse {
  status: string;
  data: { appointment: Appointment };
}


