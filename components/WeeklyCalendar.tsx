
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Plus, AlertCircle, Filter, Calendar as CalendarIcon, UserX, RefreshCw, Users } from 'lucide-react';
import { Coach, User, Appointment } from '../types';
import { ALL_TIME_SLOTS } from '../constants';
import { addDays, formatDateKey, isCoachDayOff, isPastTime, getStartOfWeek } from '../utils';

interface WeeklyCalendarProps {
  currentWeekStart: Date;
  setCurrentWeekStart: (d: Date) => void;
  currentUser: User;
  coaches: Coach[];
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
  onAppointmentClick: (app: Appointment) => void;
  onToggleComplete: (app: Appointment) => void;
  isLoading: boolean;
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  currentWeekStart, setCurrentWeekStart, currentUser, coaches, appointments, onSlotClick, onAppointmentClick, onToggleComplete, isLoading
}) => {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'private' | 'group'>('all'); 
  const weekDays = Array.from({length: 7}, (_, i) => addDays(currentWeekStart, i));
  const isManager = currentUser.role === 'manager';

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = new Date(e.target.value);
      if (!isNaN(selected.getTime())) {
          setCurrentWeekStart(getStartOfWeek(selected));
      }
  };

  const handleJumpToToday = () => {
      setCurrentWeekStart(getStartOfWeek(new Date()));
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-sm animate-fadeIn relative flex flex-col h-[750px] border border-white/50">
      
      {isLoading && (
        <div className="absolute inset-0 z-[60] bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl">
            <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-2" size={48} />
            <p className="text-slate-600 dark:text-slate-300 font-bold">資料載入中...</p>
        </div>
      )}

      <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 dark:bg-slate-900/50 z-20 relative backdrop-blur-md">
        <div className="flex items-center gap-4 w-full md:w-auto">
           <div className="flex items-center gap-2">
               <button 
                onClick={handleJumpToToday}
                disabled={isLoading}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                今天
              </button>
              <div className="flex bg-white dark:bg-slate-800 rounded-xl p-1 shadow-sm border border-slate-100 dark:border-slate-700">
                  <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} disabled={isLoading} className="p-1.5 md:p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"><ChevronLeft size={20} className="text-slate-600 dark:text-slate-300"/></button>
                  <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} disabled={isLoading} className="p-1.5 md:p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"><ChevronRight size={20} className="text-slate-600 dark:text-slate-300"/></button>
              </div>
              <div className="relative group">
                 <input 
                    type="date" 
                    onChange={handleDateChange}
                    className="glass-input pl-8 pr-2 py-1.5 rounded-xl text-sm font-bold w-36 dark:text-white cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
                 />
                 <CalendarIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
          </div>

           <span className="font-bold text-lg md:text-xl text-slate-800 dark:text-white tracking-tight whitespace-nowrap min-w-[120px]">
             {currentWeekStart.getFullYear()}年 {currentWeekStart.getMonth()+1}月
           </span>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex gap-2">
                  <select 
                      className="glass-input dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs md:text-sm font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/50 dark:text-white cursor-pointer w-full md:w-auto"
                      value={selectedCoachId}
                      onChange={(e) => setSelectedCoachId(e.target.value)}
                  >
                      <option value="all">所有教練</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select 
                      className="glass-input dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs md:text-sm font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/50 dark:text-white cursor-pointer w-full md:w-auto"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as any)}
                  >
                      <option value="all">全部類型</option>
                      <option value="private">私人課</option>
                      <option value="group">團體課</option>
                  </select>
              </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar bg-white/30 dark:bg-slate-900/30 relative">
        <div className="min-w-[700px] md:min-w-[900px]">
          <div className="grid grid-cols-8 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-40 shadow-sm backdrop-blur-sm">
            <div className="p-2 md:p-4 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100 dark:border-slate-700/50 sticky left-0 z-50 bg-white dark:bg-slate-900 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] flex items-center justify-center">時間</div>
            {weekDays.map((d, i) => {
               const dateKey = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
               const offCoaches = coaches.filter(c => isCoachDayOff(dateKey, c));
               
               return (
                <div key={i} className={`p-2 md:p-3 text-center border-r border-slate-100 dark:border-slate-700/50 ${d.toDateString()===new Date().toDateString()?'bg-indigo-50/50 dark:bg-indigo-900/20':''}`}>
                    <div className="text-[10px] md:text-xs text-slate-500 font-medium mb-1">{['週日','週一','週二','週三','週四','週五','週六'][d.getDay()]}</div>
                    <div className={`font-bold text-sm md:text-lg inline-block w-6 h-6 md:w-8 md:h-8 leading-6 md:leading-8 rounded-full ${d.toDateString()===new Date().toDateString() ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 dark:text-slate-200'}`}>{d.getDate()}</div>
                     {selectedCoachId === 'all' && offCoaches.length > 0 && (
                        <div className="mt-1 flex flex-col items-center gap-0.5" title={offCoaches.map(c => c.name).join(', ') + ' 休假'}>
                           {offCoaches.map(c => (
                             <div key={c.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full w-full max-w-[80px] truncate ${c.color}`}>{c.name}</div>
                           ))}
                        </div>
                    )}
                </div>
              );
            })}
          </div>
          
          {ALL_TIME_SLOTS.map(time => (
            <div key={time} className="grid grid-cols-8 border-b border-slate-100/50 dark:border-slate-700/50 min-h-[80px] md:min-h-[90px]">
              <div className="p-1 md:p-2 text-center text-[10px] md:text-xs font-medium text-slate-400 border-r border-slate-100/50 dark:border-slate-700/50 flex items-center justify-center bg-white dark:bg-slate-900 sticky left-0 z-30 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">{time}</div>
              {weekDays.map((day) => {
                const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate());
                const isPast = isPastTime(dateKey, time);
                
                let isCellDisabled = false;
                if (selectedCoachId !== 'all') {
                    const selectedCoach = coaches.find(c => c.id === selectedCoachId);
                    isCellDisabled = selectedCoach ? isCoachDayOff(dateKey, selectedCoach) : false;
                } else {
                    const workingCoaches = coaches.filter(c => !isCoachDayOff(dateKey, c));
                    isCellDisabled = workingCoaches.length === 0;
                }
                
                const slotApps = appointments.filter(a => 
                    a.date === dateKey && 
                    a.time === time && 
                    a.status !== 'cancelled' &&
                    (selectedCoachId === 'all' || a.coachId === selectedCoachId)
                );

                const visibleApps = slotApps.filter(a => {
                    if (selectedType === 'all') return true;
                    return a.type === selectedType;
                });

                // Aggregation Logic for Group Classes
                const aggregatedApps: (Appointment & { currentCount?: number; maxCount?: number; isGroupHeader?: boolean })[] = [];
                const groups: Record<string, any> = {};

                visibleApps.forEach(app => {
                    if (app.type === 'group') {
                        const key = `${app.coachId}_${app.reason}`;
                        if (!groups[key]) {
                            groups[key] = {
                                ...app,
                                isGroupHeader: true,
                                currentCount: 1,
                                maxCount: app.maxAttendees || 8
                            };
                            aggregatedApps.push(groups[key]);
                        } else {
                            groups[key].currentCount++;
                            // If any in group is checked_in, highlight the aggregated card
                            if (app.status === 'checked_in') groups[key].status = 'checked_in';
                        }
                    } else {
                        aggregatedApps.push(app);
                    }
                });

                return (
                  <div 
                    key={`${dateKey}-${time}`} 
                    className={`border-r border-slate-100/50 dark:border-slate-700/50 p-1 md:p-1.5 relative group transition-all duration-200
                      ${isCellDisabled ? 'bg-stripes-gray opacity-40 cursor-not-allowed' : 
                        (isPast && !isManager) ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50' :
                        'hover:bg-white/40 dark:hover:bg-slate-800/40 cursor-pointer'}
                    `}
                    onClick={() => {
                        if (((!isCellDisabled && !isPast) || isManager) && !isLoading) {
                            onSlotClick(dateKey, time);
                        }
                    }}
                  >
                     <div className="flex flex-col gap-1 md:gap-1.5 h-full">
                        {aggregatedApps.slice(0, expandedCell === `${dateKey}-${time}` ? undefined : 2).map(app => {
                            const coach = coaches.find(c => c.id === app.coachId);
                            const colorClass = coach?.color || 'bg-slate-100 text-slate-800 border-slate-200';
                            const isMine = currentUser.role === 'manager' || app.coachId === currentUser.id;
                            const isCompleted = app.status === 'completed';
                            const isCheckedIn = app.status === 'checked_in';

                            const displayText = app.isGroupHeader 
                              ? `${app.reason || '團體課'} (${app.currentCount}/${app.maxCount})`
                              : (app.type === 'block' ? (app.reason || '內部事項') : (app.customer?.name || '私人課'));

                            return (
                              <div key={app.id} 
                                   onClick={(e) => { e.stopPropagation(); if(isMine && !isLoading) onAppointmentClick(app); }}
                                   className={`
                                      text-[9px] md:text-[11px] p-1 md:p-2 rounded-lg md:rounded-xl shadow-sm border border-black/5 hover:scale-[1.02] transition-transform
                                      ${colorClass} 
                                      ${isCompleted ? 'opacity-60 grayscale' : ''} 
                                      ${!isMine ? 'opacity-80' : ''}
                                      ${isCheckedIn ? 'ring-2 ring-orange-400 ring-offset-1 dark:ring-offset-slate-900 animate-pulse' : ''}
                                      ${app.isGroupHeader && (app.currentCount || 0) < (app.maxCount || 8) ? 'border-dashed border-2' : ''}
                                   `}
                              >
                                  <div className="flex justify-between items-center mb-0.5">
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span className="font-bold truncate max-w-[50px] md:max-w-none">{coach?.name.slice(0,3) || app.coachName}</span>
                                        {app.isGroupHeader && <Users size={10} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {(isMine || isManager) && isCheckedIn && (
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); onToggleComplete(app); }}
                                              className="bg-orange-500 text-white rounded-full p-0.5 shadow-sm hover:scale-110 transition-transform" 
                                              title="確認完課"
                                          >
                                              <AlertCircle size={10} className="md:w-3 md:h-3"/>
                                          </button>
                                      )}
                                      {isManager && isCompleted && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); if(!isLoading) onToggleComplete(app); }}
                                          className="bg-yellow-100 hover:bg-yellow-200 rounded-full p-0.5 text-yellow-700 transition-colors shadow-sm" title="撤銷完課"
                                        >
                                          <RefreshCw size={10} className="md:w-3 md:h-3"/>
                                        </button>
                                      )}
                                      {(isMine || isManager) && isCompleted && <CheckCircle size={10} className="text-green-800 md:w-3 md:h-3"/>}
                                    </div>
                                  </div>
                                  <div className="truncate font-bold opacity-90">{displayText}</div>
                                  {app.type === 'private' && app.service?.name && (
                                    <div className="text-[8px] md:text-[10px] opacity-70 truncate mt-0.5">{app.service.name}</div>
                                  )}
                              </div>
                            );
                        })}
                        {aggregatedApps.length > 2 && expandedCell !== `${dateKey}-${time}` && (
                          <div onClick={(e) => { e.stopPropagation(); setExpandedCell(`${dateKey}-${time}`); }} className="text-[9px] md:text-[10px] text-center text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-900/30 rounded-lg cursor-pointer hover:bg-indigo-100 py-1 transition-colors">
                            +{aggregatedApps.length - 2}
                          </div>
                        )}
                        {expandedCell === `${dateKey}-${time}` && aggregatedApps.length > 2 && (
                          <div onClick={(e) => { e.stopPropagation(); setExpandedCell(null); }} className="text-[9px] md:text-[10px] text-center text-slate-400 cursor-pointer py-1 hover:text-slate-600">
                            收起
                          </div>
                        )}
                        {!isCellDisabled && aggregatedApps.length === 0 && (!isPast || isManager) && (
                            <div className="hidden group-hover:flex w-full h-full items-center justify-center">
                                <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-indigo-50 dark:bg-slate-700 text-indigo-500 flex items-center justify-center">
                                    <Plus size={12} strokeWidth={3} className="md:w-3.5 md:h-3.5"/>
                                </div>
                            </div>
                        )}
                     </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;
