/** Metro·adb logcat에서 `[DART]`로 필터링 */
const TAG = '[DART]';

export function dartTrace(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) {
    console.warn(TAG, message, data);
  } else {
    console.warn(TAG, message);
  }
}
