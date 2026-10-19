import * as THREE from "three";

type Props = {
  position?: [number, number, number];
  color?: string;
  size?: number;
  opacity?: number;
};

export function SignalNode({ position = [0, 0, 0], color = "#1a1a18", size = 0.06, opacity = 0.9 }: Props) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial color={color} roughness={0.7} transparent opacity={opacity} />
    </mesh>
  );
}
