import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  User, 
  Phone, 
  Mail, 
  Dumbbell, 
  Briefcase,
  FileText
} from 'lucide-react';
import { Coach, Service, Customer } from '../types';
import { SERVICES, ALL_TIME_SLOTS } from '../constants';
import { formatDateKey, getSlotStatus, isCoachDayOff, isPastTime, getDaysInMonth, getFirstDayOfMonth } from '../utils';

interface BookingWizardProps {
  step: number;
  setStep: (step: number) => void;
  selectedService: Service | null;
  setSelectedService: (s: Service) => void;
  selectedCoach: Coach | null;
  setSelectedCoach: (c: Coach) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  selectedSlot: string | null;
  setSelectedSlot: (s: string | null) => void;
  formData: Customer;
  setFormData: (c: Customer) => void;
  coaches: Coach[];
  appointments: any[];
  onSubmit: (e: React.FormEvent) => void;
  reset: () => void;
  currentDate: Date;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
}

const BookingWizard: React.FC<BookingWizardProps> = ({
  step, setStep, selectedService, setSelectedService,
  selectedCoach, setSelectedCoach, selectedDate, setSelectedDate,
  selectedSlot, setSelectedSlot, formData, setFormData,
  coaches, appointments, onSubmit, reset, currentDate, handlePrevMonth, handleNextMonth
}) => {
  const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const isDayOff = selectedCoach ? isCoachDayOff(dateKey, selectedCoach) : false;

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-10 w-full"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const loopDate = new Date(year, month, day);
      const isSelected = selectedDate.toDateString() === loopDate.toDateString();
      const isToday = new Date().toDateString() === loopDate.toDateString();
      const loopDateKey = formatDateKey(year, month, day);
      const isPast = new Date(loopDateKey) < new Date(new Date().toDateString());
      
      days.push(
        <button 
          key={day} 
          onClick={() => { setSelectedDate(loopDate); setSelectedSlot(null); }} 
          disabled={isPast}
          className={`h-10 w-full rounded-full flex items-center justify-center text-sm font-medium transition-all 
            ${isSelected ? 'bg-blue-600 text-white shadow-md transform scale-105' : 
              isToday ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200 font-bold' : 
              isPast ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 
              'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400"><ChevronLeft size={20}/></button>
          <h3 className="font-bold text-gray-800 dark:text-white text-lg">{year}年 {month + 1}月</h3>
          <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400"><ChevronRight size={20}/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (<span key={d} className="text-xs text-gray-400 dark:text-gray-500 font-medium">{d}</span>))}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">線上預約系統</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {step===1&&"第一步：請選擇服務項目"}
          {step===2&&"第二步：請選擇您的專屬教練"}
          {step===3&&"第三步：選擇日期與時段"}
          {step===4&&"最後一步：填寫聯絡資料"}
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          {SERVICES.map(service => (
            <button key={service.id} onClick={() => { setSelectedService(service); setStep(2); }} className={`w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-2xl flex items-center justify-between hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${service.color}`}><Dumbbell size={24} /></div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{service.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{service.duration}</p>
                </div>
              </div>
              <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-fadeIn">
          <button onClick={() => setStep(1)} className="text-gray-400 flex items-center mb-2 hover:text-gray-600 dark:hover:text-white"><ChevronLeft size={16} /> 返回服務選擇</button>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">請選擇 {selectedService?.name} 的指導教練</h2>
          <div className="grid grid-cols-1 gap-3">
            {coaches.map(coach => (
              <button key={coach.id} onClick={() => { setSelectedCoach(coach); setStep(3); }} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl flex items-center justify-between hover:border-orange-500 hover:shadow-md transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg">{coach.name.charAt(0)}</div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-800 dark:text-white">{coach.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Briefcase size={12}/> 上班時間: 詳見班表</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-orange-600 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">選擇此教練</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-fadeIn">
          <button onClick={() => setStep(2)} className="text-gray-400 flex items-center mb-2 hover:text-gray-600 dark:hover:text-white"><ChevronLeft size={16} /> 返回教練選擇</button>
          <div className="bg-orange-50 dark:bg-gray-800 p-4 rounded-xl border border-orange-100 dark:border-gray-700 flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center font-bold text-orange-600 dark:text-orange-400 shadow-sm">{selectedCoach?.name.charAt(0)}</div>
            <div>
              <div className="text-xs text-orange-800 dark:text-gray-400 opacity-75">目前選擇教練</div>
              <div className="font-bold text-orange-900 dark:text-orange-400">{selectedCoach?.name}</div>
            </div>
          </div>
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase mb-3 tracking-wider">日期</h2>
            {renderCalendar()}
          </section>
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase mb-3 tracking-wider">{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 可預約時段</h2>
            {isDayOff ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">教練今日排休</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {ALL_TIME_SLOTS.map(time => {
                  const result = getSlotStatus(dateKey, time, selectedCoach, appointments);
                  const isPast = isPastTime(dateKey, time);
                  if (result.status === 'unavailable') return null;
                  const isBooked = result.status === 'booked';
                  const isDisabled = isBooked || isPast;
                  return (
                    <button key={time} disabled={isDisabled} onClick={() => setSelectedSlot(time)} className={`py-2 px-1 rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center ${isDisabled ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed decoration-slice' : selectedSlot === time ? 'bg-blue-600 text-white shadow-md transform scale-105 border border-blue-600' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400'}`}>
                      {time}
                      {isBooked && (<span className="text-[10px] text-red-400">{result.type === 'block' ? '暫停' : '額滿'}</span>)}
                      {!isBooked && isPast && (<span className="text-[10px] text-gray-400 dark:text-gray-500">過期</span>)}
                    </button>
                  );
                })}
              </div>
            )}
            {!isDayOff && ALL_TIME_SLOTS.every(t => getSlotStatus(dateKey, t, selectedCoach, appointments).status !== 'available' || isPastTime(dateKey, t)) && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">此教練今日已無可預約時段或非上班日</div>
            )}
          </section>
          <div className="pt-4 pb-20">
            <button disabled={!selectedSlot} onClick={() => setStep(4)} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${selectedSlot ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl transform hover:-translate-y-0.5' : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}>下一步：填寫資料</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-fadeIn pb-20">
          <button onClick={() => setStep(3)} className="mb-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-white"><ChevronLeft size={16} /> 返回時段選擇</button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-900 p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><FileText size={18} className="text-blue-500 dark:text-blue-400"/> 確認預約詳情</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-gray-900 p-4 rounded-xl space-y-2">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 text-sm">服務</span><span className="font-bold text-blue-900 dark:text-blue-400">{selectedService?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 text-sm">教練</span><span className="font-bold text-blue-900 dark:text-blue-400">{selectedCoach?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400 text-sm">時間</span><span className="font-bold text-blue-900 dark:text-blue-400">{selectedDate.getMonth() + 1}/{selectedDate.getDate()} {selectedSlot}</span></div>
              </div>
              <form onSubmit={onSubmit} className="space-y-5 mt-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名 <span className="text-red-500">*</span></label>
                    <div className="relative"><User className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" required className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="請輸入您的姓名" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">電話 <span className="text-red-500">*</span></label>
                    <div className="relative"><Phone className="absolute left-3 top-3 text-gray-400" size={18} /><input type="tel" required className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="請輸入您的電話" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail (選填)</label>
                    <div className="relative"><Mail className="absolute left-3 top-3 text-gray-400" size={18} /><input type="email" className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="接收預約確認信" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                  </div>
                </div>
                <button type="submit" className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all mt-6">確認預約</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-10 animate-fadeIn">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle className="text-green-500 dark:text-green-400 w-10 h-10" /></div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">預約成功！</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">我們已通知 {selectedCoach?.name}。</p>
          {formData.email && (<p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 py-2 px-4 rounded-full inline-block mb-8"><Mail size={14} className="inline mr-1"/> 確認信已發送至 {formData.email}</p>)}
          {/* Changed button color from gray-900 to blue-600 to avoid "black block" look */}
          <button onClick={reset} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg">返回首頁</button>
        </div>
      )}
    </div>
  );
};

export default BookingWizard;