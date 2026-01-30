
import React, { useState } from 'react';
import { User, Appointment, Coach, UserInventory, BlockFormState, Service } from '../types';
import { saveToFirestore, deleteFromFirestore, batchUpdateFirestore } from '../services/firebase';
import { formatDateKey, addDays } from '../utils';
import { ALL_TIME_SLOTS } from '../constants';


interface UseBookingsProps {
  currentUser: User | null;
  appointments: Appointment[];
  coaches: Coach[];
  inventories: UserInventory[];
  addLog: (action: string, details: string) => void;
  showNotification: (msg: string, type?: 'success' | 'error' | 'info') => void;
  sendToGoogleScript: (data: any) => void;
}

export const useBookings = ({ currentUser, appointments, coaches, inventories, addLog, showNotification, sendToGoogleScript }: UseBookingsProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmitBooking = async (
    selectedDate: Date,
    selectedSlot: string | null,
    selectedCoach: Coach | null,
    selectedService: Service | null,
    formData: { name: string; phone: string; email: string },
    lineProfile?: { userId: string, displayName: string }
  ) => {
    if (!selectedDate || !selectedSlot || !selectedCoach || !selectedService) {
        showNotification('預約資訊不完整', 'error');
        return { success: false, step: 1 };
    }
    const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const existing = appointments.find(a => a.date === dateKey && a.time === selectedSlot && a.coachId === selectedCoach.id && a.status !== 'cancelled');
    if (existing) {
        showNotification('此時段已被預約', 'error');
        return { success: false, step: 3 };
    }

    const id = Date.now().toString();
    const newAppointment: Appointment = {
        id,
        type: 'private',
        date: dateKey,
        time: selectedSlot,
        coachId: selectedCoach.id,
        coachName: selectedCoach.name,
        service: selectedService,
        customer: { name: formData.name, phone: formData.phone, email: formData.email },
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        lineUserId: lineProfile?.userId,
        lineName: lineProfile?.displayName
    };
    
    try {
        await saveToFirestore('appointments', id, newAppointment);
        addLog('客戶預約', `客戶 ${formData.name} 預約了 ${selectedCoach.name} 在 ${dateKey} ${selectedSlot} 的 ${selectedService.name}`);
        showNotification('預約成功！', 'success');
        sendToGoogleScript({ event: 'new_booking', ...newAppointment });
        return { success: true };
    } catch (e) {
        showNotification(`預約失敗: ${(e as Error).message}`, 'error');
        return { success: false };
    }
  };

  const handleCustomerCancel = async (app: Appointment, reason: string) => {
    const twentyFourHoursBefore = new Date(new Date(`${app.date}T${app.time}`).getTime() - 24 * 60 * 60 * 1000);
    const isCustomer = !currentUser;

    if (isCustomer && new Date() > twentyFourHoursBefore) {
        showNotification('課程開始前 24 小時内無法自行取消', 'error');
        return;
    }
    
    try {
        await saveToFirestore('appointments', app.id, { status: 'cancelled', cancelReason: reason });
        addLog('取消預約', `${isCustomer ? '客戶' : (currentUser?.name || '管理員')} 取消了 ${app.customer?.name} 在 ${app.date} ${app.time} 的預約。原因: ${reason}`);
        showNotification('預約已取消', 'info');
        sendToGoogleScript({ event: 'cancel_booking', ...app, cancelReason: reason });
    } catch (e) {
        showNotification(`取消失敗: ${(e as Error).message}`, 'error');
    }
  };

  const handleSaveBlock = async (e: React.FormEvent, blockForm: BlockFormState, isBatchMode: boolean, force: boolean = false) => {
    e.preventDefault();
    setIsProcessing(true);

    if (isBatchMode) {
        const updates: { col: string; id: string; data: any }[] = [];
        const today = new Date(blockForm.date);
        for (let i = 0; i < (blockForm.repeatWeeks || 1); i++) {
            const targetDate = addDays(today, i * 7);
            const dateKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
            const startIdx = ALL_TIME_SLOTS.indexOf(blockForm.time);
            const endIdx = ALL_TIME_SLOTS.indexOf(blockForm.endTime || blockForm.time);

            for (let j = startIdx; j < endIdx; j++) {
                const time = ALL_TIME_SLOTS[j];
                const id = `${dateKey}-${time}-${blockForm.coachId}-${Math.random()}`;
                const newBlock: Appointment = {
                    id, type: 'block', date: dateKey, time, coachId: blockForm.coachId,
                    reason: blockForm.reason, status: 'confirmed', createdAt: new Date().toISOString()
                };
                updates.push({ col: 'appointments', id, data: newBlock });
            }
        }
        try {
            await batchUpdateFirestore(updates);
            showNotification('批次鎖定成功', 'success');
            addLog('批次鎖定', `鎖定 ${blockForm.coachId} 從 ${blockForm.date} 開始 ${blockForm.repeatWeeks} 週，${blockForm.time} 到 ${blockForm.endTime}。原因: ${blockForm.reason}`);
            setIsProcessing(false);
            return true;
        } catch (e) {
            showNotification(`批次鎖定失敗: ${(e as Error).message}`, 'error');
            setIsProcessing(false);
            return false;
        }
    }

    const id = blockForm.id || Date.now().toString();
    const coach = coaches.find(c => c.id === blockForm.coachId);
    const newRecord: Partial<Appointment> = {
        id, type: blockForm.type, date: blockForm.date, time: blockForm.time,
        coachId: blockForm.coachId, coachName: coach?.name,
        reason: blockForm.reason, status: 'confirmed', createdAt: new Date().toISOString()
    };
    if (blockForm.type === 'private') {
        newRecord.customer = blockForm.customer;
        newRecord.service = { id: 'coaching', name: '一對一教練課', duration: '50 分鐘', color: '' };
    }
    if (blockForm.type === 'group') {
        newRecord.attendees = blockForm.attendees;
        newRecord.maxAttendees = blockForm.maxAttendees;
    }
    
    const existing = appointments.find(a => a.date === blockForm.date && a.time === blockForm.time && a.coachId === blockForm.coachId && a.id !== blockForm.id && a.status !== 'cancelled');
    if (existing && !force) {
        showNotification('此時段已被預約', 'error');
        setIsProcessing(false);
        return false;
    }
    
    try {
        await saveToFirestore('appointments', id, newRecord);
        showNotification('儲存成功', 'success');
        addLog('後台操作', `儲存/更新 ${blockForm.date} ${blockForm.time} 的預約/事務`);
        setIsProcessing(false);
        return true;
    } catch (e) {
        showNotification(`儲存失敗: ${(e as Error).message}`, 'error');
        setIsProcessing(false);
        return false;
    }
  };

  const handleActualDelete = async (id: string, reason: string) => {
    try {
        await deleteFromFirestore('appointments', id);
        showNotification('刪除成功', 'success');
        addLog('刪除紀錄', `刪除 ID: ${id}, 原因: ${reason}`);
        return true;
    } catch(e) {
        showNotification(`刪除失敗: ${(e as Error).message}`, 'error');
        return false;
    }
  };

  const handleUserCheckIn = async (app: Appointment) => {
    try {
        await saveToFirestore('appointments', app.id, { status: 'checked_in' });
        showNotification('簽到成功，請向教練確認', 'success');
        addLog('學員簽到', `${app.customer?.name} 已簽到 ${app.date} ${app.time} 的課程`);
    } catch (e) {
        showNotification(`簽到失敗: ${(e as Error).message}`, 'error');
    }
  };

  const handleCoachConfirmCompletion = async (app: Appointment) => {
    let targetInventory: UserInventory | undefined;
    if (app.type === 'private' || (app.type as string) === 'client') {
        targetInventory = inventories.find(inv => inv.lineUserId === app.lineUserId || (inv.phone && inv.phone === app.customer?.phone));
    } else if (app.type === 'group') {
        // Group class, no deduction from a single user
    }

    if ((app.type === 'private' || (app.type as string) === 'client') && (!targetInventory || targetInventory.credits.private < 1)) {
        showNotification('學員點數不足，無法完課', 'error');
        return;
    }

    try {
        const updates: { col: string; id: string; data: any }[] = [{
            col: 'appointments',
            id: app.id,
            data: { status: 'completed' }
        }];

        let logDetails = `確認 ${app.customer?.name || '團體課'} 在 ${app.date} ${app.time} 的課程完課。`;
        if (targetInventory && (app.type === 'private' || (app.type as string) === 'client')) {
            const newCredits = { ...targetInventory.credits, private: targetInventory.credits.private - 1 };
            updates.push({
                col: 'user_inventory',
                id: targetInventory.id,
                data: { credits: newCredits, lastUpdated: new Date().toISOString() }
            });
            logDetails += ` 扣除 1 點私人課點數。剩餘 ${newCredits.private} 點。`;
        }
        
        await batchUpdateFirestore(updates);
        showNotification('完課確認成功', 'success');
        addLog('完課確認', logDetails);
    } catch (e) {
        showNotification(`操作失敗: ${(e as Error).message}`, 'error');
    }
  };

  const handleRevertCompletion = async (app: Appointment) => {
    const targetInventory = inventories.find(inv => inv.lineUserId === app.lineUserId || (inv.phone && inv.phone === app.customer?.phone));
    if ((app.type === 'private' || (app.type as string) === 'client') && !targetInventory) {
        showNotification('找不到對應的學員庫存，無法返還點數', 'error');
        return;
    }

    try {
        const updates: { col: string; id: string; data: any }[] = [{
            col: 'appointments',
            id: app.id,
            data: { status: 'confirmed' }
        }];

        let logDetails = `撤銷 ${app.customer?.name} 在 ${app.date} ${app.time} 的完課狀態。`;
        if (targetInventory && (app.type === 'private' || (app.type as string) === 'client')) {
            const newCredits = { ...targetInventory.credits, private: targetInventory.credits.private + 1 };
            updates.push({
                col: 'user_inventory',
                id: targetInventory.id,
                data: { credits: newCredits, lastUpdated: new Date().toISOString() }
            });
            logDetails += ` 返還 1 點私人課點數。現有 ${newCredits.private} 點。`;
        }

        await batchUpdateFirestore(updates);
        showNotification('已撤銷完課並返還點數', 'info');
        addLog('撤銷完課', logDetails);
    } catch (e) {
        showNotification(`操作失敗: ${(e as Error).message}`, 'error');
    }
  };

  const handleToggleComplete = (app: Appointment) => {
      if (!currentUser) return;
      if (app.status === 'checked_in' || (app.status === 'confirmed' && (currentUser.role === 'manager' || app.type === 'group'))) {
          handleCoachConfirmCompletion(app);
      } else if (app.status === 'completed' && currentUser.role === 'manager') {
          handleRevertCompletion(app);
      } else {
          showNotification('無法變更此狀態或權限不足', 'info');
      }
  };

  const handleBatchDelete = async (selectedBatch: Set<string>) => {
    const updates = Array.from(selectedBatch).map(id => ({
        col: 'appointments',
        id: id,
        data: { status: 'cancelled', cancelReason: '管理員批次刪除' }
    }));
    try {
        await batchUpdateFirestore(updates);
        showNotification(`成功取消 ${updates.length} 筆預約`, 'success');
        addLog('批次取消', `取消了 ${updates.length} 筆預約`);
    } catch(e) {
        showNotification(`批次取消失敗: ${(e as Error).message}`, 'error');
    }
  };

  return {
    isProcessing,
    handleSubmitBooking,
    handleCustomerCancel,
    handleSaveBlock,
    handleActualDelete,
    handleUserCheckIn,
    handleCoachConfirmCompletion,
    handleRevertCompletion,
    handleToggleComplete,
    handleBatchDelete,
  };
};
