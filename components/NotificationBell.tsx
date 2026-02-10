import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { AppNotification, User } from '../types';
import { subscribeToUnreadNotifications, saveToFirestore } from '../services/firebase';

interface NotificationBellProps {
  currentUser: User;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser.role !== 'manager') return;

    const unsubscribe = subscribeToUnreadNotifications(
      'manager',
      (data) => {
        setNotifications(data as AppNotification[]);
      },
      (error) => {
        console.error("Failed to subscribe to notifications:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUser.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await saveToFirestore('notifications', notificationId, { read: true });
      // The real-time listener will automatically update the state
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const timeAgo = (isoString: string) => {
    const now = new Date();
    const past = new Date(isoString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 1) return '剛剛';
    if (minutes < 60) return `${minutes} 分鐘前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小時前`;

    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label={`您有 ${notifications.length} 則未讀通知`}
      >
        <Bell size={22} />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-slate-800 leading-5">
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden animate-fadeIn z-50">
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
            <h3 className="font-bold text-slate-800 dark:text-white">通知中心</h3>
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-4 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/50"
                >
                  <p className="text-sm text-slate-700 dark:text-slate-200 mb-2 leading-relaxed">{notif.message}</p>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {timeAgo(notif.createdAt)}
                    </span>
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                      title="標示為已讀"
                    >
                      <Check size={14}/> 已讀
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-slate-400">
                <Bell size={32} className="mx-auto mb-2 opacity-20" />
                沒有未讀通知
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
