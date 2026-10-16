package com.seki999.toeicvisualvocabulary

import android.content.Intent
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Compiled on CI; must be run on a connected Android device. Does not certify 30-minute behavior. */
@RunWith(AndroidJUnit4::class)
class PlaybackLifecycleTest {
    @Test fun repeatedStartStopDestroysServiceAndReleasesWakeLock() {
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        val context=instrumentation.targetContext
        repeat(3) {
            context.startActivity(Intent(context,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            instrumentation.waitForIdleSync()
            context.startForegroundService(Intent(context,PlaybackService::class.java).setAction("play").putExtra("listId","list01").putExtra("index",0))
            val start=System.currentTimeMillis()
            while(PlaybackHub.service==null && System.currentTimeMillis()-start<5000) Thread.sleep(50)
            val service=PlaybackHub.service
            assertNotNull("播放服务没有成功启动；检查前台启动与 TTS 环境", service)
            context.startService(Intent(context,PlaybackService::class.java).setAction("stop"))
            val stop=System.currentTimeMillis()
            while(PlaybackHub.service!=null && System.currentTimeMillis()-stop<5000) Thread.sleep(50)
            instrumentation.runOnMainSync {
                assertNull(PlaybackHub.service)
                if(service!=null) assertFalse(service.holdsWakeLock())
            }
        }
    }
}
