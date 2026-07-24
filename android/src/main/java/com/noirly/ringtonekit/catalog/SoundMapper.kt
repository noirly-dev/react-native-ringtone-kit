package com.noirly.ringtonekit.catalog

import android.content.Context
import android.media.RingtoneManager
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

object SoundMapper {
  fun ringtoneType(category: String): Int? {
    return when (category) {
      "ringtone" -> RingtoneManager.TYPE_RINGTONE
      "notification" -> RingtoneManager.TYPE_NOTIFICATION
      "alarm" -> RingtoneManager.TYPE_ALARM
      else -> null
    }
  }

  fun toWritableMap(record: SoundRecord): WritableMap {
    return Arguments.createMap().apply {
      putString("id", record.id)
      putString("title", record.title)
      putString("category", record.category)
      putString("uri", record.uri)
      if (record.durationMs != null) {
        putDouble("durationMs", record.durationMs.toDouble())
      } else {
        putNull("durationMs")
      }
      putBoolean("isSystemDefault", record.isSystemDefault)
      putString("source", record.source)
    }
  }

  fun fromUri(
    context: Context,
    uri: Uri,
    category: String,
    isSystemDefault: Boolean = false,
  ): SoundRecord {
    val ringtone = RingtoneManager.getRingtone(context, uri)
    val title = try {
      ringtone?.getTitle(context) ?: uri.lastPathSegment ?: "Unknown"
    } finally {
      ringtone?.stop()
    }
    return SoundRecord(
      id = uri.toString(),
      title = title,
      category = category,
      uri = uri.toString(),
      isSystemDefault = isSystemDefault,
      source = "system",
    )
  }

  fun availableSounds(status: String = "available", data: List<SoundRecord> = emptyList()): WritableMap {
    return Arguments.createMap().apply {
      putString("status", status)
      putNull("reason")
      putNull("permission")
      val array = Arguments.createArray()
      data.forEach { array.pushMap(toWritableMap(it)) }
      putArray("data", array)
    }
  }

  fun unsupportedSounds(reason: String): WritableMap {
    return Arguments.createMap().apply {
      putString("status", "unsupported")
      putString("reason", reason)
      putNull("permission")
      putNull("data")
    }
  }

  fun availableSound(status: String = "available", data: SoundRecord?): WritableMap {
    return Arguments.createMap().apply {
      putString("status", status)
      putNull("reason")
      putNull("permission")
      if (data != null) {
        putMap("data", toWritableMap(data))
      } else {
        putNull("data")
      }
    }
  }

  fun unsupportedSound(reason: String): WritableMap {
    return Arguments.createMap().apply {
      putString("status", "unsupported")
      putString("reason", reason)
      putNull("permission")
      putNull("data")
    }
  }
}
