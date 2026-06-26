import React from 'react';
import {
  ArrowRight,
  Calendar,
  ClipboardList,
  LineChart,
  Sparkles,
  Users,
  Wallet,
  Clock3,
  ShieldCheck,
  BadgeCheck,
  Layers3,
} from 'lucide-react';
import { Appointment, Coach, UserInventory } from '../types';
import { addDays, formatDateKey } from '../utils';

interface HomeLandingProps {
  appointments: Appointment[];
  coaches: Coach[];
  inventories: UserInventory[];
  onStartBooking: () => void;
  onOpenAdmin: () => void;
  onOpenMyBookings: () => void;
  onOpenSchedule: () => void;
}

const featureCards = [
  {
    icon: Calendar,
    title: '行事曆',
    text: '用週/月檢視快速掌握可預約時段、教練排班與空檔。',
  },
  {
    icon: ClipboardList,
    title: '預約功能',
    text: '支援線上預約、提醒通知、取消管理與顧客資料同步。',
  },
  {
    icon: LineChart,
    title: '庫存統計',
    text: '會員點數、消費紀錄、完課與剩餘庫存一眼看清楚。',
  },
  {
    icon: Layers3,
    title: '班表系統',
    text: '依教練、日期、時段快速排班，減少手動對帳與撞期。',
  },
];

const HomeLanding: React.FC<HomeLandingProps> = ({
  appointments,
  coaches,
  inventories,
  onStartBooking,
  onOpenAdmin,
  onOpenMyBookings,
  onOpenSchedule,
}) => {
  const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const weekStart = new Date();
  const weekEnd = addDays(new Date(), 6);
  const weekStartKey = formatDateKey(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const weekEndKey = formatDateKey(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
  const weekAppointments = appointments.filter((a) => {
    return a.date >= weekStartKey && a.date <= weekEndKey && a.status !== 'cancelled';
  });
  const todayAppointments = appointments.filter((a) => a.date === todayKey && a.status !== 'cancelled');
  const totalCredits = inventories.reduce((sum, inv) => sum + inv.credits.private + inv.credits.group, 0);
  const topAppointments = [...weekAppointments]
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 3);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(79,70,229,0.16),_transparent_28%),linear-gradient(180deg,_#fffdf8_0%,_#fff7ed_48%,_#ffffff_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.14),_transparent_28%),linear-gradient(180deg,_#0f172a_0%,_#111827_100%)]" />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm backdrop-blur dark:border-orange-500/20 dark:bg-slate-900/70 dark:text-orange-300">
          <Sparkles size={16} />
          會員預約、班表與庫存統整在同一個平台
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              把預約、行事曆、庫存與班表
              <span className="block bg-gradient-to-r from-orange-500 via-amber-500 to-indigo-600 bg-clip-text text-transparent">
                放進一個乾淨的營運入口。
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
              這是一個偏向 HOTCAKE 風格的 SaaS 介面，讓顧客可以快速預約，管理者可以查看行事曆、排班、庫存統計與會員狀態。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onStartBooking}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-transform hover:scale-[1.02] dark:bg-white dark:text-slate-900"
              >
                立即預約
                <ArrowRight size={18} />
              </button>
              <button
                onClick={onOpenSchedule}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3.5 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition-transform hover:scale-[1.02] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
              >
                查看班表
              </button>
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3.5 text-sm font-bold text-orange-700 shadow-sm transition-transform hover:scale-[1.02] dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200"
              >
                管理後台
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { label: '今日預約', value: todayAppointments.length },
                { label: '本週預約', value: weekAppointments.length },
                { label: '會員點數', value: totalCredits },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-10 -top-8 h-28 w-28 rounded-full bg-orange-300/30 blur-3xl" />
            <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-indigo-300/30 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">營運總覽</div>
                  <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">一眼看清今天狀態</div>
                </div>
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                  <ShieldCheck size={22} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-900 p-4 text-white shadow-lg shadow-slate-900/10">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Users size={16} />
                    會員資料
                  </div>
                  <div className="mt-2 text-3xl font-black">{inventories.length}</div>
                  <div className="mt-2 text-sm text-white/70">已建立會員與點數帳戶</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Clock3 size={16} />
                    教練班表
                  </div>
                  <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{coaches.length}</div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">可安排的教練/師資數量</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {topAppointments.length > 0 ? (
                  topAppointments.map((app) => (
                    <div key={app.id} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{app.customer?.name || app.reason || '預約項目'}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {app.date} · {app.time} · {app.coachName || '未指定教練'}
                        </div>
                      </div>
                      <BadgeCheck size={18} className="text-emerald-500" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                    目前還沒有建立預約，點一下「立即預約」就能開始。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => (
            <div key={card.title} className="group rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur transition-transform hover:-translate-y-1 dark:border-slate-700 dark:bg-slate-900/75">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
                <card.icon size={20} />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/80 bg-slate-950 p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.18)] dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-orange-300">
              <Wallet size={16} />
              核心資料
            </div>
            <h2 className="mt-3 text-2xl font-black">會員與預約數據同步管理</h2>
            <p className="mt-3 text-sm leading-7 text-white/70">
              你可以把這個站當成健身房、工作室、教練預約或服務型商家的營運中樞。預約、扣點、班表和統計都能一起看。
            </p>

            <div className="mt-6 space-y-3">
              {[
                '自動預約提醒與狀態更新',
                '會員點數與庫存統計',
                '教練班表與休假管理',
                '可擴充成多門市或多服務方案',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <div className="rounded-full bg-orange-400/20 p-2 text-orange-300">
                    <BadgeCheck size={16} />
                  </div>
                  <span className="text-sm font-medium text-white/85">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">下一步</div>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">把流程接起來</h2>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Layers3 size={22} />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button onClick={onOpenMyBookings} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition-transform hover:-translate-y-1 dark:border-slate-700 dark:bg-slate-800/80">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Clock3 size={16} />
                  顧客入口
                </div>
                <div className="mt-3 text-xl font-black text-slate-900 dark:text-white">查看我的預約</div>
                <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">適合會員查詢、取消、簽到與追蹤課程狀態。</div>
              </button>

              <button onClick={onOpenSchedule} className="rounded-3xl border border-slate-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5 text-left transition-transform hover:-translate-y-1 dark:border-slate-700 dark:from-orange-500/10 dark:to-amber-500/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-300">
                  <Calendar size={16} />
                  管理入口
                </div>
                <div className="mt-3 text-xl font-black text-slate-900 dark:text-white">查看週班表</div>
                <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">快速安排教練時段、課程與空檔調整。</div>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomeLanding;
