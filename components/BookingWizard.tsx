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
  FileText,
  Sun,
  Sunset,
  Moon,
  Calendar,
  Clock
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
        days.push(<div key={`empty-${year}-${month}-${i}`} className="h-10 w-full"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const loopDate = new Date(year, month, day);
      const isSelected = selectedDate.toDateString() === loopDate.toDateString();
      const isToday = new Date().toDateString() === loopDate.toDateString();
      const loopDateKey = formatDateKey(year, month, day);
      const isPast = new Date(loopDateKey) < new Date(new Date().toDateString());
      
      days.push(
        <button 
          key={loopDateKey} 
          onClick={() => { setSelectedDate(loopDate); setSelectedSlot(null); }} 
          disabled={isPast}
          className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300
            ${isSelected ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110' : 
              isToday ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 font-bold' : 
              isPast ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 
              'text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10'}`}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="glass-card rounded-3xl p-6 mb-6 animate-slideUp">
        <div className="flex justify-between items-center mb-6">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-300 transition-colors"><ChevronLeft size={20}/></button>
          <h3 className="font-bold text-gray-800 dark:text-white text-lg tracking-wide">{year}年 {month + 1}月</h3>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-300 transition-colors"><ChevronRight size={20}/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-3">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (<span key={d} className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase">{d}</span>))}
        </div>
        <div className="grid grid-cols-7 gap-y-2">{days}</div>
      </div>
    );
  };

  const renderTimeSlots = () => {
    const morningSlots = ALL_TIME_SLOTS.filter(t => parseInt(t.split(':')[0]) < 12);
    const afternoonSlots = ALL_TIME_SLOTS.filter(t => { const h = parseInt(t.split(':')[0]); return h >= 12 && h < 18; });
    const eveningSlots = ALL_TIME_SLOTS.filter(t => parseInt(t.split(':')[0]) >= 18);

    const renderSlotGroup = (title: string, icon: React.ReactNode, slots: string[]) => {
      if (slots.length === 0) return null;
      return (
        <div className="mb-6 animate-slideUp">
           <div className="flex items-center gap-2 mb-3 px-1 text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
              {icon} {title}
           </div>
           <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
             {slots.map(time => {
                const result = getSlotStatus(dateKey, time, selectedCoach, appointments);
                const isPast = isPastTime(dateKey, time);
                
                if (result.status === 'unavailable') return null;

                const isBooked = result.status === 'booked';
                const isDisabled = isBooked || isPast;
                const isSelected = selectedSlot === time;

                return (
                  <button 
                    key={time} 
                    disabled={isDisabled} 
                    onClick={() => setSelectedSlot(time)} 
                    className={`
                      relative py-3 rounded-2xl text-sm font-medium transition-all duration-300 flex flex-col items-center justify-center
                      ${isDisabled 
                         ? 'bg-gray-100/50 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed border border-transparent' 
                         : isSelected 
                           ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/40 transform scale-105 border border-transparent' 
                           : 'glass-card text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md hover:-translate-y-0.5'
                      }
                    `}
                  >
                    <span className="text-base font-bold tracking-tight">{time}</span>
                    {isBooked && (<span className="text-[10px] text-red-400 mt-1 font-bold">{result.type === 'block' ? '暫停' : '額滿'}</span>)}
                    {!isBooked && isPast && (<span className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">已過</span>)}
                  </button>
                );
             })}
           </div>
        </div>
      );
    };

    return (
      <div className="space-y-2">
         {renderSlotGroup("上午時段", <Sun size={14}/>, morningSlots)}
         {renderSlotGroup("下午時段", <Sunset size={14}/>, afternoonSlots)}
         {renderSlotGroup("晚上時段", <Moon size={14}/>, eveningSlots)}
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="mb-8 text-center animate-fadeIn">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 mb-2">
          {step === 5 ? "預約完成" : "線上預約"}
        </h1>
        <div className="flex justify-center gap-2 mb-4">
           {[1,2,3,4].map(i => (
             <div key={i} className={`h-1 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-indigo-500' : 'w-2 bg-gray-200 dark:bg-gray-700'}`}></div>
           ))}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
          {step===1&&"選擇您想要的服務項目"}
          {step===2&&"指定您的專屬教練"}
          {step===3&&"挑選合適的日期與時間"}
          {step===4&&"留下您的聯絡資訊"}
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-4 animate-slideUp">
          {SERVICES.map(service => (
            <button key={service.id} onClick={() => { setSelectedService(service); setStep(2); }} 
              className="w-full glass-card p-6 rounded-3xl flex items-center justify-between group hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${service.color} shadow-inner bg-opacity-20 backdrop-blur-sm`}>
                  <Dumbbell size={28} />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-xl text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{service.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{service.duration}</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors">
                <ChevronRight className="text-gray-400 group-hover:text-indigo-600 transition-colors" size={20}/>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-slideUp">
          <button onClick={() => setStep(1)} className="text-gray-400 flex items-center mb-4 hover:text-gray-600 dark:hover:text-white transition-colors text-sm font-medium"><ChevronLeft size={16} className="mr-1" /> 重選服務</button>
          <div className="grid grid-cols-1 gap-4">
            {coaches.filter(c => c.status !== 'disabled').map(coach => (
              <button key={coach.id} onClick={() => { setSelectedCoach(coach); setStep(3); }} 
                className="w-full glass-card p-4 rounded-3xl flex items-center justify-between group hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden"
              >
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-2xl shadow-inner">
                    {coach.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">{coach.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                         <span className={`text-[10px] px-2 py-0.5 rounded-full border ${coach.color} bg-opacity-10`}>教練</span>
                         <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1"><Briefcase size={10}/> 查看班表</p>
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-indigo-50 dark:from-indigo-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 relative z-10 mr-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-slideUp">
          <button onClick={() => setStep(2)} className="text-gray-400 flex items-center mb-2 hover:text-gray-600 dark:hover:text-white transition-colors text-sm font-medium"><ChevronLeft size={16} className="mr-1"/> 重選教練</button>
          
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800/50 p-4 rounded-3xl border border-orange-100 dark:border-gray-700 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center font-bold text-xl text-orange-500 dark:text-orange-400 shadow-md">
                {selectedCoach?.name.charAt(0)}
            </div>
            <div>
              <div className="text-xs text-orange-400 dark:text-gray-400 font-medium uppercase tracking-wider">目前選擇教練</div>
              <div className="font-bold text-lg text-gray-800 dark:text-white">{selectedCoach?.name}</div>
            </div>
          </div>

          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
                <Calendar size={16} className="text-indigo-500"/>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">日期選擇</h2>
            </div>
            {/* Restored Date Picker Calendar */}
            {renderCalendar()}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
                <Clock size={16} className="text-indigo-500"/>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 時段
                </h2>
            </div>
            
            {isDayOff ? (
              <div className="text-center py-10 glass-card rounded-3xl border-dashed border-2 border-gray-300 dark:border-gray-600 flex flex-col items-center gap-2 text-gray-400">
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full"><Moon size={24}/></div>
                  <span>教練今日排休</span>
              </div>
            ) : (
              <div>
                {renderTimeSlots()}
              </div>
            )}
            
            {!isDayOff && ALL_TIME_SLOTS.every(t => getSlotStatus(dateKey, t, selectedCoach, appointments).status !== 'available' || isPastTime(dateKey, t)) && (
               <div className="text-center py-10 glass-card rounded-3xl border-dashed border-2 border-gray-300 dark:border-gray-600 flex flex-col items-center gap-2 text-gray-400">
                  <span>今日已無可預約時段</span>
               </div>
            )}
          </section>
          
          <div className="pt-4">
            <button 
                disabled={!selectedSlot} 
                onClick={() => setStep(4)} 
                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all duration-300
                    ${selectedSlot 
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-indigo-500/50 hover:scale-[1.02]' 
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    }`}
            >
                下一步：填寫資料
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-slideUp">
          <button onClick={() => setStep(3)} className="mb-6 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm font-medium"><ChevronLeft size={16} className="mr-1"/> 重選時段</button>
          
          <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-indigo-50/50 dark:bg-gray-800/50 p-6 border-b border-white/20 dark:border-gray-700">
              <h3 className="font-bold text-xl text-gray-800 dark:text-white flex items-center gap-2">
                  <FileText size={20} className="text-indigo-500"/> 確認預約詳情
              </h3>
            </div>
            
            <div className="p-6 md:p-8 space-y-6">
              <div className="bg-white/60 dark:bg-gray-900/60 p-5 rounded-2xl space-y-3 border border-white/40 dark:border-gray-700">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">服務項目</span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-300">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">指導教練</span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-300">{selectedCoach?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">預約時間</span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 px-2 py-1 rounded-lg">
                        {selectedDate.getMonth() + 1}/{selectedDate.getDate()} {selectedSlot}
                    </span>
                </div>
              </div>
              
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">姓名 <span className="text-red-400">*</span></label>
                    <div className="relative group">
                        <User className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input type="text" required 
                            className="w-full pl-12 pr-4 py-3.5 glass-input rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-gray-900 placeholder-gray-400" 
                            placeholder="請輸入您的姓名" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">電話 <span className="text-red-400">*</span></label>
                    <div className="relative group">
                        <Phone className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input type="tel" required 
                            className="w-full pl-12 pr-4 py-3.5 glass-input rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-gray-900 placeholder-gray-400" 
                            placeholder="請輸入您的電話" 
                            value={formData.phone} 
                            onChange={e => setFormData({...formData, phone: e.target.value})} 
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">E-mail (選填)</label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input type="email" 
                            className="w-full pl-12 pr-4 py-3.5 glass-input rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white text-gray-900 placeholder-gray-400" 
                            placeholder="接收預約確認信" 
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})} 
                        />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] transition-all duration-300 mt-4">
                    確認送出
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="text-center py-12 animate-slideUp">
          <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
              <CheckCircle className="text-green-500 dark:text-green-400 w-12 h-12" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">預約成功！</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-lg">我們已通知 {selectedCoach?.name}。</p>
          
          {formData.email && (
              <div className="glass-card inline-flex items-center gap-2 px-6 py-3 rounded-2xl mb-10 text-indigo-600 dark:text-indigo-300">
                  <Mail size={16}/> <span>確認信已發送至 {formData.email}</span>
              </div>
          )}
          
          <div className="block">
              <button onClick={reset} className="px-10 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white rounded-2xl font-bold hover:shadow-lg transition-all transform hover:-translate-y-1">
                返回首頁
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingWizard;