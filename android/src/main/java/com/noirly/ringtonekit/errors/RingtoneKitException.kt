package com.noirly.ringtonekit.errors

sealed class RingtoneKitException(
  val code: String,
  message: String,
  val nativeMessage: String? = null,
) : Exception(message) {
  class InvalidArgument(message: String) :
    RingtoneKitException("E_INVALID_ARGUMENT", message)

  class SoundNotFound(message: String) :
    RingtoneKitException("E_SOUND_NOT_FOUND", message)

  class PlaybackFailed(message: String, nativeMessage: String? = null) :
    RingtoneKitException("E_PLAYBACK_FAILED", message, nativeMessage)

  class Internal(message: String, cause: Throwable? = null) :
    RingtoneKitException("E_UNKNOWN", message, cause?.message) {
    init {
      cause?.let { initCause(it) }
    }
  }
}
