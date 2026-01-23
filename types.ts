

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
  title?: string; // Added title for coach/therapist distinction
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
  type: 'private' | 'group' | 'block'; // 'client' is deprecated, normalized to 'private' in logic
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  coachId: string;
  coachName?: string;
  service?: Service | null;
  customer?: Customer | null;
  reason?: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'checked_in'; // Added checked_in status
  createdAt: string;
  cancelReason?: string;
  lineUserId?: string; // LINE LIFF Integration
  lineName?: string;   // LINE LIFF Integration
}

export interface Coach extends User {
  workStart: string;
  workEnd: string;
  workDays: number[];
  color: string;
  dailyWorkHours?: Record<string, { start: string; end: string }>;
  offDates?: string[]; // Specific dates off (YYYY-MM-DD)
  title?: string; // Added title field
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
  type?: 'private' | 'group' | 'block' | 'off';
  reason?: string;
  record?: Appointment;
}

export interface BlockFormState {
  id: string | null;
  type: 'block' | 'private' | 'group'; // Normalized inputs
  coachId: string;
  date: string;
  time: string;
  endTime?: string; // For batch blocking
  reason: string;
  customer: Customer | null;
  repeatWeeks?: number;
}

// New: Inventory System
export interface UserInventory {
  id: string; // Use lineUserId or Email as ID
  name: string;
  lineUserId?: string;
  email?: string;
  phone?: string;
  credits: {
      private: number;
      group: number;
  };
  lastUpdated: string;
}