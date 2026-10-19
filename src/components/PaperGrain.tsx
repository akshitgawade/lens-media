import { useEffect, useRef } from "react";

type Props = {
  variant?: "public" | "dashboard";
};

/**
 * PaperGrain renders a prominent warm paper-grain texture over the background.
 * Two stacked canvas layers create a rich, visible texture.
 */
export function PaperGrain({ variant = "public" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random();
      // High-contrast warm grain: strong variation between light and dark spots
      const base = noise > 0.5
        ? 160 + Math.random() * 60   // lighter warm spots
        : 80 + Math.random() * 60;   // darker warm spots
      data[i]     = Math.min(255, Math.max(0, base + 12));       // R (warm)
      data[i + 1] = Math.min(255, Math.max(0, base + 4));       // G
      data[i + 2] = Math.min(255, Math.max(0, base - 18));      // B (less blue)
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    el.style.backgroundImage = `url("${dataUrl}")`;
  }, []);

  const opacity = variant === "dashboard" ? 0.12 : 0.15;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        zIndex: 2,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
        mixBlendMode: "overlay",
        opacity,
      }}
    />
  );
}
