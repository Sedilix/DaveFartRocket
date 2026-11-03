/**
 * Dialogue box, popups, objective banner and end-of-act screen shared by all story scenes.
 * Fully wired to src/ui/tokens.css for visual parity with STREET.
 */

import { audio } from '../audio/AudioEngine';

export type Speaker = string;

export type Mood = 'neutral' | 'worried' | 'delighted' | 'horrified' | 'deadpan' | 'smug';

export interface Line {
  who: Speaker;
  text: string;
  whisper?: boolean;
  shout?: boolean;
  mood?: Mood;
  sfx?: string;
  action?: () => void;
}

export interface EndScreen {
  act: string;
  title: string;
  blurb: string;
  stats: string;
  nextHref?: string;
  nextLabel?: string;
}

export class StoryUi {
  public root = document.createElement('div');
  private dialog: HTMLElement;
  private name: HTMLElement;
  private text: HTMLElement;
  private prompt: HTMLElement;
  private pop: HTMLElement;
  private objective: HTMLElement;
  private chain: HTMLElement;
  private end: HTMLElement;

  // Meter elements
  private meterCard: HTMLElement;
  private meterTitle: HTMLElement;
  private meterCounter: HTMLElement;
  private meterFill: HTMLElement;
  private meterHint: HTMLElement;

  private lines: Line[] = [];
  private index = 0;
  private done: (() => void) | null = null;
  public lastAdvance = 0;
  private popTimer = 0;

  // Typewriter state
  private typewriterTimer = 0;
  private currentFullText = '';
  private displayedLength = 0;
  private isTypewriting = false;

  constructor(private colors: Record<string, string>) {
    this.root.className = 'story-ui-root';
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:var(--z-hud);';
    this.root.innerHTML = `
      <div data-id="objective" class="story-objective-banner" style="display:none"></div>
      <div data-id="meter" class="hud-meter-card" style="display:none">
        <div class="hud-meter-header">
          <span data-id="meter-title" class="hud-meter-title">HUSH FIELD</span>
          <span data-id="meter-counter" class="hud-meter-counter"></span>
        </div>
        <div class="hud-meter-bar">
          <div data-id="meter-fill" class="hud-meter-fill"></div>
        </div>
        <div data-id="meter-hint" class="hud-meter-hint"></div>
      </div>
      <div data-id="chain" style="position:absolute;left:50%;top:64px;transform:translateX(-50%);font-family:var(--font-ui);font-weight:var(--fw-heavy);font-size:var(--fs-label);letter-spacing:var(--tracking-widest);text-shadow:0 2px 8px #000;opacity:0;transition:opacity .25s;color:#fff;pointer-events:none"></div>
      <div data-id="pop" class="story-pop-text"></div>
      <div data-id="dialog" class="story-dialogue-card" style="display:none">
        <div data-id="name" class="story-speaker-name"></div>
        <div data-id="text" class="story-dialogue-text"></div>
        <div data-id="prompt" class="story-dialogue-prompt">Space / Tap to continue &#9656;</div>
      </div>
      <div data-id="end" class="story-end-screen" style="display:none"></div>`;
    document.body.appendChild(this.root);

    const q = (id: string) => this.root.querySelector(`[data-id="${id}"]`) as HTMLElement;
    this.dialog = q('dialog');
    this.name = q('name');
    this.text = q('text');
    this.prompt = q('prompt');
    this.pop = q('pop');
    this.objective = q('objective');
    this.chain = q('chain');
    this.end = q('end');

    this.meterCard = q('meter');
    this.meterTitle = q('meter-title');
    this.meterCounter = q('meter-counter');
    this.meterFill = q('meter-fill');
    this.meterHint = q('meter-hint');

    window.addEventListener('keydown', (e) => {
      if (this.active && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        this.advance();
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (this.active && !this.end.contains(e.target as Node)) {
        this.advance();
      }
    });
  }

  public get active() {
    return this.lines.length > 0;
  }

  public say(lines: Line[], done: () => void) {
    this.lines = lines;
    this.index = 0;
    this.done = done;
    this.lastAdvance = performance.now();
    this.show();
  }

  private show() {
    if (this.index >= this.lines.length) return;
    const line = this.lines[this.index];
    this.dialog.style.display = 'flex';

    // Format Speaker Name & Chip
    const color = this.colors[line.who] ?? '#fff';
    this.name.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}"></span><span>${line.who}</span>`;
    this.name.style.color = color;

    // Typewriter reveal
    this.currentFullText = line.text;
    this.text.className = `story-dialogue-text ${line.whisper ? 'whisper' : ''} ${line.shout ? 'shout' : ''}`;
    this.text.style.fontStyle = line.who === 'Narrator' || line.whisper ? 'italic' : 'normal';

    // Cancel prior typewriter
    window.clearTimeout(this.typewriterTimer);
    this.displayedLength = 0;
    this.isTypewriting = true;
    this.stepTypewriter();

    line.action?.();
  }

