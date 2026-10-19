import { useEffect, useState, type ReactNode, Suspense } from "react";

type Props = {
  children: ReactNode;
  fallback: ReactNode;
};

export function ClientOnly({ children, fallback }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return <>{fallback}</>;

  // Reserve space during lazy chunk load via same fallback
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
