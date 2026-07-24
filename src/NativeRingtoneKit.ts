import type {TurboModule} from 'react-native';
import type {EventEmitter} from 'react-native/Libraries/Types/CodegenTypes';
import {TurboModuleRegistry} from 'react-native';

/**
 * Codegen-legal sound shape (Layer 1).
 * Richer discriminated unions live in the public Layer 2 API.
 */
export interface NativeSound {
  id: string;
  title: string;
  category: string;
  uri: string;
  durationMs?: number | null;
  isSystemDefault?: boolean | null;
  source: string;
}

/**
 * Flat capability result for sound lists — Codegen cannot express rich unions.
 */
export interface NativeCapabilitySounds {
  status: string;
  reason?: string | null;
  permission?: string | null;
  data?: ReadonlyArray<NativeSound> | null;
}

/**
 * Flat capability result for a single sound (picker / default).
 */
export interface NativeCapabilitySound {
  status: string;
  reason?: string | null;
  permission?: string | null;
  data?: NativeSound | null;
}

export interface NativePreviewStateEvent {
  soundId: string;
  status: string;
  errorMessage?: string | null;
}

export interface Spec extends TurboModule {
  getSounds(category: string): Promise<NativeCapabilitySounds>;
  openSystemPicker(category: string): Promise<NativeCapabilitySound>;
  getSelectedSound(category: string): Promise<NativeCapabilitySound>;
  /** Preview by URI; soundId is echoed in preview events. */
  previewSound(soundId: string, uri: string): Promise<void>;
  stopPreview(): Promise<void>;

  readonly onPreviewStateChanged: EventEmitter<NativePreviewStateEvent>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRingtoneKit');
