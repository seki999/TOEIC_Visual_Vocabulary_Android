package com.seki999.toeicvisualvocabulary

/** Manifest order is authoritative; stale IDs and duplicate selections cannot create queue entries. */
object PlaylistOrder {
    fun resolve(manifestIds: List<String>, selectedIds: List<String>): List<String> {
        val selected = selectedIds.toSet()
        return manifestIds.distinct().filter { it in selected }
    }
    fun next(ids: List<String>, current: String, direction: Int = 1): String {
        require(ids.isNotEmpty()) { "请至少选择一个有效的 List" }
        val index = ids.indexOf(current)
        return if (index < 0) ids.first() else ids[Math.floorMod(index + direction, ids.size)]
    }
}
