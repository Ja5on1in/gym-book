
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserInventory, WorkoutPlan, ExerciseLog, Exercise } from '../types';
import { Search, Plus, X, Trash2, Dumbbell, Calendar, Save, Edit, BookCopy } from 'lucide-react';
import { EXERCISE_LIST } from '../constants';
import { formatDateKey } from '../utils';

interface WorkoutPlansProps {
  currentUser: User;
  inventories: UserInventory[];
  workoutPlans: WorkoutPlan[];
  onSavePlan: (plan: WorkoutPlan) => void;
  onDeletePlan: (id: string) => void;
}

const WorkoutPlans: React.FC<WorkoutPlansProps> = ({ currentUser, inventories, workoutPlans, onSavePlan, onDeletePlan }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserInventory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Partial<WorkoutPlan>>({});
  
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
  const exercisePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exercisePickerRef.current && !exercisePickerRef.current.contains(event.target as Node)) {
        setIsExercisePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return [];
    const lowerTerm = searchTerm.toLowerCase();
    return inventories.filter(u => 
        u.name.toLowerCase().includes(lowerTerm) || 
        (u.phone && u.phone.includes(lowerTerm))
    ).slice(0, 5);
  }, [searchTerm, inventories]);

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
  
  const handleOpenModal = (plan?: WorkoutPlan, copy = false) => {
    if (!selectedUser) return;
    if (plan) {
      // Deep copy to avoid mutating props and allow editing
      const planToEdit: Partial<WorkoutPlan> = JSON.parse(JSON.stringify(plan));
      if (copy) {
        delete planToEdit.id;
        planToEdit.name = `${planToEdit.name} (複製)`;
        planToEdit.date = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
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
  
  const handleSave = () => {
    if (currentPlan.exercises && currentPlan.exercises.length > 0) {
      // Ensure required fields are present before saving
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
    const newExerciseLog: ExerciseLog = { 
        id: `${Date.now()}`, 
        exerciseId: exercise.id, 
        exerciseName: exercise.name, 
        sets: [{ id: `${Date.now()}-set1`, reps: 10, weight: 20 }] 
    };
    handleUpdatePlan('exercises', [...(currentPlan.exercises || []), newExerciseLog]);
    setExerciseSearch('');
    setIsExercisePickerOpen(false);
  };
  
  const handleRemoveExercise = (exerciseId: string) => handleUpdatePlan('exercises', (currentPlan.exercises || []).filter(ex => ex.id !== exerciseId));

  const handleAddSet = (exerciseId: string) => {
    const updatedExercises = (currentPlan.exercises || []).map(ex => {
      if (ex.id === exerciseId) {
        const lastSet = ex.sets[ex.sets.length - 1] || { reps: 10, weight: 20 };
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
  
  return (
    <div className="glass-panel rounded-3xl shadow-lg p-6 animate-slideUp">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><Dumbbell className="text-indigo-500"/> 課表管理</h3>
        <div className="relative w-full md:w-1/3">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input 
            type="text" 
            placeholder="搜尋學員姓名/電話..." 
            className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" 
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
      </div>

      {selectedUser ? (
        <div>
          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl mb-6">
              <h4 className="font-bold text-lg dark:text-white">{selectedUser.name} <span className="text-sm font-normal text-gray-500">的課表紀錄</span></h4>
              <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center gap-2">
                  <Plus size={16}/> 新增課表
              </button>
          </div>
          
          <div className="space-y-3">
             {userPlans.length === 0 ? (
                 <div className="text-center py-10 text-gray-400">尚無課表紀錄</div>
             ) : (
                 userPlans.map(plan => (
                    <div key={plan.id} className="glass-card p-4 rounded-2xl flex justify-between items-center hover:shadow-md transition-shadow">
                        <div>
                            <div className="font-bold text-gray-800 dark:text-white text-lg">{plan.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4 mt-1">
                                <span className="flex items-center gap-1"><Calendar size={12}/> {plan.date}</span>
                                <span className="flex items-center gap-1"><Edit size={12}/> {plan.coachName}</span>
                                <span className="flex items-center gap-1"><Dumbbell size={12}/> {plan.exercises.length} 個動作</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleOpenModal(plan, true)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="複製課表"><BookCopy size={16}/></button>
                            <button onClick={() => handleOpenModal(plan)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="編輯"><Edit size={16}/></button>
                            <button onClick={() => handleDelete(plan.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="刪除"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))
             )}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-800/20 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <Search size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4"/>
            <p className="font-medium text-gray-500">請先搜尋並選取一位學員以管理課表</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col animate-slideUp border border-white/40 max-h-[90vh]">
                <div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white">編輯課表</h3>
                    <button onClick={() => setIsModalOpen(false)}><X className="text-gray-500"/></button>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">課表名稱</label>
                            <input type="text" value={currentPlan.name || ''} onChange={e => handleUpdatePlan('name', e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="例如：胸部 & 三頭"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">訓練日期</label>
                            <input type="date" value={currentPlan.date || ''} onChange={e => handleUpdatePlan('date', e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        {(currentPlan.exercises || []).map((exLog: ExerciseLog, idx: number) => (
                            <div key={exLog.id} className="glass-card p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-1 rounded-full">{idx + 1}</span>
                                        <h5 className="font-bold text-gray-800 dark:text-white">{exLog.exerciseName}</h5>
                                    </div>
                                    <button onClick={() => handleRemoveExercise(exLog.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 px-2 uppercase tracking-wider">
                                        <div className="col-span-2 text-center">組數</div>
                                        <div className="col-span-4 text-center">重量 (KG)</div>
                                        <div className="col-span-4 text-center">次數</div>
                                        <div className="col-span-2"></div>
                                    </div>
                                    {exLog.sets.map((set, index) => (
                                        <div key={set.id} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-2 text-center font-bold bg-gray-100 dark:bg-gray-700/50 rounded-lg py-2 text-sm">{index + 1}</div>
                                            <div className="col-span-4">
                                                <input type="number" value={set.weight} onChange={e => handleUpdateSet(exLog.id, set.id, 'weight', e.target.value)} className="w-full text-center glass-input rounded-lg p-2 font-bold dark:text-white"/>
                                            </div>
                                            <div className="col-span-4">
                                                <input type="number" value={set.reps} onChange={e => handleUpdateSet(exLog.id, set.id, 'reps', e.target.value)} className="w-full text-center glass-input rounded-lg p-2 font-bold dark:text-white"/>
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                                <button onClick={() => handleRemoveSet(exLog.id, set.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors"><X size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => handleAddSet(exLog.id)} className="w-full text-center mt-3 text-xs font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg py-2 transition-colors border border-dashed border-indigo-200 dark:border-indigo-800">
                                    + 新增一組
                                </button>
                            </div>
                        ))}
                        {(!currentPlan.exercises || currentPlan.exercises.length === 0) && (
                            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-400">
                                請新增訓練動作
                            </div>
                        )}
                    </div>

                    <div ref={exercisePickerRef} className="relative">
                        <div className="relative">
                            <Dumbbell size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="搜尋並新增動作..." 
                                className="w-full pl-9 pr-4 py-3 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white shadow-sm" 
                                value={exerciseSearch} 
                                onChange={e => setExerciseSearch(e.target.value)} 
                                onFocus={() => setIsExercisePickerOpen(true)}
                            />
                        </div>
                        {isExercisePickerOpen && (
                            <div className="absolute z-20 w-full bottom-full mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
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
                                {Object.keys(groupedExercises).length === 0 && (
                                    <div className="p-4 text-center text-sm text-gray-400">找不到動作</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white/50 dark:bg-gray-900/50 p-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={handleSave} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
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
