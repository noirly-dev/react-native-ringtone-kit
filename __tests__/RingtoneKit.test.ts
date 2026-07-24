import {
  RINGTONEKIT_ERROR_CODES,
  RingtoneKit,
  isRingtoneKitError,
  isRingtoneKitErrorCode,
  registerSoundProvider,
  unregisterSoundProvider,
} from '../src';
import {clearProviders} from '../src/providers';
import NativeRingtoneKit from '../src/NativeRingtoneKit';

describe('errors', () => {
  it('recognizes RingtoneKit errors by code', () => {
    const error = Object.assign(new Error('missing'), {
      code: 'E_SOUND_NOT_FOUND',
    });
    expect(isRingtoneKitError(error)).toBe(true);
    expect(isRingtoneKitErrorCode(error, 'E_SOUND_NOT_FOUND')).toBe(true);
  });

  it('exports all documented error codes', () => {
    expect(RINGTONEKIT_ERROR_CODES).toContain('E_INVALID_ARGUMENT');
    expect(RINGTONEKIT_ERROR_CODES).toHaveLength(5);
  });
});

describe('RingtoneKit wrapper', () => {
  beforeEach(() => {
    clearProviders();
    jest.clearAllMocks();
  });

  it('exposes catalog and preview methods', () => {
    expect(typeof RingtoneKit.getSounds).toBe('function');
    expect(typeof RingtoneKit.previewSound).toBe('function');
    expect(typeof RingtoneKit.addListener).toBe('function');
    expect(typeof RingtoneKit.addPreviewStateListener).toBe('function');
  });

  it('merges custom provider sounds into getSounds(custom)', async () => {
    registerSoundProvider({
      id: 'demo.pack',
      getSounds: async () => [
        {
          id: 'chime',
          title: 'Chime',
          category: 'custom',
          uri: 'file:///chime.m4a',
          source: 'custom-provider',
        },
      ],
      getSoundUri: async () => 'file:///chime.m4a',
    });

    (NativeRingtoneKit.getSounds as jest.Mock).mockResolvedValueOnce({
      status: 'available',
      data: [],
    });

    const result = await RingtoneKit.getSounds('custom');
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('demo.pack::chime');
      expect(result.data[0].source).toBe('custom-provider');
    }

    unregisterSoundProvider('demo.pack');
  });

  it('resolves provider URI when previewing a namespaced sound', async () => {
    registerSoundProvider({
      id: 'demo.pack',
      getSounds: async () => [
        {
          id: 'chime',
          title: 'Chime',
          category: 'custom',
          uri: 'file:///chime.m4a',
          source: 'custom-provider',
        },
      ],
      getSoundUri: async id => `file:///${id}.m4a`,
    });

    await RingtoneKit.previewSound('demo.pack::chime');
    expect(NativeRingtoneKit.previewSound).toHaveBeenCalledWith(
      'demo.pack::chime',
      'file:///chime.m4a',
    );
  });
});
