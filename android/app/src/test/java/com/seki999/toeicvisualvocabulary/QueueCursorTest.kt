package com.seki999.toeicvisualvocabulary
import org.junit.Assert.*
import org.junit.Test

class QueueCursorTest {
    private fun next(c: QueueCursor, size: Int = 2, fields: Int = 1, fr: Int = 1, wr: Int = 1, current: Boolean = false, loop: Boolean = false) = c.advance(size,fields,fr,wr,current,loop)
    @Test fun rapidSeekInvalidatesEveryOldCallback() {
        val c=QueueCursor(); c.play(0); val a=c.generation; c.seek(1); val b=c.generation; c.seek(0)
        assertFalse(c.accepts(a)); assertFalse(c.accepts(b)); assertEquals(0,c.index); assertTrue(c.accepts(c.generation))
    }
    @Test fun pauseResumeRepeatsInterruptedFieldAndStopRejectsCallbacks() {
        val c=QueueCursor(); c.play(0); next(c,fields=2); val token=c.generation; c.pause()
        assertFalse(c.accepts(token)); assertEquals(1,c.field); next(c); assertEquals(1,c.field)
        c.resume(); assertEquals("playing",c.status); assertEquals(1,c.field); c.stop(); c.resume(); assertEquals("stopped",c.status)
    }
    @Test fun repeatsFieldsThenWordsThenAdvances() {
        val c=QueueCursor(); c.play(0)
        repeat(7){next(c,fields=2,fr=2,wr=2);assertEquals(0,c.index)}
        assertTrue(next(c,fields=2,fr=2,wr=2));assertEquals(1,c.index);assertEquals(0,c.field)
    }
    @Test fun loopsCurrentWordAndWholeList() {
        val c=QueueCursor();c.play(1);repeat(20){next(c,current=true);assertEquals(1,c.index)}
        next(c,loop=true);assertEquals(0,c.index);next(c);next(c);assertEquals("stopped",c.status);assertEquals(1,c.index)
    }
    @Test fun seekWhilePausedPreservesPauseAndResetsField() {
        val c=QueueCursor();c.play(0);next(c,fields=2);c.pause();c.seek(1);assertEquals("paused",c.status);assertEquals(0,c.field)
    }
}
