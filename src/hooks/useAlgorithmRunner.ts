import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlgorithmId, AlgorithmStep } from "../algorithms/types";
import { replaySteps, type RunSnapshot } from "../algorithms/replay";

type RunnerStatus = "idle" | "ready" | "running" | "paused" | "finished";

interface RunMeta {
  algo: AlgorithmId;
  startId: string;
  targetId?: string;
}

// Base delay per step; each speed label divides it (delay = base / speed).
// Was 680 — now 680/5 (5x faster playback) without touching the speed labels.
const BASE_DELAY_MS = 136;

export interface AlgorithmRunner {
  status: RunnerStatus;
  snapshot: RunSnapshot | null;
  meta: RunMeta | null;
  speed: number;
  index: number;
  total: number;
  setSpeed: (v: number) => void;
  begin: (steps: AlgorithmStep[], meta: RunMeta) => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: () => void;
}

/**
 * AnimationController.
 *
 *   algorithm steps[] ─▶ replay ─▶ RunSnapshot ─▶ renderer / panels
 *
 * Owns playback timing only. It never runs graph logic and never
 * touches Three.js — algorithms and rendering stay fully decoupled.
 */
export function useAlgorithmRunner(): AlgorithmRunner {
  const [steps, setSteps] = useState<AlgorithmStep[]>([]);
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const hasRun = meta !== null && steps.length > 0;
  const atEnd = hasRun && index >= steps.length - 1;

  const status: RunnerStatus = !hasRun
    ? "idle"
    : playing
      ? "running"
      : atEnd
        ? "finished"
        : index < 0
          ? "ready"
          : "paused";

  const snapshot = useMemo(
    () => (hasRun ? replaySteps(steps, index) : null),
    [hasRun, steps, index],
  );

  // Playback loop: a chain of timeouts driven by (playing, index, speed).
  useEffect(() => {
    if (!playing || !hasRun) return;
    if (index >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, steps.length - 1));
    }, BASE_DELAY_MS / speedRef.current);
    return () => window.clearTimeout(t);
  }, [playing, hasRun, index, steps]);

  const begin = useCallback((newSteps: AlgorithmStep[], newMeta: RunMeta) => {
    setSteps(newSteps);
    setMeta(newMeta);
    setIndex(-1);
    setPlaying(true);
  }, []);

  const play = useCallback(() => {
    if (!hasRun) return;
    if (index >= steps.length - 1) {
      // Restart from the beginning when pressing Run on a finished run.
      setIndex(-1);
    }
    setPlaying(true);
  }, [hasRun, index, steps.length]);

  const pause = useCallback(() => setPlaying(false), []);

  const step = useCallback(() => {
    if (!hasRun) return;
    setPlaying(false);
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [hasRun, steps.length]);

  const reset = useCallback(() => {
    setSteps([]);
    setMeta(null);
    setIndex(-1);
    setPlaying(false);
  }, []);

  const setSpeed = useCallback((v: number) => setSpeedState(v), []);

  return {
    status,
    snapshot,
    meta,
    speed,
    index,
    total: steps.length,
    setSpeed,
    begin,
    play,
    pause,
    step,
    reset,
  };
}
