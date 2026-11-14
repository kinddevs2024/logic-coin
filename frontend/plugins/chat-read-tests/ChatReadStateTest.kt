package com.kinddevs.logiccoin.chatnotify

import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(application = Application::class, sdk = [28])
class ChatReadStateTest {
  private val account = "111111111111111111111111"; private val other = "222222222222222222222222"; private val chat = "333333333333333333333333"
  private lateinit var context: Context; private lateinit var manager: NotificationManager
  private fun data(seq: Long, recipient: String = account) = JSONObject().put("type", "chat_message").put("recipientId", recipient).put("conversationId", chat).put("seq", seq)
  @Before fun prepare() {
    context = RuntimeEnvironment.getApplication(); manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancelAll(); context.getSharedPreferences("logic-chat-read-v1", Context.MODE_PRIVATE).edit().clear().commit()
    manager.createNotificationChannel(NotificationChannel("messages", "Messages", NotificationManager.IMPORTANCE_HIGH)); ChatReadState.configure(context, account)
  }
  @Test fun firstUpgradePreservesExistingUnreadNotifications() {
    context.getSharedPreferences("logic-chat-read-v1", Context.MODE_PRIVATE).edit().remove("account").commit()
    manager.notify("logic-inbox:event:444444444444444444444444@2026-11-14T12:00:00Z", 0, Notification.Builder(context, "messages").setSmallIcon(android.R.drawable.ic_dialog_info).build())
    ChatReadState.configure(context, account); assertEquals(1, manager.activeNotifications.size)
  }
  @Test fun receiptsSurviveAnotherInstanceAndNeverGoBackwards() {
    ChatReadState.acknowledge(context, account, chat, 10, emptySet()); ChatReadState.acknowledge(context, account, chat, 4, emptySet())
    assertFalse(ChatReadState.canPresent(context, data(10))); assertTrue(ChatReadState.canPresent(context, data(11)))
  }
  @Test fun receiptBeforeDelayedPushPreventsRedisplay() {
    ChatReadState.acknowledge(context, account, chat, 2, emptySet())
    assertFalse(ChatReadState.canPresent(context, data(1))); assertTrue(ChatReadState.canPresent(context, data(3)))
  }
  @Test fun readBetweenReceivingAndPresentingCannotRepostAnOldNotification() {
    val received = data(1)
    ChatReadState.acknowledge(context, account, chat, 1, emptySet())
    val shown = ChatReadState.postIfUnread(context, received) { manager.notify("late", 0, Notification.Builder(context, "messages").setSmallIcon(android.R.drawable.ic_dialog_info).build()) }
    assertFalse(shown); assertEquals(0, manager.activeNotifications.size)
  }
  @Test fun silentControlIsNeverDisplayed() { assertFalse(ChatReadState.canPresent(context, JSONObject().put("type", "chat_read"))) }
  @Test fun accountSwitchCannotShowPreviousAccountMessages() { ChatReadState.configure(context, other); assertFalse(ChatReadState.canPresent(context, data(99))); assertTrue(ChatReadState.canPresent(context, data(1, other))) }
  @Test fun removesReadButPreservesLaterUnreadAndNonChatNotificationsWithoutReact() {
    val id = "event:444444444444444444444444"
    fun post(tag: String, payload: JSONObject) { manager.notify(tag, 0, Notification.Builder(context, "messages").setContentTitle("Test").setSmallIcon(android.R.drawable.ic_dialog_info).addExtras(Bundle().apply { putString("body", payload.toString()) }).build()) }
    post("logic-inbox:$id@2026-11-14T12:00:00Z", data(1)); post("unread", data(2)); post("update", JSONObject().put("logicUpdate", true))
    ChatReadState.acknowledge(context, account, chat, 1, setOf(id))
    assertEquals(setOf("unread", "update"), manager.activeNotifications.map { it.tag }.toSet())
  }
  @Test fun previousAccountControlCannotClearCurrentAccountTray() {
    ChatReadState.configure(context, other)
    val id = "event:444444444444444444444444"
    val tag = "logic-inbox:$id@2026-11-14T12:00:00Z"
    manager.notify(tag, 0, Notification.Builder(context, "messages").setSmallIcon(android.R.drawable.ic_dialog_info).build())
    ChatReadState.acknowledge(context, account, chat, 10, setOf(id)); assertEquals(1, manager.activeNotifications.size)
  }
  @Test fun dataOnlyTransportKeepsExpoTitleBodyAndTapPayload() {
    val message = RemoteMessage.Builder("server").setData(mapOf("google.sent_time" to "1794657600000", "type" to "chat_message", "title" to "Group", "message" to "Hello", "body" to data(1).toString())).build()
    val converted = ReadFirebaseMessagingService.asExpoNotification(message)
    assertEquals(message.sentTime, converted.sentTime); assertNotNull(converted.notification); assertEquals("Group", converted.notification?.title); assertEquals("Hello", converted.notification?.body); assertEquals(message.data["body"], converted.data["body"])
  }
}
