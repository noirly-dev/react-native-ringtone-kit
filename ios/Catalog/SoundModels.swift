import Foundation

struct SoundRecord {
  let id: String
  let title: String
  let category: String
  let uri: String
  let durationMs: Double?
  let isSystemDefault: Bool
  let source: String

  func toDictionary() -> [String: Any] {
    var map: [String: Any] = [
      "id": id,
      "title": title,
      "category": category,
      "uri": uri,
      "isSystemDefault": isSystemDefault,
      "source": source,
    ]
    if let durationMs {
      map["durationMs"] = durationMs
    } else {
      map["durationMs"] = NSNull()
    }
    return map
  }
}

enum CapabilityMapper {
  static func availableSounds(_ data: [SoundRecord]) -> [String: Any] {
    [
      "status": "available",
      "reason": NSNull(),
      "permission": NSNull(),
      "data": data.map { $0.toDictionary() },
    ]
  }

  static func unsupportedSounds(_ reason: String) -> [String: Any] {
    [
      "status": "unsupported",
      "reason": reason,
      "permission": NSNull(),
      "data": NSNull(),
    ]
  }

  static func availableSound(_ data: SoundRecord?) -> [String: Any] {
    [
      "status": "available",
      "reason": NSNull(),
      "permission": NSNull(),
      "data": data?.toDictionary() ?? NSNull(),
    ]
  }

  static func unsupportedSound(_ reason: String) -> [String: Any] {
    [
      "status": "unsupported",
      "reason": reason,
      "permission": NSNull(),
      "data": NSNull(),
    ]
  }
}
