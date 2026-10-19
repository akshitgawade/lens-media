import type { CSSProperties, ReactNode } from "react";

type Props = {
  className?: string;
  style?: CSSProperties;
  message?: string;
  children?: ReactNode;
  height?: string;
};

export function SceneFallback({ className, style, message, children, height = "100%" }: Props) {
  return (
    <div
      aria-hidden
      className={className ?? "h-full w-full bg-secondary/20"}
      style={{ minHeight: height, height, ...style }}
    >
      {children}
      {message ? <span className="sr-only">{message}</span> : null}
    </div>
  );
}
