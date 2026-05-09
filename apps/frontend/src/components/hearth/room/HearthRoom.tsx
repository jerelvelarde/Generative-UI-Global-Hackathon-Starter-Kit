"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SceneId, VisualUniforms } from "@/lib/hearth/schema";
import {
  FOREST_CABIN_FRAGMENT_SHADER,
  HEARTH_VERTEX_SHADER,
} from "@/components/hearth/room/shaders/forestCabinShader";

type HearthRoomProps = {
  sceneId: SceneId;
  uniforms: VisualUniforms;
  className?: string;
  overlayTitle?: string;
};

type ShaderBackdropProps = {
  sceneId: SceneId;
  uniforms: VisualUniforms;
};

export function HearthRoom({
  sceneId,
  uniforms,
  className,
  overlayTitle,
}: HearthRoomProps) {
  const overlayText =
    overlayTitle ??
    (sceneId === "forest_cabin" ? "Forest cabin" : "Warm bedroom");

  return (
    <section
      className={`relative h-full min-h-[500px] overflow-hidden rounded-3xl border border-white/15 bg-[#090d16] ${className ?? ""}`}
    >
      <Canvas
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
        fallback={
          <div className="flex h-full items-center justify-center bg-[#090d16] p-6 text-sm text-[#d8d3bc]">
            WebGL is unavailable. Showing static room fallback.
          </div>
        }
      >
        <ShaderBackdrop sceneId={sceneId} uniforms={uniforms} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-6 rounded-full border border-white/20 bg-black/35 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#efe4c8]">
          {overlayText}
        </div>
        <div
          className={`absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t ${
            sceneId === "forest_cabin"
              ? "from-[#090b12] via-[#11192a]/80 to-transparent"
              : "from-[#130d10] via-[#2b1c2e]/75 to-transparent"
          }`}
        />
      </div>
    </section>
  );
}

function ShaderBackdrop({ sceneId, uniforms }: ShaderBackdropProps) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const targets = useMemo(() => uniforms, [uniforms]);

  const shaderUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSceneMix: { value: sceneId === "warm_bedroom" ? 1 : 0 },
      uColorTempK: { value: targets.colorTempK },
      uRainIntensity: { value: targets.rainIntensity },
      uFogDensity: { value: targets.fogDensity },
      uWindowGlow: { value: targets.windowGlow },
      uTimeOfDay: { value: targets.timeOfDay },
      uMotionRate: { value: targets.motionRate },
      uVignette: { value: targets.vignette },
    }),
    [],
  );

  useEffect(() => {
    shaderUniforms.uSceneMix.value = sceneId === "warm_bedroom" ? 1 : 0;
  }, [sceneId, shaderUniforms]);

  useFrame((_state, delta) => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms as Record<string, { value: number }>;
    u.uTime.value += delta;
    u.uSceneMix.value = damp(
      u.uSceneMix.value,
      sceneId === "warm_bedroom" ? 1 : 0,
      4.2,
      delta,
    );
    u.uColorTempK.value = damp(u.uColorTempK.value, targets.colorTempK, 6.5, delta);
    u.uRainIntensity.value = damp(
      u.uRainIntensity.value,
      clamp01(targets.rainIntensity),
      6.5,
      delta,
    );
    u.uFogDensity.value = damp(
      u.uFogDensity.value,
      clamp01(targets.fogDensity),
      5.8,
      delta,
    );
    u.uWindowGlow.value = damp(
      u.uWindowGlow.value,
      clamp01(targets.windowGlow),
      6.4,
      delta,
    );
    u.uTimeOfDay.value = damp(
      u.uTimeOfDay.value,
      clamp01(targets.timeOfDay),
      3.8,
      delta,
    );
    u.uMotionRate.value = damp(
      u.uMotionRate.value,
      clamp01(targets.motionRate),
      5.2,
      delta,
    );
    u.uVignette.value = damp(u.uVignette.value, clamp01(targets.vignette), 4.5, delta);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={shaderUniforms}
        vertexShader={HEARTH_VERTEX_SHADER}
        fragmentShader={FOREST_CABIN_FRAGMENT_SHADER}
      />
    </mesh>
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function damp(current: number, target: number, smoothing: number, delta: number) {
  return THREE.MathUtils.damp(current, target, smoothing, delta);
}

