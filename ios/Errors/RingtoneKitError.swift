import Foundation

enum RingtoneKitErrorCode: String {
  case invalidArgument = "E_INVALID_ARGUMENT"
  case soundNotFound = "E_SOUND_NOT_FOUND"
  case playbackFailed = "E_PLAYBACK_FAILED"
  case unknown = "E_UNKNOWN"
}

struct RingtoneKitError: Error {
  let code: RingtoneKitErrorCode
  let message: String
  let nativeMessage: String?

  init(_ code: RingtoneKitErrorCode, _ message: String, nativeMessage: String? = nil) {
    self.code = code
    self.message = message
    self.nativeMessage = nativeMessage
  }
}
