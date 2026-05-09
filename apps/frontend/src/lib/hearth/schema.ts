/**
 * Hearth MoodProfile — Zod schema (frontend mirror).
 *
 * THIS FILE MIRRORS apps/agent/src/hearth/schema.py.
 * If you change one, change the other in the same commit.
 *
 * The agent emits MoodProfile via Gemini structured output; the frontend
 * validates the response, persists to the Zustand store, and renders the
 * Lever Card from `profile.levers`. F-06 makes this profile frontend-owned:
 * lever drags mutate it locally; agent tool calls mutate it via CopilotKit
 * frontend tools (updateLeverValue / addLever / swapScene).
 */
import { z } from "zod";

// ----------------------------- enums ---------------------------------------

export const GoalKind = z.enum([
  "deep_focus",
  "wind_down",
  "creative",
  "energetic",
]);
export type GoalKind = z.infer<typeof GoalKind>;

export const SceneId = z.enum(["forest_cabin", "warm_bedroom"]);
export type SceneId = z.infer<typeof SceneId>;

export const LeverKind = z.enum(["slider", "segmented", "toggle"]);
export type LeverKind = z.infer<typeof LeverKind>;

// ------------------------ lever sub-types ----------------------------------

export const LeverRange = z.object({
  min: z.number(),
  max: z.number(),
  default: z.number(),
  step: z.number().optional(),
});
export type LeverRange = z.infer<typeof LeverRange>;

export const LeverOption = z.object({
  value: z.string(),
  label: z.string(),
});
export type LeverOption = z.infer<typeof LeverOption>;

/**
 * Crossing either threshold for > 3s triggers F-07 (amber) then F-08 (regen).
 * A lever with no `outOfBoundsAt` never triggers regen.
 */
export const OutOfBoundsAt = z.object({
  lo: z.number().optional(),
  hi: z.number().optional(),
});
export type OutOfBoundsAt = z.infer<typeof OutOfBoundsAt>;

/**
 * One control on the Lever Card. Agent emits an array of these tailored
 * to the user's goal. Plain-language labels — no DSP jargon.
 *
 * `bindTo` is a dot-path into MoodProfile (e.g. "music.bpm", "music.aux.rain",
 * "visual.sceneId"). Invalid paths are caught at runtime — the lever drags
 * but doesn't mutate anything.
 */
export const Lever = z.object({
  id: z.string(),
  label: z.string(),
  kind: LeverKind,
  description: z.string().optional(),
  bindTo: z.string(),
  range: LeverRange.optional(),
  options: z.array(LeverOption).optional(),
  outOfBoundsAt: OutOfBoundsAt.optional(),
});
export type Lever = z.infer<typeof Lever>;

// ------------------------- profile sub-types -------------------------------

export const Goal = z.object({
  kind: GoalKind,
  description: z.string(),
  durationMin: z.number().int(),
});
export type Goal = z.infer<typeof Goal>;

export const MusicAux = z.object({
  brownNoise: z.number().min(0).max(1),
  rain: z.number().min(0).max(1),
});
export type MusicAux = z.infer<typeof MusicAux>;

export const Music = z.object({
  /**
   * Drives clip selection (low/mid/high focus or wind-down). MVP does NOT
   * time-stretch audio — bpm changes which clip plays, not the tempo of
   * the playing clip.
   */
  bpm: z.number(),
  /** 0..1 crossfade weight across the focus clip stack. */
  intensity: z.number().min(0).max(1),
  /** -1 melancholy .. 0 neutral .. +1 hopeful. Used by wind-down. */
  valence: z.number().min(-1).max(1),
  aux: MusicAux,
  /** Lyria prompt. Used only when USE_LYRIA=true (stretch F-16). */
  promptForGen: z.string(),
});
export type Music = z.infer<typeof Music>;

/**
 * Shader uniforms. The renderer lerps these per frame for smooth
 * transitions when the agent updates the profile.
 */
export const VisualUniforms = z.object({
  colorTempK: z.number().min(2700).max(6500),
  rainIntensity: z.number().min(0).max(1),
  fogDensity: z.number().min(0).max(1),
  windowGlow: z.number().min(0).max(1),
  /** 0=dawn, 0.5=midday, 1=night. */
  timeOfDay: z.number().min(0).max(1),
  motionRate: z.number().min(0).max(1),
  vignette: z.number().min(0).max(1),
});
export type VisualUniforms = z.infer<typeof VisualUniforms>;

export const Visual = z.object({
  sceneId: SceneId,
  uniforms: VisualUniforms,
});
export type Visual = z.infer<typeof Visual>;

export const Evolution = z.object({
  phase: z.enum(["ramp", "sustain", "wind_down"]),
});
export type Evolution = z.infer<typeof Evolution>;

// ----------------------------- root ----------------------------------------

/**
 * The single source of truth for what the room is right now.
 * Frontend-owned per F-06.
 *
 * The `levers` array is the GenUI heart of Hearth: the agent generates
 * which controls exist for *this* user, *this* goal, *this* moment. Other
 * apps draw their UI in Figma. Hearth's UI is agent output.
 */
export const MoodProfile = z.object({
  goal: Goal,
  music: Music,
  visual: Visual,
  levers: z.array(Lever),
  evolution: Evolution,
});
export type MoodProfile = z.infer<typeof MoodProfile>;
