type Props = {
  variant?: "public" | "dashboard";
};

export function Atmosphere({ variant = "public" }: Props) {
  const isDashboard = variant === "dashboard";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      {/* Base paper */}
      <div className="absolute inset-0 bg-paper" />

      {/* Warm-grey layered gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: isDashboard
            ? `radial-gradient(900px 600px at 12% 8%, oklch(0.91 0.018 75 / 0.35), transparent 60%),
               radial-gradient(700px 500px at 88% 92%, oklch(0.90 0.02 25 / 0.18), transparent 65%)`
            : `radial-gradient(1100px 700px at 10% 10%, oklch(0.91 0.018 75 / 0.45), transparent 58%),
               radial-gradient(900px 600px at 90% 88%, oklch(0.90 0.02 25 / 0.22), transparent 62%),
               radial-gradient(600px 400px at 50% 50%, oklch(0.93 0.012 80 / 0.4), transparent 70%)`,
        }}
      />

      {/* Slow blurred light — respects prefers-reduced-motion */}
      <div
        className="absolute -top-1/2 -left-1/4 h-[120%] w-[150%] rounded-full blur-[80px] will-change-transform"
        style={{
          background: isDashboard
            ? `radial-gradient(600px 400px at 30% 30%, oklch(0.55 0.02 60 / 0.04), transparent 70%),
               radial-gradient(500px 350px at 70% 70%, oklch(0.52 0.14 25 / 0.03), transparent 72%)`
            : `radial-gradient(650px 450px at 28% 32%, oklch(0.60 0.015 60 / 0.07), transparent 68%),
               radial-gradient(550px 380px at 72% 68%, oklch(0.52 0.14 25 / 0.05), transparent 70%),
               radial-gradient(400px 300px at 50% 50%, oklch(0.88 0.015 80 / 0.06), transparent 75%)`,
          opacity: isDashboard ? 0.7 : 0.9,
          animation: "atmosphereDrift 28s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}
