import { DIFFICULTIES, DIFFICULTY_ORDER } from './config.js';
import { drawCastPortrait } from './sprites.js';
import { formatRunTime } from './timer.js';

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
    this.resultStats = byId('result-stats');
    this.resultTime = byId('result-time');
    this.resultRecord = byId('result-record');
    this.pauseOverlay = byId('stage-pause');
    this.pauseCopy = byId('pause-copy');
    this.resumeButton = byId('btn-resume');
    this.powerElement = byId('stage-power');
    this.powerValue = byId('stage-power-value');
    this.powerFill = byId('stage-power-fill');
    this.victorElement = byId('stage-victor');
    this.victorValue = byId('stage-victor-value');
    this.victorFill = byId('stage-victor-fill');
    this.victorSpeed = byId('stage-victor-speed');
    this.victorNext = byId('stage-victor-next');
    this.victorCycle = [...document.querySelectorAll('#stage-victor-cycle [data-power]')];
    this.countdownOverlay = byId('stage-countdown');
    this.countdownValue = byId('stage-countdown-value');
    this.countdownCopy = byId('stage-countdown-copy');
    this.timerElement = byId('stage-timer');
    this.timerValue = byId('stage-timer-value');
    this.timerRecord = byId('stage-timer-record');
    this.timerDelta = byId('stage-timer-delta');
    this.leaderboardButton = byId('btn-leaderboard');
    this.leaderboardDialog = byId('leaderboard-dialog');
    this.leaderboardGroups = byId('leaderboard-groups');
    this.leaderboardSource = byId('leaderboard-source');
    this.nameDialog = byId('name-dialog');
    this.nameForm = byId('name-form');
    this.nameInput = byId('player-name');
    this.nameError = byId('name-error');
    this.powerKey = '';
    this.victorKey = '';
    this.runTimeKey = '';
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
    this.leaderboardButton.addEventListener('click', () => handlers.onLeaderboard?.());
    byId('btn-close-leaderboard').addEventListener('click', () => this.leaderboardDialog.close());
    byId('btn-close-leaderboard-2').addEventListener('click', () => this.leaderboardDialog.close());
    this.nameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      handlers.onNameSubmit?.(this.nameInput.value);
    });
    byId('btn-cancel-name').addEventListener('click', () => this.nameDialog.close());
    this.nameDialog.addEventListener('click', (event) => {
      if (event.target === this.nameDialog) this.nameDialog.close();
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
    this.leaderboardDialog.addEventListener('close', () => handlers.onLeaderboardClosed?.());
    this.leaderboardDialog.addEventListener('click', (event) => {
      if (event.target === this.leaderboardDialog) this.leaderboardDialog.close();
    });
  }

  applySettings(settings) {
    this.radios.forEach((radio) => {
      radio.checked = radio.value === settings.difficulty;
    });
    this.setDifficulty(settings.difficulty);
    this.setSound(settings.sound);
  }

  showNamePrompt() {
    this.nameInput.value = '';
    this.nameError.textContent = '';
    this.nameError.hidden = true;
    if (!this.nameDialog.open) this.nameDialog.showModal();
    window.requestAnimationFrame(() => this.nameInput.focus({ preventScroll: true }));
  }

  hideNamePrompt() {
    if (this.nameDialog.open) this.nameDialog.close();
  }

  showNameError(message) {
    this.nameError.textContent = message;
    this.nameError.hidden = false;
    this.nameInput.focus({ preventScroll: true });
  }

  /** The stage objective, controls and power panels follow the level. */
  setStage(protectedCharacter = null, difficulty = null) {
    const protectedName = protectedCharacter?.name ?? 'la personne protégée';
    const phase = difficulty?.victorPowerDuration ?? 3.5;
    const fr = (value) => String(value).replace('.', ',');

    this.hudLabel.textContent = 'Frankenstein · nuit';
    this.hudTitle.textContent = `Atteindre ${protectedName}`;
    this.hudObjective.textContent = `Vous êtes la Créature. Rejoignez ${protectedName} sans être touché par Victor, qui change de pouvoir toutes les ${fr(phase)} secondes environ, sans pause.`;
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

  setRunTime(elapsedMs = 0, bestTimeMs = null) {
    const label = formatRunTime(elapsedMs);
    const hasBest = Number.isFinite(bestTimeMs) && bestTimeMs > 0;
    const bestLabel = hasBest ? formatRunTime(bestTimeMs) : '';
    const deltaMs = hasBest ? elapsedMs - bestTimeMs : null;
    const deltaLabel = hasBest
      ? `${deltaMs <= 0 ? '-' : '+'}${formatRunTime(Math.abs(deltaMs))}`
      : '';
    const key = `${label}|${bestLabel}|${deltaLabel}`;
    if (key === this.runTimeKey) return;
    this.runTimeKey = key;
    this.timerValue.textContent = label;
    this.timerRecord.textContent = hasBest ? `Record ${bestLabel}` : 'Record —';
    this.timerDelta.textContent = deltaLabel;
    this.timerDelta.hidden = !hasBest;
    this.timerDelta.classList.toggle('is-ahead', hasBest && deltaMs <= 0);
    this.timerDelta.classList.toggle('is-behind', hasBest && deltaMs > 0);
    this.timerElement.setAttribute(
      'aria-label',
      hasBest
        ? `Temps de la partie : ${label}. Record : ${bestLabel}. Écart : ${deltaLabel}.`
        : `Temps de la partie : ${label}. Aucun record enregistré.`,
    );
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
    speed = 0,
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
    const speedLabel =
      Number.isFinite(speed) && speed > 0
        ? `${String(Math.round(speed * 10) / 10).replace('.', ',')} c/s`
        : '—';
    const key = `${value}|${surging}|${warning}|${Math.round(progress * 25)}|${nextLabel}|${speedLabel}`;
    if (key === this.victorKey) return;
    this.victorKey = key;

    const colorPower = surging ? power : next;
    this.victorElement.style.setProperty('--victor-color', colorPower?.color ?? '#ff5c7a');
    this.victorElement.style.setProperty('--victor-soft', colorPower?.soft ?? 'rgba(255, 92, 122, 0.1)');
    this.victorElement.dataset.power = colorPower?.id ?? 'rage';
    this.victorValue.textContent = value;
    this.victorSpeed.textContent = speedLabel;
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
        ? `Pouvoir de Victor — ${power?.label ?? 'Rage'} (${speedLabel}) : ${power?.note ?? 'il vous traque à pleine vitesse'}.`
        : warning
          ? `${warningLabel} dans ${Math.ceil(cooldown)} secondes.`
          : `Prochain pouvoir de Victor : ${next?.label ?? 'Rage'} dans ${Math.ceil(cooldown)} secondes.`,
    );
  }

  /** Countdown overlay shown over the board before the run starts. */
  showCountdown(seconds = 5) {
    const value = Math.max(1, Math.ceil(seconds));
    this.countdownValue.textContent = String(value);
    this.countdownCopy.textContent = `La course commence dans ${value} seconde${value > 1 ? 's' : ''}.`;
    this.countdownOverlay.hidden = false;
    this.countdownValue.animate?.(
      [
        { transform: 'scale(0.72)', opacity: 0.2 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }

  hideCountdown() {
    this.countdownOverlay.hidden = true;
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
    story = null,
    timeMs = null,
    record = null,
    mapLabel = '',
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
      this.resultLabel.textContent = lost ? 'Victor gagne' : 'La Créature gagne';
      title.textContent = lost ? 'Victor vous rattrape.' : 'La Créature triomphe.';
      copy.textContent = lost
        ? 'Victor vous touche avant que vous n’atteigniez la personne protégée ; dans le roman, il ne capture jamais la Créature et la poursuit jusqu’aux glaces de l’Arctique.'
        : 'Vous atteignez la personne protégée avant que Victor ne puisse vous arrêter.';
      this.resultEpilogue.textContent = '';
      this.resultEpilogue.hidden = true;
    }

    const hasTime = Number.isFinite(timeMs) && timeMs >= 0;
    this.resultStats.hidden = !hasTime;
    this.resultTime.textContent = hasTime
      ? `${formatRunTime(timeMs)}${mapLabel ? ` · ${mapLabel}` : ''}`
      : '';
    this.resultRecord.hidden = !record?.entry;
    this.resultRecord.textContent = record?.entry
      ? record.isBest
        ? 'Nouveau record sur cette difficulté.'
        : `${record.rank}e temps sur cette difficulté.`
      : '';

    this.playAgainButton.textContent = 'Recommencer';
    this.stageResult.hidden = false;
    window.requestAnimationFrame(() => this.playAgainButton.focus({ preventScroll: true }));
  }

  showLeaderboard(runs = []) {
    const safeRuns = Array.isArray(runs) ? runs : [];
    this.leaderboardSource.textContent = 'Records enregistrés sur cet appareil.';
    this.leaderboardGroups.replaceChildren();

    for (const difficulty of DIFFICULTY_ORDER) {
      const entries = safeRuns
        .filter((entry) => entry?.difficulty === difficulty)
        .slice(0, 5);
      const group = document.createElement('section');
      group.className = 'leaderboard__group';
      group.dataset.level = difficulty;

      const heading = document.createElement('h3');
      heading.textContent = DIFFICULTIES[difficulty]?.label ?? difficulty;
      group.append(heading);

      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'leaderboard__empty';
        empty.textContent = 'Aucun temps enregistré.';
        group.append(empty);
      } else {
        const list = document.createElement('ol');
        list.className = 'leaderboard__list';
        entries.forEach((entry, index) => {
          const item = document.createElement('li');
          item.className = 'leaderboard__item';

          const rank = document.createElement('span');
          rank.className = 'leaderboard__rank';
          rank.textContent = String(index + 1);

          const body = document.createElement('span');
          body.className = 'leaderboard__entry';
          const time = document.createElement('span');
          time.className = 'leaderboard__time';
          time.textContent = formatRunTime(entry.timeMs);
          const meta = document.createElement('span');
          meta.className = 'leaderboard__meta';
          meta.textContent =
            [entry.name, entry.characterName, entry.mapLabel]
              .filter(Boolean)
              .join(' · ') || 'Anonyme';
          body.append(time, meta);
          item.append(rank, body);
          list.append(item);
        });
        group.append(list);
      }

      this.leaderboardGroups.append(group);
    }

    if (!this.leaderboardDialog.open) this.leaderboardDialog.showModal();
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
    return this.dialog.open || this.leaderboardDialog.open || this.nameDialog.open;
  }
}
