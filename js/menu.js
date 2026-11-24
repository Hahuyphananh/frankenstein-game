import { DIFFICULTIES } from './config.js';
import { drawCastPortrait } from './sprites.js';

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
    this.radios = [...document.querySelectorAll('input[name="difficulty"]')];
    this.hudLabel = byId('hud-mode-label');
    this.hudTitle = byId('stage-title');
    this.hudObjective = byId('stage-objective');
    this.stageMoveHint = byId('stage-move-hint');
    this.soundButtons = [...document.querySelectorAll('[data-sound-toggle]')];
    this.soundLabels = [...document.querySelectorAll('[data-sound-label]')];
    this.stageResult = byId('stage-result');
    this.playAgainButton = byId('btn-play-again');
    this.resultLabel = byId('result-label');
    this.resultEpilogue = byId('result-epilogue');
    this.pauseOverlay = byId('stage-pause');
    this.pauseCopy = byId('pause-copy');
    this.resumeButton = byId('btn-resume');
    this.powerElement = byId('stage-power');
    this.powerValue = byId('stage-power-value');
    this.powerFill = byId('stage-power-fill');
    this.victorElement = byId('stage-victor');
    this.victorValue = byId('stage-victor-value');
    this.victorFill = byId('stage-victor-fill');
    this.victorNext = byId('stage-victor-next');
    this.victorCycle = [...document.querySelectorAll('#stage-victor-cycle [data-power]')];
    this.powerKey = '';
    this.victorKey = '';
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
  }

  /** The stage objective, controls and power panels follow the level. */
  setStage(protectedCharacter = null, difficulty = null) {
    const protectedName = protectedCharacter?.name ?? 'la personne protégée';
    const recharge = difficulty?.victorPowerInterval ?? 6;
    const surge = difficulty?.victorPowerDuration ?? 3;
    const fr = (value) => String(value).replace('.', ',');

    this.hudLabel.textContent = 'Frankenstein · nuit';
    this.hudTitle.textContent = `Atteindre ${protectedName}`;
    this.hudObjective.textContent = `Vous êtes la Créature. Rejoignez ${protectedName} sans être touché par Victor, qui recharge ${fr(recharge)} secondes puis bondit ${fr(surge)} secondes.`;
    this.pauseCopy.textContent = `La partie est en pause. ${protectedName} vous attend dans les ruelles.`;
    this.stageMoveHint.innerHTML =
      '<span class="stage-bar__keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>ou les flèches pour déplacer la Créature</span><span class="stage-bar__keys"><kbd>Espace</kbd></span><span>ruée</span>';
    this.powerElement.hidden = false;
    this.victorElement.hidden = false;
  }

  setDifficulty(id) {
    const difficulty = DIFFICULTIES[id];
    if (!difficulty) return;
    this.difficultyChip.textContent = difficulty.label;
    this.difficultyChip.dataset.level = difficulty.id;
  }

  setCreaturePower({ enabled = true, cooldown = 0, limit = 0, dashing = false } = {}) {
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
    const key = `${value}|${state}|${Math.round(progress * 25)}`;
    if (key === this.powerKey) return;
    this.powerKey = key;

    this.powerValue.textContent = value;
    this.powerFill.style.width = `${Math.round(progress * 100)}%`;
    this.powerElement.classList.toggle('is-ready', state === 'ready');
    this.powerElement.classList.toggle('is-cooling', state === 'cooling');
    this.powerElement.classList.toggle('is-active', state === 'active');
    this.powerElement.setAttribute(
      'aria-label',
      `Ruée de la Créature : ${value.toLowerCase()}.`,
    );
  }

  /** Victor's surge cycle: a visible countdown, then a named power. */
  setVictorPower({
    surging = false,
    warning = false,
    remaining = 0,
    cooldown = 0,
    interval = 6,
    duration = 3,
    power = null,
    next = null,
  } = {}) {
    this.victorElement.hidden = false;

    const progress = surging
      ? Math.max(0, Math.min(1, remaining / duration))
      : Math.max(0, Math.min(1, 1 - cooldown / interval));
    const value = surging
      ? power?.label ?? 'Rage'
      : cooldown > 0.05
        ? `${Math.ceil(cooldown)} s`
        : 'Prêt';
    const warningLabel = next?.warning ?? 'Pouvoir imminent';
    const nextLabel = warning ? warningLabel : next?.label ? `Suivant : ${next.label}` : '';
    const key = `${value}|${surging}|${warning}|${Math.round(progress * 25)}|${nextLabel}`;
    if (key === this.victorKey) return;
    this.victorKey = key;

    this.victorValue.textContent = value;
    this.victorFill.style.width = `${Math.round(progress * 100)}%`;
    this.victorElement.classList.toggle('is-active', surging);
    this.victorElement.classList.toggle('is-warning', warning);
    this.victorElement.classList.toggle('is-cooling', !surging && cooldown > 0.05);
    this.victorElement.classList.toggle('is-ready', !surging && cooldown <= 0.05);
    this.victorNext.textContent = nextLabel;
    this.victorNext.hidden = !nextLabel;
    for (const item of this.victorCycle) {
      const id = item.dataset.power;
      item.classList.toggle('is-current', Boolean(surging && power?.id === id));
      item.classList.toggle('is-next', Boolean(!surging && next?.id === id));
      item.classList.toggle('is-warning', Boolean(warning && next?.id === id));
    }
    this.victorElement.setAttribute(
      'aria-label',
      surging
        ? `Pouvoir de Victor — ${power?.label ?? 'Rage'} : ${power?.note ?? 'il vous traque à pleine vitesse'}.`
        : warning
          ? `${warningLabel} dans ${Math.ceil(cooldown)} secondes.`
          : `Prochain pouvoir de Victor : ${next?.label ?? 'Rage'} dans ${Math.ceil(cooldown)} secondes.`,
    );
  }

  showPause() {
    this.pauseOverlay.hidden = false;
    window.requestAnimationFrame(() => this.resumeButton.focus({ preventScroll: true }));
  }

  hidePause() {
    this.pauseOverlay.hidden = true;
  }

  showStageResult({ outcome = 'won', story = null } = {}) {
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
      this.resultLabel.textContent = lost ? 'Victor vous rattrape' : 'La Créature triomphe';
      title.textContent = lost ? 'Victor gagne.' : 'La Créature gagne.';
      copy.textContent = lost
        ? 'Victor vous touche avant que vous n’atteigniez la personne protégée.'
        : 'Vous atteignez la personne protégée avant que Victor ne puisse vous arrêter.';
      this.resultEpilogue.textContent = '';
      this.resultEpilogue.hidden = true;
    }

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
