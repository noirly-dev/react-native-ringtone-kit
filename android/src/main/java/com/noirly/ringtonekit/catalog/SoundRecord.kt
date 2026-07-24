package com.noirly.ringtonekit.catalog

data class SoundRecord(
  val id: String,
  val title: String,
  val category: String,
  val uri: String,
  val durationMs: Long? = null,
  val isSystemDefault: Boolean = false,
  val source: String = "system",
)
