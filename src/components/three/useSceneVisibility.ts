import { useEffect, useRef, useState } from "react";

export function useSceneVisibility<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05, rootMargin: "120px", ...options },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);

  return { ref, isVisible };
}
