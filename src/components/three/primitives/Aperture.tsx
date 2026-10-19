import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = {
  count?: number;
  radius?: number;
  bladeWidth?: number;
  bladeLength?: number;
  bladeThickness?: number;
  color?: string;
  opacity?: number;
  accentColor?: string;
  accentOpacity?: number;
};

export function Aperture({
  count = 8,
  radius = 0.52,
  bladeWidth = 0.028,
  bladeLength = 0.52,
  bladeThickness = 0.008,
  color = "#3d2f2a",
  opacity = 0.28,
  accentColor = "#a94442",
  accentOpacity = 0.12,
}: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      dummy.rotation.z = angle + Math.PI / 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return () => {
      mesh.instanceMatrix.needsUpdate = false;
    };
  }, [count, radius, dummy]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[bladeWidth, bladeLength, bladeThickness]} />
      <meshStandardMaterial color={color} roughness={0.88} metalness={0.05} transparent opacity={opacity} />
    </instancedMesh>
  );
}
