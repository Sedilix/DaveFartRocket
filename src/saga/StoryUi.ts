/** Dialogue box, popups, objective banner and end-of-act screen shared by the story scenes. */
export type Speaker = string;

export interface Line {
  who: Speaker;
  text: string;
  whisper?: boolean;
  shout?: boolean;
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
  private root = document.createElement('div');
  private dialog: HTMLElement;
  private name: HTMLElement;
  private text: HTMLElement;
  private pop: HTMLElement;
  private objective: HTMLElement;
  private chain: HTMLElement;
  private end: HTMLElement;
  private lines: Line[] = [];
  private index = 0;
  private done: (() => void) | null = null;
  private lastAdvance = 0;
  private popTimer = 0;

  constructor(private colors: Record<string, string>) {
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:Georgia,serif;color:#fff;z-index:10';
    this.root.innerHTML = `
      <div data-id="objective" style="position:absolute;left:50%;top:14px;transform:translateX(-50%);max-width:min(560px,90vw);padding:9px 16px;border-radius:12px;background:rgba(20,26,40,.82);border:1.5px solid rgba(255,255,255,.45);font:600 13px system-ui,sans-serif;text-align:center;display:none"></div>
      <div data-id="chain" style="position:absolute;left:50%;top:62px;transform:translateX(-50%);font:700 13px system-ui,sans-serif;letter-spacing:1.5px;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .25s"></div>
      <div data-id="pop" style="position:absolute;left:50%;top:26%;transform:translateX(-50%);font:italic 700 20px Georgia,serif;opacity:0;text-shadow:0 2px 10px #000;transition:opacity .4s;text-align:center;max-width:90vw"></div>
      <div data-id="dialog" style="position:absolute;left:50%;bottom:22px;transform:translateX(-50%);width:min(660px,92vw);padding:14px 18px;border-radius:16px;background:rgba(14,18,30,.9);border:1px solid rgba(255,255,255,.28);display:none;pointer-events:auto">
        <div data-id="name" style="font:700 12px system-ui,sans-serif;letter-spacing:1.4px;margin-bottom:6px;text-transform:uppercase"></div>
        <div data-id="text" style="font-size:19px;line-height:1.4"></div>
        <div style="text-align:right;font:11px system-ui,sans-serif;opacity:.55;margin-top:6px">Space / click &#9656;</div>
      </div>
      <div data-id="end" style="position:absolute;inset:0;background:rgba(4,5,12,.88);display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:auto;padding:24px"></div>`;
    document.body.appendChild(this.root);
    const q = (id: string) => this.root.querySelector(`[data-id="${id}"]`) as HTMLElement;
    this.dialog = q('dialog');
    this.name = q('name');
    this.text = q('text');
    this.pop = q('pop');
    this.objective = q('objective');
    this.chain = q('chain');
    this.end = q('end');

    window.addEventListener('keydown', (e) => {
      if (this.active && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        this.advance();
      }
    });
    window.addEventListener('mousedown', () => {
      if (this.active) this.advance();
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
    const line = this.lines[this.index];
    this.dialog.style.display = 'block';
    this.name.textContent = line.who;
    this.name.style.color = this.colors[line.who] ?? '#fff';
    this.text.textContent = line.text;
    this.text.style.fontStyle = line.who === 'Narrator' || line.whisper ? 'italic' : 'normal';
    this.text.style.fontSize = line.whisper ? '15px' : line.shout ? '22px' : '19px';
    this.text.style.fontWeight = line.shout ? '800' : '400';
    this.text.style.opacity = line.whisper ? '0.82' : '1';
    line.action?.();
  }

  private advance() {
    if (!this.active || performance.now() - this.lastAdvance < 280) return;
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

  public popup(text: string, ms = 1400) {
    this.pop.textContent = text;
    this.pop.style.opacity = '0.95';
    window.clearTimeout(this.popTimer);
    this.popTimer = window.setTimeout(() => (this.pop.style.opacity = '0'), ms);
  }

  public setObjective(text: string | null) {
    this.objective.style.display = text ? 'block' : 'none';
    if (text) this.objective.textContent = text;
  }

  public setChain(text: string | null) {
    this.chain.textContent = text ?? '';
    this.chain.style.opacity = text ? '1' : '0';
  }

  public showEnd(e: EndScreen) {
    this.setObjective(null);
    this.end.style.display = 'flex';
    this.end.innerHTML = `
      <div style="font:700 13px system-ui,sans-serif;letter-spacing:3px;opacity:.7">${e.act} COMPLETE</div>
      <h1 style="font-size:clamp(28px,6vw,52px);margin:10px 0 6px;max-width:90vw">${e.title}</h1>
      <p style="font-style:italic;opacity:.8;max-width:540px;margin:0 0 6px">${e.blurb}</p>
      <p style="opacity:.65;font:13px system-ui,sans-serif;margin:0 0 22px">${e.stats}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        ${e.nextHref ? `<a href="${e.nextHref}" style="font:700 14px system-ui,sans-serif;letter-spacing:1px;padding:12px 22px;border-radius:999px;border:1.5px solid #fff;background:#3a4668;color:#fff;text-decoration:none">${e.nextLabel ?? 'CONTINUE'}</a>` : ''}
        <button data-id="replay" style="font:700 14px system-ui,sans-serif;letter-spacing:1px;padding:12px 22px;border-radius:999px;border:1.5px solid rgba(255,255,255,.7);background:#252c40;color:#fff;cursor:pointer">REPLAY</button>
        <button data-id="street" style="font:700 14px system-ui,sans-serif;letter-spacing:1px;padding:12px 22px;border-radius:999px;border:1.5px solid rgba(255,255,255,.5);background:transparent;color:#fff;cursor:pointer">BACK TO THE STREET</button>
      </div>`;
    (this.end.querySelector('[data-id="replay"]') as HTMLElement).addEventListener('click', () => window.location.reload());
    (this.end.querySelector('[data-id="street"]') as HTMLElement).addEventListener('click', () => (window.location.href = window.location.pathname));
    if (document.exitPointerLock) document.exitPointerLock();
  }
}
