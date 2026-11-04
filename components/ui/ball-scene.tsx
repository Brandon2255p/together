"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ballFragmentShader, ballVertexShader } from "@/components/ui/ball-shader";

function BallMesh({ colors, speed }: { colors: [string, string, string]; speed: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uA: { value: new THREE.Color(colors[0]) },
      uB: { value: new THREE.Color(colors[1]) },
      uC: { value: new THREE.Color(colors[2]) },
    }),
    [colors]
  );

  // mutate through refs (three.js objects), never the memoised uniforms directly
  useFrame((state, delta) => {
    const u = material.current?.uniforms;
    if (!u || !mesh.current) return;
    (u.uTime as THREE.IUniform<number>).value += delta * speed;
    // a slow breath and a gentle float
    const t = state.clock.elapsedTime * speed;
    mesh.current.scale.setScalar(1 + Math.sin(t * 1.1) * 0.015);
    mesh.current.position.y = Math.sin(t * 0.8) * 0.04;
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 96, 64]} />
      <shaderMaterial ref={material} vertexShader={ballVertexShader} fragmentShader={ballFragmentShader} uniforms={uniforms} />
    </mesh>
  );
}

export default function BallScene({ colors, speed }: { colors: [string, string, string]; speed: number }) {
  return (
    <Canvas
      dpr={[1, 2]}
      // fits the ball (radius 1, plus its breath and float) inside the square canvas
      camera={{ position: [0, 0, 4.2], fov: 30 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
    >
      <BallMesh colors={colors} speed={speed} />
    </Canvas>
  );
}
