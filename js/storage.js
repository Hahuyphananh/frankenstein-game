/**
 * Guarded, offline persistence. Settings, the player's name and the three
 * difficulty boards are stored in cookies; old localStorage data is read once
 * and migrated so existing local records are not lost.
 */

import {
  DEFAULT_SETTINGS,
  DIFFICULTY_ORDER,
  LEADERBOARD_COOKIE_PREFIX,
  LEADERBOARD_LIMIT,
  LEGACY_LEADERBOARD_KEY,
  LEGACY_SETTINGS_KEY,
  PLAYER_NAME_COOKIE,
  SETTINGS_COOKIE,
  isDifficulty,
  sanitizePlayerName,
} from './config.js';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function cookieSuffix() {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  return `Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function readCookie(name) {
  try {
    if (typeof document === 'undefined' || typeof document.cookie !== 'string') return null;
    const prefix = `${name}=`;
    const part = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : null;
  } catch (error) {
    console.warn('[FRANKENSTEIN] Cookie could not be read.', error);
    return null;
  }
}

function writeCookie(name, value) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; ${cookieSuffix()}`;
    return true;
  } catch (error) {
    console.warn('[FRANKENSTEIN] Cookie could not be saved.', error);
    return false;
  }
}

function readLegacyStorage(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function leaderboardCookie(difficulty) {
  return `${LEADERBOARD_COOKIE_PREFIX}${difficulty}`;
}

export function loadSettings() {
  const raw = readCookie(SETTINGS_COOKIE) ?? readLegacyStorage(LEGACY_SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(raw);
    const settings = {
      difficulty: isDifficulty(parsed?.difficulty)
        ? parsed.difficulty
        : DEFAULT_SETTINGS.difficulty,
      sound: typeof parsed?.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
    };
    if (readCookie(SETTINGS_COOKIE) === null) saveSettings(settings);
    return settings;
  } catch (error) {
    console.warn('[FRANKENSTEIN] Settings could not be read, using defaults.', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  writeCookie(
    SETTINGS_COOKIE,
    JSON.stringify({
      difficulty: settings.difficulty,
      sound: settings.sound,
    }),
  );
}

/** Null means no name has been saved yet, so the game should ask before playing. */
export function loadPlayerName() {
  const raw = readCookie(PLAYER_NAME_COOKIE);
  if (!raw) return null;
  return sanitizePlayerName(raw);
}

export function savePlayerName(name) {
  const safeName = sanitizePlayerName(name);
  writeCookie(PLAYER_NAME_COOKIE, safeName);
  return safeName;
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
    name: sanitizePlayerName(entry.name),
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
  let foundCookie = false;
  const entries = [];

  for (const difficulty of DIFFICULTY_ORDER) {
    const raw = readCookie(leaderboardCookie(difficulty));
    if (raw === null) continue;
    foundCookie = true;
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) entries.push(...parsed);
    } catch (error) {
      console.warn(`[FRANKENSTEIN] ${difficulty} records could not be read.`, error);
    }
  }

  if (foundCookie) return normalizeLeaderboard(entries);

  const legacy = readLegacyStorage(LEGACY_LEADERBOARD_KEY);
  if (!legacy) return [];

  try {
    const migrated = normalizeLeaderboard(JSON.parse(legacy));
    saveLeaderboard(migrated);
    return migrated;
  } catch (error) {
    console.warn('[FRANKENSTEIN] Legacy leaderboard could not be migrated.', error);
    return [];
  }
}

export function saveLeaderboard(runs) {
  const normalized = normalizeLeaderboard(runs);
  for (const difficulty of DIFFICULTY_ORDER) {
    writeCookie(
      leaderboardCookie(difficulty),
      JSON.stringify(normalized.filter((entry) => entry.difficulty === difficulty)),
    );
  }
}

export function recordLeaderboardRun(run) {
  const result = insertLeaderboardRun(loadLeaderboard(), run);
  if (result.entry) saveLeaderboard(result.runs);
  return result;
}

/** Fastest stored time for one difficulty, used by the live HUD comparison. */
export function fastestTimeForDifficulty(runs, difficulty) {
  const entries = normalizeLeaderboard(runs).filter(
    (entry) => entry.difficulty === difficulty,
  );
  return entries.length ? entries[0].timeMs : null;
}
