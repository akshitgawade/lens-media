import { useEffect, useRef, type ReactNode } from "react";

let lenisInstance: unknown | null = null;
let lenisCount = 0;

type Props = {
  children: ReactNode;
};

export function SmoothScrollProvider({ children }: Props) {
  const rafRef = useRef<number | null>(null);
  const lenisRef = useRef<unknown | null>(null);

  useEffect(() => {
    // Respect reduced motion: native scroll only
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Touch/mobile: Lenis handles touch, but keep native feel - don't trap
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    // Still allow Lenis on touch, but with lower lerp for less delay

    let cancelled = false;

    (async () => {
      try {
        const { default: Lenis } = await import("lenis");
        // Enforce one instance globally
        if (lenisInstance) {
          if (import.meta.env.DEV) console.warn("[SmoothScroll] Lenis already running, skip second instance");
          return;
        }
        // Dynamically import CSS without overriding project styles
        await import("lenis/dist/lenis.css");

        const lenis = new Lenis({
          autoRaf: true,
          lerp: isTouch ? 0.08 : 0.075,
          smoothWheel: true,
          gestureOrientation: "vertical",
          touchMultiplier: isTouch ? 1.2 : 1,
          // Preserve nested scroll: tables, dialogs, dropdowns
          prevent: (node: Element) => node.hasAttribute("data-lenis-prevent"),
        });

        if (cancelled) {
          lenis.destroy();
          return;
        }

        lenisInstance = lenis;
        lenisRef.current = lenis;
        lenisCount += 1;

        // Lenis autoRaf handles its own loop, do not create second rAF

        // Preserve ScrollTrigger sync if GSAP present (no-op if not)
        const onScroll = () => {
          const scrollTrigger = (window as Window & { ScrollTrigger?: { update: () => void } }).ScrollTrigger;
          scrollTrigger?.update();
        };
        lenis.on("scroll", onScroll);

        if (import.meta.env.DEV) console.info("[SmoothScroll] Lenis mounted");

        // Cleanup helper
        const cleanup = () => {
          lenis.off("scroll", onScroll);
          lenis.destroy();
          if (lenisRef.current === lenis) lenisRef.current = null;
          if (lenisInstance === lenis) lenisInstance = null;
          lenisCount = Math.max(0, lenisCount - 1);
        };

        // Store cleanup for unmount
        (lenis as unknown as { __cleanup?: () => void }).__cleanup = cleanup;
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[SmoothScroll] Lenis failed, fallback to native", e);
      }
    })();

    return () => {
      cancelled = true;
      const lenis = lenisRef.current as unknown as { destroy?: () => void; off?: (e: string, cb: () => void) => void; __cleanup?: () => void } | null;
      if (lenis) {
        if (lenis.__cleanup) lenis.__cleanup();
        else if (lenis.destroy) lenis.destroy();
        lenisRef.current = null;
        if (lenisInstance === lenis) lenisInstance = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return <>{children}</>;
}

// For diagnostics / tests
export function getLenisInstance() {
  return lenisInstance;
}
