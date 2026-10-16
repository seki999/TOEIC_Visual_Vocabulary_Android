package com.seki999.toeicvisualvocabulary

import android.Manifest
import android.content.Intent
import android.os.Build
import android.speech.tts.TextToSpeech
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray

@CapacitorPlugin(name = "VocabularyTTS", permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])])
class VocabularyTTSPlugin : Plugin() {
    private val observer: (JSObject) -> Unit = { notifyListeners("state", it) }
    override fun load() { activity.runOnUiThread { PlaybackHub.observers.add(observer) } }
    override fun handleOnDestroy() { activity.runOnUiThread { PlaybackHub.observers.remove(observer) }; super.handleOnDestroy() }
    @PluginMethod fun getState(call: PluginCall) { activity.runOnUiThread {
        val state = PlaybackHub.snapshot(context)
        // A killed process cannot still be playing. Position remains recoverable.
        if (PlaybackHub.service == null) state.put("status", "stopped")
        call.resolve(state)
    } }
    @PluginMethod fun command(call: PluginCall) { activity.runOnUiThread {
        try {
            val action = call.getString("action") ?: throw IllegalArgumentException("Missing action")
            if (action == "fullscreen") {
                (activity as? MainActivity)?.setImageFullscreen(call.getBoolean("fullscreen", false) == true)
                call.resolve(); return@runOnUiThread
            }
            val settings = call.getObject("settings")
            if (settings != null) context.getSharedPreferences("playback", 0).edit()
                .putString("settings", settings.toString()).putBoolean("wake", settings.optBoolean("wake", true)).apply()
            (activity as? MainActivity)?.updateKeepScreenOn()
            val service = PlaybackHub.service
            if (action == "settings") { service?.configure(settings); call.resolve(); return@runOnUiThread }
            if (action == "select" && service == null) {
                val state = PlaybackHub.snapshot(context).put("status", "stopped").put("listId", call.getString("listId", ""))
                    .put("index", call.getInt("index", 0)).put("wordId", call.getString("wordId", "")).put("error", "")
                PlaybackHub.emit(context, state); call.resolve(); return@runOnUiThread
            }
            if (service == null && action != "play" && action != "resume") { call.resolve(); return@runOnUiThread }
            val intent = Intent(context, PlaybackService::class.java).setAction(action)
                .putExtra("listId", call.getString("listId")).putExtra("index", call.getInt("index", 0))
                .putExtra("settings", settings?.toString())
            if (action == "play" || action == "resume") context.startForegroundService(intent) else context.startService(intent)
            call.resolve()
        } catch (e: Exception) { call.reject(e.message, e) }
    } }
    @PluginMethod fun requestNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)
            requestPermissionForAlias("notifications", call, "notificationResult") else call.resolve()
    }
    @PermissionCallback private fun notificationResult(call: PluginCall) { call.resolve() }
    @PluginMethod fun getVoices(call: PluginCall) { activity.runOnUiThread {
        var engine: TextToSpeech? = null
        engine = TextToSpeech(context) { status -> activity.runOnUiThread {
            val voices = JSONArray()
            if (status == TextToSpeech.SUCCESS) engine?.voices?.filter {
                !it.isNetworkConnectionRequired && !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
            }?.sortedBy { it.name }?.forEach {
                voices.put(JSObject().put("id", it.name).put("language", it.locale.toLanguageTag()))
            }
            call.resolve(JSObject().put("voices", voices)); engine?.shutdown()
        } }
    } }
}
