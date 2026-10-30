import type { MemoryData } from '../data/types';

/**
 * Interfaz HTML mínima sobre el canvas.
 * Solo muestra; no decide reglas.
 */
export interface DioramaToolHandlers {
  rotate: (dir: number) => void;
  scale: (dir: number) => void;
  reset: () => void;
}

export class UIManager {
  private root: HTMLElement;
  private hint: HTMLElement;
  private label: HTMLElement;
  private dots: HTMLElement;
  private continueBtn: HTMLButtonElement;
  private message: HTMLElement;
  private debug: HTMLElement;
  private flashEl: HTMLElement;
  private intro: HTMLButtonElement;
  private caption: HTMLElement;
  private navPrev: HTMLButtonElement;
  private navNext: HTMLButtonElement;
  private navHandlers: { prev: () => void; next: () => void } | null = null;
  private hintTimer = 0;
  private tools: HTMLElement;
  private resetBtn: HTMLButtonElement;
  private toolHandlers: DioramaToolHandlers | null = null;
  private debugExtra = '';
  private lastDebug: { data: MemoryData; stage: string | null } | null = null;
  private onContinue: (() => void) | null = null;
  private messageTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = `
      <p class="ui-hint"></p>
      <p class="ui-label"></p>
      <div class="ui-dots" aria-hidden="true"></div>
      <button class="ui-continue" type="button">continuar</button>
      <p class="ui-message"></p>
      <pre class="ui-debug"></pre>
      <div class="ui-flash"></div>
      <div class="ui-caption" aria-live="polite">
        <span class="ui-caption-num"></span>
        <span class="ui-caption-title"></span>
      </div>
      <button class="ui-nav ui-nav-prev" type="button" aria-label="Escena anterior">
        <span class="ui-nav-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M24 9 L13 20 L24 31" /></svg></span>
        <span class="ui-nav-label">anterior</span>
      </button>
      <button class="ui-nav ui-nav-next" type="button" aria-label="Escena siguiente">
        <span class="ui-nav-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M16 9 L27 20 L16 31" /></svg></span>
        <span class="ui-nav-label">siguiente</span>
      </button>
      <div class="ui-tools" role="toolbar" aria-label="Editar recuerdo">
        <span class="ui-tools-name"></span>
        <div class="ui-tools-row">
          <button type="button" data-tool="rotate-left" aria-label="Girar a la izquierda" title="Girar (Q)">⟲</button>
          <button type="button" data-tool="rotate-right" aria-label="Girar a la derecha" title="Girar (E)">⟳</button>
          <span class="ui-tools-sep"></span>
          <button type="button" data-tool="smaller" aria-label="Más pequeño" title="Más pequeño (−)">−</button>
          <button type="button" data-tool="bigger" aria-label="Más grande" title="Más grande (+)">+</button>
        </div>
      </div>
      <button class="ui-reset" type="button" title="Volver a la composición original">restablecer</button>
      <button class="ui-intro" type="button">
        <span class="ui-intro-title">Donde viven los recuerdos</span>
        <span class="ui-intro-cta">haz clic para comenzar</span>
      </button>
    `;
    this.hint = this.q('.ui-hint');
    this.label = this.q('.ui-label');
    this.dots = this.q('.ui-dots');
    this.continueBtn = this.q('.ui-continue');
    this.message = this.q('.ui-message');
    this.debug = this.q('.ui-debug');
    this.flashEl = this.q('.ui-flash');
    this.intro = this.q('.ui-intro');
    this.caption = this.q('.ui-caption');
    this.navPrev = this.q('.ui-nav-prev');
    this.navNext = this.q('.ui-nav-next');
    this.tools = this.q('.ui-tools');
    this.resetBtn = this.q('.ui-reset');
    this.tools.addEventListener('click', (e) => {
      const tool = (e.target as HTMLElement).closest('button')?.dataset.tool;
      const h = this.toolHandlers;
      if (!tool || !h) return;
      if (tool === 'rotate-left') h.rotate(-1);
      if (tool === 'rotate-right') h.rotate(1);
      if (tool === 'smaller') h.scale(-1);
      if (tool === 'bigger') h.scale(1);
    });
    this.resetBtn.addEventListener('click', () => this.toolHandlers?.reset());
    this.navPrev.addEventListener('click', () => this.navHandlers?.prev());
    this.navNext.addEventListener('click', () => this.navHandlers?.next());

    this.continueBtn.addEventListener('click', () => {
      const cb = this.onContinue;
      this.hideContinue(); // un solo clic
      cb?.();
    });

