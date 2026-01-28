


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
    // Force Taipei Time display
    return d.toLocaleString('zh-TW', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
  } catch (e) { return '-'; }
};

export const isPastTime = (dateKey: string, time: string) => {
  if (!dateKey || !time) return false;
  const now = new Date();
  const target = new Date(`${dateKey}T${time}`);
  return target < now;
};

// Check if current time is within [Start - 30mins, End]
export const isCheckInWindow = (dateKey: string, time: string, durationStr: string = '50 分鐘') => {
  if (!dateKey || !time) return false;
  const now = new Date();
  const startTime = new Date(`${dateKey}T${time}`);
  
  // Calculate duration in minutes (simple parsing)
  const durationMatch = durationStr.match(/\d+/);
  const duration = durationMatch ? parseInt(durationMatch[0]) : 50;
  
  const endTime = new Date(startTime.getTime() + duration * 60000);
  const checkInStart = new Date(startTime.getTime() - 30 * 60000); // 30 mins before

  return now >= checkInStart && now <= endTime;
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

  // Robust Time Comparison
  // Convert "HH:mm" to minutes for accurate comparison
  const parseMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
  };

  const slotMins = parseMinutes(time);
  const startMins = parseMinutes(start);
  const endMins = parseMinutes(end);

  // If slot time is before start or >= end time (closing time), it's unavailable
  if (slotMins < startMins || slotMins >= endMins) return { status: 'unavailable' };
  
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