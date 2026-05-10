"use client";

import * as Tone from "tone";
import { MoodProfile } from "@/lib/hearth/schema";

type ClipId =
  | "focusLow"
  | "focusMid"
  | "focusHigh"
  | "windDown"
  | "rain"
  | "brownNoise";

type SfxId = "leverGrab" | "cardMaterialize" | "regenChime";

const CLIP_URLS: Record<ClipId, string> = {
  focusLow: "/audio/loop_focus_low.mp3",
  focusMid: "/audio/loop_focus_mid.mp3",
  focusHigh: "/audio/loop_focus_high.mp3",
  windDown: "/audio/loop_winddown.mp3",
  rain: "/audio/texture_rain.mp3",
  brownNoise: "/audio/texture_brown_noise.mp3",
};

const SFX_URLS: Record<SfxId, string> = {
  leverGrab: "/audio/sfx_lever_grab.mp3",
  cardMaterialize: "/audio/sfx_card_materialize.mp3",
  regenChime: "/audio/sfx_chime_regen.mp3",
};

export class AudioEngine {
  private initialized = false;
  private started = false;
  private clips = new Map<ClipId, Tone.Player>();
  private sfx = new Map<SfxId, Tone.Player>();
  private gains = new Map<ClipId, Tone.Gain>();

  async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();
    this.initialized = true;

    await Promise.allSettled(
      (Object.keys(CLIP_URLS) as ClipId[]).map(async (id) => {
        const player = new Tone.Player({ loop: true, autostart: false });
        const gain = new Tone.Gain(0);
        player.connect(gain);
        gain.toDestination();
        try {
          await player.load(CLIP_URLS[id]);
          this.clips.set(id, player);
          this.gains.set(id, gain);
        } catch (error) {
          console.warn(`[AudioEngine] Failed to load clip: ${CLIP_URLS[id]}`, error);
          player.dispose();
          gain.dispose();
        }
      }),
    );

    await Promise.allSettled(
      (Object.keys(SFX_URLS) as SfxId[]).map(async (id) => {
        const player = new Tone.Player({ loop: false, autostart: false }).toDestination();
        try {
          await player.load(SFX_URLS[id]);
          this.sfx.set(id, player);
        } catch (error) {
          console.warn(`[AudioEngine] Failed to load SFX: ${SFX_URLS[id]}`, error);
          player.dispose();
        }
      }),
    );

    this.startBeds();
  }

  applyProfile(profile: MoodProfile): void {
    if (!this.initialized) return;
    this.startBeds();

    const intensity = clamp01(profile.music.intensity);
    const rain = clamp01(profile.music.aux.rain);
    const brownNoise = clamp01(profile.music.aux.brownNoise);
    const windDownMode = profile.goal.kind === "wind_down";

    const focusLow = windDownMode ? 0 : triangleAt(intensity, 0.08);
    const focusMid = windDownMode ? 0 : triangleAt(intensity, 0.5);
    const focusHigh = windDownMode ? 0 : triangleAt(intensity, 0.92);
    const windDown = windDownMode ? 1 : 0;

    this.ramp("focusLow", focusLow, 0.25);
    this.ramp("focusMid", focusMid, 0.25);
    this.ramp("focusHigh", focusHigh, 0.25);
    this.ramp("windDown", windDown, windDownMode ? 2.0 : 1.2);
    this.ramp("rain", rain, 0.25);
    this.ramp("brownNoise", brownNoise, 0.25);
  }

  playSfx(type: SfxId): void {
    const player = this.sfx.get(type);
    if (!player) return;
    try {
      player.stop();
      player.start();
    } catch (error) {
      console.warn(`[AudioEngine] Failed to play sfx: ${type}`, error);
    }
  }

  dispose(): void {
    this.clips.forEach((player) => player.dispose());
    this.sfx.forEach((player) => player.dispose());
    this.gains.forEach((gain) => gain.dispose());
    this.clips.clear();
    this.sfx.clear();
    this.gains.clear();
    this.initialized = false;
    this.started = false;
  }

  private startBeds() {
    if (this.started) return;
    this.started = true;
    this.clips.forEach((player) => {
      try {
        player.start();
      } catch {
        // Ignore start failures for missing/bad files to keep the UI stable.
      }
    });
  }

  private ramp(id: ClipId, targetLinear: number, seconds: number) {
    const gain = this.gains.get(id);
    if (!gain) return;
    const safeLinear = Math.max(0.00001, targetLinear);
    const targetDb = targetLinear <= 0.001 ? -72 : Tone.gainToDb(safeLinear);
    gain.gain.rampTo(Tone.dbToGain(targetDb), seconds);
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function triangleAt(value: number, peak: number): number {
  const width = 0.45;
  const delta = Math.abs(value - peak);
  if (delta >= width) return 0;
  return 1 - delta / width;
}

