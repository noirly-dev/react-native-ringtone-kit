import type {
  NativeCapabilitySound,
  NativeCapabilitySounds,
  NativeSound,
} from './NativeRingtoneKit';

export type SoundCategory = 'ringtone' | 'notification' | 'alarm' | 'custom';

export type SoundSource = 'system' | 'bundled' | 'custom-provider';

export interface Sound {
  id: string;
  title: string;
  category: SoundCategory;
  uri: string;
  durationMs?: number;
  isSystemDefault?: boolean;
  source: SoundSource;
}

export type CapabilityResult<T> =
  | {status: 'available'; data: T}
  | {status: 'unsupported'; reason: string}
  | {status: 'permission-required'; permission: string};

export type PreviewPlaybackStatus =
  | 'started'
  | 'completed'
  | 'stopped'
  | 'error';

export interface PreviewStateEvent {
  soundId: string;
  status: PreviewPlaybackStatus;
  errorMessage?: string;
}

export type RingtoneKitErrorCode =
  | 'E_INVALID_ARGUMENT'
  | 'E_SOUND_NOT_FOUND'
  | 'E_PLAYBACK_FAILED'
  | 'E_NATIVE_MODULE_UNAVAILABLE'
  | 'E_UNKNOWN';

export interface RingtoneKitErrorUserInfo {
  code: RingtoneKitErrorCode;
  nativeMessage?: string | null;
}

export type RingtoneKitEventName = 'onPreviewStateChanged';

export interface RingtoneKitEventMap {
  onPreviewStateChanged: PreviewStateEvent;
}

export interface SoundProvider {
  id: string;
  getSounds(): Promise<Sound[]>;
  getSoundUri(soundId: string): Promise<string>;
}

const SOUND_CATEGORIES: readonly SoundCategory[] = [
  'ringtone',
  'notification',
  'alarm',
  'custom',
] as const;

const SOUND_SOURCES: readonly SoundSource[] = [
  'system',
  'bundled',
  'custom-provider',
] as const;

const PREVIEW_STATUSES: readonly PreviewPlaybackStatus[] = [
  'started',
  'completed',
  'stopped',
  'error',
] as const;

export function isSoundCategory(value: string): value is SoundCategory {
  return (SOUND_CATEGORIES as readonly string[]).includes(value);
}

export function assertSoundCategory(category: string): SoundCategory {
  if (!isSoundCategory(category)) {
    throw Object.assign(new Error(`Invalid sound category: ${category}`), {
      code: 'E_INVALID_ARGUMENT' satisfies RingtoneKitErrorCode,
    });
  }
  return category;
}

function asSoundSource(value: string): SoundSource {
  if ((SOUND_SOURCES as readonly string[]).includes(value)) {
    return value as SoundSource;
  }
  return 'system';
}

function asSoundCategory(value: string): SoundCategory {
  if (isSoundCategory(value)) {
    return value;
  }
  return 'custom';
}

export function fromNativeSound(native: NativeSound): Sound {
  const sound: Sound = {
    id: native.id,
    title: native.title,
    category: asSoundCategory(native.category),
    uri: native.uri,
    source: asSoundSource(native.source),
  };
  if (native.durationMs != null) {
    sound.durationMs = native.durationMs;
  }
  if (native.isSystemDefault != null) {
    sound.isSystemDefault = native.isSystemDefault;
  }
  return sound;
}

export function refineCapabilitySounds(
  raw: NativeCapabilitySounds,
): CapabilityResult<Sound[]> {
  if (raw.status === 'unsupported') {
    return {status: 'unsupported', reason: raw.reason ?? 'Unsupported'};
  }
  if (raw.status === 'permission-required') {
    return {
      status: 'permission-required',
      permission: raw.permission ?? 'unknown',
    };
  }
  return {
    status: 'available',
    data: (raw.data ?? []).map(fromNativeSound),
  };
}

export function refineCapabilitySound(
  raw: NativeCapabilitySound,
): CapabilityResult<Sound | null> {
  if (raw.status === 'unsupported') {
    return {status: 'unsupported', reason: raw.reason ?? 'Unsupported'};
  }
  if (raw.status === 'permission-required') {
    return {
      status: 'permission-required',
      permission: raw.permission ?? 'unknown',
    };
  }
  return {
    status: 'available',
    data: raw.data != null ? fromNativeSound(raw.data) : null,
  };
}

export function refinePreviewEvent(raw: {
  soundId: string;
  status: string;
  errorMessage?: string | null;
}): PreviewStateEvent {
  const status = (PREVIEW_STATUSES as readonly string[]).includes(raw.status)
    ? (raw.status as PreviewPlaybackStatus)
    : 'error';
  const event: PreviewStateEvent = {
    soundId: raw.soundId,
    status,
  };
  if (raw.errorMessage != null) {
    event.errorMessage = raw.errorMessage;
  }
  return event;
}
