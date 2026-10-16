package com.seki999.toeicvisualvocabulary

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.media.*
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.*
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** The sole playback owner. JS only sends commands and displays snapshots. */
class PlaybackService : Service() {
    val cursor = QueueCursor()
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var tts: TextToSpeech
    private lateinit var audio: AudioManager
    private lateinit var session: MediaSession
    private lateinit var wakeLock: PowerManager.WakeLock
    private lateinit var focusRequest: AudioFocusRequest
    private var ready = false
    private var destroyed = false
    private var foreground = false
    private var focusHeld = false
    private var resumeOnFocus = false
    private var listId = ""
    private var items = JSONArray()
    private var settings = JSONObject()
    private var pendingSettings: JSONObject? = null
    private var error = ""
    private var delayPending = false
    private var delayMs = 0L
    private var utteranceId = ""
    private var serial = 0L
    private val allowed = setOf("word", "meaning", "collocation.en", "collocation.zh", "example.en", "example.zh")
    private val prefs get() = getSharedPreferences("playback", MODE_PRIVATE)
    private val noisy = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) { if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) pause(true) }
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onCreate() {
        super.onCreate(); PlaybackHub.service = this
        settings = JSONObject(prefs.getString("settings", "{}") ?: "{}")
        audio = getSystemService(AudioManager::class.java)
        wakeLock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:tts")
        wakeLock.setReferenceCounted(false)
        val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
        focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes).setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener({ change ->
                when (change) {
                    AudioManager.AUDIOFOCUS_GAIN -> if (resumeOnFocus && cursor.status == "paused") { resumeOnFocus = false; resume() }
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                        resumeOnFocus = cursor.status == "playing"; pause(false)
                    }
                    AudioManager.AUDIOFOCUS_LOSS -> { resumeOnFocus = false; pause(true) }
                }
            }, handler).build()
        session = MediaSession(this, "VocabularyTTS").apply {
            setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS)
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() { resume() }
                override fun onPause() { pause(true) }
                override fun onStop() { finishPlayback() }
                override fun onSkipToNext() { seek(cursor.index + 1) }
                override fun onSkipToPrevious() { seek(cursor.index - 1) }
            }, handler)
            isActive = true
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("reading", "词汇朗读", NotificationManager.IMPORTANCE_LOW))
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), RECEIVER_NOT_EXPORTED)
        else @Suppress("DEPRECATION") registerReceiver(noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
        tts = TextToSpeech(this) { result -> handler.post {
            if (destroyed) return@post
            if (result != TextToSpeech.SUCCESS) { fail("Android TTS 初始化失败，请检查系统文字转语音引擎"); return@post }
            ready = true; tts.setAudioAttributes(attributes)
            tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) { handler.post { complete(id) } }
                @Deprecated("TTS legacy callback") override fun onError(id: String?) { handler.post { if (id == utteranceId) fail("TTS 朗读失败，请检查离线语言包") } }
                override fun onError(id: String?, code: Int) { handler.post { if (id == utteranceId) fail("TTS 朗读失败（$code），请检查离线语言包") } }
            })
            if (cursor.status == "playing") speak()
        } }
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            // Foreground before requesting focus (required for target Android 15).
            if (intent?.action == "play" || intent?.action == "resume") promote()
            intent?.getStringExtra("settings")?.let { configure(JSONObject(it)) }
            when (intent?.action) {
                "play" -> {
                    invalidateSpeech(); settings = pendingSettings ?: settings; pendingSettings = null
                    loadList(intent.getStringExtra("listId") ?: "")
                    cursor.play(intent.getIntExtra("index", 0).coerceIn(0, items.length() - 1)); error = ""
                    require(hasContent()) { "所选字段没有可朗读内容" }
                    if (!requestFocus()) return START_NOT_STICKY
                    holdWake(); publish(); if (ready) speak()
                    else handler.postDelayed({ if (!ready && !destroyed) fail("TTS 引擎初始化超时") }, 15000)
                }
                "resume" -> {
                    if (items.length() == 0) {
                        val saved = PlaybackHub.snapshot(this)
                        loadList(saved.optString("listId"))
                        val stable = (0 until items.length()).firstOrNull { items.getJSONObject(it).optString("id") == saved.optString("wordId") }
                        cursor.play(stable ?: saved.optInt("index").coerceIn(0, items.length()-1)); cursor.pause()
                    }
                    resume()
                }
                "pause" -> pause(true)
                "stop" -> finishPlayback()
                "select" -> {
                    invalidateSpeech(); loadList(intent.getStringExtra("listId") ?: listId)
                    cursor.seek(intent.getIntExtra("index", 0).coerceIn(0, items.length()-1)); error = ""; finishPlayback()
                }
                "seek" -> seek(intent.getIntExtra("index", cursor.index))
                "next" -> seek(cursor.index + 1)
                "previous" -> seek(cursor.index - 1)
            }
        } catch (e: Exception) { fail("无法启动朗读：${e.message}") }
        return START_NOT_STICKY
    }
    private fun loadList(id: String) {
        val manifest = JSONObject(assets.open("public/data/manifest.json").bufferedReader().use { it.readText() }).getJSONArray("lists")
        val entry = (0 until manifest.length()).map { manifest.getJSONObject(it) }.firstOrNull { it.getString("id") == id }
            ?: throw IllegalArgumentException("找不到 List：$id")
        val path = entry.getString("file")
        require(path.startsWith("data/") && !path.contains(".."))
        val data = JSONObject(assets.open("public/$path").bufferedReader().use { it.readText() })
        items = data.getJSONArray("items"); require(items.length() > 0) { "List 没有词汇" }; listId = id
    }
    fun configure(value: JSONObject?) {
        if (value == null) return
        // The current utterance remains owned by the same engine; new settings apply at a boundary.
        pendingSettings = JSONObject(value.toString())
        if (cursor.status != "playing") { settings = pendingSettings!!; pendingSettings = null }
    }
    private fun order(): List<String> {
        val a = settings.optJSONArray("order") ?: JSONArray().put("word").put("example.en")
        return (0 until a.length()).map { a.optString(it) }.filter { it in allowed }.distinct()
    }
    private fun intSetting(key: String, default: Int, max: Int) = settings.optInt(key, default).coerceIn(if (key.endsWith("Repeat") || key == "repeat") 1 else 0, max)
    private fun number(key: String, default: Double, min: Double, max: Double) = settings.optDouble(key, default).let { if (it.isFinite()) it.coerceIn(min, max) else default }.toFloat()
    private fun text(word: JSONObject, field: String): String {
        val parts = field.split('.')
        return if (parts.size == 1) word.optString(field) else word.optJSONObject(parts[0])?.optString(parts[1]) ?: ""
    }
    private fun hasContent() = (0 until items.length()).any { n -> order().any { text(items.getJSONObject(n), it).isNotBlank() } }
    private fun speak() {
        try { speakNext() }
        catch (e: Exception) { fail("TTS 引擎错误：${e.message}") }
    }
    private fun speakNext() {
        if (!ready || destroyed || cursor.status != "playing") return
        pendingSettings?.let {
            settings = it; pendingSettings = null
            if (!hasContent()) { fail("所选字段没有可朗读内容"); return }
        }
        val fields = order()
        if (fields.isEmpty()) { fail("请至少选择一个朗读字段"); return }
        if (cursor.field >= fields.size) { cursor.field = 0; cursor.fieldCycle = 0 }
        val word = items.optJSONObject(cursor.index) ?: run { finishPlayback(); return }
        if (settings.optBoolean("currentOnly") && fields.none { text(word, it).isNotBlank() }) { fail("当前单词的所选字段为空，无法循环朗读"); return }
        val field = fields[cursor.field]; val content = text(word, field)
        if (content.isBlank()) { schedule(0) { advance() }; return }
        val chinese = field == "meaning" || field.endsWith(".zh")
        val locale = if (chinese) Locale.SIMPLIFIED_CHINESE else Locale.forLanguageTag(settings.optString("accent", "en-US"))
        val available = tts.voices.orEmpty().toList()
        val selected = settings.optString(if (chinese) "zhVoice" else "enVoice")
        val voiceId = OfflineVoicePolicy.select(available.map { OfflineVoice(it.name, it.locale.language, it.locale.country,
            it.isNetworkConnectionRequired, !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) }, locale.language, locale.country, selected)
        val voice = available.firstOrNull { it.name == voiceId }
        if (voice == null || tts.setLanguage(voice.locale) < TextToSpeech.LANG_AVAILABLE || tts.setVoice(voice) == TextToSpeech.ERROR) {
            fail("缺少${if (chinese) "中文" else "英语"}离线 TTS 语言包，请到系统文字转语音设置安装"); return
        }
        tts.setSpeechRate(number(if (chinese) "zhRate" else "enRate", if (chinese) 1.2 else 0.8, 0.1, 3.0))
        tts.setPitch(number("pitch", 1.0, 0.5, 2.0))
        val token = cursor.generation
        utteranceId = "$token:${++serial}"
        holdWake(); publish()
        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, number("volume", 1.0, 0.0, 1.0)) }
        if (content.length > TextToSpeech.getMaxSpeechInputLength()) { fail("字段超过系统 TTS 长度限制，请开发者拆分资源内容"); return }
        if (tts.speak(content, TextToSpeech.QUEUE_FLUSH, params, utteranceId) == TextToSpeech.ERROR) { fail("TTS 无法开始朗读"); return }
        val expected = utteranceId
        handler.postDelayed({ if (cursor.accepts(token) && utteranceId == expected) fail("TTS 超时，已停止以释放播放资源") }, 240000)
    }
    private fun complete(id: String?) {
        if (id == null || id != utteranceId || !cursor.accepts(id.substringBefore(':').toLongOrNull() ?: -1)) return
        utteranceId = ""; handler.removeCallbacksAndMessages(null); advance()
    }
    private fun advance() {
        val boundary = cursor.advance(items.length(), order().size, intSetting("fieldRepeat", 1, 20), intSetting("repeat", 1, 20), settings.optBoolean("currentOnly"), settings.optBoolean("loop"))
        if (cursor.status == "stopped") { finishPlayback(); return }
        publish()
        schedule(intSetting(if (boundary) "itemGap" else "gap", if (boundary) 500 else 300, 60000).toLong()) { speak() }
    }
    private fun schedule(ms: Long, block: () -> Unit) {
        val token = cursor.generation; delayPending = true; delayMs = ms
        handler.postDelayed({ if (cursor.accepts(token) && !destroyed) { delayPending = false; block() } }, ms)
    }
    private fun invalidateSpeech() { cursor.invalidate(); utteranceId = ""; handler.removeCallbacksAndMessages(null); if (ready) tts.stop() }
    private fun seek(n: Int) {
        if (items.length() == 0) return
        invalidateSpeech(); delayPending = false; cursor.seek(n.coerceIn(0, items.length()-1)); error = ""; publish()
        if (cursor.status == "playing") speak()
    }
    private fun pause(abandon: Boolean) {
        if (cursor.status != "playing") {
            if (abandon) { resumeOnFocus = false; abandonFocus() }
            return
        }
        cursor.pause(); invalidateSpeech(); releaseWake()
        if (abandon) { resumeOnFocus = false; abandonFocus() }
        publish(); if (foreground) { stopForeground(STOP_FOREGROUND_DETACH); foreground = false }
        getSystemService(NotificationManager::class.java).notify(1, notification())
    }
    private fun resume() {
        if (cursor.status != "paused") return
        try { promote(); if (!requestFocus()) return }
        catch (e: Exception) { fail("系统不允许恢复后台服务，请回到 App 点击播放：${e.message}"); return }
        cursor.resume(); error = ""; holdWake(); publish()
        if (ready) { if (delayPending) schedule(delayMs) { speak() } else speak() }
        else handler.postDelayed({ if (!ready && !destroyed) fail("TTS 引擎初始化超时") }, 15000)
    }
    private fun requestFocus(): Boolean {
        if (focusHeld) return true
        focusHeld = audio.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        if (!focusHeld) fail("无法获得音频焦点，请在其他音频或通话结束后重试")
        return focusHeld
    }
    private fun abandonFocus() { if (focusHeld) audio.abandonAudioFocusRequest(focusRequest); focusHeld = false }
    private fun holdWake() { if (wakeLock.isHeld) wakeLock.release(); wakeLock.acquire(10 * 60 * 1000L) }
    private fun releaseWake() { if (wakeLock.isHeld) wakeLock.release() }
    internal fun holdsWakeLock() = wakeLock.isHeld
    private fun fail(message: String) { error = message; finishPlayback() }
    private fun finishPlayback() {
        cursor.stop(); invalidateSpeech(); delayPending = false; resumeOnFocus = false
        releaseWake(); abandonFocus(); publish(); session.isActive = false
        stopForeground(STOP_FOREGROUND_REMOVE); foreground = false; getSystemService(NotificationManager::class.java).cancel(1); stopSelf()
    }
    private fun publish() {
        val word = items.optJSONObject(cursor.index)
        PlaybackHub.emit(this, JSObject().put("status", cursor.status).put("listId", listId).put("index", cursor.index)
            .put("wordId", word?.optString("id") ?: "").put("error", error))
        val actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS
        session.setPlaybackState(PlaybackState.Builder().setActions(actions).setState(when (cursor.status) { "playing" -> PlaybackState.STATE_PLAYING; "paused" -> PlaybackState.STATE_PAUSED; else -> PlaybackState.STATE_STOPPED }, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build())
        session.setMetadata(MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, word?.optString("word") ?: "TOEIC")
            .putString(MediaMetadata.METADATA_KEY_ARTIST, "$listId · ${cursor.index+1}/${items.length()}").build())
        if (cursor.status != "stopped") getSystemService(NotificationManager::class.java).notify(1, notification())
    }
    private fun pending(action: String): PendingIntent {
        val intent = Intent(this, PlaybackService::class.java).setAction(action)
        return if (action == "resume") PendingIntent.getForegroundService(this, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        else PendingIntent.getService(this, action.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    private fun notification(): Notification {
        val playing = cursor.status == "playing"
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, "reading").setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(items.optJSONObject(cursor.index)?.optString("word") ?: "TOEIC 朗读")
            .setContentText("$listId · ${cursor.index+1} · ${if (playing) "朗读中" else "已暂停，恢复将重读当前字段"}")
            .setContentIntent(open).setOnlyAlertOnce(true).setOngoing(playing).setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(android.R.drawable.ic_media_previous, "上一词", pending("previous")).build())
            .addAction(Notification.Action.Builder(if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play, if (playing) "暂停" else "恢复", pending(if (playing) "pause" else "resume")).build())
            .addAction(Notification.Action.Builder(android.R.drawable.ic_media_next, "下一词", pending("next")).build())
            .addAction(Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "停止", pending("stop")).build())
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0,1,2)).build()
    }
    private fun promote() {
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        else startForeground(1, notification())
        foreground = true; session.isActive = true
    }
    override fun onDestroy() {
        destroyed = true; cursor.stop(); invalidateSpeech(); releaseWake(); abandonFocus()
        tts.stop(); tts.shutdown(); session.release(); unregisterReceiver(noisy)
        PlaybackHub.service = null
        val snapshot = PlaybackHub.snapshot(this).put("status", "stopped"); PlaybackHub.emit(this, snapshot)
        super.onDestroy()
    }
}
