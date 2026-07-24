package com.noirly.ringtonekit.catalog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SoundMapperTest {
  @Test
  fun mapsKnownCategoriesToRingtoneTypes() {
    assertEquals(android.media.RingtoneManager.TYPE_RINGTONE, SoundMapper.ringtoneType("ringtone"))
    assertEquals(android.media.RingtoneManager.TYPE_NOTIFICATION, SoundMapper.ringtoneType("notification"))
    assertEquals(android.media.RingtoneManager.TYPE_ALARM, SoundMapper.ringtoneType("alarm"))
    assertNull(SoundMapper.ringtoneType("custom"))
    assertNull(SoundMapper.ringtoneType("unknown"))
  }
}
