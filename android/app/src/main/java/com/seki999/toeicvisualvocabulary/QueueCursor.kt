package com.seki999.toeicvisualvocabulary

/** Pure queue state, independent of Activity, WebView, TTS and Android timers. */
class QueueCursor {
    var index = 0
    var field = 0
    var fieldCycle = 0
    var wordCycle = 0
    var listEnded = false
        private set
    var generation = 0L
        private set
    var status = "stopped"
        private set
    fun play(start: Int) { invalidate(); index = start; resetField(); status = "playing" }
    fun seek(start: Int) { invalidate(); index = start; resetField() }
    private fun resetField() { field = 0; fieldCycle = 0; wordCycle = 0; listEnded = false }
    fun invalidate() { generation++ }
    fun pause() { if (status == "playing") { invalidate(); status = "paused" } }
    fun resume() { if (status == "paused") { invalidate(); status = "playing" } }
    fun stop() { invalidate(); status = "stopped"; resetField() }
    fun accepts(token: Long) = status == "playing" && generation == token
    /** Returns true at a word boundary. The caller chooses the corresponding native delay. */
    fun advance(size: Int, fields: Int, fieldRepeat: Int, repeat: Int, currentOnly: Boolean, loop: Boolean, continueToNextList: Boolean = false): Boolean {
        listEnded = false
        if (status != "playing") return false
        fieldCycle++
        if (fieldCycle < fieldRepeat) return false
        fieldCycle = 0; field++
        if (field < fields) return false
        field = 0; wordCycle++
        if (wordCycle < repeat) return false
        wordCycle = 0
        if (!currentOnly) index++
        if (index >= size) {
            if (loop || continueToNextList) { index = 0; listEnded = true }
            else { index = (size - 1).coerceAtLeast(0); stop() }
        }
        return true
    }
}
