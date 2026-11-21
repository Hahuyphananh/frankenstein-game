import { AudioBus } from './audio.js';
import { Game } from './game.js';
import { Keyboard } from './input.js';
import { MAZE } from './maze.js';
import { StageRenderer } from './renderer.js';
import { loadSettings, saveSettings } from './storage.js';

function boot() {
  const canvas = document.getElementById('stage-canvas');
  if (!canvas) throw new Error('Missing #stage-canvas.');

  const settings = loadSettings();
  const audio = new AudioBus({ enabled: settings.sound });
  const keyboard = new Keyboard();
  const renderer = new StageRenderer(canvas, { maze: MAZE });
  const game = new Game({
    settings,
    audio,
    renderer,
    keyboard,
    maze: MAZE,
    persist: saveSettings,
  });

  game.init();

  // Opt-in handle for automated checks; never exposed for normal play.
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.__FRANKENSTEIN_GAME__ = game;
  }

  document.documentElement.dataset.app = 'ready';
}

try {
  boot();
} catch (error) {
  document.documentElement.dataset.app = 'error';
  console.error('[FRANKENSTEIN] Failed to start.', error);
  throw error;
}
