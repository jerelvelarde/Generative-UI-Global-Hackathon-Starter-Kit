"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CinematicTransition } from "@/components/hearth/transition/CinematicTransition";
import {
  LeverCard,
  LeverValue,
  LeverValueMap,
} from "@/components/hearth/lever-card/LeverCard";
import { HearthRoom } from "@/components/hearth/room/HearthRoom";
import { WelcomeScreen } from "@/components/hearth/welcome/WelcomeScreen";
import { MoodProfile } from "@/lib/hearth/schema";
import { AudioEngine } from "@/lib/hearth/audio/AudioEngine";

type Stage = "welcome" | "transition" | "room";

const DEEP_FOCUS_PROFILE: MoodProfile = {
  goal: {
    kind: "deep_focus",
    description: "Debugging a flaky integration test, need 90 minutes of deep focus.",
    durationMin: 90,
  },
  music: {
    bpm: 65,
    intensity: 0.5,
    valence: 0,
    aux: {
      brownNoise: 0.0,
      rain: 0.4,
    },
    promptForGen:
      "instrumental lo-fi, 65 BPM, sparse harmonic content, warm rhodes and analog pads, gentle vinyl crackle",
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
      description: "Lower for logic tracing, higher for repetitive coding rhythm.",
      bindTo: "music.bpm",
      range: { min: 50, max: 80, default: 65, step: 1 },
      outOfBoundsAt: { lo: 55 },
    },
    {
      id: "rain_intensity",
      label: "Rain",
      kind: "slider",
      description: "From clear night to heavy storm.",
      bindTo: "visual.uniforms.rainIntensity",
      range: { min: 0, max: 1, default: 0.4, step: 0.01 },
    },
    {
      id: "harmonic_density",
      label: "Harmonic density",
      kind: "slider",
      description: "Drone-like sparseness to jazzier movement.",
      bindTo: "music.intensity",
      range: { min: 0, max: 1, default: 0.5, step: 0.01 },
    },
    {
      id: "brown_noise",
      label: "Brown noise",
      kind: "slider",
      description: "Mask low-frequency distractions.",
      bindTo: "music.aux.brownNoise",
      range: { min: 0, max: 1, default: 0.0, step: 0.01 },
    },
    {
      id: "window_view",
      label: "Window view",
      kind: "segmented",
      description: "Switch visual scene template.",
      bindTo: "visual.sceneId",
      options: [
        { value: "forest_cabin", label: "Forest" },
        { value: "warm_bedroom", label: "Cabin" },
      ],
    },
  ],
  evolution: { phase: "ramp" },
};

const WIND_DOWN_PROFILE: MoodProfile = {
  goal: {
    kind: "wind_down",
    description: "Wind down before sleep after a long debug session.",
    durationMin: 45,
  },
  music: {
    bpm: 56,
    intensity: 0.2,
    valence: -0.2,
    aux: {
      brownNoise: 0.12,
      rain: 0.2,
    },
    promptForGen:
      "slow ambient pads, warm piano accents, 56 BPM, gentle and reflective, no percussion",
  },
  visual: {
    sceneId: "warm_bedroom",
    uniforms: {
      colorTempK: 3050,
      rainIntensity: 0.15,
      fogDensity: 0.25,
      windowGlow: 0.85,
      timeOfDay: 0.82,
      motionRate: 0.12,
      vignette: 0.62,
    },
  },
  levers: [
    {
      id: "valence",
      label: "Valence",
      kind: "slider",
      description: "Melancholy to hopeful emotional tone.",
      bindTo: "music.valence",
      range: { min: -1, max: 1, default: -0.2, step: 0.01 },
    },
    {
      id: "pad_density",
      label: "Pad density",
      kind: "slider",
      description: "Sparse to lush ambient layers.",
      bindTo: "music.intensity",
      range: { min: 0, max: 1, default: 0.2, step: 0.01 },
    },
    {
      id: "candlelight",
      label: "Candlelight",
      kind: "slider",
      description: "Controls room warmth and glow.",
      bindTo: "visual.uniforms.windowGlow",
      range: { min: 0, max: 1, default: 0.85, step: 0.01 },
    },
    {
      id: "breathing_sync",
      label: "Breathing sync",
      kind: "toggle",
      description: "Set pace to a guided breathing rhythm.",
      bindTo: "music.aux.brownNoise",
    },
    {
      id: "ambient_warmth",
      label: "Ambient warmth",
      kind: "slider",
      description: "Warmth of the visual color temperature.",
      bindTo: "visual.uniforms.colorTempK",
      range: { min: 2700, max: 3500, default: 3050, step: 10 },
    },
  ],
  evolution: { phase: "wind_down" },
};

