import { DIFFICULTIES } from './config.js';
import { drawCastPortrait } from './sprites.js';
import { formatTime } from './timer.js';

/**
 * DOM controller for the menu, stage shell and instructions dialog.
 * It knows nothing about game rules — callbacks are supplied by the Game.
 */
export class MenuView {
  constructor(handlers = {}) {
    this.handlers = handlers;

    const byId = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`MenuView: missing #${id}.`);
      return element;
    };

    this.screens = {
      menu: byId('screen-menu'),
      stage: byId('screen-stage'),
    };
    this.playButton = byId('btn-play');
    this.instructionsButton = byId('btn-instructions');
    this.difficultyHint = byId('difficulty-hint');
    this.difficultyChip = byId('stage-difficulty');
    this.mapLayoutButton = byId('btn-map-layout');
    this.dialog = byId('instructions-dialog');
    this.radios = [...document.querySelectorAll('input[name="difficulty"]')];
    this.soundButtons = [...document.querySelectorAll('[data-sound-toggle]')];
    this.soundLabels = [...document.querySelectorAll('[data-sound-label]')];
    this.creatureLives = byId('stage-lives');
    this.lifePips = [...this.creatureLives.querySelectorAll('.lives__pip')];
    this.lifeCount = byId('stage-lives-count');
    this.stageResult = byId('stage-result');
    this.playAgainButton = byId('btn-play-again');
    this.resultLabel = byId('result-label');
    this.resultTimeLabel = byId('result-time-label');
    this.resultTime = byId('result-time');
    this.resultStarsGroup = byId('result-stars');
    this.resultEpilogue = byId('result-epilogue');
    this.resultStars = [...this.resultStarsGroup.querySelectorAll('.star')];
    this.pauseOverlay = byId('stage-pause');
    this.resumeButton = byId('btn-resume');
    this.timerElement = byId('stage-timer');
    this.timerValue = byId('stage-timer-value');
    this.castPortraits = [...document.querySelectorAll('[data-cast]')];

    this.bind(byId);
    this.castPortraits.forEach((canvas) => drawCastPortrait(canvas, canvas.dataset.cast));
  }

  bind(byId) {
    const handlers = this.handlers;

    this.playButton.addEventListener('click', () => handlers.onPlay?.());
    this.playAgainButton.addEventListener('click', () => handlers.onPlayAgain?.());
    byId('btn-result-menu').addEventListener('click', () => handlers.onBack?.());
    this.resumeButton.addEventListener('click', () => handlers.onResume?.());
    byId('btn-pause-restart').addEventListener('click', () => handlers.onPlayAgain?.());
    byId('btn-pause-menu').addEventListener('click', () => handlers.onBack?.());
    byId('btn-back').addEventListener('click', () => handlers.onBack?.());
    this.instructionsButton.addEventListener('click', () => handlers.onInstructions?.());
    this.mapLayoutButton.addEventListener('click', () => handlers.onMapLayout?.());
    byId('btn-close-instructions').addEventListener('click', () => this.dialog.close());
    byId('btn-close-instructions-2').addEventListener('click', () => this.dialog.close());

    this.radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) handlers.onDifficulty?.(radio.value);
      });
    });

    this.soundButtons.forEach((button) => {
      button.addEventListener('click', () => handlers.onSound?.());
    });

    this.dialog.addEventListener('close', () => handlers.onInstructionsClosed?.());
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
  }

  applySettings(settings) {
    this.radios.forEach((radio) => {
      radio.checked = radio.value === settings.difficulty;
    });
    this.setDifficulty(settings.difficulty);
    this.setSound(settings.sound);
    this.setMapLayout(settings.mapLayout);
  }

  setMapLayout(layout) {
    const full = layout === 'full';
    document.body.dataset.mapLayout = full ? 'full' : 'windowed';
    this.mapLayoutButton.textContent = full ? 'Windowed' : 'Fullscreen';
    this.mapLayoutButton.setAttribute('aria-pressed', String(full));
    this.mapLayoutButton.setAttribute(
      'aria-label',
      full ? 'Switch to windowed map' : 'Switch to full-screen map',
    );
  }

  setDifficulty(id) {
    const difficulty = DIFFICULTIES[id];
    if (!difficulty) return;
    this.difficultyHint.textContent = difficulty.hint;
    this.difficultyChip.textContent = difficulty.label;
    this.difficultyChip.dataset.level = difficulty.id;
  }

  setCreatureLives(lives, maxLives) {
    if (this.lifePips.length !== maxLives) {
      const container = this.creatureLives.querySelector('.lives__pips');
      container.replaceChildren(
        ...Array.from({ length: maxLives }, () => {
          const pip = document.createElement('i');
          pip.className = 'lives__pip';
          return pip;
        }),
      );
      this.lifePips = [...container.children];
    }

    const previous = Number(this.creatureLives.dataset.lives);
    const remaining = Math.max(0, Math.min(lives, maxLives));
    this.lifePips.forEach((pip, index) => {
      pip.classList.toggle('is-lost', index >= remaining);
    });
    this.lifeCount.textContent = String(remaining);

    if (Number.isFinite(previous) && remaining < previous) {
      this.creatureLives.classList.remove('is-hit');
      void this.creatureLives.offsetWidth;
      this.creatureLives.classList.add('is-hit');
      window.clearTimeout(this.lifeHitTimer);
      this.lifeHitTimer = window.setTimeout(
        () => this.creatureLives.classList.remove('is-hit'),
        520,
      );
    }

    this.creatureLives.dataset.lives = String(remaining);
    this.creatureLives.setAttribute(
      'aria-label',
      `Creature lives remaining: ${remaining} of ${maxLives}`,
    );
  }

  setTimer(remainingSeconds, limitSeconds) {
    this.timerValue.textContent = formatTime(remainingSeconds);
    this.timerElement.classList.toggle(
      'is-urgent',
      remainingSeconds > 0 && remainingSeconds <= 10,
    );
    this.timerElement.setAttribute(
      'aria-label',
      `Time remaining: ${formatTime(remainingSeconds)} of ${formatTime(limitSeconds)}`,
    );
  }

  showPause() {
    this.pauseOverlay.hidden = false;
    window.requestAnimationFrame(() => this.resumeButton.focus({ preventScroll: true }));
  }

  hidePause() {
    this.pauseOverlay.hidden = true;
  }

  showStageResult({ outcome = 'won', elapsedMs = 0, stars = 0, story = null } = {}) {
    const lost = outcome === 'lost';
    const title = this.stageResult.querySelector('#stage-result-title');
    const copy = this.stageResult.querySelector('#stage-result-copy');

    if (story) {
      this.resultLabel.textContent = story.label;
      title.textContent = story.title;
      copy.textContent = story.copy;
      this.resultEpilogue.textContent = story.epilogue ?? '';
      this.resultEpilogue.hidden = !story.epilogue;
    } else {
      this.resultLabel.textContent = lost ? 'Time expired' : 'Experiment complete';
      title.textContent = lost ? 'The Creature escaped.' : 'Victor wins.';
      copy.textContent = lost
        ? 'Victor ran out of time. The Creature slips back into the laboratory corridors.'
        : "All three of the Creature's lives are spent and the specimen is secured.";
      this.resultEpilogue.textContent = '';
      this.resultEpilogue.hidden = true;
    }

    this.resultTimeLabel.textContent = lost ? 'Time survived' : 'Time taken';
    this.resultTime.textContent = formatTime(elapsedMs / 1000);
    this.resultStars.forEach((star, index) => {
      star.classList.toggle('is-earned', index < stars);
    });
    this.resultStarsGroup.setAttribute('aria-label', `${stars} of 3 stars`);
    this.playAgainButton.textContent = 'Restart';
    this.stageResult.hidden = false;
    window.requestAnimationFrame(() => this.playAgainButton.focus({ preventScroll: true }));
  }

  hideStageResult() {
    this.stageResult.hidden = true;
  }

  setSound(enabled) {
    this.soundLabels.forEach((label) => {
      label.textContent = enabled ? 'Sound on' : 'Sound off';
    });
    this.soundButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(enabled));
      button.classList.toggle('is-muted', !enabled);
    });
  }

  showScreen(name) {
    for (const [key, element] of Object.entries(this.screens)) {
      element.hidden = key !== name;
    }
    document.body.dataset.screen = name;

    const target = name === 'stage' ? this.screens.stage : this.playButton;
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }

  openInstructions() {
    if (!this.dialog.open) this.dialog.showModal();
  }

  closeInstructions() {
    if (this.dialog.open) this.dialog.close();
  }

  isDialogOpen() {
    return this.dialog.open;
  }
}
