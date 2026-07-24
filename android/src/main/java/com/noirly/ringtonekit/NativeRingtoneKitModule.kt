package com.noirly.ringtonekit

import android.app.Activity
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.noirly.ringtonekit.catalog.SoundCatalogProvider
import com.noirly.ringtonekit.catalog.SoundMapper
import com.noirly.ringtonekit.errors.RingtoneKitException
import com.noirly.ringtonekit.playback.PreviewPlayer
import kotlinx.coroutines.launch

@ReactModule(name = NativeRingtoneKitModule.NAME)
class NativeRingtoneKitModule(
  reactContext: ReactApplicationContext,
) : NativeRingtoneKitSpec(reactContext) {

  private val catalog = SoundCatalogProvider(reactContext)
  private val previewPlayer = PreviewPlayer(reactContext) { payload ->
    emitOnPreviewStateChanged(payload)
  }

  private var pickerPromise: Promise? = null
  private var pickerCategory: String? = null

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != REQUEST_CODE_PICKER) {
          return
        }
        val promise = pickerPromise ?: return
        pickerPromise = null
        val category = pickerCategory ?: "ringtone"
        pickerCategory = null

        if (resultCode != Activity.RESULT_OK || data == null) {
          promise.resolve(SoundMapper.availableSound(data = null))
          return
        }

        @Suppress("DEPRECATION")
        val uri = data.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        if (uri == null) {
          promise.resolve(SoundMapper.availableSound(data = null))
          return
        }

        try {
          val sound = SoundMapper.fromUri(reactApplicationContext, uri, category)
          promise.resolve(SoundMapper.availableSound(data = sound))
        } catch (error: Throwable) {
          rejectPromise(promise, RingtoneKitException.Internal(error.message ?: "Picker failed", error))
        }
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun invalidate() {
    previewPlayer.stop()
    reactApplicationContext.removeActivityEventListener(activityEventListener)
    super.invalidate()
  }

  override fun getSounds(category: String, promise: Promise) {
    RingtoneKitScope.scope.launch {
      try {
        if (category == "custom") {
          promise.resolve(SoundMapper.availableSounds(data = emptyList()))
          return@launch
        }
        if (SoundMapper.ringtoneType(category) == null) {
          promise.reject(
            "E_INVALID_ARGUMENT",
            "Invalid sound category: $category",
          )
          return@launch
        }
        val sounds = catalog.getSounds(category)
        promise.resolve(SoundMapper.availableSounds(data = sounds))
      } catch (error: Throwable) {
        rejectPromise(promise, RingtoneKitException.Internal(error.message ?: "getSounds failed", error))
      }
    }
  }

  override fun openSystemPicker(category: String, promise: Promise) {
    val type = SoundMapper.ringtoneType(category)
    if (type == null) {
      promise.resolve(
        SoundMapper.unsupportedSound(
          "System picker is only available for ringtone, notification, and alarm categories",
        ),
      )
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      rejectPromise(
        promise,
        RingtoneKitException.Internal("No foreground activity available for system picker"),
      )
      return
    }

    if (pickerPromise != null) {
      rejectPromise(
        promise,
        RingtoneKitException.InvalidArgument("A system picker session is already in progress"),
      )
      return
    }

    pickerPromise = promise
    pickerCategory = category

    val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
      putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, type)
      putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
      putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, true)
      putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Select sound")
      catalog.getSelectedSound(category)?.let {
        putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(it.uri))
      }
    }

    try {
      activity.startActivityForResult(intent, REQUEST_CODE_PICKER)
    } catch (error: Throwable) {
      pickerPromise = null
      pickerCategory = null
      rejectPromise(promise, RingtoneKitException.Internal(error.message ?: "Failed to open picker", error))
    }
  }

  override fun getSelectedSound(category: String, promise: Promise) {
    RingtoneKitScope.scope.launch {
      try {
        if (SoundMapper.ringtoneType(category) == null) {
          promise.resolve(
            SoundMapper.unsupportedSound(
              "Selected system sound is only available for ringtone, notification, and alarm",
            ),
          )
          return@launch
        }
        val sound = catalog.getSelectedSound(category)
        promise.resolve(SoundMapper.availableSound(data = sound))
      } catch (error: Throwable) {
        rejectPromise(promise, RingtoneKitException.Internal(error.message ?: "getSelectedSound failed", error))
      }
    }
  }

  override fun previewSound(soundId: String, uri: String, promise: Promise) {
    try {
      previewPlayer.play(soundId, uri)
      promise.resolve(null)
    } catch (error: RingtoneKitException) {
      rejectPromise(promise, error)
    } catch (error: Throwable) {
      rejectPromise(promise, RingtoneKitException.PlaybackFailed(error.message ?: "Preview failed", error.message))
    }
  }

  override fun stopPreview(promise: Promise) {
    previewPlayer.stop()
    promise.resolve(null)
  }

  private fun rejectPromise(promise: Promise, error: RingtoneKitException) {
    val map: WritableMap = com.facebook.react.bridge.Arguments.createMap().apply {
      putString("code", error.code)
      if (error.nativeMessage != null) {
        putString("nativeMessage", error.nativeMessage)
      }
    }
    promise.reject(error.code, error.message, error, map)
  }

  companion object {
    const val NAME = "NativeRingtoneKit"
    private const val REQUEST_CODE_PICKER = 21073
  }
}
