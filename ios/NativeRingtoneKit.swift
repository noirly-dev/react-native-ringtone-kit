import Foundation

@objc(NativeRingtoneKit)
class NativeRingtoneKit: NativeRingtoneKitSpec {
  private let catalog = BundledSoundCatalog.shared

  override init() {
    super.init()
    PreviewPlayer.shared.onStateChanged = { [weak self] payload in
      self?.emitOnPreviewStateChanged(payload)
    }
  }

  @objc override func getSounds(
    _ category: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    switch category {
    case "ringtone", "notification", "alarm":
      resolve(
        CapabilityMapper.unsupportedSounds(
          "iOS has no public API to enumerate system \(category) sounds"
        )
      )
    case "custom":
      resolve(CapabilityMapper.availableSounds(catalog.getCustomSounds()))
    default:
      reject(
        RingtoneKitErrorCode.invalidArgument.rawValue,
        "Invalid sound category: \(category)",
        nil
      )
    }
  }

  @objc override func openSystemPicker(
    _ category: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(
      CapabilityMapper.unsupportedSound(
        "iOS has no system sound picker; use getSounds() with a custom UI"
      )
    )
  }

  @objc override func getSelectedSound(
    _ category: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(
      CapabilityMapper.unsupportedSound(
        "iOS has no public API for the selected system \(category) sound"
      )
    )
  }

  @objc override func previewSound(
    _ soundId: String,
    uri: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      try PreviewPlayer.shared.play(soundId: soundId, uriString: uri)
      resolve(nil)
    } catch let error as RingtoneKitError {
      reject(error.code.rawValue, error.message, error as NSError)
    } catch {
      reject(RingtoneKitErrorCode.unknown.rawValue, error.localizedDescription, error)
    }
  }

  @objc override func stopPreview(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    PreviewPlayer.shared.stop()
    resolve(nil)
  }
}
