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
    this.powerElement = byId('stage-power');
    this.powerValue = byId('stage-power-value');
    this.powerFill = byId('stage-power-fill');
    this.wallState = byId('stage-wall-state');
    this.powerKey = '';
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
    this.mapLayoutButton.textContent = full ? 'Fenêtré' : 'Plein écran';
    this.mapLayoutButton.setAttribute('aria-pressed', String(full));
    this.mapLayoutButton.setAttribute(
      'aria-label',
      full ? 'Passer à la carte en fenêtre' : 'Passer à la carte plein écran',
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
      `Vies restantes de la Créature : ${remaining} sur ${maxLives}`,
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
      `Temps restant : ${formatTime(remainingSeconds)} sur ${formatTime(limitSeconds)}`,
    );
  }

  setCreaturePower({
    cooldown = 0,
    limit = 0,
    dashing = false,
    canBreakWalls = false,
    wallBreakAvailable = false,
    wallBreakPerLife = false,
  } = {}) {
    const remaining = Math.max(0, cooldown);
    const progress = dashing
      ? 1
      : limit > 0
        ? Math.max(0, Math.min(1, 1 - remaining / limit))
        : 1;
    const value = dashing ? 'Active' : remaining > 0.05 ? `${Math.ceil(remaining)} s` : 'Prêt';
    const state = dashing ? 'active' : remaining > 0.05 ? 'cooling' : 'ready';
    const wallText = wallBreakAvailable ? 'Mur : prêt' : 'Mur : utilisé';
    const key = `${value}|${state}|${Math.round(progress * 25)}|${canBreakWalls}|${wallText}`;
    if (key === this.powerKey) return;
    this.powerKey = key;

    this.powerValue.textContent = value;
    this.powerFill.style.width = `${Math.round(progress * 100)}%`;
    this.powerElement.classList.toggle('is-ready', state === 'ready');
    this.powerElement.classList.toggle('is-cooling', state === 'cooling');
    this.powerElement.classList.toggle('is-active', state === 'active');
    this.powerElement.setAttribute(
      'aria-label',
      canBreakWalls
        ? `Ruée de la Créature : ${value.toLowerCase()}. ${wallText}.`
        : `Ruée de la Créature : ${value.toLowerCase()}.`,
    );

    this.wallState.hidden = !canBreakWalls;
    if (canBreakWalls) {
      this.wallState.textContent = wallText;
      this.wallState.classList.toggle('is-spent', !wallBreakAvailable);
      this.wallState.title = wallBreakPerLife
        ? 'Un mur peut être brisé par vie en mode Difficile.'
        : 'Disponible à la prochaine ruée.';
    }
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
      this.resultLabel.textContent = lost ? 'Temps écoulé' : 'Expérience terminée';
      title.textContent = lost ? 'La Créature s’est échappée.' : 'Victor gagne.';
      copy.textContent = lost
        ? 'Victor n’a plus de temps. La Créature se glisse hors des ruelles du laboratoire.'
        : 'Les trois vies de la Créature sont épuisées et le spécimen est maîtrisé.';
      this.resultEpilogue.textContent = '';
      this.resultEpilogue.hidden = true;
    }

    this.resultTimeLabel.textContent = lost ? 'Temps survécu' : 'Temps réalisé';
    this.resultTime.textContent = formatTime(elapsedMs / 1000);
    this.resultStars.forEach((star, index) => {
      star.classList.toggle('is-earned', index < stars);
    });
    this.resultStarsGroup.setAttribute('aria-label', `${stars} étoiles sur 3`);
    this.playAgainButton.textContent = 'Recommencer';
    this.stageResult.hidden = false;
    window.requestAnimationFrame(() => this.playAgainButton.focus({ preventScroll: true }));
  }

  hideStageResult() {
    this.stageResult.hidden = true;
  }

  setSound(enabled) {
    this.soundLabels.forEach((label) => {
      label.textContent = enabled ? 'Son activé' : 'Son coupé';
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
