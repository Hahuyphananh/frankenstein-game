/**
 * Guarded persistence for player settings. Storage can be unavailable
 * (private mode, disabled cookies, quota), so every access is defensive.
 */

import { DEFAULT_SETTINGS, STORAGE_KEY, isDifficulty } from './config.js';

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      difficulty: isDifficulty(parsed?.difficulty) ? parsed.difficulty : DEFAULT_SETTINGS.difficulty,
      sound: typeof parsed?.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
      mapLayout:
        parsed?.mapLayout === 'full' || parsed?.mapLayout === 'windowed'
          ? parsed.mapLayout
          : DEFAULT_SETTINGS.mapLayout,
    };
  } catch (error) {
    console.warn('[FRANKENSTEIN] Settings could not be read, using defaults.', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        difficulty: settings.difficulty,
        sound: settings.sound,
        mapLayout: settings.mapLayout,
      }),
    );
  } catch (error) {
    console.warn('[FRANKENSTEIN] Settings could not be saved.', error);
  }
}
