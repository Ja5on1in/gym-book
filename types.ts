export interface User {
  id: string;
  name: string;
  role: 'manager' | 'coach' | 'staff'; // Added staff for flexibility
  email?: string;
  photoURL?: string;
  color?: string;
  workStart?: string;
  workEnd?: string;
  workDays?: number[];
  dailyWorkHours?: Record<string, { start: string; end: string }>;
  status?: 'active' | 'disabled'; // New field for access control
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
}

export interface Service {
  id: string;
  name: string;
  duration: string;
  color: string;
}

export interface Appointment {
  id: string;
  type: 'client' | 'block';
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  coachId: string;
  coachName?: string;
  service?: Service | null;
  customer?: Customer | null;
  reason?: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  isCompleted?: boolean;
  cancelReason?: string;
}

export interface Coach extends User {
  workStart: string;
  workEnd: string;
  workDays: number[];
  color: string;
  dailyWorkHours?: Record<string, { start: string; end: string }>;
  offDates?: string[]; // Specific dates off (YYYY-MM-DD)
}

export interface Log {
  id: string;
  time: string;
  user: string;
  action: string;
  details: string;
}

export interface SlotStatus {
  status: 'available' | 'booked' | 'unavailable';
  type?: 'client' | 'block' | 'off';
  reason?: string;
  record?: Appointment;
}

export interface BlockFormState {
  id: string | null;
  type: 'block' | 'client';
  coachId: string;
  date: string;
  time: string;
  endTime?: string; // For batch blocking
  reason: string;
  customer: Customer | null;
  repeatWeeks?: number;
}