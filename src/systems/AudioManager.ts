import type { TrackDefinition } from '../data/audio';

interface ActiveTrack {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Música y efectos con Web Audio API.
 * - Se desbloquea con un gesto del usuario (restricción de autoplay).
 * - Solo una pista de música suena a la vez; los cambios hacen crossfade.
 * - Expone el nivel de la música (0–1) para sincronizar luz y movimiento.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelData: Uint8Array<ArrayBuffer> | null = null;

  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: ActiveTrack | null = null;
  /** Aumenta con cada petición de música: invalida cargas que llegan tarde. */
  private requestToken = 0;
  private volume = 0.8;
  private muted = false;
  private smoothedLevel = 0;

  get isUnlocked(): boolean {
    return this.context?.state === 'running';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Debe llamarse dentro de un evento de clic/tecla. */
  async unlock(): Promise<void> {
    if (!this.context) {
      const ctx = new AudioContext();
      this.context = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(ctx.destination);

      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.7;
      this.levelData = new Uint8Array(this.analyser.frequencyBinCount);

      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.analyser);
      this.analyser.connect(this.master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  /** Precarga una pista sin reproducirla. */
  preload(track: TrackDefinition): void {
    void this.getBuffer(track);
  }

  /**
   * Reproduce una pista de música con fundido.
   * Si ya suena esa pista no hace nada. Si se pide otra mientras carga, gana la última.
   */
  async playMusic(track: TrackDefinition, fadeSeconds = 2.5): Promise<void> {
    if (!this.context || !this.musicBus) return;
    if (this.current?.id === track.id) return;

    const token = ++this.requestToken;
    const buffer = await this.getBuffer(track);
    if (token !== this.requestToken || !this.context || !this.musicBus) return;
    if (!buffer) {
      // Sin archivo para esta pista: silencio suave en vez de dejar sonando la anterior
      this.fadeOutCurrent(fadeSeconds);
      return;
    }

    const ctx = this.context;
    const now = ctx.currentTime;
    this.fadeOutCurrent(fadeSeconds);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(track.volume, now + fadeSeconds);
    gain.connect(this.musicBus);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = track.loop;
    source.connect(gain);
    source.start(now);

    const active: ActiveTrack = { id: track.id, source, gain };
    source.onended = () => {
      if (this.current === active) this.current = null;
    };
    this.current = active;
  }

  stopMusic(fadeSeconds = 2): void {
    this.requestToken++;
    this.fadeOutCurrent(fadeSeconds);
  }

  async playSfx(track: TrackDefinition): Promise<void> {
    if (!this.context || !this.sfxBus) return;
    const buffer = await this.getBuffer(track);
    if (!buffer || !this.context || !this.sfxBus) return;
    const gain = this.context.createGain();
    gain.gain.value = track.volume;
    gain.connect(this.sfxBus);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.onended = () => gain.disconnect();
    source.start();
  }

  setVolume(value: number): void {
    this.volume = Math.min(Math.max(value, 0), 1);
    this.applyMaster();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyMaster();
    return this.muted;
  }

  /** Energía actual de la música, suavizada (0–1). */
  getLevel(): number {
    if (!this.analyser || !this.levelData || !this.current) {
      this.smoothedLevel *= 0.9;
      return this.smoothedLevel;
    }
    this.analyser.getByteFrequencyData(this.levelData);
    // Prioriza graves y medios bajos: dan el pulso
    const bins = Math.floor(this.levelData.length * 0.35);
    let sum = 0;
    for (let i = 0; i < bins; i++) sum += this.levelData[i];
    const raw = Math.min((sum / (bins * 255)) * 2.2, 1);
    this.smoothedLevel += (raw - this.smoothedLevel) * 0.25;
    return this.smoothedLevel;
  }

  private fadeOutCurrent(fadeSeconds: number): void {
    const old = this.current;
    if (!old || !this.context) return;
    this.current = null;
    const now = this.context.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    old.source.stop(now + fadeSeconds + 0.05);
    old.source.onended = () => old.gain.disconnect();
  }

  private applyMaster(): void {
    if (!this.master || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.15);
  }

  private getBuffer(track: TrackDefinition): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(track.src);
    if (!pending) {
      pending = this.load(track.src);
      this.buffers.set(track.src, pending);
    }
    return pending;
  }

  private async load(src: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${src}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      // decodeAudioData necesita un contexto; si aún no hay, se crea uno temporal
      const ctx = this.context ?? new OfflineAudioContext(2, 1, 44100);
      return await ctx.decodeAudioData(data);
    } catch (err) {
      console.warn(`[Audio] no se pudo cargar "${src}". Se continúa sin este sonido.`, err);
      return null;
    }
  }

  dispose(): void {
    this.stopMusic(0);
    void this.context?.close();
    this.context = null;
  }
}
