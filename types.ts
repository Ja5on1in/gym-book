
export interface User {
  id: string;
  name: string;
  role: 'manager' | 'coach' | 'staff' | 'receptionist';
  email?: string;
  photoURL?: string;
  color?: string;
  workStart?: string;
  workEnd?: string;
  workDays?: number[];
  dailyWorkHours?: Record<string, { start: string; end: string }>;
  status?: 'active' | 'disabled';
  title?: string;
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
  type: 'private' | 'group' | 'block'; 
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  coachId: string;
  coachName?: string;
  service?: Service | null;
  customer?: Customer | null;
  reason?: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'checked_in';
  createdAt: string;
  cancelReason?: string;
  lineUserId?: string;
  lineName?: string;
  maxAttendees?: number; // New field for group capacity
  groupId?: string; // New field to group participants of the same session
}

export interface Coach extends User {
  workStart: string;
  workEnd: string;
  workDays: number[];
  color: string;
  dailyWorkHours?: Record<string, { start: string; end: string }>;
  offDates?: string[];
  title?: string;
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
  currentAttendees?: number;
  maxAttendees?: number;
}

export interface BlockFormState {
  id: string | null;
  type: 'block' | 'private' | 'group';
  coachId: string;
  date: string;
  time: string;
  endTime?: string;
  reason: string;
  customer: Customer | null;
  repeatWeeks?: number;
}

export interface UserInventory {
  id: string;
  name: string;
  lineUserId?: string;
  email?: string;
  phone?: string;
  credits: {
      private: number;
      group: number;
  };
  lastUpdated: string;
  goals?: string;
  injuries?: string;
  physicalNotes?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
}

export interface WorkoutSet {
  id: string;
  reps: number;
  weight: number;
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  userName: string;
  coachId: string;
  coachName: string;
  date: string;
  name: string;
  exercises: ExerciseLog[];
  createdAt: string;
}
