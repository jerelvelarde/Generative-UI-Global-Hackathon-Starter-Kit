/**
 * Hearth — locked MoodProfile presets (frontend mirror).
 *
 * MUST mirror apps/agent/src/hearth/presets.py field-for-field.
 *
 * Two roles:
 * 1. Demo-path source of truth. The MVP demo runs from these presets so the
 *    mic-drop is bulletproof (USE_LIVE_REGEN=false).
 * 2. Initial Zustand store hydration. The frontend boots with
 *    DEEP_FOCUS_PRESET so Lever Card and shader scene have valid data
 *    even before the agent responds.
 *
 * Lever sets share zero IDs across presets — that's deliberate. When the
 * regen fires (F-08), every label changes, so the UI swap reads as a
 * category change.
 */
import type { MoodProfile } from "./schema";
import { MoodProfile as MoodProfileSchema } from "./schema";

// --------------------------- DEEP FOCUS ------------------------------------

export const DEEP_FOCUS_PRESET: MoodProfile = MoodProfileSchema.parse({
  goal: {
    kind: "deep_focus",
    description:
      "Debugging a flaky integration test, need 90 minutes of deep focus.",
    durationMin: 90,
  },
  music: {
    bpm: 65,
    intensity: 0.5,
    valence: 0.0,
    aux: { brownNoise: 0.0, rain: 0.4 },
    promptForGen:
      "instrumental lo-fi, 65 BPM, sparse harmonic content, warm rhodes and analog pads, gentle vinyl crackle, contemplative and focused, no drums in the foreground",
  },
  visual: {
    sceneId: "forest_cabin",
    uniforms: {
      colorTempK: 4500,
      rainIntensity: 0.4,
      fogDensity: 0.3,
      windowGlow: 0.7,
      timeOfDay: 0.4,
      motionRate: 0.3,
      vignette: 0.5,
    },
  },
  levers: [
    {
      id: "tempo",
      label: "Tempo",
      kind: "slider",
      description:
        "How fast the music moves. Lower for thinking, higher for rhythm.",
      bindTo: "music.bpm",
      range: { min: 50, max: 80, default: 65, step: 1 },
      outOfBoundsAt: { lo: 55 },
    },
    {
      id: "rain_intensity",
      label: "Rain",
      kind: "slider",
      description: "From clear sky to thunderstorm.",
      bindTo: "music.aux.rain",
      range: { min: 0, max: 1, default: 0.4 },
    },
    {
      id: "harmonic_density",
      label: "Harmonic density",
      kind: "slider",
      description: "Drone-like sparseness to jazzy density.",
      bindTo: "music.intensity",
      range: { min: 0, max: 1, default: 0.3 },
    },
    {
      id: "brown_noise",
      label: "Brown noise",
      kind: "slider",
      description: "Low-frequency masking layer for distractions.",
      bindTo: "music.aux.brownNoise",
      range: { min: 0, max: 1, default: 0.0 },
    },
    {
      id: "window_view",
      label: "Window view",
      kind: "segmented",
      description: "What you see through the cabin window.",
      bindTo: "visual.sceneId",
      options: [
        { value: "forest_cabin", label: "Forest" },
        { value: "warm_bedroom", label: "Cabin" },
      ],
    },
  ],
  evolution: { phase: "ramp" },
});

// --------------------------- WIND DOWN -------------------------------------

export const WIND_DOWN_PRESET: MoodProfile = MoodProfileSchema.parse({
  goal: {
    kind: "wind_down",
    description: "Winding down from a long session — let the room hold me.",
    durationMin: 30,
  },
  music: {
    bpm: 54,
    intensity: 0.7,
    valence: -0.2,
    aux: { brownNoise: 0.2, rain: 0.3 },
    promptForGen:
      "ambient instrumental, 54 BPM, lush evolving pads, gentle felt piano, slow reverb tails, warm and contemplative, melancholy but tender, no percussion",
  },
  visual: {
    sceneId: "warm_bedroom",
    uniforms: {
      colorTempK: 2900,
      rainIntensity: 0.3,
      fogDensity: 0.5,
      windowGlow: 0.4,
      timeOfDay: 0.85,
      motionRate: 0.15,
      vignette: 0.7,
    },
  },
  levers: [
    {
      id: "valence",
      label: "Valence",
      kind: "slider",
      description: "Melancholy through tender to hopeful.",
      bindTo: "music.valence",
      range: { min: -1, max: 1, default: -0.2 },
    },
    {
      id: "pad_density",
      label: "Pad density",
      kind: "slider",
      description: "Sparse held notes to lush evolving pads.",
      bindTo: "music.intensity",
      range: { min: 0, max: 1, default: 0.6 },
    },
    {
      id: "candlelight_flicker",
      label: "Candlelight flicker",
      kind: "slider",
      description: "Steady glow to lively flicker.",
      bindTo: "visual.uniforms.motionRate",
      range: { min: 0, max: 1, default: 0.5 },
    },
    {
      id: "breathing_pace",
      label: "Breathing pace",
      kind: "slider",
      description: "Slow inhale-exhale rhythm. Match your breath to the room.",
      bindTo: "music.bpm",
      range: { min: 48, max: 60, default: 54, step: 1 },
    },
    {
      id: "ambient_warmth",
      label: "Ambient warmth",
      kind: "slider",
      description: "Cool ember to warm hearthlight.",
      bindTo: "visual.uniforms.colorTempK",
      range: { min: 2700, max: 3500, default: 2900, step: 50 },
    },
  ],
  evolution: { phase: "wind_down" },
});

/**
 * Resolution map: when an agent response fails validation, frontend falls
 * back by goal.kind. Keep in sync with GoalKind enum.
 */
export const PRESETS_BY_KIND: Record<string, MoodProfile> = {
  deep_focus: DEEP_FOCUS_PRESET,
  wind_down: WIND_DOWN_PRESET,
  creative: DEEP_FOCUS_PRESET,
  energetic: DEEP_FOCUS_PRESET,
};
