import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  User, 
  Phone, 
  Mail, 
  Dumbbell, 
  Briefcase,
  FileText,
  Sun,
  Sunset,
  Moon,
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  MessageCircle,
  AlertCircle,
  LogIn,
  Info
} from 'lucide-react';
import { Coach, Service, Customer, UserInventory } from '../types';
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
  setFormData: React.Dispatch<React.SetStateAction<Customer>>;
  coaches: Coach[];
  appointments: any[];
  onSubmit: (e: React.FormEvent, lineProfile?: {userId: string, displayName: string}) => void;
  reset: () => void;
  currentDate: Date;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  // Inventory Props
  inventories: UserInventory[];
  onRegisterUser: (profile: {userId: string, displayName: string}) => Promise<void>;
  // Login Props
  liffProfile: { userId: string; displayName: string } | null;
  onLogin: () => void;
}

const BookingWizard: React.FC<BookingWizardProps> = ({
  step, setStep, selectedService, setSelectedService,
  selectedCoach, setSelectedCoach, selectedDate, setSelectedDate,
  selectedSlot, setSelectedSlot, formData, setFormData,
  coaches, appointments, onSubmit, reset, currentDate, handlePrevMonth, handleNextMonth,
  inventories, onRegisterUser, liffProfile, onLogin
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const isDayOff = selectedCoach ? isCoachDayOff(dateKey, selectedCoach) : false;

  // Auto-fill form data when logged in
  useEffect(() => {
    if (liffProfile) {
        setFormData(prev => ({ ...prev, name: liffProfile.displayName }));
    }
  }, [liffProfile, setFormData]);

  const handleLineSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsVerifying(true);
      setAuthError(null);
      
      if (liffProfile) {
          try {
              const userInv = inventories.find(i => i.lineUserId === liffProfile.userId);
              
              if (!userInv) {
                  await onRegisterUser({ userId: liffProfile.userId, displayName: liffProfile.displayName });
              }

              // Await the actual submission to Firebase
              await onSubmit(e, { userId: liffProfile.userId, displayName: liffProfile.displayName });
          } catch (err) {
              console.error("LIFF Error", err);
              await onSubmit(e); 
          }
      } else {
          // Fallback if somehow bypassed
           setAuthError('請先登入 LINE 以完成預約');
      }
      setIsVerifying(false);
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${year}-${month}-${i}`} className="h-12 w-full"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const loopDate = new Date(year, month, day);
      const isSelected = selectedDate.toDateString() === loopDate.toDateString();
      const isToday = new Date().toDateString() === loopDate.toDateString();
      const loopDateKey = formatDateKey(year, month, day);
      const isPast = new Date(loopDateKey) < new Date(new Date().toDateString());
      
      // Check Coach Availability
      const isOff = selectedCoach ? isCoachDayOff(loopDateKey, selectedCoach) : false;
      
      let cellClass = "h-12 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 relative ";
      
      if (isPast) {
          cellClass += "text-gray-300 dark:text-gray-600 cursor-not-allowed ";
      } else if (isOff) {
          cellClass += "bg-stripes-gray text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-100 dark:border-gray-700 opacity-60 ";
      } else if (isSelected) {
          cellClass += "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 font-bold transform scale-105 z-10 ";
      } else if (isToday) {
          cellClass += "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800 ";
      } else {
          cellClass += "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ";
      }

      days.push(
        <button 
          key={loopDateKey} 
          onClick={() => { if (!isPast && !isOff) { setSelectedDate(loopDate); setSelectedSlot(null); } }} 
          disabled={isPast || isOff}
          className={cellClass}
        >
          {day}
          {isToday && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-indigo-500 rounded-full"></div>}
        </button>
      );
    }

    return (
      <div className="glass-panel p-6 rounded-3xl mb-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><ChevronLeft size={20}/></button>
          <h3 className="font-bold text-gray-800 dark:text-white text-lg tracking-wide flex items-center gap-2">
            <CalendarIcon size={18} className="text-indigo-500"/>
            {year}年 {month + 1}月
          </h3>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><ChevronRight size={20}/></button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {['日','一','二','三','四','五','六'].map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 mt-4 justify-center text-[10px] text-gray-500">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-indigo-600"></div>選擇</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200"></div>今天</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-stripes-gray border border-gray-200"></div>教練休假</div>
        </div>
      </div>
    );
  };

  // Step 0: Force Login
  if (!liffProfile) {
     return (
        <div className="max-w-md mx-auto mt-12 animate-slideUp">
             <div className="glass-panel p-10 rounded-3xl text-center shadow-xl">
                 <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400">
                     <MessageCircle size={36}/>
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">歡迎使用 GymBooker</h2>
                 <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">為了提供完整的預約服務與點數紀錄，請先登入您的 LINE 帳號。</p>
                 <button onClick={onLogin} className="w-full py-4 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl font-bold shadow-lg shadow-green-500/30 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2">
                     <LogIn size={20}/> LINE 登入
                 </button>
             </div>
        </div>
     );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-2">
          <span className={step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : ''}>服務</span>
          <span className={step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : ''}>教練</span>
          <span className={step >= 3 ? 'text-indigo-600 dark:text-indigo-400' : ''}>時間</span>
          <span className={step >= 4 ? 'text-indigo-600 dark:text-indigo-400' : ''}>資料</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-500 ease-out" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-slideUp">
          <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">嗨，{liffProfile.displayName}！</h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">今天想做什麼訓練呢？</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SERVICES.map(service => (
              <button
                key={service.id}
                onClick={() => { setSelectedService(service); setStep(2); }}
                className={`glass-card p-6 rounded-3xl text-left transition-all hover:scale-[1.02] border-2 group
                  ${selectedService?.id === service.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30' : 'border-transparent hover:border-indigo-200 dark:hover:border-indigo-800'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${service.color.split(' ')[0]} ${service.color.split(' ')[1]}`}>
                  <Dumbbell size={24}/>
                </div>
                <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{service.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1"><Clock size={14}/> {service.duration}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-slideUp">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setStep(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"><ChevronLeft/></button>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex-1 text-center pr-10">選擇您的教練</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coaches.filter(c => {
                // Filter out receptionists from booking wizard
                if (c.role === 'receptionist') return false;

                if (selectedService?.id === 'assessment') {
                    const title = (c.title || '').toLowerCase();
                    return title !== 'coach' && title !== '教練';
                }
                return true;
            }).map(coach => (
              <button
                key={coach.id}
                onClick={() => { setSelectedCoach(coach); setStep(3); }}
                className={`glass-card p-4 rounded-3xl text-left transition-all hover:scale-[1.02] border-2 group flex items-center gap-4
                  ${selectedCoach?.id === coach.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30' : 'border-transparent hover:border-indigo-200 dark:hover:border-indigo-800'}`}
              >
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold ${coach.color} shadow-sm`}>
                    {coach.name[0]}
                 </div>
                 <div>
                    <h3 className="font-bold text-lg dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{coach.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{coach.title || (coach.role === 'manager' ? '經理' : '教練')}</p>
                 </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-slideUp flex flex-col h-full">
           <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setStep(2)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"><ChevronLeft/></button>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex-1 text-center pr-10">預約時間</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                  {renderCalendar()}
              </div>

              <div className="glass-panel rounded-3xl p-6 flex flex-col h-full">
                <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <Clock size={18} className="text-indigo-500"/> 
                  {selectedDate.getMonth()+1}月{selectedDate.getDate()}日 可選時段
                </h4>
                
                {isDayOff ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 p-8">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-300">
                          <Sunset size={32}/>
                      </div>
                      <h5 className="font-bold text-lg mb-1">今日教練休假</h5>
                      <p className="text-sm">請選擇其他日期</p>
                   </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[400px]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {ALL_TIME_SLOTS.map(time => {
                        const status = getSlotStatus(dateKey, time, selectedCoach, appointments);
                        const isPast = isPastTime(dateKey, time);
                        const isAvailable = status.status === 'available' && !isPast;
                        
                        return (
                          <button
                            key={time}
                            disabled={!isAvailable}
                            onClick={() => setSelectedSlot(time)}
                            className={`
                              py-3 rounded-xl text-sm font-bold transition-all border relative overflow-hidden
                              ${selectedSlot === time 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30' 
                                : isAvailable
                                  ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-100 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600'
                                  : 'bg-gray-50 dark:bg-gray-900/50 text-gray-300 dark:text-gray-600 border-transparent cursor-not-allowed'
                              }
                            `}
                          >
                            {time}
                            {status.status === 'booked' && <span className="absolute right-1 top-1 w-1.5 h-1.5 bg-red-400 rounded-full"></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => setStep(4)} 
                  disabled={!selectedSlot}
                  className={`w-full mt-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                    ${selectedSlot 
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-indigo-500/30 hover:shadow-indigo-500/40 transform hover:scale-[1.02]' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                >
                  下一步 <ArrowRight size={18}/>
                </button>
              </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-slideUp">
           <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setStep(3)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"><ChevronLeft/></button>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex-1 text-center pr-10">確認聯絡資料</h2>
          </div>

          <form onSubmit={handleLineSubmit} className="space-y-4">
             <div className="glass-card p-6 rounded-3xl mb-6 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
                <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4">預約確認</h3>
                <div className="space-y-3">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-indigo-500 shadow-sm"><Dumbbell size={18}/></div>
                      <div>
                        <div className="text-xs text-gray-400">課程項目</div>
                        <div className="font-bold text-gray-800 dark:text-white">{selectedService?.name}</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-indigo-500 shadow-sm"><Briefcase size={18}/></div>
                      <div>
                        <div className="text-xs text-gray-400">指導教練</div>
                        <div className="font-bold text-gray-800 dark:text-white">{selectedCoach?.name}</div>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-indigo-500 shadow-sm"><Clock size={18}/></div>
                      <div>
                        <div className="text-xs text-gray-400">預約時間</div>
                        <div className="font-bold text-gray-800 dark:text-white">{selectedDate.toLocaleDateString()} {selectedSlot}</div>
                      </div>
                   </div>
                </div>
                
                {/* Info Note */}
                <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/30 text-xs text-indigo-600 dark:text-indigo-400 flex items-start gap-2 bg-white/50 dark:bg-gray-900/20 p-3 rounded-lg">
                    <Info size={14} className="mt-0.5 shrink-0"/>
                    <span>注意：預約完成後不會立即扣點。請在上課當天透過「我的預約」進行簽到，經教練核實後才會扣除點數。</span>
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1"><User size={12}/> 姓名</label>
                <input required type="text" className="w-full glass-input rounded-xl p-3.5 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" 
                       placeholder="請輸入您的姓名"
                       value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
             </div>
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1"><Phone size={12}/> 電話</label>
                <input required type="tel" className="w-full glass-input rounded-xl p-3.5 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" 
                       placeholder="0912-345-678"
                       value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
             </div>
             <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center gap-1"><Mail size={12}/> Email (選填)</label>
                <input type="email" className="w-full glass-input rounded-xl p-3.5 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" 
                       placeholder="example@mail.com"
                       value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
             </div>
             
             {authError && (
                 <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 flex gap-3 animate-fadeIn">
                     <AlertCircle className="text-red-500 shrink-0" size={20}/>
                     <p className="text-sm text-red-600 dark:text-red-400 font-medium leading-relaxed">{authError}</p>
                 </div>
             )}

             <button type="submit" disabled={isVerifying || !!authError} className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all transform hover:scale-[1.02] mt-4 flex items-center justify-center gap-2
                 ${!!authError ? 'bg-gray-400 text-white cursor-not-allowed shadow-none' : 'bg-[#06C755] hover:bg-[#05b34c] text-white shadow-green-500/30'}`}>
                {isVerifying ? '驗證中...' : !!authError ? '無法預約' : '確認預約'} <MessageCircle size={18}/>
             </button>
          </form>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-10 animate-slideUp">
           <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
              <CheckCircle size={48} className="animate-pulse"/>
           </div>
           <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">預約成功！</h2>
           <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">我們已經收到您的預約資訊，期待在健身房見到您。</p>
           
           <div className="glass-card p-6 rounded-3xl max-w-sm mx-auto mb-8 border border-green-200 dark:border-green-900/50">
               <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">預約詳情</div>
               <div className="font-bold text-lg dark:text-white">{selectedService?.name}</div>
               <div className="text-indigo-600 dark:text-indigo-400 font-bold mb-2">{selectedCoach?.name}</div>
               <div className="text-gray-800 dark:text-gray-200">{selectedDate.toLocaleDateString()} {selectedSlot}</div>
           </div>

           <button onClick={reset} className="px-8 py-3 bg-gray-800 hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-200 dark:text-gray-900 text-white rounded-xl font-bold shadow-lg transition-all">
              返回首頁
           </button>
        </div>
      )}
    </div>
  );
};

export default BookingWizard;