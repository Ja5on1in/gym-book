
import { Service, Coach } from './types';

// Default initial coaches if DB is empty
export const INITIAL_COACHES: Coach[] = [
  { id: 'c1', name: '教練 Jason', role: 'coach', workStart: '09:00', workEnd: '21:00', workDays: [0,1,2,3,4,5,6], color: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700' },
  { id: 'c2', name: '教練 Sarah', role: 'coach', workStart: '09:00', workEnd: '21:00', workDays: [0,1,2,3,4,5,6], color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700' },
];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let i = 8; i <= 22; i++) {
    slots.push(`${String(i).padStart(2, '0')}:00`);
  }
  return slots;
};

export const ALL_TIME_SLOTS = generateTimeSlots();

export const BLOCK_REASONS = ['1v1教練課', '評估', '團課', '開會', '外出', '休假'];

export const SERVICES: Service[] = [
    { id: 'assessment', name: '功能性檢測', duration: '60 分鐘', color: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-700' }, 
    { id: 'coaching', name: '一對一教練課', duration: '50 分鐘', color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700' }
];

// Tailwind color options for coach creation
export const COLOR_OPTIONS = [
    { label: '藍色', value: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700' },
    { label: '綠色', value: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700' },
    { label: '紫色', value: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700' },
    { label: '橘色', value: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700' },
    { label: '粉紅', value: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900 dark:text-pink-200 dark:border-pink-700' },
    { label: '黃色', value: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700' },
    { label: '青色', value: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-200 dark:border-cyan-700' },
    { label: '紅色', value: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700' },
];

export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6VsKvWB2Lo6G96-2EKmp2qpxgoTF9cgPaJF8SLIezKbOeWAt-0typ-3H1ZkfmZyh2/exec";