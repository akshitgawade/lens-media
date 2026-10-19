import * as THREE from "three";

type Props = {
  activeIndex: number;
};

const SIGNAL_COLORS = [
  "#3a6ea5",
  "#a94442",
  "#b5892e",
  "#2e7d5b",
  "#6b5b9a",
  "#1a1a18",
];

export default function PipelineScene({ activeIndex }: Props) {
  return (
    <group>
      {/* Base rail */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-2.2, 0, 0, 2.2, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1a1a18" transparent opacity={0.07} />
      </line>
      {/* Progress */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-2.2, 0, 0, -2.2 + (4.4 * (activeIndex + 1)) / 6, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#a94442" transparent opacity={0.14} />
      </line>
      {/* Nodes */}
      {Array.from({ length: 6 }).map((_, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        return (
          <group key={i} position={[(i / 5) * 4.4 - 2.2, 0, 0]}>
            <mesh scale={isActive ? 1.35 : isPast ? 1 : 0.9}>
              <circleGeometry args={[0.09, 16]} />
              <meshBasicMaterial color={SIGNAL_COLORS[i]} transparent opacity={isActive ? 0.92 : isPast ? 0.5 : 0.28} />
            </mesh>
            {isActive ? (
              <mesh>
                <ringGeometry args={[0.11, 0.124, 16]} />
                <meshBasicMaterial color={SIGNAL_COLORS[i]} transparent opacity={0.2} side={THREE.DoubleSide} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
