package com.noirly.ringtonekit

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

object RingtoneKitScope {
  val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}
