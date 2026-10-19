import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  position?: [number, number, number];
  size?: [number, number];
  color?: string;
  floatSpeed?: number;
  floatAmplitude?: number;
};

export function FloatingCard({ position = [0, 0, 0], size = [1.8, 1.2], color = "#ffffff", floatSpeed = 0.7, floatAmplitude = 0.12 }: Props) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    m.position.y = position[1] + Math.sin(clock.elapsedTime * floatSpeed) * floatAmplitude;
    m.rotation.z = Math.sin(clock.elapsedTime * floatSpeed * 0.5) * 0.02;
  });

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
    </mesh>
  );
}
