import type { ArcadeEvent } from "../game/arcade/types";

/** Optional, gesture-unlocked Web Audio. Audio failure never affects gameplay. */
export class ArcadeAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<AudioScheduledSourceNode>();
  private enabled = false;
  private disposed = false;

  /** Call from a user's Tip off or sound-setting interaction, never from render. */
  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.enabled = enabled;
    try {
      if (enabled && !this.context) {
        const Audio =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = 0.23;
        this.master.connect(this.context.destination);
        this.noise = this.context.createBuffer(
          1,
          Math.floor(this.context.sampleRate * 0.5),
          this.context.sampleRate,
        );
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
      }
      if (this.context && this.master) {
        this.master.gain.setTargetAtTime(
          enabled ? 0.23 : 0,
          this.context.currentTime,
          0.02,
        );
        if (enabled && this.context.state === "suspended")
          void this.context.resume().catch(() => {});
      }
    } catch {
      // Browser policy, missing devices, and unavailable APIs are all optional.
    }
  }

  play(event: ArcadeEvent): void {
    if (
      !this.enabled ||
      this.disposed ||
      !this.context ||
      !this.master ||
      this.context.state !== "running"
    )
      return;
    try {
      switch (event.kind) {
        case "score":
          this.tone(523, 523, 0.15, 0.24, "triangle");
          this.tone(659, 659, 0.18, 0.21, "triangle", 0.065);
          this.tone(
            event.value === 3 ? 1047 : 784,
            784,
            0.25,
            0.22,
            "triangle",
            0.13,
          );
          this.rush(0.38, 0.19, 1600, 0.06);
          break;
        case "shot":
          this.tone(170, 72, 0.11, 0.42, "sine");
          this.rush(0.045, 0.12, 900);
          break;
        case "pass":
          this.rush(0.075, 0.13, 1600);
          break;
        case "rebound":
          this.tone(185, 82, 0.095, 0.36, "sine");
          break;
        case "block":
          this.tone(105, 48, 0.14, 0.46, "triangle");
          this.rush(0.08, 0.26, 2400);
          break;
        case "steal":
          this.tone(650, 950, 0.075, 0.15, "triangle");
          this.tone(850, 1200, 0.08, 0.12, "triangle", 0.07);
          break;
        case "turnover":
          this.tone(1800, 1600, 0.13, 0.08, "sine");
          break;
        case "period":
          this.tone(1800, 2100, 0.17, 0.1, "sine");
          this.tone(2050, 1850, 0.21, 0.09, "sine", 0.2);
          break;
        case "sub":
          this.tone(380, 510, 0.07, 0.11, "triangle");
          break;
      }
    } catch {
      // Losing the audio device or closing the tab must not stop the game loop.
    }
  }

  private envelope(
    duration: number,
    volume: number,
    delay: number,
  ): { gain: GainNode; start: number } {
    const context = this.context!;
    const gain = context.createGain();
    const start = context.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      start + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.master!);
    return { gain, start };
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    volume: number,
    wave: OscillatorType,
    delay = 0,
  ) {
    const oscillator = this.context!.createOscillator();
    const { gain, start } = this.envelope(duration, volume, delay);
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    oscillator.connect(gain);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(oscillator);
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private rush(duration: number, volume: number, cutoff: number, delay = 0) {
    if (!this.noise) return;
    const context = this.context!;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const { gain, start } = this.envelope(duration, volume, delay);
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.6;
    source.connect(filter);
    filter.connect(gain);
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.voices.delete(source);
    };
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    for (const voice of this.voices) {
      try {
        voice.stop();
        voice.disconnect();
      } catch {
        /* A voice may already have ended. */
      }
    }
    this.voices.clear();
    try {
      this.master?.disconnect();
    } catch {
      /* Optional device cleanup. */
    }
    const context = this.context;
    this.context = null;
    this.master = null;
    this.noise = null;
    if (context && context.state !== "closed") {
      try {
        void context.close().catch(() => {});
      } catch {
        /* Optional device cleanup. */
      }
    }
  }
}