    // Panel de depuración: solo en desarrollo (o con ?debug en la URL). Nunca en la versión publicada.
    const debugAllowed = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
    window.addEventListener('keydown', (e) => {
      if (debugAllowed && e.key.toLowerCase() === 'd' && !e.repeat) {
        this.debug.classList.toggle('is-visible');
        if (this.lastDebug) this.updateDebug(this.lastDebug.data, this.lastDebug.stage);
      }
    });
  }

  /**
   * Pantalla inicial. El clic es el gesto que habilita el audio del navegador.
   * Se resuelve una sola vez, en el momento del clic.
   */
  showIntro(): Promise<void> {
    this.intro.classList.add('is-visible');
    return new Promise((resolve) => {
      const start = () => {
        this.intro.removeEventListener('click', start);
        this.intro.classList.remove('is-visible');
        this.intro.disabled = true;
        resolve();
      };
      this.intro.addEventListener('click', start);
    });
  }

  /** Destello de luz a pantalla completa (explosión). */
  flash(): void {
    const el = this.flashEl;
    el.classList.remove('is-fading');
    el.classList.add('is-visible');
    // Fuerza el reflow para que el fundido arranque desde opacidad 1
    void el.offsetWidth;
    el.classList.add('is-fading');
    el.classList.remove('is-visible');
  }

  private q<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector(selector) as T;
  }

  showHint(text: string, durationMs = 0): void {
    window.clearTimeout(this.hintTimer);
    this.hint.textContent = text;
    this.hint.classList.add('is-visible');
    if (durationMs > 0) this.hintTimer = window.setTimeout(() => this.hideHint(), durationMs);
  }

  // ---------- Diorama ----------

  /** Activa las herramientas del diorama (el panel aparece solo con un recuerdo seleccionado). */
  enableDioramaTools(handlers: DioramaToolHandlers): void {
    this.toolHandlers = handlers;
    this.resetBtn.classList.add('is-visible');
  }

  disableDioramaTools(): void {
    this.toolHandlers = null;
    this.resetBtn.classList.remove('is-visible');
    this.tools.classList.remove('is-visible');
  }

  /** Muestra el panel con el nombre del recuerdo seleccionado (o lo oculta con null). */
  setSelection(name: string | null): void {
    if (name) (this.tools.querySelector('.ui-tools-name') as HTMLElement).textContent = name;
    this.tools.classList.toggle('is-visible', Boolean(name));
  }

  // ---------- Cinta cinematográfica ----------

  showNav(handlers: { prev: () => void; next: () => void }): void {
    this.navHandlers = handlers;
    this.navPrev.classList.add('is-visible');
    this.navNext.classList.add('is-visible');
  }

  setNavState(canPrev: boolean, canNext: boolean): void {
    this.navPrev.disabled = !canPrev;
    this.navNext.disabled = !canNext;
  }

  hideNav(): void {
    this.navHandlers = null;
    this.navPrev.classList.remove('is-visible');
    this.navNext.classList.remove('is-visible');
  }

  /** Título del fotograma, como un intertítulo de cine mudo. */
  setCaption(num: string, title: string): void {
    const numEl = this.caption.querySelector('.ui-caption-num') as HTMLElement;
    const titleEl = this.caption.querySelector('.ui-caption-title') as HTMLElement;
    if (titleEl.textContent === title && this.caption.classList.contains('is-visible')) return;
    this.caption.classList.remove('is-visible');
    window.setTimeout(() => {
      numEl.textContent = num;
      titleEl.textContent = title;
      this.caption.classList.add('is-visible');
    }, 450);
  }

  hideCaption(): void {
    this.caption.classList.remove('is-visible');
  }

  hideHint(): void {
    this.hint.classList.remove('is-visible');
  }

  setHoverLabel(text: string | null): void {
    if (text) this.label.textContent = text;
    this.label.classList.toggle('is-visible', Boolean(text));
  }

  /** Puntos discretos: uno por recuerdo posible. */
  setMemoryDots(filled: number, max: number): void {
    if (this.dots.childElementCount !== max) {
      this.dots.innerHTML = '<span></span>'.repeat(max);
    }
    [...this.dots.children].forEach((dot, i) => dot.classList.toggle('is-filled', i < filled));
    this.dots.classList.add('is-visible');
  }

  hideMemoryDots(): void {
    this.dots.classList.remove('is-visible');
  }

  showContinue(onContinue: () => void): void {
    this.onContinue = onContinue;
    this.continueBtn.disabled = false;
    this.continueBtn.classList.add('is-visible');
  }

  hideContinue(): void {
    this.onContinue = null;
    this.continueBtn.disabled = true;
    this.continueBtn.classList.remove('is-visible');
  }

  showMessage(text: string, durationMs = 3500): void {
    window.clearTimeout(this.messageTimer);
    this.message.textContent = text;
    this.message.classList.add('is-visible');
    this.messageTimer = window.setTimeout(() => this.message.classList.remove('is-visible'), durationMs);
  }

  /** Panel de depuración (tecla D). */
  /** Texto adicional en el panel de depuración (por ejemplo, el plan del diorama). */
  setDebugExtra(text: string): void {
    this.debugExtra = text;
    if (this.lastDebug) this.updateDebug(this.lastDebug.data, this.lastDebug.stage);
  }

  updateDebug(data: MemoryData, stage: string | null): void {
    this.lastDebug = { data, stage };
    if (!this.debug.classList.contains('is-visible')) return;
    const stats = Object.entries(data.sceneStats)
      .map(([id, st]) => `${id.padEnd(13)} t=${st.timeSpent.toFixed(1)}s  v=${st.visitCount}  i=${st.interactionCount}`)
      .join('\n');
    const objects = data.selectedObjects.map((m) => `${m.order}. ${m.id} (${m.category}, ${m.color})`).join('\n');
    const extra = this.debugExtra ? `\n\n${this.debugExtra}` : '';
    this.debug.textContent = `etapa: ${stage}\n\nobjetos:\n${objects || '—'}\n\nescenarios:\n${stats || '—'}${extra}`;
  }
}
