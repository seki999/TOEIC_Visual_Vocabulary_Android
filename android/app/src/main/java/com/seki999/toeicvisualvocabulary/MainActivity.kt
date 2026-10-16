package com.seki999.toeicvisualvocabulary

import android.os.Bundle
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.activity.OnBackPressedCallback
import com.getcapacitor.BridgeActivity
import com.getcapacitor.JSObject

class MainActivity : BridgeActivity() {
    private val observer: (JSObject) -> Unit = { updateKeepScreenOn() }
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(VocabularyTTSPlugin::class.java)
        super.onCreate(savedInstanceState)
        // Android 15 enforces edge-to-edge: keep WebView inside actual system insets.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        PlaybackHub.observers.add(observer)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                bridge.webView.evaluateJavascript("Boolean(document.querySelector('.scrim, .fullscreen'))") { modal ->
                    if (modal == "true") bridge.webView.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", null)
                    else moveTaskToBack(true)
                }
            }
        })
        updateKeepScreenOn()
    }
    fun updateKeepScreenOn() {
        val enabled = getSharedPreferences("playback", MODE_PRIVATE).getBoolean("wake", true)
        if (enabled && PlaybackHub.service?.cursor?.status == "playing")
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
    fun setImageFullscreen(enabled: Boolean) {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (enabled) controller.hide(WindowInsetsCompat.Type.systemBars())
        else controller.show(WindowInsetsCompat.Type.systemBars())
    }
    override fun onResume() { super.onResume(); updateKeepScreenOn() }
    override fun onDestroy() { PlaybackHub.observers.remove(observer); window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); super.onDestroy() }
}
