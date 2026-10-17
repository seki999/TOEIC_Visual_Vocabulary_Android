package com.seki999.toeicvisualvocabulary

import org.junit.Assert.*
import org.junit.Test

class PlaylistOrderTest {
    @Test fun resolvesManifestOrderAndIgnoresDeletedOrDuplicateSelections() {
        assertEquals(listOf("list14", "list99"), PlaylistOrder.resolve(
            listOf("list01", "list14", "list99"), listOf("list99", "deleted", "list14", "list14")))
    }
    @Test fun wrapsBothDirectionsAndHandlesRemovedCurrentList() {
        val ids = listOf("a", "b", "c")
        assertEquals("b", PlaylistOrder.next(ids, "a"))
        assertEquals("a", PlaylistOrder.next(ids, "c"))
        assertEquals("c", PlaylistOrder.next(ids, "a", -1))
        assertEquals("a", PlaylistOrder.next(ids, "removed"))
        assertEquals("only", PlaylistOrder.next(listOf("only"), "only"))
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsEmptyPlaylist() {
        PlaylistOrder.next(emptyList(), "a")
    }
    @Test fun continuesAcrossListsThenWrapsWithoutStoppingOrAcceptingOldCallbacks() {
        val ids = listOf("a", "b")
        val sizes = mapOf("a" to 1, "b" to 2)
        val cursor = QueueCursor(); cursor.play(0)
        var current = ids.first()
        val sequence = mutableListOf("$current:${cursor.index}")
        repeat(6) {
            val oldToken = cursor.generation
            cursor.advance(sizes.getValue(current), 1, 1, 1, false, false, true)
            if (cursor.listEnded) {
                current = PlaylistOrder.next(ids, current); cursor.seek(0)
                assertFalse(cursor.accepts(oldToken))
            }
            assertEquals("playing", cursor.status)
            sequence.add("$current:${cursor.index}")
        }
        assertEquals(listOf("a:0", "b:0", "b:1", "a:0", "b:0", "b:1", "a:0"), sequence)
    }
    @Test fun completesAllFieldAndWordRepeatsBeforeCrossingListBoundary() {
        val cursor = QueueCursor(); cursor.play(0)
        repeat(7) {
            cursor.advance(1, 2, 2, 2, false, false, true)
            assertFalse(cursor.listEnded)
        }
        cursor.pause(); cursor.advance(1, 2, 2, 2, false, false, true)
        assertFalse(cursor.listEnded)
        cursor.resume(); cursor.advance(1, 2, 2, 2, false, false, true)
        assertTrue(cursor.listEnded)
        cursor.stop(); cursor.resume()
        assertEquals("stopped", cursor.status)
    }
    @Test fun currentWordLoopNeverCrossesListEvenWithContinuationEnabled() {
        val cursor = QueueCursor(); cursor.play(0)
        repeat(10) {
            cursor.advance(1, 1, 1, 1, true, false, true)
            assertFalse(cursor.listEnded); assertEquals(0, cursor.index)
        }
    }
}
