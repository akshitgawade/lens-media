import { useMemo } from "react";
import * as THREE from "three";

type Props = {
  count?: number;
  spread?: number;
  opacity?: number;
  color?: string;
};

export function LineField({ count = 24, spread = 4, opacity = 0.06, color = "#1a1a18" }: Props) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread;
      const y = (Math.random() - 0.5) * spread * 0.5;
      const z = (Math.random() - 0.5) * 0.2;
      const len = 0.4 + Math.random() * 0.6;
      arr[i * 6] = x;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 2] = z;
      arr[i * 6 + 3] = x + len;
      arr[i * 6 + 4] = y;
      arr[i * 6 + 5] = z;
    }
    return arr;
  }, [count, spread]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}
