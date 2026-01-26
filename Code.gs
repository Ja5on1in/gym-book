// 1. 設定您的專案資訊
// 前往 "檔案" > "專案屬性" > "指令碼屬性" 並新增以下三個屬性：
//
// FIREBASE_URL:              您的 Firebase Realtime Database URL (例如: https://gympohai.firebaseio.com)
// FIREBASE_DB_SECRET:        您的 Firebase Realtime Database Secret (在專案設定 > 服務帳戶 > 資料庫密鑰 中找到)
// LINE_CHANNEL_ACCESS_TOKEN: 您的 LINE Channel Access Token

/**
 * 主函式：自動發送 24 小時前預約提醒
 * 請為此函式設定一個每小時執行的時間觸發器
 */
function autoSend24hReminders() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const firebaseUrl = scriptProperties.getProperty('FIREBASE_URL');
  const dbSecret = scriptProperties.getProperty('FIREBASE_DB_SECRET');
  
  if (!firebaseUrl || !dbSecret) {
    console.error("錯誤：請在指令碼屬性中設定 FIREBASE_URL 和 FIREBASE_DB_SECRET。");
    return;
  }

  try {
    const now = new Date();
    // 設定時間篩選範圍：現在時間的 24 小時後到 25 小時後
    // 這樣每小時執行一次，就能捕捉到所有在未來 24 小時左右的預約
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endTime = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const startTimeISO = startTime.toISOString();
    const endTimeISO = endTime.toISOString();
    
    // 建立 Firebase Realtime Database REST API 查詢 URL
    // 注意：我們透過 'appointmentTimestamp' 欄位查詢。請確保您在 Realtime Database 的規則中為此欄位建立索引以獲得最佳效能。
    const queryUrl = `${firebaseUrl}/appointments.json?auth=${dbSecret}&orderBy="appointmentTimestamp"&startAt="${startTimeISO}"&endAt="${endTimeISO}"`;
    
    const options = {
      'method': 'get',
      'contentType': 'application/json',
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(queryUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      console.error(`讀取預約失敗。狀態碼: ${responseCode}, 回應: ${responseText}`);
      return;
    }
    
    const appointmentsData = JSON.parse(responseText);
    
    if (!appointmentsData || Object.keys(appointmentsData).length === 0) {
      console.log(`在 ${startTimeISO} 到 ${endTimeISO} 之間找不到需要提醒的預約。`);
      return;
    }
    
    const appointmentsToRemind = [];
    // 回應是一個以預約 ID 為 key 的物件，我們需要將它轉換為陣列
    for (const key in appointmentsData) {
        const appointment = appointmentsData[key];
        // 查詢抓取了時間範圍，現在我們在腳本中進行更精確的過濾
        if (appointment.status === 'confirmed' && !appointment.isReminderSent) {
            // 將 ID (也就是物件的 key) 加入到預約物件中以便後續使用
            appointment.id = key;
            appointmentsToRemind.push(appointment);
        }
    }

    if (appointmentsToRemind.length === 0) {
      console.log(`在時間範圍內找到預約，但沒有符合條件 (已確認且尚未發送提醒) 的項目。`);
      return;
    }

    console.log(`找到 ${appointmentsToRemind.length} 筆預約需要提醒。`);

    appointmentsToRemind.forEach(app => {
      if (app.lineUserId) {
        const success = sendLineReminder(app);
        if (success) {
          markReminderAsSent(app.id);
        }
      }
    });

  } catch(e) {
    console.error("執行 autoSend24hReminders 時發生錯誤:", e);
  }
}

/**
 * 發送 LINE Flex Message 提醒
 * @param {object} appointment 預約物件
 * @return {boolean} 是否發送成功
 */
