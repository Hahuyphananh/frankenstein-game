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
    this.difficultyChip = byId('stage-difficulty');
    this.dialog = byId('instructions-dialog');
    this.modeRadios = [...document.querySelectorAll('input[name="mode"]')];
    this.radios = [...document.querySelectorAll('input[name="difficulty"]')];
    this.hudLabel = byId('hud-mode-label');
    this.hudTitle = byId('stage-title');
    this.hudTitleWrap = this.hudTitle.closest('.hud__title-wrap');
    this.hudObjective = byId('stage-objective');
    this.stageMoveHint = byId('stage-move-hint');
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
    this.resultTimeStat = this.resultTimeLabel.closest('.result-stat');
    this.resultStarsGroup = byId('result-stars');
    this.resultEpilogue = byId('result-epilogue');
    this.resultStars = [...this.resultStarsGroup.querySelectorAll('.star')];
    this.resultStats = this.resultStarsGroup.closest('.result-stats');
    this.resultStarsStat = this.resultStarsGroup.closest('.result-stat');
    this.pauseOverlay = byId('stage-pause');
    this.pauseCopy = byId('pause-copy');
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
    byId('btn-close-instructions').addEventListener('click', () => this.dialog.close());
    byId('btn-close-instructions-2').addEventListener('click', () => this.dialog.close());

    this.modeRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) handlers.onMode?.(radio.value);
      });
    });

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
    this.modeRadios.forEach((radio) => {
      radio.checked = radio.value === settings.mode;
    });
    this.radios.forEach((radio) => {
      radio.checked = radio.value === settings.difficulty;
    });
    this.setMode(settings.mode);
    this.setDifficulty(settings.difficulty);
    this.setSound(settings.sound);
  }

  setMode(id) {
    const mode = id === 'creature' ? 'creature' : 'guardian';
    document.body.dataset.mode = mode;
  }

  /** The stage objective, controls and power panel follow the selected mode. */
  setStageMode(mode, protectedCharacter = null) {
    const duel = mode === 'creature';
    const protectedName = protectedCharacter?.name ?? 'la personne protégée';
    this.hudLabel.textContent = duel ? 'Duel local · une seule vie' : 'Village victorien · nuit';
    this.hudTitle.textContent = duel ? 'Duel local' : `Protéger ${protectedName}`;
    this.hudTitle.hidden = duel;
    this.hudTitleWrap.hidden = duel;
    this.hudObjective.textContent = duel
      ? `Vous êtes la Créature : flèches pour bouger, WASD pour Victor. Espace pour la ruée ; atteignez ${protectedName} avant d’être touché.`
      : `La Créature traque ${protectedName}. Épuisez ses trois vies avant qu’elle ne l’atteigne.`;
    this.timerElement.hidden = duel;
    this.pauseCopy.textContent = duel
      ? 'La partie est en pause. Reprenez quand vous êtes prêt.'
      : `Le temps est figé. ${protectedName} attend dans les ruelles.`;
    this.stageMoveHint.innerHTML = duel
      ? '<span class="stage-bar__keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Victor</span><span class="stage-bar__keys"><kbd>&larr;</kbd><kbd>&uarr;</kbd><kbd>&darr;</kbd><kbd>&rarr;</kbd></span><span>Créature</span><span class="stage-bar__keys"><kbd>Espace</kbd></span><span>ruée</span>'
      : '<span class="stage-bar__keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>ou les flèches pour déplacer Victor</span>';
    this.powerElement.hidden = false;
  }

  setDifficulty(id) {
    const difficulty = DIFFICULTIES[id];
    if (!difficulty) return;
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
    enabled = true,
    cooldown = 0,
    limit = 0,
    dashing = false,
    canBreakWalls = false,
    wallsBroken = 0,
  } = {}) {
    this.powerElement.hidden = !enabled;
    if (!enabled) return;

    const remaining = Math.max(0, cooldown);
    const progress = dashing
      ? 1
      : limit > 0
        ? Math.max(0, Math.min(1, 1 - remaining / limit))
        : 1;
    const value = dashing ? 'Active' : remaining > 0.05 ? `${Math.ceil(remaining)} s` : 'Prêt';
    const state = dashing ? 'active' : remaining > 0.05 ? 'cooling' : 'ready';
    const wallText =
      wallsBroken > 0
        ? `Murs : ${wallsBroken} brisé${wallsBroken > 1 ? 's' : ''}`
        : 'Murs : brisables';
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
      this.wallState.classList.toggle('is-spent', wallsBroken > 0);
      this.wallState.title = 'Chaque mur traversé pendant une ruée est brisé.';
    }
  }

  showPause() {
    this.pauseOverlay.hidden = false;
    window.requestAnimationFrame(() => this.resumeButton.focus({ preventScroll: true }));
  }

  hidePause() {
    this.pauseOverlay.hidden = true;
  }

  showStageResult({
    outcome = 'won',
    elapsedMs = 0,
    stars = 0,
    story = null,
    showStars = true,
    showTime = true,
  } = {}) {
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
    this.resultTimeStat.hidden = !showTime;
    this.resultStarsStat.hidden = !showStars;
    this.resultStats.hidden = !showStars && !showTime;
    this.resultStats.classList.toggle('result-stats--single', showStars !== showTime);
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