  private stepTypewriter() {
    if (!this.isTypewriting) return;
    this.displayedLength += 2; // smooth 2-char chunks for swift reading
    if (this.displayedLength >= this.currentFullText.length) {
      this.text.textContent = this.currentFullText;
      this.isTypewriting = false;
      return;
    }

    this.text.textContent = this.currentFullText.slice(0, this.displayedLength);
    if (this.displayedLength % 4 === 0) {
      const line = this.lines[this.index];
      if (line) audio.playVoiceBlip(line.who);
    }

    // Dynamic pace with punctuation pauses
    const lastChar = this.currentFullText[this.displayedLength - 1];
    let delay = 18;
    if (lastChar === '.' || lastChar === '!' || lastChar === '?') delay = 140;
    else if (lastChar === ',' || lastChar === ';' || lastChar === ':') delay = 80;

    this.typewriterTimer = window.setTimeout(() => this.stepTypewriter(), delay);
  }

  public advance() {
    if (!this.active) return;

    // If typewriter is still playing, first tap finishes the line immediately
    if (this.isTypewriting) {
      window.clearTimeout(this.typewriterTimer);
      this.isTypewriting = false;
      this.text.textContent = this.currentFullText;
      this.lastAdvance = performance.now();
      return;
    }

    if (performance.now() - this.lastAdvance < 220) return;
    this.lastAdvance = performance.now();
    this.index++;

    if (this.index >= this.lines.length) {
      this.lines = [];
      this.dialog.style.display = 'none';
      const d = this.done;
      this.done = null;
      d?.();
    } else {
      this.show();
    }
  }

  public setPrompt(text: string) {
    this.prompt.textContent = text;
  }

  public popup(text: string, ms = 1500) {
    this.pop.textContent = text;
    this.pop.style.opacity = '1';
    this.pop.style.transform = 'translateX(-50%) scale(1.04)';
    window.clearTimeout(this.popTimer);
    this.popTimer = window.setTimeout(() => {
      this.pop.style.opacity = '0';
      this.pop.style.transform = 'translateX(-50%) scale(1)';
    }, ms);
  }

  public setObjective(text: string | null) {
    this.objective.style.display = text ? 'block' : 'none';
    if (text) this.objective.textContent = text;
  }

  public showMeter(title: string, counter = '', hint = '') {
    this.meterTitle.textContent = title;
    this.meterCounter.textContent = counter;
    this.meterHint.textContent = hint;
    this.meterCard.style.display = 'flex';
  }

  public updateMeter(percentage: number, counter?: string, hint?: string) {
    const clamped = Math.max(0, Math.min(100, percentage));
    this.meterFill.style.width = `${clamped}%`;
    if (clamped > 50) {
      this.meterFill.style.background = 'linear-gradient(90deg, var(--col-accent-cyan), #9be7ff)';
    } else if (clamped > 25) {
      this.meterFill.style.background = 'linear-gradient(90deg, var(--col-accent-yellow), var(--col-accent-amber))';
    } else {
      this.meterFill.style.background = 'linear-gradient(90deg, var(--col-accent-red), var(--col-accent-rose))';
    }
    if (counter !== undefined) this.meterCounter.textContent = counter;
    if (hint !== undefined) this.meterHint.textContent = hint;
  }

  public hideMeter() {
    this.meterCard.style.display = 'none';
  }

  public setChain(text: string | null) {
    this.chain.textContent = text ?? '';
    this.chain.style.opacity = text ? '1' : '0';
  }

  public showEndScreen(e: EndScreen) {
    this.showEnd(e);
  }

  public showEnd(e: EndScreen) {
    this.setObjective(null);
    this.end.style.display = 'flex';
    this.end.innerHTML = `
      <div class="act-tag">${e.act} COMPLETE</div>
      <h1 class="act-title">${e.title}</h1>
      <p class="act-blurb">${e.blurb}</p>
      <p class="act-stats">${e.stats}</p>
      <div class="btn-group">
        ${e.nextHref ? `<a href="${e.nextHref}" class="hud-btn hud-btn-primary">${e.nextLabel ?? 'CONTINUE'}</a>` : ''}
        <button data-id="replay" class="hud-btn hud-btn-secondary">REPLAY</button>
        <button data-id="street" class="hud-btn hud-btn-ghost">BACK TO THE STREET</button>
      </div>`;

    (this.end.querySelector('[data-id="replay"]') as HTMLElement).addEventListener('click', () => window.location.reload());
    (this.end.querySelector('[data-id="street"]') as HTMLElement).addEventListener('click', () => (window.location.href = window.location.pathname));
    if (document.exitPointerLock) document.exitPointerLock();
  }

  public dispose() {
    window.clearTimeout(this.typewriterTimer);
    window.clearTimeout(this.popTimer);
    this.root.remove();
  }
}
