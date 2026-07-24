import type {RingtoneKitErrorCode, RingtoneKitErrorUserInfo} from './types';

/** All known error codes for exhaustiveness checks. */
export const RINGTONEKIT_ERROR_CODES: readonly RingtoneKitErrorCode[] = [
  'E_INVALID_ARGUMENT',
  'E_SOUND_NOT_FOUND',
  'E_PLAYBACK_FAILED',
  'E_NATIVE_MODULE_UNAVAILABLE',
  'E_UNKNOWN',
] as const;

/**
 * Typed error shape surfaced to JS consumers via Promise rejection.
 */
export interface RingtoneKitError extends Error {
  code: RingtoneKitErrorCode;
  nativeMessage?: string;
  userInfo?: RingtoneKitErrorUserInfo;
}

/**
 * Type guard for distinguishing RingtoneKit errors from generic failures.
 */
export function isRingtoneKitError(error: unknown): error is RingtoneKitError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as Partial<RingtoneKitError>;
  return (
    typeof candidate.code === 'string' &&
    RINGTONEKIT_ERROR_CODES.includes(candidate.code as RingtoneKitErrorCode)
  );
}

/**
 * Narrows a caught error to a specific RingtoneKit error code.
 */
export function isRingtoneKitErrorCode<C extends RingtoneKitErrorCode>(
  error: unknown,
  code: C,
): error is RingtoneKitError & {code: C} {
  return isRingtoneKitError(error) && error.code === code;
}
