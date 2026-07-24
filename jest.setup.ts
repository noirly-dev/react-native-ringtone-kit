jest.mock('./src/NativeRingtoneKit', () => ({
  __esModule: true,
  default: {
    getSounds: jest.fn(async () => ({
      status: 'available',
      data: [],
    })),
    openSystemPicker: jest.fn(async () => ({
      status: 'unsupported',
      reason: 'mock',
    })),
    getSelectedSound: jest.fn(async () => ({
      status: 'unsupported',
      reason: 'mock',
    })),
    previewSound: jest.fn(async () => undefined),
    stopPreview: jest.fn(async () => undefined),
    onPreviewStateChanged: jest.fn(() => ({remove: jest.fn()})),
  },
}));
