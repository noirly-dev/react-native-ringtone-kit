import type {Sound, SoundProvider} from './types';

const providers = new Map<string, SoundProvider>();

/**
 * Register a JS-side custom sound provider.
 * Providers are composed into `getSounds('custom')` with zero native changes.
 */
export function registerSoundProvider(provider: SoundProvider): void {
  if (!provider.id) {
    throw Object.assign(new Error('SoundProvider.id is required'), {
      code: 'E_INVALID_ARGUMENT',
    });
  }
  providers.set(provider.id, provider);
}

/**
 * Remove a previously registered provider by id.
 */
export function unregisterSoundProvider(providerId: string): void {
  providers.delete(providerId);
}

/** @internal */
export function listProviders(): SoundProvider[] {
  return Array.from(providers.values());
}

/** @internal */
export function getProvider(providerId: string): SoundProvider | undefined {
  return providers.get(providerId);
}

/** @internal — clears registry between tests. */
export function clearProviders(): void {
  providers.clear();
}

/**
 * Namespace provider sound ids so they never collide across providers.
 */
export function namespacedSoundId(providerId: string, soundId: string): string {
  return `${providerId}::${soundId}`;
}

export function parseNamespacedSoundId(
  namespacedId: string,
): {providerId: string; soundId: string} | null {
  const separator = namespacedId.indexOf('::');
  if (separator <= 0) {
    return null;
  }
  return {
    providerId: namespacedId.slice(0, separator),
    soundId: namespacedId.slice(separator + 2),
  };
}

export async function collectProviderSounds(): Promise<Sound[]> {
  const results: Sound[] = [];
  for (const provider of providers.values()) {
    const sounds = await provider.getSounds();
    for (const sound of sounds) {
      results.push({
        ...sound,
        id: namespacedSoundId(provider.id, sound.id),
        category: 'custom',
        source: 'custom-provider',
      });
    }
  }
  return results;
}
