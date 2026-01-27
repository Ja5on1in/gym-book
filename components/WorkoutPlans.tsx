import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserInventory, WorkoutPlan, ExerciseLog, Exercise } from '../types';
import { Search, Plus, X, Trash2, Dumbbell, Calendar, Save, Edit, BookCopy, Activity, AlertTriangle, Copy, FileText, CheckCircle, ChevronLeft } from 'lucide-react';
import { EXERCISE_LIST } from '../constants';
import { formatDateKey } from '../utils';

interface WorkoutPlansProps {
  currentUser: User;
  inventories: UserInventory[];
  workoutPlans: WorkoutPlan[];
  onSavePlan: (plan: WorkoutPlan) => void;
  onDeletePlan: (id: string) => void;
  onSaveInventory: (inv: UserInventory) => void;
}

const WorkoutPlans: React.FC<WorkoutPlansProps> = ({ currentUser, inventories, workoutPlans, onSavePlan, onDeletePlan, onSaveInventory }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserInventory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Partial<WorkoutPlan>>({});
  
  // Health Profile State (Local buffer before saving)
  const [profileBuffer, setProfileBuffer] = useState<Partial<UserInventory>>({});
  const [isProfileDirty, setIsProfileDirty] = useState(false);

  const [exerciseSearch, setExerciseSearch] = useState('');
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const exercisePickerRef = useRef<HTMLDivElement>(null);
  
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exercisePickerRef.current && !exercisePickerRef.current.contains(event.target as Node)) {
        setIsExercisePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      if (selectedUser) {
          setProfileBuffer({
              goals: selectedUser.goals || '',
              injuries: selectedUser.injuries || '',
              physicalNotes: selectedUser.physicalNotes || ''
          });
          setIsProfileDirty(false);
      }
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return [];
    const lowerTerm = searchTerm.toLowerCase();
    return inventories.filter(u => 
        u.name.toLowerCase().includes(lowerTerm) || 
        (u.phone && u.phone.includes(lowerTerm))
    ).slice(0, 10);
  }, [searchTerm, inventories]);

  const recentlyUpdatedUsers = useMemo(() => {
    return [...inventories]
      .sort((a, b) => {
        const dateA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const dateB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [inventories]);

  const userPlans = useMemo(() => {
    if (!selectedUser) return [];
    return workoutPlans
        .filter(p => p.userId === selectedUser.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedUser, workoutPlans]);

  const groupedExercises = useMemo(() => {
    const filtered = EXERCISE_LIST.filter(ex => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()));
    return filtered.reduce((acc, ex) => {
        (acc[ex.category] = acc[ex.category] || []).push(ex);
        return acc;
    }, {} as Record<string, Exercise[]>);
  }, [exerciseSearch]);

  const handleSelectUser = (user: UserInventory) => {
    setSelectedUser(user);
    setSearchTerm('');
  };

  const handleSaveProfile = () => {
      if (!selectedUser) return;
      onSaveInventory({
          ...selectedUser,
          ...profileBuffer,
          lastUpdated: new Date().toISOString()
      } as UserInventory);
      setIsProfileDirty(false);
      // Update local selectedUser to reflect changes immediately
      setSelectedUser(prev => prev ? ({ ...prev, ...profileBuffer }) : null);
  };
  
  const handleOpenModal = (plan?: WorkoutPlan, copy = false) => {
    if (!selectedUser) return;
    setEditingExerciseId(null); // Reset editing state when opening modal
    if (plan) {
      const planToEdit: Partial<WorkoutPlan> = JSON.parse(JSON.stringify(plan));
      if (copy) {
        delete planToEdit.id;
        planToEdit.name = `${planToEdit.name} (複製)`;
        planToEdit.date = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        // Reset set IDs
        planToEdit.exercises?.forEach(ex => {
            ex.id = `${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
            ex.sets.forEach(s => s.id = `${Date.now()}_${Math.random().toString(36).substr(2,9)}`);
        });
      }
      setCurrentPlan(planToEdit);
    } else {
      setCurrentPlan({
        userId: selectedUser.id,
        userName: selectedUser.name,
        coachId: currentUser.id,
        coachName: currentUser.name,
        date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
        name: `${selectedUser.name} 的訓練日`,
        exercises: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCopyLastWorkout = () => {
      if (userPlans.length > 0) {
          const lastPlan = userPlans[0]; // Already sorted by date desc
          const exercisesCopy = lastPlan.exercises.map(ex => ({
              ...ex,
              id: `${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
              sets: ex.sets.map(s => ({...s, id: `${Date.now()}_${Math.random().toString(36).substr(2,9)}`}))
          }));
          
          handleUpdatePlan('exercises', exercisesCopy);
          if (!currentPlan.name?.includes('複製')) {
             handleUpdatePlan('name', `${lastPlan.name} (複製)`);
          }
      } else {
          alert('查無歷史課表可複製');
      }
  };
  
  const handleSave = () => {
    if (currentPlan.exercises && currentPlan.exercises.length > 0) {
      if (!currentPlan.userId || !currentPlan.date || !currentPlan.name) {
          alert('請填寫完整課表資訊');
          return;
      }
      onSavePlan(currentPlan as WorkoutPlan);
      setIsModalOpen(false);
    } else {
      alert('請至少新增一個訓練動作');
    }
  };

  const handleDelete = (id: string) => {
      if(window.confirm('確定要刪除此課表嗎？')) {
          onDeletePlan(id);
      }
  };

  const handleUpdatePlan = (field: keyof WorkoutPlan, value: any) => setCurrentPlan(prev => ({ ...prev, [field]: value }));

  const handleAddExercise = (exercise: { id: string, name: string }) => {
    // Default: 3 sets, 12 reps, 10kg (arbitrary default)
    const defaultSets = Array(3).fill(null).map((_, i) => ({
        id: `${Date.now()}_set_${i}`,
        reps: 12,
        weight: 10
    }));

    const newExerciseLog: ExerciseLog = { 
        id: `${Date.now()}`, 
        exerciseId: exercise.id, 
        exerciseName: exercise.name, 
        sets: defaultSets
    };
    handleUpdatePlan('exercises', [...(currentPlan.exercises || []), newExerciseLog]);
    setExerciseSearch('');
    setIsExercisePickerOpen(false);
  };
  
  const handleRemoveExercise = (exerciseId: string) => handleUpdatePlan('exercises', (currentPlan.exercises || []).filter(ex => ex.id !== exerciseId));

  const handleAddSet = (exerciseId: string) => {
    const updatedExercises = (currentPlan.exercises || []).map(ex => {
      if (ex.id === exerciseId) {
        const lastSet = ex.sets[ex.sets.length - 1] || { reps: 10, weight: 10 };
        return { 
            ...ex, 
            sets: [...ex.sets, { id: `${Date.now()}-set${ex.sets.length + 1}`, reps: lastSet.reps, weight: lastSet.weight }] 
        };
      }
      return ex;
    });
    handleUpdatePlan('exercises', updatedExercises);
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    const updatedExercises = (currentPlan.exercises || []).map(ex => {
      if (ex.id === exerciseId && ex.sets.length > 1) {
        return { ...ex, sets: ex.sets.filter(set => set.id !== setId) };
      }
      return ex;
    });
    handleUpdatePlan('exercises', updatedExercises);
  };

  const handleUpdateSet = (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => {
    const numericValue = Number(value);
    const updatedExercises = (currentPlan.exercises || []).map(ex => {
      if (ex.id === exerciseId) {
        return { ...ex, sets: ex.sets.map(set => (set.id === setId ? { ...set, [field]: numericValue } : set)) };
      }
      return ex;
    });
    handleUpdatePlan('exercises', updatedExercises);
  };
  
  const canSeeSensitive = ['manager', 'coach'].includes(currentUser.role);

  return (
    <div className="glass-panel rounded-3xl shadow-lg p-6 animate-slideUp border border-white/60">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
            {selectedUser && (
                <button 
                    onClick={() => setSelectedUser(null)}
                    className="p-2 -ml-2 text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="返回列表"
                >
                    <ChevronLeft size={24} />
                </button>
            )}
            <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                <Dumbbell className="text-indigo-500"/> 課表與學員檔案
            </h3>
        </div>
        {!selectedUser && (
            <div className="relative w-full md:w-1/3">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input 
                type="text" 
                placeholder="搜尋學員姓名/電話..." 
                className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white glass-input" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
              {filteredUsers.length > 0 && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                    {filteredUsers.map(user => (
                        <button key={user.id} onClick={() => handleSelectUser(user)} className="w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex justify-between items-center">
                            <span className="font-bold dark:text-gray-200">{user.name}</span>
                            <span className="text-xs text-gray-400">{user.phone}</span>
                        </button>
                    ))}
                </div>
              )}
            </div>
        )}
      </div>

      {selectedUser ? (
        <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-320px)]">
          {/* Left Column: Health Profile */}
          <div className="lg:w-1/3 flex flex-col">
              <div className="glass-card p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                      <h4 className="font-bold text-lg dark:text-white flex items-center gap-2">
                          <Activity size={20} className="text-pink-500"/> 健康檔案
                      </h4>
                      {isProfileDirty && (
                          <button onClick={handleSaveProfile} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg shadow hover:bg-indigo-700 flex items-center gap-1 transition-all">
                              <Save size={12}/> 儲存
                          </button>
                      )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {canSeeSensitive ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1"><Dumbbell size={12}/> 訓練目標</label>
                                <textarea 
                                    className="w-full glass-input rounded-xl p-3 text-sm dark:text-white h-20 resize-none focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                    placeholder="增肌、減脂、提升力量..."
                                    value={profileBuffer.goals}
                                    onChange={e => { setProfileBuffer({...profileBuffer, goals: e.target.value}); setIsProfileDirty(true); }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-red-500 uppercase flex items-center gap-1 mb-1"><AlertTriangle size={12}/> 傷病史與禁忌</label>
                                <textarea 
                                    className="w-full bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-sm dark:text-white h-20 resize-none focus:ring-2 focus:ring-red-500/30 outline-none"
                                    placeholder="例如：右肩韌帶舊傷、下背痛..."
                                    value={profileBuffer.injuries}
                                    onChange={e => { setProfileBuffer({...profileBuffer, injuries: e.target.value}); setIsProfileDirty(true); }}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1"><FileText size={12}/> 身體狀況備註</label>
                                <textarea 
                                    className="w-full glass-input rounded-xl p-3 text-sm dark:text-white h-20 resize-none focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                    placeholder="例如：最近睡眠不足、工作壓力大..."
                                    value={profileBuffer.physicalNotes}
                                    onChange={e => { setProfileBuffer({...profileBuffer, physicalNotes: e.target.value}); setIsProfileDirty(true); }}
                                />
                            </div>
                        </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 text-sm">權限不足，無法查看詳細資料</div>
                  )}
                  </div>
              </div>
          </div>

          {/* Right Column: Workout List */}
          <div className="lg:w-2/3 flex flex-col">
              <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl mb-4 shrink-0">
                  <div>
                      <h4 className="font-bold text-lg dark:text-white">{selectedUser.name} <span className="text-sm font-normal text-gray-500">的課表紀錄</span></h4>
                  </div>
                  <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center gap-2">
                      <Plus size={16}/> 新增課表
                  </button>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                 {userPlans.length === 0 ? (
                     <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                         <Dumbbell size={48} className="mx-auto mb-2 opacity-50"/>
                         <p>尚無課表紀錄</p>
                     </div>
                 ) : (
                     userPlans.map(plan => (
                        <div key={plan.id} className="glass-card p-4 rounded-2xl flex justify-between items-center hover:shadow-md transition-shadow group">
                            <div>
                                <div className="font-bold text-gray-800 dark:text-white text-lg flex items-center gap-2">
                                    {plan.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4 mt-1">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {plan.date}</span>
                                    <span className="flex items-center gap-1"><Edit size={12}/> {plan.coachName}</span>
                                    <span className="flex items-center gap-1"><Dumbbell size={12}/> {plan.exercises.length} 個動作</span>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(plan, true)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="複製課表"><BookCopy size={16}/></button>
                                <button onClick={() => handleOpenModal(plan)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="編輯"><Edit size={16}/></button>
                                <button onClick={() => handleDelete(plan.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="刪除"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))
                 )}
              </div>
          </div>
        </div>
      ) : (
        <div>
            <h4 className="font-bold text-gray-500 dark:text-gray-400 mb-4">或從最近更新的學員中選取：</h4>
            {inventories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentlyUpdatedUsers.map(user => (
                        <button key={user.id} onClick={() => handleSelectUser(user)} className="glass-card p-4 rounded-2xl text-left hover:shadow-md transition-shadow group border border-gray-100 dark:border-gray-700 hover:border-indigo-300">
                            <div className="font-bold text-gray-800 dark:text-white group-hover:text-indigo-600">{user.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{user.phone}</div>
                            <div className="text-[10px] text-gray-400 mt-2">上次更新: {user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : 'N/A'}</div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-24 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <Search size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-6"/>
                    <h4 className="text-xl font-bold text-gray-400 dark:text-gray-500">尚無學員資料</h4>
                    <p className="font-medium text-gray-400 mt-2">請至「庫存管理」新增學員</p>
                </div>
            )}
        </div>
      )}

      {/* Wide Modal for Editing - Upgraded Glassmorphism */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col animate-slideUp border border-white/20 dark:border-slate-700/30 h-[90vh]">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center backdrop-blur-md">
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        <Edit size={20} className="text-indigo-500"/> 
                        {currentPlan.id ? '編輯課表' : '建立新課表'} 
                        <span className="text-sm font-normal text-gray-500 mx-2">|</span>
                        <span className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">{selectedUser.name}</span>
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleCopyLastWorkout}
                            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 px-3 py-2 rounded-lg font-bold flex items-center gap-1 transition-colors"
                        >
                            <Copy size={14}/> 複製上一次課表
                        </button>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><X className="text-gray-500"/></button>
                    </div>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Side: Reference Profile (Read Only) */}
                    <div className="hidden lg:block w-1/4 bg-gray-50/50 dark:bg-gray-900/30 border-r border-gray-100 dark:border-gray-700 p-6 overflow-y-auto custom-scrollbar">
                        <h5 className="font-bold text-gray-500 dark:text-gray-400 uppercase text-xs mb-4 flex items-center gap-1"><Activity size={14}/> 學員狀況提醒</h5>
                        
                        <div className="space-y-6">
                            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="text-xs font-bold text-indigo-500 mb-1">訓練目標</div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedUser.goals || '未填寫'}</p>
                            </div>
                            
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30">
                                <div className="text-xs font-bold text-red-500 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> 傷病禁忌</div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedUser.injuries || '無紀錄'}</p>
                            </div>

                            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="text-xs font-bold text-gray-500 mb-1">備註</div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedUser.physicalNotes || '無'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Editor */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white/30 dark:bg-gray-900/10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">課表名稱</label>
                                <input type="text" value={currentPlan.name || ''} onChange={e => handleUpdatePlan('name', e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white font-bold" placeholder="例如：胸部 & 三頭"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">訓練日期</label>
                                <input type="date" value={currentPlan.date || ''} onChange={e => handleUpdatePlan('date', e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                            </div>
                        </div>

                        <div className="space-y-3 mb-20">
                            {(currentPlan.exercises || []).map((exLog: ExerciseLog, idx: number) => {
                                const isEditing = editingExerciseId === exLog.id;
                                return (
                                <div key={exLog.id} className="glass-card p-4 rounded-xl border border-gray-100 dark:border-gray-700 group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-700/50">
                                        <div className="flex items-center gap-3 flex-1 mr-2">
                                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0">{idx + 1}</span>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={exLog.exerciseName}
                                                    onChange={e => {
                                                        const updatedExercises = (currentPlan.exercises || []).map(ex => 
                                                            ex.id === exLog.id ? { ...ex, exerciseName: e.target.value } : ex
                                                        );
                                                        handleUpdatePlan('exercises', updatedExercises);
                                                    }}
                                                    className="w-full bg-white/50 dark:bg-gray-700/50 p-1 rounded-lg font-bold text-lg text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                                    autoFocus
                                                />
                                            ) : (
                                                <h5 className="font-bold text-gray-800 dark:text-white text-lg truncate">{exLog.exerciseName}</h5>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setEditingExerciseId(isEditing ? null : exLog.id)} className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors">
                                                {isEditing ? <CheckCircle size={16}/> : <Edit size={16}/>}
                                            </button>
                                            <button onClick={() => handleRemoveExercise(exLog.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto">
                                        <div className="flex gap-2 min-w-max pb-2">
                                            {exLog.sets.map((set, index) => (
                                                <div key={set.id} className="relative flex flex-col items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-200 dark:border-gray-700 w-24">
                                                    <div className="text-[10px] font-bold text-gray-400 mb-1">SET {index + 1}</div>
                                                    <div className="flex items-center gap-1 w-full mb-1">
                                                        <input 
                                                            type="number" 
                                                            value={set.weight} 
                                                            onChange={e => handleUpdateSet(exLog.id, set.id, 'weight', e.target.value)} 
                                                            className="w-full text-center bg-white dark:bg-gray-700 rounded-md p-1 font-bold text-sm dark:text-white border border-gray-200 dark:border-gray-600 focus:border-indigo-500 outline-none"
                                                            placeholder="KG"
                                                        />
                                                        <span className="text-[10px] text-gray-400">KG</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 w-full">
                                                        <input 
                                                            type="number" 
                                                            value={set.reps} 
                                                            onChange={e => handleUpdateSet(exLog.id, set.id, 'reps', e.target.value)} 
                                                            className="w-full text-center bg-white dark:bg-gray-700 rounded-md p-1 font-bold text-sm dark:text-white border border-gray-200 dark:border-gray-600 focus:border-indigo-500 outline-none"
                                                            placeholder="Reps"
                                                        />
                                                        <span className="text-[10px] text-gray-400">Reps</span>
                                                    </div>
                                                    <button onClick={() => handleRemoveSet(exLog.id, set.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><X size={10}/></button>
                                                </div>
                                            ))}
                                            <button onClick={() => handleAddSet(exLog.id)} className="w-8 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors">
                                                <Plus size={20}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                            {(!currentPlan.exercises || currentPlan.exercises.length === 0) && (
                                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-400 bg-white/20 dark:bg-gray-800/20">
                                    <Dumbbell size={32} className="mx-auto mb-2 opacity-50"/>
                                    <p>請下方搜尋並新增訓練動作</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-white/90 dark:bg-slate-900/90 p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center backdrop-blur-md absolute bottom-0 w-full rounded-b-3xl z-20">
                     <div ref={exercisePickerRef} className="relative flex-1 w-full">
                        <div className="relative">
                            <Dumbbell size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="搜尋動作加入課表..." 
                                className="w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" 
                                value={exerciseSearch} 
                                onChange={e => setExerciseSearch(e.target.value)} 
                                onFocus={() => setIsExercisePickerOpen(true)}
                            />
                        </div>
                        {isExercisePickerOpen && (
                            <div className="absolute z-50 w-full bottom-full mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                {exerciseSearch && !EXERCISE_LIST.some(ex => ex.name.toLowerCase() === exerciseSearch.toLowerCase()) && (
                                    <button
                                        onClick={() => handleAddExercise({ id: `custom_${Date.now()}`, name: exerciseSearch })}
                                        className="w-full text-left px-3 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-between border-b border-indigo-100 dark:border-indigo-800"
                                    >
                                        <span>新增動作: "{exerciseSearch}"</span>
                                        <Plus size={14} />
                                    </button>
                                )}
                                {Object.entries(groupedExercises).map(([category, exercises]) => (
                                    <div key={category}>
                                        <h6 className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 sticky top-0 backdrop-blur-sm">{category}</h6>
                                        {(exercises as Exercise[]).map(ex => (
                                            <button key={ex.id} onClick={() => handleAddExercise(ex)} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-between border-b border-gray-50 dark:border-gray-700/50 last:border-0 dark:text-gray-200">
                                                <span>{ex.name}</span>
                                                <Plus size={14} className="text-gray-400"/>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                                {Object.keys(groupedExercises).length === 0 && !(exerciseSearch && !EXERCISE_LIST.some(ex => ex.name.toLowerCase() === exerciseSearch.toLowerCase())) && (
                                    <div className="p-4 text-center text-sm text-gray-400">找不到動作</div>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={handleSave} className="w-full md:w-auto py-3 px-8 bg-indigo-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors whitespace-nowrap">
                        <Save size={16}/> 儲存課表
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPlans;