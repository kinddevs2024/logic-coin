package com.kinddevs.logiccoin.chatnotify

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class ChatNotificationSyncModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ChatNotificationSync"
  override fun getConstants(): MutableMap<String, Any> = mutableMapOf("version" to 1)
  @ReactMethod fun configure(account: String?, promise: Promise) {
    runCatching { ChatReadState.configure(context, account); true }.onSuccess { promise.resolve(it) }.onFailure { promise.reject("chat_read_sync", "Could not configure notification sync") }
  }
  @ReactMethod fun acknowledge(account: String, conversation: String, sequence: Double, ids: ReadableArray, promise: Promise) {
    runCatching { ChatReadState.acknowledge(context, account, conversation, sequence.toLong(), ids.toArrayList().filterIsInstance<String>().toSet()); true }.onSuccess { promise.resolve(it) }.onFailure { promise.reject("chat_read_sync", "Could not clear read notifications") }
  }
}
class ChatNotificationSyncPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(ChatNotificationSyncModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
