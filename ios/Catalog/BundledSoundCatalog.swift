import Foundation

/// Enumerates app-bundled custom sounds from the main bundle / Library/Sounds.
final class BundledSoundCatalog {
  static let shared = BundledSoundCatalog()

  private let queue = DispatchQueue(label: "com.noirly.ringtonekit.catalog")

  func getCustomSounds() -> [SoundRecord] {
    queue.sync {
      var results: [SoundRecord] = []
      let extensions = ["caf", "m4a", "wav", "aiff", "aif", "mp3"]

      if let urls = Bundle.main.urls(forResourcesWithExtension: nil, subdirectory: nil) {
        for url in urls where extensions.contains(url.pathExtension.lowercased()) {
          results.append(makeRecord(url: url, source: "bundled"))
        }
      }

      let librarySounds = FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)
        .first?
        .appendingPathComponent("Sounds", isDirectory: true)
      if let librarySounds,
         let contents = try? FileManager.default.contentsOfDirectory(
           at: librarySounds,
           includingPropertiesForKeys: nil
         ) {
        for url in contents where extensions.contains(url.pathExtension.lowercased()) {
          results.append(makeRecord(url: url, source: "bundled"))
        }
      }

      return results
    }
  }

  private func makeRecord(url: URL, source: String) -> SoundRecord {
    SoundRecord(
      id: url.absoluteString,
      title: url.deletingPathExtension().lastPathComponent,
      category: "custom",
      uri: url.absoluteString,
      durationMs: nil,
      isSystemDefault: false,
      source: source
    )
  }
}
