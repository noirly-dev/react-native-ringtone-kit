import AVFoundation
import Foundation

final class PreviewPlayer {
  static let shared = PreviewPlayer()

  private var player: AVAudioPlayer?
  private var activeSoundId: String?
  private let queue = DispatchQueue(label: "com.noirly.ringtonekit.preview")

  var onStateChanged: (([String: Any]) -> Void)?

  func play(soundId: String, uriString: String) throws {
    try queue.sync {
      stopInternal(emitStopped: true)

      guard let url = URL(string: uriString) else {
        throw RingtoneKitError(.invalidArgument, "Invalid sound URI: \(uriString)")
      }

      let resolvedURL: URL
      if url.isFileURL {
        resolvedURL = url
      } else if FileManager.default.fileExists(atPath: uriString) {
        resolvedURL = URL(fileURLWithPath: uriString)
      } else {
        throw RingtoneKitError(.soundNotFound, "Sound file not found: \(uriString)")
      }

      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [])
        try session.setActive(true)
      } catch {
        throw RingtoneKitError(
          .playbackFailed,
          "Failed to activate audio session",
          nativeMessage: error.localizedDescription
        )
      }

      do {
        let audioPlayer = try AVAudioPlayer(contentsOf: resolvedURL)
        audioPlayer.delegate = PreviewPlayerDelegate.shared
        PreviewPlayerDelegate.shared.owner = self
        audioPlayer.prepareToPlay()
        activeSoundId = soundId
        player = audioPlayer
        guard audioPlayer.play() else {
          throw RingtoneKitError(.playbackFailed, "AVAudioPlayer failed to start")
        }
        emit(soundId: soundId, status: "started")
      } catch let error as RingtoneKitError {
        activeSoundId = nil
        player = nil
        emit(soundId: soundId, status: "error", errorMessage: error.message)
        throw error
      } catch {
        activeSoundId = nil
        player = nil
        emit(soundId: soundId, status: "error", errorMessage: error.localizedDescription)
        throw RingtoneKitError(
          .playbackFailed,
          "Failed to preview sound",
          nativeMessage: error.localizedDescription
        )
      }
    }
  }

  func stop() {
    queue.sync {
      stopInternal(emitStopped: true)
    }
  }

  fileprivate func handleFinished() {
    queue.async {
      if let soundId = self.activeSoundId {
        self.emit(soundId: soundId, status: "completed")
      }
      self.stopInternal(emitStopped: false)
    }
  }

  private func stopInternal(emitStopped: Bool) {
    let soundId = activeSoundId
    player?.stop()
    player = nil
    if emitStopped, let soundId {
      emit(soundId: soundId, status: "stopped")
    }
    activeSoundId = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
  }

  private func emit(soundId: String, status: String, errorMessage: String? = nil) {
    var payload: [String: Any] = [
      "soundId": soundId,
      "status": status,
    ]
    payload["errorMessage"] = errorMessage ?? NSNull()
    onStateChanged?(payload)
  }
}

private final class PreviewPlayerDelegate: NSObject, AVAudioPlayerDelegate {
  static let shared = PreviewPlayerDelegate()
  weak var owner: PreviewPlayer?

  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    owner?.handleFinished()
  }
}
