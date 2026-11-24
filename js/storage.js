/**
 * Guarded persistence for player settings. Storage can be unavailable
 * (private mode, disabled cookies, quota), so every access is defensive.
 */

import {
  DEFAULT_SETTINGS,
  DIFFICULTY_ORDER,
  LEADERBOARD_KEY,
  LEADERBOARD_LIMIT,
  STORAGE_KEY,
  isDifficulty,
} from './config.js';

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    return {
      difficulty: isDifficulty(parsed?.difficulty)
        ? parsed.difficulty
        : DEFAULT_SETTINGS.difficulty,
      sound: typeof parsed?.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
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
      }),
    );
  } catch (error) {
    console.warn('[FRANKENSTEIN] Settings could not be saved.', error);
  }
}

function cleanText(value, maxLength = 80) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

/** One validated, immutable leaderboard entry. */
export function normalizeLeaderboardEntry(entry) {
  if (!entry || !isDifficulty(entry.difficulty)) return null;
  const timeMs = Number(entry.timeMs);
  const at = cleanText(entry.at, 40);
  if (!Number.isFinite(timeMs) || timeMs <= 0 || !Number.isFinite(Date.parse(at))) {
    return null;
  }

  return Object.freeze({
    difficulty: entry.difficulty,
    timeMs: Math.round(timeMs),
    characterId: cleanText(entry.characterId, 40),
    characterName: cleanText(entry.characterName, 80),
    mapId: cleanText(entry.mapId, 40),
    mapLabel: cleanText(entry.mapLabel, 80),
    at,
  });
}

function compareRuns(a, b) {
  return a.timeMs - b.timeMs || a.at.localeCompare(b.at);
}

/** Keep the fastest five entries for each difficulty. */
export function normalizeLeaderboard(value) {
  const entries = Array.isArray(value)
    ? value.map(normalizeLeaderboardEntry).filter(Boolean)
    : [];

  return DIFFICULTY_ORDER.flatMap((difficulty) =>
    entries
      .filter((entry) => entry.difficulty === difficulty)
      .sort(compareRuns)
      .slice(0, LEADERBOARD_LIMIT),
  );
}

/**
 * Insert a run and return the stored entry plus its rank on its difficulty
 * board. A run outside the top five is returned with rank 0 and is not stored.
 */
export function insertLeaderboardRun(runs, run, limit = LEADERBOARD_LIMIT) {
  const existing = normalizeLeaderboard(runs);
  const entry = normalizeLeaderboardEntry(run);
  if (!entry) {
    return { runs: existing, rank: 0, isBest: false, entry: null };
  }

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : LEADERBOARD_LIMIT;
  const sameBoard = [
    ...existing.filter((candidate) => candidate.difficulty === entry.difficulty),
    entry,
  ]
    .sort(compareRuns)
    .slice(0, safeLimit);
  const rank = sameBoard.indexOf(entry) + 1;
  const next = DIFFICULTY_ORDER.flatMap((difficulty) =>
    difficulty === entry.difficulty
      ? sameBoard
      : existing.filter((candidate) => candidate.difficulty === difficulty),
  );

  return {
    runs: next,
    rank,
    isBest: rank === 1,
    entry: rank > 0 ? entry : null,
  };
}

export function loadLeaderboard() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    return normalizeLeaderboard(JSON.parse(raw));
  } catch (error) {
    console.warn('[FRANKENSTEIN] Leaderboard could not be read.', error);
    return [];
  }
}

export function saveLeaderboard(runs) {
  try {
    window.localStorage.setItem(
      LEADERBOARD_KEY,
      JSON.stringify(normalizeLeaderboard(runs)),
    );
  } catch (error) {
    console.warn('[FRANKENSTEIN] Leaderboard could not be saved.', error);
  }
}

export function recordLeaderboardRun(run) {
  const result = insertLeaderboardRun(loadLeaderboard(), run);
  if (result.entry) saveLeaderboard(result.runs);
  return result;
}
