package com.seki999.toeicvisualvocabulary
import org.junit.Assert.*
import org.junit.Test
class OfflineVoicePolicyTest {
    private val us=OfflineVoice("us","en","US",false,true)
    private val uk=OfflineVoice("uk","en","GB",false,true)
    @Test fun refusesMissingChineseAndNetworkOnlyVoices() {
        assertNull(OfflineVoicePolicy.select(listOf(us),"zh","CN",""))
        assertNull(OfflineVoicePolicy.select(listOf(us.copy(network=true)),"en","US",""))
        assertNull(OfflineVoicePolicy.select(listOf(us.copy(installed=false)),"en","US",""))
    }
    @Test fun respectsVoiceThenAccentAndFallsBackWithinLanguage() {
        assertEquals("us",OfflineVoicePolicy.select(listOf(us,uk),"en","GB","us"))
        assertEquals("uk",OfflineVoicePolicy.select(listOf(us,uk),"en","GB","missing"))
        assertEquals("us",OfflineVoicePolicy.select(listOf(us),"en","GB",""))
    }
}