function sendLineReminder(appointment) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const lineAccessToken = scriptProperties.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!lineAccessToken) {
    console.error("錯誤：請在指令碼屬性中設定 LINE_CHANNEL_ACCESS_TOKEN。");
    return false;
  }

  const url = 'https://api.line.me/v2/bot/message/push';

  const appointmentDate = new Date(appointment.appointmentTimestamp);
  const formattedDateTime = appointmentDate.toLocaleString('zh-TW', { 
    timeZone: 'Asia/Taipei', 
    year: 'numeric', month: '2-digit', day: '2-digit', 
    hour: '2-digit', minute: '2-digit', hour12: false 
  });

  const flexMessage = {
    "type": "flex",
    "altText": "您有一則預約提醒",
    "contents": {
      "type": "bubble",
      "header": { "type": "box", "layout": "vertical", "contents": [ { "type": "text", "text": "🗓️ 預約提醒", "weight": "bold", "color": "#1DB446", "size": "md" } ] },
      "body": {
        "type": "box", "layout": "vertical", "contents": [
          { "type": "text", "text": "您有一筆即將到來的預約", "weight": "bold", "size": "xl", "wrap": true },
          { "type": "separator", "margin": "md" },
          { "type": "box", "layout": "vertical", "margin": "lg", "spacing": "sm", "contents": [
              { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [ { "type": "text", "text": "學員", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": appointment.customer.name, "wrap": true, "color": "#666666", "size": "sm", "flex": 5 } ] },
              { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [ { "type": "text", "text": "時間", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": formattedDateTime, "wrap": true, "color": "#666666", "size": "sm", "flex": 5 } ] },
              { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [ { "type": "text", "text": "課程", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": appointment.service ? appointment.service.name : "私人課程", "wrap": true, "color": "#666666", "size": "sm", "flex": 5 } ] },
              { "type": "box", "layout": "baseline", "spacing": "sm", "contents": [ { "type": "text", "text": "教練", "color": "#aaaaaa", "size": "sm", "flex": 2 }, { "type": "text", "text": appointment.coachName, "wrap": true, "color": "#666666", "size": "sm", "flex": 5 } ] }
            ]
          },
          { "type": "separator", "margin": "lg" },
          { "type": "text", "text": "請準時抵達，期待見到您！", "margin": "md", "size": "xs", "color": "#aaaaaa", "wrap": true }
        ]
      },
      "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [ { "type": "button", "style": "link", "height": "sm", "action": { "type": "uri", "label": "查看我的預約", "uri": "https://liff.line.me/2008923061-bPeQysat?mode=my-bookings" } } ], "flex": 0 }
    }
  };

  const payload = { 'to': appointment.lineUserId, 'messages': [flexMessage] };
  const options = { 
    'method': 'post', 
    'contentType': 'application/json', 
    'headers': { 'Authorization': 'Bearer ' + lineAccessToken }, 
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true 
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() === 200) {
    console.log(`成功發送提醒給 ${appointment.customer.name} (LINE ID: ${appointment.lineUserId})`);
    return true;
  } else {
    console.error(`發送提醒失敗給 ${appointment.customer.name}。錯誤: ${response.getContentText()}`);
    return false;
  }
}

/**
 * 更新 Firebase Realtime Database 中的預約，標記為已發送提醒
 * @param {string} appointmentId 預約紀錄的 ID
 */
function markReminderAsSent(appointmentId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const firebaseUrl = scriptProperties.getProperty('FIREBASE_URL');
  const dbSecret = scriptProperties.getProperty('FIREBASE_DB_SECRET');

  const updateUrl = `${firebaseUrl}/appointments/${appointmentId}.json?auth=${dbSecret}`;

  // 使用 PATCH 方法只更新特定欄位，而不會覆蓋整個物件
  const payload = { "isReminderSent": true };
  
  const options = { 
    'method': 'patch', 
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true 
  };

  const response = UrlFetchApp.fetch(updateUrl, options);
  if (response.getResponseCode() === 200) {
    console.log(`成功更新預約 ${appointmentId} 的提醒狀態。`);
  } else {
    console.error(`更新預約 ${appointmentId} 狀態失敗。錯誤: ${response.getContentText()}`);
  }
}
