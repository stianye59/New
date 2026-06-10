/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a duration in seconds into a friendly Japanese string like "3分45秒" or "1時間2分30秒".
 */
export function formatTimeJapanese(seconds: number): string {
  if (seconds <= 0) return '0秒';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}時間`);
  if (m > 0 || h > 0) parts.push(`${m}分`);
  if (s > 0 || parts.length === 0) parts.push(`${s}秒`);
  
  return parts.join('');
}

/**
 * Formats seconds to mm:ss or hh:mm:ss format for the digital stopwatch display.
 */
export function formatDigitalTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  const pad = (num: number) => num.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Parses minutes and seconds strings safely into total seconds.
 */
export function parseToSeconds(minutes: string, seconds: string): number {
  const mins = parseInt(minutes, 10) || 0;
  const secs = parseInt(seconds, 10) || 0;
  return mins * 60 + secs;
}
