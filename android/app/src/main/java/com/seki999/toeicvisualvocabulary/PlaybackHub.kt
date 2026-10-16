package com.seki999.toeicvisualvocabulary

import android.content.Context
import com.getcapacitor.JSObject

/** Only touched on Android's main thread. Subscribers never own playback. */
object PlaybackHub {
    @Volatile var service: PlaybackService? = null
    val observers = linkedSetOf<(JSObject) -> Unit>()
    private var revision = System.currentTimeMillis()
    fun snapshot(context: Context): JSObject {
        val raw = context.getSharedPreferences("playback", Context.MODE_PRIVATE).getString("state", null)
        return if (raw != null) JSObject(raw) else JSObject().put("status", "stopped").put("index", 0)
            .put("listId", "").put("wordId", "").put("revision", 0).put("error", "")
    }
    fun emit(context: Context, state: JSObject) {
        revision = maxOf(revision + 1, System.currentTimeMillis())
        state.put("revision", revision)
        context.getSharedPreferences("playback", Context.MODE_PRIVATE).edit().putString("state", state.toString()).apply()
        observers.toList().forEach { it(state) }
    }
}
