

import { Service, Coach, Exercise } from './types';

// Default initial coaches if DB is empty
export const INITIAL_COACHES: Coach[] = [
  { id: 'c1', name: '教練 Jason', role: 'coach', workStart: '09:00', workEnd: '21:00', workDays: [0,1,2,3,4,5,6], color: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700', title: '教練' },
  { id: 'c2', name: '教練 Sarah', role: 'coach', workStart: '09:00', workEnd: '21:00', workDays: [0,1,2,3,4,5,6], color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700', title: '物理治療師' },
];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let i = 8; i <= 22; i++) {
    slots.push(`${String(i).padStart(2, '0')}:00`);
  }
  return slots;
};

export const ALL_TIME_SLOTS = generateTimeSlots();

// Modified: Removed '1v1教練課' and '團課' as they are handled by the Type selector
export const BLOCK_REASONS = ['評估', '開會', '外出', '休假', '內部訓練', '場地維護'];

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

export const EXERCISE_LIST: Exercise[] = [
  // 胸部 (Chest)
  { id: 'ex001', name: '槓鈴臥推', category: '胸部' },
  { id: 'ex002', name: '啞鈴臥推', category: '胸部' },
  { id: 'ex003', name: '上斜臥推', category: '胸部' },
  { id: 'ex004', name: '啞鈴飛鳥', category: '胸部' },
  { id: 'ex005', name: '繩索夾胸', category: '胸部' },
  { id: 'ex006', name: '機械推胸', category: '胸部' },
  { id: 'ex007', name: '伏地挺身', category: '胸部' },

  // 背部 (Back)
  { id: 'ex008', name: '引體向上', category: '背部' },
  { id: 'ex009', name: '滑輪下拉', category: '背部' },
  { id: 'ex010', name: '槓鈴划船', category: '背部' },
  { id: 'ex011', name: '啞鈴划船', category: '背部' },
  { id: 'ex012', name: '坐姿划船', category: '背部' },
  { id: 'ex013', name: '硬舉', category: '背部' },
  { id: 'ex014', name: 'T槓划船', category: '背部' },

  // 腿部 (Legs)
  { id: 'ex015', name: '槓鈴深蹲', category: '腿部' },
  { id: 'ex016', name: '腿推舉', category: '腿部' },
  { id: 'ex017', name: '腿伸展', category: '腿部' },
  { id: 'ex018', name: '腿彎舉', category: '腿部' },
  { id: 'ex019', name: '保加利亞分腿蹲', category: '腿部' },
  { id: 'ex020', name: '羅馬尼亞硬舉', category: '腿部' },
  { id: 'ex021', name: '小腿提踵', category: '腿部' },
  { id: 'ex022', name: '弓箭步', category: '腿部' },

  // 肩部 (Shoulders)
  { id: 'ex023', name: '槓鈴肩推', category: '肩部' },
  { id: 'ex024', name: '啞鈴肩推', category: '肩部' },
  { id: 'ex025', name: '啞鈴側平舉', category: '肩部' },
  { id: 'ex026', name: '啞鈴前平舉', category: '肩部' },
  { id: 'ex027', name: '臉拉', category: '肩部' },
  { id: 'ex028', name: '阿諾推舉', category: '肩部' },
  { id: 'ex029', name: '機械肩推', category: '肩部' },

  // 手臂 (Arms)
  { id: 'ex030', name: '啞鈴彎舉', category: '手臂' },
  { id: 'ex031', name: '槓鈴彎舉', category: '手臂' },
  { id: 'ex032', name: '牧師椅彎舉', category: '手臂' },
  { id: 'ex033', name: '繩索下壓', category: '手臂' },
  { id: 'ex034', name: '雙槓臂屈伸', category: '手臂' },
  { id: 'ex035', name: '法式推舉', category: '手臂' },
  { id: 'ex036', name: '槌式彎舉', category: '手臂' },

  // 核心 (Core)
  { id: 'ex037', name: '平板支撐', category: '核心' },
  { id: 'ex038', name: '仰臥起坐', category: '核心' },
  { id: 'ex039', name: '腿部抬高', category: '核心' },
  { id: 'ex040', name: '俄羅斯轉體', category: '核心' },
  { id: 'ex041', name: '藥球砸地', category: '核心' },
  { id: 'ex042', name: '腹部滾輪', category: '核心' },
  
  // 複合動作
  { id: 'ex043', name: '壺鈴擺盪', category: '複合' },
  { id: 'ex044', name: '箱上跳', category: '複合' },
  { id: 'ex045', name: '過頭深蹲', category: '複合' },
  { id: 'ex046', name: '農夫走路', category: '複合' },
  { id: 'ex047', name: '雪橇推', category: '複合' },
  { id: 'ex048', name: '高腳杯深蹲', category: '腿部' },
  { id: 'ex049', name: '反向飛鳥', category: '肩部' },
  { id: 'ex050', name: '臀推', category: '腿部' },
];
