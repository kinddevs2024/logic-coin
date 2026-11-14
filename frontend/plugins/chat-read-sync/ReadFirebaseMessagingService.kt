package com.kinddevs.logiccoin.chatnotify

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class ReadFirebaseMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    if (message.data["type"] == "chat_read") {
      val ids = runCatching { JSONArray(message.data["ids"] ?: "[]") }.getOrDefault(JSONArray())
      ChatReadState.acknowledge(this, message.data["recipientId"] ?: "", message.data["conversationId"] ?: "", message.data["readSeq"]?.toLongOrNull() ?: return, (0 until ids.length()).map { ids.optString(it) }.toSet())
      return // Never create a visible notification or start the JavaScript UI.
    }
    val data = ChatReadState.unwrap(runCatching { JSONObject(message.data["body"] ?: "{}") }.getOrNull())
    if (!ChatReadState.canPresent(this, data)) return
    super.onMessageReceived(asExpoNotification(message))
  }
  companion object {
    /** Data-only FCM reaches us in the background; Expo retains its normal tap intent. */
    fun asExpoNotification(message: RemoteMessage): RemoteMessage {
      if (message.data["type"] != "chat_message" || message.notification != null) return message
      return RemoteMessage.Builder(message.from ?: "logiccoin")
        .setMessageId(message.messageId ?: UUID.randomUUID().toString())
        .setData(message.data + mapOf("gcm.n.e" to "1", "gcm.n.title" to (message.data["title"] ?: "Logic Coin"), "gcm.n.body" to (message.data["message"] ?: ""), "gcm.n.android_channel_id" to "messages", "gcm.n.sound2" to "default"))
        .build()
    }
  }
}
