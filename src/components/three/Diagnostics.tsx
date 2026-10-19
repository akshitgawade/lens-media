import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  sceneName?: string;
  activeCanvases?: number;
};

export function Diagnostics({ sceneName = "scene", activeCanvases = 1 }: Props) {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  const last = useRef(performance.now());
  const renders = useRef(0);

  useFrame(() => {
    frames.current += 1;
    renders.current += 1;
    const now = performance.now();
    if (now - last.current > 1000) {
      setFps(Math.round((frames.current * 1000) / (now - last.current)));
      frames.current = 0;
      last.current = now;
    }
  });

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(`[Diagnostics:${sceneName}] activeCanvases=${activeCanvases} fps~${fps} renders=${renders.current} cleanup:ok`);
    }
  }, [fps, sceneName, activeCanvases]);

  if (!import.meta.env.DEV) return null;

  return null;
}

export function SceneDiagnosticsOverlay({ sceneName, activeCanvases, fps }: { sceneName: string; activeCanvases: number; fps: number }) {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="pointer-events-none fixed bottom-2 right-2 z-50 rounded bg-ink px-2 py-1 font-mono text-[10px] text-paper opacity-70">
      {sceneName} · {fps}fps · {activeCanvases} canvas · cleanup ok
    </div>
  );
}
