import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMouseParallax } from "./useMouseParallax";
import { Aperture } from "./primitives/Aperture";
import { OrbitRing } from "./primitives/OrbitRing";

export default function LandingScene() {
  const groupRef = useRef<THREE.Group>(null);
  const parallax = useMouseParallax(true, 0.05);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    group.rotation.z += delta * 0.04;
    group.position.x = parallax.current.x * 0.25;
    group.position.y = parallax.current.y * 0.15;
  });

  return (
    <group ref={groupRef}>
      {/* Refined aperture — thin editorial blades */}
      <Aperture
        count={8}
        radius={0.48}
        bladeWidth={0.025}
        bladeLength={0.5}
        bladeThickness={0.006}
        color="#3d2f2a"
        opacity={0.22}
      />
      {/* Six faint orbital rings — signal metaphor */}
      <group>
        {[0.82, 0.95, 1.08, 1.21, 1.34, 1.47].map((r, idx) => (
          <OrbitRing
            key={idx}
            radius={r}
            thickness={0.008}
            opacity={0.022 + idx * 0.003}
            color={idx === 0 ? "#a94442" : "#3d2f2a"}
            segments={48}
          />
        ))}
      </group>
      {/* Central lens disc — faint warm fill */}
      <mesh>
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color="#3d2f2a" transparent opacity={0.018} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
