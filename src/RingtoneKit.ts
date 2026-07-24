import type {EventSubscription} from 'react-native';

import NativeRingtoneKit from './NativeRingtoneKit';
import {
  collectProviderSounds,
  getProvider,
  parseNamespacedSoundId,
} from './providers';
import {
  assertSoundCategory,
  refineCapabilitySound,
  refineCapabilitySounds,
  refinePreviewEvent,
  type CapabilityResult,
  type RingtoneKitEventMap,
  type RingtoneKitEventName,
  type Sound,
  type SoundCategory,
} from './types';

/**
 * Thin JS convenience layer over the generated TurboModule.
 * Owns provider composition and CapabilityResult refinement.
 */
class RingtoneKitImpl {
  private soundIndex = new Map<string, Sound>();

  private indexSounds(sounds: Sound[]): void {
    for (const sound of sounds) {
      this.soundIndex.set(sound.id, sound);
    }
  }

  /**
   * Subscribe to a native event with full payload type inference.
   *
   * @returns Unsubscribe function — call to remove the listener.
   */
  addListener<E extends RingtoneKitEventName>(
    eventName: E,
    callback: (payload: RingtoneKitEventMap[E]) => void,
  ): () => void {
    if (eventName === 'onPreviewStateChanged') {
      const emitter = NativeRingtoneKit.onPreviewStateChanged as {
        (
          listener: (payload: RingtoneKitEventMap['onPreviewStateChanged']) => void,
        ): EventSubscription;
      };
      const subscription = emitter(raw => {
        callback(
          refinePreviewEvent(raw) as RingtoneKitEventMap[E],
        );
      });
      return () => subscription.remove();
    }
    throw Object.assign(new Error(`Unknown event: ${String(eventName)}`), {
      code: 'E_INVALID_ARGUMENT',
    });
  }

  /**
   * Convenience alias matching the architecture doc's `addPreviewStateListener`.
   */
  addPreviewStateListener(
    callback: (event: RingtoneKitEventMap['onPreviewStateChanged']) => void,
  ): {remove: () => void} {
    const remove = this.addListener('onPreviewStateChanged', callback);
    return {remove};
  }

  async getSounds(
    category: SoundCategory,
  ): Promise<CapabilityResult<Sound[]>> {
    assertSoundCategory(category);

    if (category === 'custom') {
      const native = refineCapabilitySounds(
        await NativeRingtoneKit.getSounds('custom'),
      );
      const nativeSounds =
        native.status === 'available' ? native.data : ([] as Sound[]);
      const providerSounds = await collectProviderSounds();
      const merged = [...nativeSounds, ...providerSounds];
      this.indexSounds(merged);
      return {status: 'available', data: merged};
    }

    const result = refineCapabilitySounds(
      await NativeRingtoneKit.getSounds(category),
    );
    if (result.status === 'available') {
      this.indexSounds(result.data);
    }
    return result;
  }

  async openSystemPicker(
    category: SoundCategory,
  ): Promise<CapabilityResult<Sound | null>> {
    assertSoundCategory(category);
    const result = refineCapabilitySound(
      await NativeRingtoneKit.openSystemPicker(category),
    );
    if (result.status === 'available' && result.data != null) {
      this.indexSounds([result.data]);
    }
    return result;
  }

  async getSelectedSound(
    category: SoundCategory,
  ): Promise<CapabilityResult<Sound | null>> {
    assertSoundCategory(category);
    const result = refineCapabilitySound(
      await NativeRingtoneKit.getSelectedSound(category),
    );
    if (result.status === 'available' && result.data != null) {
      this.indexSounds([result.data]);
    }
    return result;
  }

  async previewSound(soundId: string): Promise<void> {
    if (!soundId) {
      throw Object.assign(new Error('soundId is required'), {
        code: 'E_INVALID_ARGUMENT',
      });
    }

    const uri = await this.resolveUri(soundId);
    await NativeRingtoneKit.previewSound(soundId, uri);
  }

  stopPreview = NativeRingtoneKit.stopPreview.bind(NativeRingtoneKit);

  private async resolveUri(soundId: string): Promise<string> {
    const cached = this.soundIndex.get(soundId);
    if (cached?.uri) {
      return cached.uri;
    }

    const namespaced = parseNamespacedSoundId(soundId);
    if (namespaced != null) {
      const provider = getProvider(namespaced.providerId);
      if (provider == null) {
        throw Object.assign(
          new Error(`Provider not found: ${namespaced.providerId}`),
          {code: 'E_SOUND_NOT_FOUND'},
        );
      }
      return provider.getSoundUri(namespaced.soundId);
    }

    throw Object.assign(new Error(`Sound not found: ${soundId}`), {
      code: 'E_SOUND_NOT_FOUND',
    });
  }
}

/** Public singleton instance. */
export const RingtoneKit = new RingtoneKitImpl();
