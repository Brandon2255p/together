"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Bubble } from "@/lib/together/bubbles";
import { fragmentShader, vertexShader } from "@/components/ui/orb-scene";
import { TONE_COLORS } from "./bubble-palette";

// Screen 17's cluster: one morphing orb per Together (the orb's shaders), sized by recent activity. Drag spins the
// cluster; tapping a bubble flies the camera to it, then calls onPick. Labels are DOM, placed over each bubble every
// frame. Loaded with next/dynamic (no SSR); the screen shows a static grid instead when motion is reduced.

/** the orb geometry's radius; bubbles scale it to their own */
const BASE_RADIUS = 1.25;
/** a pointer that moves further than this between down and up is a drag, not a tap */
const TAP_SLOP_PX = 6;
const FLY_MS = 520;

function BubbleMesh({
  bubble,
  wasDrag,
  onTap,
}: {
  bubble: Bubble;
  /** whether the pointer moved enough since it went down to count as a drag */
  wasDrag: () => boolean;
  onTap: (mesh: THREE.Mesh) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const [a, b, c] = TONE_COLORS[bubble.tone];
  const uniforms = useMemo(
    () => ({
      // each bubble starts at a different point in its wobble
      uTime: { value: bubble.position[0] * 3 + bubble.position[1] * 7 },
      uPointer: { value: new THREE.Vector2() },
      uA: { value: new THREE.Color(a) },
      uB: { value: new THREE.Color(b) },
      uC: { value: new THREE.Color(c) },
    }),
    [a, b, c, bubble.position]
  );

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (u) (u.uTime as THREE.IUniform<number>).value += delta * 0.6;
  });

  return (
    <mesh
      ref={mesh}
      name={bubble.id}
      position={bubble.position}
      scale={bubble.radius / BASE_RADIUS}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (!wasDrag() && mesh.current) onTap(mesh.current);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <icosahedronGeometry args={[BASE_RADIUS, 32]} />
      <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} transparent />
    </mesh>
  );
}

function Cluster({
  bubbles,
  extent,
  labelFor,
  onPick,
}: {
  bubbles: Bubble[];
  extent: number;
  labelFor: (id: string) => HTMLElement | undefined;
  onPick: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const drag = useRef({ active: false, x: 0, y: 0, vx: 0, vy: 0, moved: 0 });
  const flying = useRef<{ id: string; target: THREE.Vector3; started: number; done: boolean } | null>(null);
  const { camera, size, gl } = useThree();
  const home = useMemo(() => new THREE.Vector3(0, 0, 3 + extent * 2.1), [extent]);
  const world = useMemo(() => new THREE.Vector3(), []);

  // drag anywhere on the canvas spins the cluster
  useEffect(() => {
    const el = gl.domElement;
    const d = drag.current;
    const down = (e: PointerEvent) => Object.assign(d, { active: true, x: e.clientX, y: e.clientY, vx: 0, vy: 0, moved: 0 });
    const move = (e: PointerEvent) => {
      if (!d.active) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      Object.assign(d, { moved: d.moved + Math.hypot(dx, dy), vx: dx * 0.006, vy: dy * 0.004, x: e.clientX, y: e.clientY });
    };
    const up = () => (d.active = false);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    for (const name of ["pointerup", "pointercancel", "pointerleave"] as const) el.addEventListener(name, up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      for (const name of ["pointerup", "pointercancel", "pointerleave"] as const) el.removeEventListener(name, up);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const g = group.current;
    const d = drag.current;
    if (!g) return;

    // spin: follow the drag, then coast to a stop; a slow idle drift otherwise
    if (!d.active) {
      d.vx *= 0.94;
      d.vy *= 0.94;
    }
    g.rotation.y += d.vx + (flying.current ? 0 : delta * 0.05);
    g.rotation.x = THREE.MathUtils.clamp(g.rotation.x + d.vy, -0.6, 0.6);

    // camera: fly to the tapped bubble, else rest at home
    const fly = flying.current;
    const cam = state.camera;
    if (fly) {
      const t = Math.min(1, (performance.now() - fly.started) / FLY_MS);
      cam.position.lerp(fly.target, 1 - Math.pow(1 - t, 3));
      if (t >= 1 && !fly.done) {
        fly.done = true;
        onPick(fly.id);
        // if nothing navigates away (a failed switch, the design system), drift back out
        setTimeout(() => {
          if (flying.current === fly) flying.current = null;
        }, 1500);
      }
    } else {
      cam.position.lerp(home, 0.08);
    }
    cam.lookAt(0, 0, 0);

    // labels follow their bubbles on screen; the nearer ones on top
    for (const child of g.children) {
      const label = labelFor(child.name);
      if (!label) continue;
      child.getWorldPosition(world);
      const depth = world.distanceTo(cam.position);
      world.project(cam);
      const x = (world.x * 0.5 + 0.5) * size.width;
      const y = (-world.y * 0.5 + 0.5) * size.height;
      label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      label.style.zIndex = String(1000 - Math.round(depth * 10));
      label.style.opacity = world.z < 1 ? "1" : "0";
    }
  });

  return (
    <group ref={group}>
      {bubbles.map((b) => (
        <BubbleMesh
          key={b.id}
          bubble={b}
          wasDrag={() => drag.current.moved > TAP_SLOP_PX}
          onTap={(mesh) => {
            if (flying.current) return;
            const target = mesh.getWorldPosition(new THREE.Vector3());
            // stop short of the bubble, along the line from the camera
            const away = camera.position
              .clone()
              .sub(target)
              .normalize()
              .multiplyScalar(Math.max(1.4, mesh.scale.x * BASE_RADIUS * 2.4));
            drag.current.vx = 0;
            drag.current.vy = 0;
            flying.current = { id: b.id, target: target.add(away), started: performance.now(), done: false };
          }}
        />
      ))}
    </group>
  );
}

export default function BubbleScene({
  bubbles,
  extent,
  onPick,
}: {
  bubbles: Bubble[];
  extent: number;
  /** after the camera reaches the tapped bubble */
  onPick: (id: string) => void;
}) {
  const labels = useRef(new Map<string, HTMLElement>());

  return (
    <div className="relative size-full touch-none select-none">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 3 + extent * 2.1], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
      >
        <Cluster bubbles={bubbles} extent={extent} labelFor={(id) => labels.current.get(id)} onPick={onPick} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bubbles.map((b) => (
          <div
            key={b.id}
            ref={(el) => {
              if (el) labels.current.set(b.id, el);
              else labels.current.delete(b.id);
            }}
            className="absolute top-0 left-0 flex max-w-36 flex-col items-center text-center will-change-transform"
            style={{ opacity: 0 }}
          >
            <span className="flex items-center gap-1 text-callout font-semibold text-ink drop-shadow-[0_1px_6px_rgba(255,255,255,0.9)]">
              {b.name}
              {b.hasNews ? <span className="size-2 rounded-full bg-accent" /> : null}
            </span>
            <span className="text-caption text-ink drop-shadow-[0_1px_6px_rgba(255,255,255,0.9)]">
              {b.current ? "You're here" : b.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
