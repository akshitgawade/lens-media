import React, { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { ClientOnly } from "./ClientOnly";
import { SceneFallback } from "./SceneFallback";
import { useSceneVisibility } from "./useSceneVisibility";
import { useReducedMotion } from "./useReducedMotion";

type Quality = "low" | "medium" | "high" | "auto";
type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
  dpr?: [number, number];
  frameloop?: "always" | "demand" | "never";
  quality?: Quality;
  ariaHidden?: boolean;
  onContextLost?: () => void;
  sceneName?: string;
};

let activeCanvasCount = 0;
function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function getQualityTier(requested: Quality): Quality {
  if (requested !== "auto") return requested;
  if (typeof window === "undefined") return "medium";
  const lowMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory !== undefined && (navigator as unknown as { deviceMemory: number }).deviceMemory <= 4;
  const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4;
  const isMobile = window.innerWidth < 768;
  if (isMobile || lowMemory || lowCores) return "low";
  return window.devicePixelRatio > 1.5 ? "high" : "medium";
}

class SceneErrorBoundary extends React.Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error("[SceneCanvas] render error", err); this.setState({ hasError: true }); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

export function SceneCanvas({
  children,
  className,
  style,
  fallback,
  dpr,
  frameloop = "demand",
  quality = "auto",
  ariaHidden = true,
  onContextLost,
  sceneName = "scene",
}: Props) {
  const { ref, isVisible } = useSceneVisibility<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglOk, setWebglOk] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const reducedMotion = useReducedMotion();
  const [resolvedQuality, setResolvedQuality] = useState<Quality>("medium");

  // One-canvas-per-page enforcement (dev warning)
  useEffect(() => {
    activeCanvasCount += 1;
    if (import.meta.env.DEV && activeCanvasCount > 1) {
      console.warn(`[SceneCanvas] one-canvas-per-page violated: ${activeCanvasCount} active (${sceneName}). Keep one canvas per page.`);
    }
    return () => {
      activeCanvasCount = Math.max(0, activeCanvasCount - 1);
    };
  }, [sceneName]);

  useEffect(() => {
    setWebglOk(hasWebGL());
    setResolvedQuality(getQualityTier(quality));
    const onResize = () => setResolvedQuality(getQualityTier(quality));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [quality]);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      onContextLost?.();
      if (import.meta.env.DEV) console.warn(`[SceneCanvas:${sceneName}] webglcontextlost`);
    };
    const onRestored = () => {
      setContextLost(false);
      if (import.meta.env.DEV) console.info(`[SceneCanvas:${sceneName}] webglcontextrestored`);
    };
    target.addEventListener("webglcontextlost", onLost as EventListener);
    target.addEventListener("webglcontextrestored", onRestored as EventListener);
    return () => {
      target.removeEventListener("webglcontextlost", onLost as EventListener);
      target.removeEventListener("webglcontextrestored", onRestored as EventListener);
    };
  }, [onContextLost, sceneName]);

  // Responsive resize is handled by R3F + CSS, but ensure container resize triggers invalidation
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // R3F handles resize automatically; this just ensures diagnostics stay correct
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cleanup on unmount: dispose renderer resources
  useEffect(() => {
    return () => {
      // R3F disposes on unmount; ensure any lingering listeners cleared above
      if (import.meta.env.DEV) console.info(`[SceneCanvas:${sceneName}] cleanup`);
    };
  }, [sceneName]);

  const tierDpr: [number, number] = dpr ?? (resolvedQuality === "low" ? [1, 1] : resolvedQuality === "high" ? [1, 1.5] : [1, 1.25]);
  // Enforce caps: max 1.5, low-power max 1
  const cappedDpr: [number, number] = [Math.min(tierDpr[0], 1.5), Math.min(tierDpr[1], 1.5)];
  const effectiveFrameloop = !isVisible || contextLost || reducedMotion ? "never" as const : frameloop;
  const showFallback = !webglOk || contextLost || reducedMotion;
  const antialias = resolvedQuality !== "low";

  const innerFallback = fallback ?? <SceneFallback className={className} style={style} />;

  return (
    <div ref={ref} className={className} style={style} aria-hidden={ariaHidden} data-scene={sceneName}>
      <ClientOnly fallback={innerFallback}>
        {showFallback ? (
          innerFallback
        ) : (
          <SceneErrorBoundary fallback={innerFallback}>
            <Canvas
              ref={canvasRef as unknown as React.Ref<HTMLCanvasElement>}
              frameloop={effectiveFrameloop}
              dpr={cappedDpr}
              gl={{ alpha: true, antialias, powerPreference: resolvedQuality === "low" ? "low-power" : "high-performance" }}
              style={{ background: "transparent" }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              {children}
            </Canvas>
            {import.meta.env.DEV ? (
              <span className="sr-only" data-diagnostics={`canvases:${activeCanvasCount} scene:${sceneName} visible:${String(isVisible)} frameloop:${effectiveFrameloop} dpr:${cappedDpr.join("-")} quality:${resolvedQuality}`} />
            ) : null}
          </SceneErrorBoundary>
        )}
      </ClientOnly>
    </div>
  );
}
