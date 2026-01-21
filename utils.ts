
import { Coach, Appointment, SlotStatus } from './types';

export const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

export const formatDateKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const getStartOfWeek = (date: Date) => { 
  const d = new Date(date); 
  const day = d.getDay(); 
  const diff = d.getDate() - day; 
  return new Date(d.setDate(diff)); 
};

export const addDays = (date: Date, days: number) => { 
  const result = new Date(date); 
  result.setDate(result.getDate() + days); 
  return result; 
};

export const formatDateTime = (isoString: string) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (e) { return '-'; }
};

export const isPastTime = (dateKey: string, time: string) => {
  if (!dateKey || !time) return false;
  return new Date(`${dateKey}T${time}`) < new Date();
};

export const isCoachDayOff = (dateKey: string, coach: Coach) => {
  if (!coach) return false;
  
  // 1. Check Specific Date Off (New Feature)
  if (coach.offDates && coach.offDates.includes(dateKey)) {
      return true;
  }

  // 2. Check Weekly Schedule
  if (!coach.workDays) return false;
  const dayOfWeek = new Date(dateKey).getDay();
  return !coach.workDays.includes(dayOfWeek);
};

export const getCoachWorkHours = (dateKey: string, coach: Coach) => {
    const day = new Date(dateKey).getDay();
    // Check for specific daily hours
    if (coach.dailyWorkHours && coach.dailyWorkHours[day.toString()]) {
        return coach.dailyWorkHours[day.toString()];
    }
    // Fallback to default global hours
    return { start: coach.workStart, end: coach.workEnd };
};

export const getSlotStatus = (
  date: string, 
  time: string, 
  coach: Coach | null | undefined, 
  appointments: Appointment[], 
  ignoreId?: string | null
): SlotStatus => {
  if (!coach) return { status: 'unavailable' };
  if (isCoachDayOff(date, coach)) return { status: 'unavailable', type: 'off' };
  
  // Get dynamic work hours for this specific day
  const { start, end } = getCoachWorkHours(date, coach);

  // Parse times for comparison
  const slotTime = parseInt(time.split(':')[0]);
  const startWork = parseInt(start.split(':')[0]);
  const endWork = parseInt(end.split(':')[0]);

  // Fix: slotTime should be strictly less than endWork. 
  // e.g. If endWork is 21:00, the 21:00 slot is unavailable (as it ends at 22:00)
  if (slotTime < startWork || slotTime >= endWork) return { status: 'unavailable' };
  
  const rec = appointments.find(a => 
    a.date === date && 
    a.time === time && 
    a.coachId === coach.id && 
    a.status !== 'cancelled' && 
    (ignoreId ? a.id !== ignoreId : true)
  );

  if (rec) return { status: 'booked', type: rec.type, reason: rec.reason, record: rec };
  
  return { status: 'available' };
};
