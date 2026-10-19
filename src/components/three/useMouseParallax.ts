import { useEffect, useRef } from "react";

export function useMouseParallax(enabled = true, damp = 0.08) {
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * damp;
      current.current.y += (target.current.y - current.current.y) * damp;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [damp, enabled]);

  return current;
}
