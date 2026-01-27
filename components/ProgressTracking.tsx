import React, { useState, useMemo } from 'react';
import { ChevronLeft, Dumbbell, Activity, Star, TrendingUp, Trophy } from 'lucide-react';
import { WorkoutPlan, UserInventory } from '../types';
import LineChart from './LineChart';

interface ProgressTrackingProps {
  liffProfile: { userId: string; displayName: string } | null;
  inventories: UserInventory[];
  workoutPlans: WorkoutPlan[];
  onBack: () => void;
}

const ProgressTracking: React.FC<ProgressTrackingProps> = ({ liffProfile, inventories, workoutPlans, onBack }) => {
  const [selectedExercise, setSelectedExercise] = useState<string>('');

  const currentUserInventory = liffProfile ? inventories.find(i => i.lineUserId === liffProfile.userId) : null;
  
  const userPlans = useMemo(() => {
    if (!currentUserInventory) return [];
    return workoutPlans.filter(p => p.userId === currentUserInventory.id || p.userName === currentUserInventory.name);
  }, [currentUserInventory, workoutPlans]);

  const availableExercises = useMemo(() => {
    const exerciseSet = new Set<string>();
    userPlans.forEach(plan => {
      plan.exercises.forEach(ex => exerciseSet.add(ex.exerciseName));
    });
    return Array.from(exerciseSet).sort();
  }, [userPlans]);
  
  // Set default exercise
  useState(() => {
    if (availableExercises.length > 0 && !selectedExercise) {
      setSelectedExercise(availableExercises[0]);
    }
  });

  const chartData = useMemo(() => {
    if (!selectedExercise) return [];
    
    const dataPoints: { date: string; value: number }[] = [];
    userPlans.forEach(plan => {
      plan.exercises.forEach(ex => {
        if (ex.exerciseName === selectedExercise && ex.sets.length > 0) {
          const maxWeight = Math.max(...ex.sets.map(set => set.weight));
          if (maxWeight > 0) {
            dataPoints.push({ date: plan.date, value: maxWeight });
          }
        }
      });
    });

    return dataPoints
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .filter((item, index, self) => 
            index === self.findIndex((t) => (
                t.date === item.date
            ))
        ); // Keep only one entry per day (could average/max later)
  }, [selectedExercise, userPlans]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map(d => d.value);
    const personalBest = Math.max(...values);
    const startingWeight = values[0];
    const improvement = personalBest - startingWeight;
    return { personalBest, startingWeight, improvement };
  }, [chartData]);
  
  return (
    <div className="max-w-4xl mx-auto animate-slideUp pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            <Trophy size={24} className="text-yellow-500" />
            我的成就
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">視覺化您的訓練進度</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Dumbbell className="text-indigo-500" />
            <span className="font-bold text-slate-600 dark:text-slate-300">選擇要分析的動作：</span>
          </div>
          <select 
            value={selectedExercise} 
            onChange={e => setSelectedExercise(e.target.value)}
            className="w-full md:w-auto glass-input rounded-xl px-4 py-2 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {availableExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </div>

        <div className="h-[300px] bg-white/30 dark:bg-slate-800/30 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
            {chartData.length > 0 ? (
                <LineChart data={chartData} />
            ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                   {availableExercises.length > 0 ? '請選擇一個動作來查看圖表' : '沒有足夠的訓練數據來生成圖表'}
                </div>
            )}
        </div>
        
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-4 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-500" />
                <h4 className="text-xs font-bold text-slate-500 uppercase">個人最佳紀錄 (1RM)</h4>
              </div>
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{stats.personalBest} <span className="text-lg">KG</span></p>
            </div>
            <div className="glass-card p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-500" />
                <h4 className="text-xs font-bold text-slate-500 uppercase">起始重量</h4>
              </div>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.startingWeight} <span className="text-lg">KG</span></p>
            </div>
            <div className="glass-card p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-green-500" />
                <h4 className="text-xs font-bold text-slate-500 uppercase">總進步幅度</h4>
              </div>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                {stats.improvement >= 0 ? '+' : ''}{stats.improvement.toFixed(1)} <span className="text-lg">KG</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTracking;
