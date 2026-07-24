package com.noirly.ringtonekit.catalog

import android.content.Context
import android.media.RingtoneManager
import android.net.Uri

class SoundCatalogProvider(private val context: Context) {
  fun getSounds(category: String): List<SoundRecord> {
    if (category == "custom") {
      return emptyList()
    }
    val type = SoundMapper.ringtoneType(category)
      ?: return emptyList()

    val manager = RingtoneManager(context).apply { setType(type) }
    val cursor = manager.cursor
    val defaultUri = RingtoneManager.getActualDefaultRingtoneUri(context, type)
    val results = mutableListOf<SoundRecord>()

    try {
      if (cursor != null && cursor.moveToFirst()) {
        do {
          val uri: Uri = manager.getRingtoneUri(cursor.position) ?: continue
          val title = cursor.getString(RingtoneManager.TITLE_COLUMN_INDEX)
            ?: uri.lastPathSegment
            ?: "Unknown"
          results.add(
            SoundRecord(
              id = uri.toString(),
              title = title,
              category = category,
              uri = uri.toString(),
              isSystemDefault = defaultUri != null && defaultUri == uri,
              source = "system",
            ),
          )
        } while (cursor.moveToNext())
      }
    } finally {
      cursor?.close()
    }

    return results
  }

  fun getSelectedSound(category: String): SoundRecord? {
    val type = SoundMapper.ringtoneType(category) ?: return null
    val uri = RingtoneManager.getActualDefaultRingtoneUri(context, type) ?: return null
    return SoundMapper.fromUri(context, uri, category, isSystemDefault = true)
  }
}
