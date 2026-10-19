import * as THREE from "three";

type Props = {
  radius: number;
  thickness?: number;
  opacity?: number;
  color?: string;
  segments?: number;
};

export function OrbitRing({ radius, thickness = 0.016, opacity = 0.06, color = "#1a1a18", segments = 64 }: Props) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius, radius + thickness, segments]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}
