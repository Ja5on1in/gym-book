
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

export const isCheckInWindow = (dateKey: string, time: string, durationStr: string = '50 分鐘') => {
  if (!dateKey || !time) return false;
  const now = new Date();
  const startTime = new Date(`${dateKey}T${time}`);
  const durationMatch = durationStr.match(/\d+/);
  const duration = durationMatch ? parseInt(durationMatch[0]) : 50;
  const endTime = new Date(startTime.getTime() + duration * 60000);
  const checkInStart = new Date(startTime.getTime() - 30 * 60000);
  return now >= checkInStart && now <= endTime;
};

export const isCoachDayOff = (dateKey: string, coach: Coach) => {
  if (!coach) return false;
  if (coach.offDates && coach.offDates.includes(dateKey)) {
      return true;
  }
  if (!coach.workDays) return false;
  const dayOfWeek = new Date(dateKey).getDay();
  return !coach.workDays.includes(dayOfWeek);
};

export const getCoachWorkHours = (dateKey: string, coach: Coach) => {
    const day = new Date(dateKey).getDay();
    if (coach.dailyWorkHours && coach.dailyWorkHours[day.toString()]) {
        return coach.dailyWorkHours[day.toString()];
    }
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
  
  const { start, end } = getCoachWorkHours(date, coach);

  const parseMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
  };

  const slotMins = parseMinutes(time);
  const startMins = parseMinutes(start);
  const endMins = parseMinutes(end);

  if (slotMins < startMins || slotMins >= endMins) return { status: 'unavailable' };
  
  const relevantApps = appointments.filter(a => 
    a.date === date && 
    a.time === time && 
    a.coachId === coach.id && 
    a.status !== 'cancelled' && 
    (ignoreId ? a.id !== ignoreId : true)
  );

  if (relevantApps.length > 0) {
    const firstApp = relevantApps[0];
    if (firstApp.type === 'group') {
      const currentCount = relevantApps.length;
      const maxCount = firstApp.maxAttendees || 8;
      
      if (currentCount < maxCount) {
        return { 
          status: 'available', 
          type: 'group', 
          currentAttendees: currentCount, 
          maxAttendees: maxCount,
          record: firstApp 
        };
      } else {
        return { 
          status: 'booked', 
          type: 'group', 
          currentAttendees: currentCount, 
          maxAttendees: maxCount,
          record: firstApp 
        };
      }
    } else {
      // Private or block
      return { status: 'booked', type: firstApp.type, reason: firstApp.reason, record: firstApp };
    }
  }
  
  return { status: 'available' };
};
