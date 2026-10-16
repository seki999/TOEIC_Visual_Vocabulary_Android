package com.seki999.toeicvisualvocabulary

data class OfflineVoice(val id: String, val language: String, val country: String, val network: Boolean, val installed: Boolean)
object OfflineVoicePolicy {
    fun select(voices: List<OfflineVoice>, language: String, country: String, preferred: String): String? {
        val local = voices.filter { !it.network && it.installed && it.language == language }
        return (local.firstOrNull { it.id == preferred } ?: local.firstOrNull { it.country == country } ?: local.firstOrNull())?.id
    }
}
