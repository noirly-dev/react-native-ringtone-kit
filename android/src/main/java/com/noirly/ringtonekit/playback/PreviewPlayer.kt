package com.noirly.ringtonekit.playback

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.noirly.ringtonekit.errors.RingtoneKitException

class PreviewPlayer(
  private val context: Context,
  private val emit: (WritableMap) -> Unit,
) {
  private var ringtone: Ringtone? = null
  private var mediaPlayer: MediaPlayer? = null
  private var activeSoundId: String? = null

  @Synchronized
  fun play(soundId: String, uriString: String) {
    stopInternal(emitStopped = true)

    val uri = try {
      Uri.parse(uriString)
    } catch (error: Throwable) {
      throw RingtoneKitException.InvalidArgument("Invalid sound URI: $uriString")
    }

    activeSoundId = soundId

    try {
      if (uriString.startsWith("content://")) {
        val tone = RingtoneManager.getRingtone(context, uri)
          ?: throw RingtoneKitException.SoundNotFound("Ringtone not found for $uriString")
        tone.audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        ringtone = tone
        tone.play()
        emitState(soundId, "started")
      } else {
        val player = MediaPlayer().apply {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_MEDIA)
              .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
              .build(),
          )
          setDataSource(context, uri)
          setOnCompletionListener {
            emitState(soundId, "completed")
            stopInternal(emitStopped = false)
          }
          setOnErrorListener { _, what, extra ->
            emitState(soundId, "error", "MediaPlayer error what=$what extra=$extra")
            stopInternal(emitStopped = false)
            true
          }
          prepare()
          start()
        }
        mediaPlayer = player
        emitState(soundId, "started")
      }
    } catch (error: RingtoneKitException) {
      activeSoundId = null
      emitState(soundId, "error", error.message)
      throw error
    } catch (error: Throwable) {
      activeSoundId = null
      emitState(soundId, "error", error.message)
      throw RingtoneKitException.PlaybackFailed(
        "Failed to preview sound",
        nativeMessage = error.message,
      )
    }
  }

  @Synchronized
  fun stop() {
    stopInternal(emitStopped = true)
  }

  @Synchronized
  private fun stopInternal(emitStopped: Boolean) {
    val soundId = activeSoundId
    try {
      ringtone?.stop()
    } catch (_: Throwable) {
    }
    ringtone = null

    try {
      mediaPlayer?.setOnCompletionListener(null)
      mediaPlayer?.setOnErrorListener(null)
      if (mediaPlayer?.isPlaying == true) {
        mediaPlayer?.stop()
      }
      mediaPlayer?.release()
    } catch (_: Throwable) {
    }
    mediaPlayer = null

    if (emitStopped && soundId != null) {
      emitState(soundId, "stopped")
    }
    activeSoundId = null
  }

  private fun emitState(soundId: String, status: String, errorMessage: String? = null) {
    val map = Arguments.createMap().apply {
      putString("soundId", soundId)
      putString("status", status)
      if (errorMessage != null) {
        putString("errorMessage", errorMessage)
      } else {
        putNull("errorMessage")
      }
    }
    emit(map)
  }
}