export default function HearthLabPage() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [goalText, setGoalText] = useState(DEEP_FOCUS_PROFILE.goal.description);
  const [profileReady, setProfileReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [profile, setProfile] = useState<MoodProfile>(DEEP_FOCUS_PROFILE);
  const [transitionKey, setTransitionKey] = useState("deep_focus");
  const audioRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    audioRef.current = new AudioEngine();
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioReady) return;
    audioRef.current?.applyProfile(profile);
  }, [audioReady, profile]);

  const leverValues = useMemo(() => buildLeverValues(profile), [profile]);

  const handleSubmitGoal = (nextGoal: string) => {
    setGoalText(nextGoal);
    setStage("transition");
    setProfileReady(false);
    window.setTimeout(() => {
      setProfile((prev) => ({
        ...prev,
        goal: { ...prev.goal, description: nextGoal },
      }));
      setProfileReady(true);
    }, 1200);
  };

  const handleLeverChange = (bindTo: string, nextValue: LeverValue) => {
    setProfile((prev) => setByPath(prev, bindTo, nextValue));
  };

  const enableAudio = async () => {
    if (audioReady) return;
    await audioRef.current?.init();
    setAudioReady(true);
    audioRef.current?.playSfx("cardMaterialize");
    audioRef.current?.applyProfile(profile);
  };

  const swapProfile = () => {
    const next = profile.goal.kind === "deep_focus" ? WIND_DOWN_PROFILE : DEEP_FOCUS_PROFILE;
    setProfile(next);
    setTransitionKey(`${next.goal.kind}-${Date.now()}`);
    audioRef.current?.playSfx("regenChime");
  };

  if (stage === "welcome") {
    return (
      <WelcomeScreen
        goalText={goalText}
        onGoalTextChange={setGoalText}
        onSubmitGoal={handleSubmitGoal}
      />
    );
  }

  if (stage === "transition") {
    return (
      <CinematicTransition
        goalText={goalText}
        isProfileReady={profileReady}
        preview={
          <HearthRoom
            sceneId={profile.visual.sceneId}
            uniforms={profile.visual.uniforms}
            className="h-screen rounded-none border-0"
          />
        }
        onComplete={() => setStage("room")}
      />
    );
  }

  return (
    <main className="grid min-h-screen gap-4 bg-[#060914] p-4 lg:grid-cols-[1fr_380px]">
      <HearthRoom
        sceneId={profile.visual.sceneId}
        uniforms={profile.visual.uniforms}
        overlayTitle={`${profile.goal.kind.replace("_", " ")} · ${profile.goal.durationMin} min`}
      />
      <div className="flex flex-col gap-4">
        <LeverCard
          title={`For ${profile.goal.kind.replace("_", " ")}`}
          note="Calibrated for your current session. Push one control far enough and the card can regenerate."
          levers={profile.levers}
          values={leverValues}
          transitionKey={transitionKey}
          onValueChange={(lever, nextValue) => handleLeverChange(lever.bindTo, nextValue)}
        />
        <div className="rounded-2xl border border-white/15 bg-[#100f16]/72 p-4 text-[#f3efdf]">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#decf9f]">
            Harness Controls
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enableAudio}
              className="rounded-full border border-[#d9c48f]/50 px-3 py-1 font-mono text-xs text-[#f5ebcd]"
            >
              {audioReady ? "Audio Ready" : "Enable Audio"}
            </button>
            <button
              type="button"
              onClick={swapProfile}
              className="rounded-full border border-[#d9c48f]/50 px-3 py-1 font-mono text-xs text-[#f5ebcd]"
            >
              Trigger Regen Swap
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function buildLeverValues(profile: MoodProfile): LeverValueMap {
  const values: LeverValueMap = {};
  for (const lever of profile.levers) {
    values[lever.id] = getByPath(profile, lever.bindTo);
  }
  return values;
}

function getByPath(source: unknown, path: string): LeverValue | undefined {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (
    typeof current === "number" ||
    typeof current === "string" ||
    typeof current === "boolean"
  ) {
    return current;
  }
  return undefined;
}

function setByPath(profile: MoodProfile, path: string, rawValue: LeverValue): MoodProfile {
  const parts = path.split(".");
  const clone = structuredClone(profile) as Record<string, unknown>;
  let cursor: Record<string, unknown> = clone;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const next = cursor[key];
    if (!next || typeof next !== "object") return profile;
    cursor = next as Record<string, unknown>;
  }

  const leaf = parts[parts.length - 1];
  if (!(leaf in cursor)) return profile;

  const current = cursor[leaf];
  if (typeof current === "number" && typeof rawValue === "string") {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) cursor[leaf] = parsed;
  } else if (typeof current === "number" && typeof rawValue === "boolean") {
    cursor[leaf] = rawValue ? 1 : 0;
  } else if (typeof current === "string" && typeof rawValue !== "boolean") {
    cursor[leaf] = String(rawValue);
  } else if (typeof current === "boolean") {
    cursor[leaf] = Boolean(rawValue);
  } else if (typeof current === "number" && typeof rawValue === "number") {
    cursor[leaf] = rawValue;
  }

  return clone as MoodProfile;
}

