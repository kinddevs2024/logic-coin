package com.kinddevs.logiccoin.chatnotify

import android.app.NotificationManager
import android.content.Context
import org.json.JSONObject

/** Account-scoped monotonic receipts survive process death and FCM reordering. */
object ChatReadState {
  private fun prefs(context: Context) = context.getSharedPreferences("logic-chat-read-v1", Context.MODE_PRIVATE)
  fun unwrap(value: JSONObject?): JSONObject? {
    if (value == null) return null
    if (value.optString("type").isNotEmpty()) return value
    for (key in listOf("body", "data")) {
      val nested = value.opt(key)
      val parsed = when (nested) { is JSONObject -> nested; is String -> runCatching { JSONObject(nested) }.getOrNull(); else -> null }
      if (parsed != null && parsed.optString("type").isNotEmpty()) return parsed
    }
    return value
  }
  @Synchronized fun configure(context: Context, account: String?) {
    val storage = prefs(context); val prior = storage.getString("account", null)
    if (prior != account) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.activeNotifications.filter { it.tag?.startsWith("logic-inbox:") == true || it.tag?.startsWith("logic-inbox-") == true }
        .forEach { manager.cancel(it.tag, it.id) }
      storage.edit().apply { if (account == null) remove("account") else putString("account", account) }.commit()
    }
  }
  @Synchronized fun canPresent(context: Context, raw: JSONObject?): Boolean {
    val data = unwrap(raw) ?: return true
    if (data.optString("type") == "chat_read") return false
    if (data.optString("type") != "chat_message") return true
    val account = prefs(context).getString("account", null) ?: return false
    val recipient = data.optString("recipientId")
    if (recipient.isNotEmpty() && recipient != account) return false
    val sequence = data.optLong("seq", 0)
    if (sequence <= 0) return true // Legacy pushes are removed by their inbox ID.
    return sequence > prefs(context).getLong("read:$account:${data.optString("conversationId")}", 0)
  }
  @Synchronized fun acknowledge(context: Context, account: String, conversation: String, sequence: Long, ids: Set<String>) {
    if (!account.matches(Regex("[a-fA-F0-9]{24}")) || !conversation.matches(Regex("[a-fA-F0-9]{24}")) || sequence < 0) return
    val storage = prefs(context); val key = "read:$account:$conversation"
    val cutoff = maxOf(sequence, storage.getLong(key, 0)); storage.edit().putLong(key, cutoff).commit()
    if (storage.getString("account", null) != account) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val parser = ReadPresentationDelegate(context)
    manager.activeNotifications.forEach { notice ->
      val data = unwrap(parser.payload(notice))
      val sameAccount = data?.optString("recipientId").isNullOrEmpty() || data?.optString("recipientId") == account
      val tagId = notice.tag?.removePrefix("logic-inbox:")?.substringBefore('@')
      val matchesId = sameAccount && tagId in ids
      val matchesCutoff = sameAccount && data?.optString("type") == "chat_message" && data.optString("conversationId") == conversation && data.optLong("seq", Long.MAX_VALUE) <= cutoff
      if (matchesId || matchesCutoff) manager.cancel(notice.tag, notice.id)
    }
  }
}
