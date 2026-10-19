import { useEffect, useRef, useLayoutEffect } from "react";
import { useReducedMotion } from "@/components/three/useReducedMotion";

let scrollTriggerRegistered = false;

async function ensureScrollTrigger() {
  if (scrollTriggerRegistered) return;
  const gsap = (await import("gsap")).default;
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  gsap.registerPlugin(ScrollTrigger);
  scrollTriggerRegistered = true;
}

// Safe GSAP context hook: uses gsap.context() and reverts on unmount, no SSR
export function useGsapContext(
  create: (gsap: typeof import("gsap").default) => void,
  deps: React.DependencyList = []
) {
  const reduced = useReducedMotion();
  const ctxRef = useRef<gsap.Context | null>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    let cancelled = false;
    (async () => {
      const gsap = (await import("gsap")).default;
      if (cancelled) return;
      const ctx = gsap.context(() => create(gsap));
      ctxRef.current = ctx;
    })();
    return () => {
      cancelled = true;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);
}

// Safe ScrollTrigger hook: registers once, syncs with Lenis, cleans up
export function useScrollTrigger(
  create: (gsap: typeof import("gsap").default, ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger) => void,
  deps: React.DependencyList = []
) {
  const reduced = useReducedMotion();
  const ctxRef = useRef<gsap.Context | null>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let cleanupLenis: (() => void) | null = null;

    (async () => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (!scrollTriggerRegistered) {
        gsap.registerPlugin(ScrollTrigger);
        scrollTriggerRegistered = true;
      }
      if (cancelled) return;

      const ctx = gsap.context(() => create(gsap, ScrollTrigger));
      ctxRef.current = ctx;

      // If Lenis exists, sync ScrollTrigger on Lenis scroll (one shared ticker)
      // Listen to Lenis scroll events when the shared provider is available.
      try {
        const mod = await import("./SmoothScrollProvider");
        const inst = (mod as unknown as { getLenisInstance: () => { on: (e: string, cb: () => void) => void; off: (e: string, cb: () => void) => void } | null }).getLenisInstance();
        if (inst) {
          const onScroll = () => ScrollTrigger.update();
          inst.on("scroll", onScroll);
          cleanupLenis = () => inst.off("scroll", onScroll);
        }
      } catch {
        // no Lenis, ignore
      }
    })();

    return () => {
      cancelled = true;
      if (cleanupLenis) cleanupLenis();
      ctxRef.current?.revert();
      ctxRef.current = null;
      // ScrollTrigger instances are reverted via context
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);
}

export { motionTokens } from "./motionConfig";
