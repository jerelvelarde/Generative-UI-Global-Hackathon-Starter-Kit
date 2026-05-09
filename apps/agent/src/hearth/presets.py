"""Hearth — locked MoodProfile presets.

Two roles:
1. **Demo-path source of truth.** The MVP demo runs with these presets
   (USE_LIVE_REGEN=false) so the mic-drop is bulletproof on stage.
2. **Agent fallback.** When Gemini structured output fails schema
   validation (F-02 retry → fallback), the agent emits one of these.

Lever sets share zero IDs across presets — that's deliberate. When the
regen fires, every label changes, so the UI swap reads as a category
change, not a value change.

If you change a preset, update the TS mirror at
``apps/frontend/src/lib/hearth/presets.ts`` in the same commit.
"""

from __future__ import annotations

from .schema import (
    Evolution,
    Goal,
    Lever,
    LeverOption,
    LeverRange,
    MoodProfile,
    Music,
    MusicAux,
    OutOfBoundsAt,
    Visual,
    VisualUniforms,
)


# --------------------------- DEEP FOCUS ------------------------------------

DEEP_FOCUS_PRESET: MoodProfile = MoodProfile(
    goal=Goal(
        kind="deep_focus",
        description="Debugging a flaky integration test, need 90 minutes of deep focus.",
        durationMin=90,
    ),
    music=Music(
        bpm=65,
        intensity=0.5,
        valence=0.0,
        aux=MusicAux(brownNoise=0.0, rain=0.4),
        promptForGen=(
            "instrumental lo-fi, 65 BPM, sparse harmonic content, "
            "warm rhodes and analog pads, gentle vinyl crackle, "
            "contemplative and focused, no drums in the foreground"
        ),
    ),
    visual=Visual(
        sceneId="forest_cabin",
        uniforms=VisualUniforms(
            colorTempK=4500,
            rainIntensity=0.4,
            fogDensity=0.3,
            windowGlow=0.7,
            timeOfDay=0.4,
            motionRate=0.3,
            vignette=0.5,
        ),
    ),
    levers=[
        Lever(
            id="tempo",
            label="Tempo",
            kind="slider",
            description="How fast the music moves. Lower for thinking, higher for rhythm.",
            bindTo="music.bpm",
            range=LeverRange(min=50, max=80, default=65, step=1),
            outOfBoundsAt=OutOfBoundsAt(lo=55),  # crossing this triggers F-08
        ),
        Lever(
            id="rain_intensity",
            label="Rain",
            kind="slider",
            description="From clear sky to thunderstorm.",
            bindTo="music.aux.rain",
            range=LeverRange(min=0, max=1, default=0.4),
        ),
        Lever(
            id="harmonic_density",
            label="Harmonic density",
            kind="slider",
            description="Drone-like sparseness to jazzy density.",
            bindTo="music.intensity",
            range=LeverRange(min=0, max=1, default=0.3),
        ),
        Lever(
            id="brown_noise",
            label="Brown noise",
            kind="slider",
            description="Low-frequency masking layer for distractions.",
            bindTo="music.aux.brownNoise",
            range=LeverRange(min=0, max=1, default=0.0),
        ),
        Lever(
            id="window_view",
            label="Window view",
            kind="segmented",
            description="What you see through the cabin window.",
            bindTo="visual.sceneId",
            options=[
                LeverOption(value="forest_cabin", label="Forest"),
                LeverOption(value="warm_bedroom", label="Cabin"),
            ],
        ),
    ],
    evolution=Evolution(phase="ramp"),
)


# --------------------------- WIND DOWN -------------------------------------

WIND_DOWN_PRESET: MoodProfile = MoodProfile(
    goal=Goal(
        kind="wind_down",
        description="Winding down from a long session — let the room hold me.",
        durationMin=30,
    ),
    music=Music(
        bpm=54,
        intensity=0.7,
        valence=-0.2,
        aux=MusicAux(brownNoise=0.2, rain=0.3),
        promptForGen=(
            "ambient instrumental, 54 BPM, lush evolving pads, gentle felt piano, "
            "slow reverb tails, warm and contemplative, melancholy but tender, "
            "no percussion"
        ),
    ),
    visual=Visual(
        sceneId="warm_bedroom",
        uniforms=VisualUniforms(
            colorTempK=2900,
            rainIntensity=0.3,
            fogDensity=0.5,
            windowGlow=0.4,
            timeOfDay=0.85,  # night
            motionRate=0.15,
            vignette=0.7,
        ),
    ),
    levers=[
        Lever(
            id="valence",
            label="Valence",
            kind="slider",
            description="Melancholy through tender to hopeful.",
            bindTo="music.valence",
            range=LeverRange(min=-1, max=1, default=-0.2),
        ),
        Lever(
            id="pad_density",
            label="Pad density",
            kind="slider",
            description="Sparse held notes to lush evolving pads.",
            bindTo="music.intensity",
            range=LeverRange(min=0, max=1, default=0.6),
        ),
        Lever(
            id="candlelight_flicker",
            label="Candlelight flicker",
            kind="slider",
            description="Steady glow to lively flicker.",
            bindTo="visual.uniforms.motionRate",
            range=LeverRange(min=0, max=1, default=0.5),
        ),
        Lever(
            id="breathing_pace",
            label="Breathing pace",
            kind="slider",
            description="Slow inhale-exhale rhythm. Match your breath to the room.",
            bindTo="music.bpm",
            range=LeverRange(min=48, max=60, default=54, step=1),
        ),
        Lever(
            id="ambient_warmth",
            label="Ambient warmth",
            kind="slider",
            description="Cool ember to warm hearthlight.",
            bindTo="visual.uniforms.colorTempK",
            range=LeverRange(min=2700, max=3500, default=2900, step=50),
        ),
    ],
    evolution=Evolution(phase="wind_down"),
)


# Resolution map: the agent looks up a fallback by goal.kind when its
# structured output fails validation. Keep keys in sync with GoalKind.
PRESETS_BY_KIND: dict[str, MoodProfile] = {
    "deep_focus": DEEP_FOCUS_PRESET,
    "wind_down": WIND_DOWN_PRESET,
    # creative + energetic intentionally fall through to deep_focus for MVP —
    # add their own presets when scenes for them exist.
    "creative": DEEP_FOCUS_PRESET,
    "energetic": DEEP_FOCUS_PRESET,
}


__all__ = [
    "DEEP_FOCUS_PRESET",
    "WIND_DOWN_PRESET",
    "PRESETS_BY_KIND",
]
