package com.kinddevs.logiccoin.chatnotify

import android.content.Context
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationManagerCompat
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.service.NotificationsService
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import expo.modules.notifications.service.interfaces.PresentationDelegate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class ReadNotificationsReceiver : NotificationsService() {
  override fun getPresentationDelegate(context: Context): PresentationDelegate = ReadPresentationDelegate(context)
}
/** Check again inside the same lock as cancellation, immediately before posting. */
class ReadPresentationDelegate(context: Context) : ExpoPresentationDelegate(context) {
  fun payload(notice: StatusBarNotification): JSONObject? = getNotification(notice)?.notificationRequest?.content?.body
  override fun presentNotification(notification: Notification, behavior: NotificationBehaviorRecord?) {
    val data = ChatReadState.unwrap(notification.notificationRequest.content.body)
    if (data?.optString("type") !in setOf("chat_message", "chat_read")) { super.presentNotification(notification, behavior); return }
    if (behavior?.shouldPresentAlert == false || data?.optString("type") == "chat_read") return
    CoroutineScope(Dispatchers.IO).launch {
      runCatching {
        val built = createNotification(notification, behavior)
        synchronized(ChatReadState) {
          if (ChatReadState.canPresent(context, data)) NotificationManagerCompat.from(context).notify(notification.notificationRequest.identifier, getNotifyId(notification.notificationRequest), built)
        }
      }
    }
  }
}
