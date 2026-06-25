'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { useSpring, a } from '@react-spring/three';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, MultiPolygon } from 'geojson';
import type { Topology } from 'topojson-specification';
import landTopo from 'world-atlas/land-110m.json';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────────────────
 * Build a land Feature once at module scope so every Globe3D instance and
 * every re-mount shares the same parse + topojson cost (it's ~30 kB).
 * ──────────────────────────────────────────────────────────────────────── */
const LAND = feature(
  landTopo as unknown as Topology,
  (landTopo as unknown as Topology).objects.land,
) as Feature<MultiPolygon>;

/* Cache the generated dot positions per (count, radius) so toggling tabs
 * doesn't re-run geoContains on thousands of points. */
const DOT_CACHE = new Map<string, Float32Array>();

function landDots(count: number, radius: number): Float32Array {
  const key = `${count}:${radius}`;
  const cached = DOT_CACHE.get(key);
  if (cached) return cached;

  const phi = Math.PI * (Math.sqrt(5) - 1); // golden angle
  const RAD2DEG = 180 / Math.PI;
  const tmp: number[] = [];

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const lat = Math.asin(y) * RAD2DEG;
    const lng = Math.atan2(z, x) * RAD2DEG;
    if (geoContains(LAND, [lng, lat])) {
      tmp.push(x * radius, y * radius, z * radius);
    }
  }

  const out = new Float32Array(tmp);
  DOT_CACHE.set(key, out);
  return out;
}

/* ─── Silver dot grid ─────────────────────────────────────────────────── */
interface DotsProps {
  /** How many Fibonacci samples to test (only land-side become real dots). */
  samples?: number;
  /** Slightly above the sphere surface to avoid z-fighting through glass. */
  radius?: number;
  /** Visual radius of each dot. */
  size?: number;
}

function GlobeDots({ samples = 11000, radius = 1.003, size = 0.0085 }: DotsProps) {
  const positions = useMemo(() => landDots(samples, radius), [samples, radius]);
  const count = positions.length / 3;
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      dummy.position.set(positions[ix], positions[ix + 1], positions[ix + 2]);
      // Orient each disc tangent to the sphere surface (face outward).
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, count]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <circleGeometry args={[size, 6]} />
      <meshPhysicalMaterial
        color="#c3c8d2"
        metalness={1}
        roughness={0.18}
        envMapIntensity={1.8}
        emissive="#9aa1ad"
        emissiveIntensity={0.22}
        toneMapped
      />
    </instancedMesh>
  );
}

/* ─── Glass shell ─────────────────────────────────────────────────────── */
function GlassSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhysicalMaterial
        transmission={0.95}
        thickness={0.55}
        roughness={0.07}
        metalness={0}
        ior={1.45}
        clearcoat={1}
        clearcoatRoughness={0.08}
        attenuationColor="#f4f7fc"
        attenuationDistance={2.6}
        color="#ffffff"
        transparent
      />
    </mesh>
  );
}

/* ─── The interactive group (hover spring + scroll-driven rotation) ───── */
function GlobeGroup() {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Smoothed scroll value — `target` updates on scroll, `current` lerps to it.
  const scroll = useRef({ current: 0, target: 0 });

  useEffect(() => {
    const onScroll = () => {
      // Normalise scroll into a unit-ish range so the rotation is gentle
      // regardless of page length.
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      scroll.current.target = window.scrollY / maxScroll;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hover/press spring → smooth bounce on touch.
  const { scale } = useSpring({
    scale: pressed ? 0.97 : hovered ? 1.05 : 1.0,
    config: { mass: 1, tension: 240, friction: 18 },
  });

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    // Frame-rate independent lerp toward the latest scroll position.
    const k = 1 - Math.exp(-dt * 6);
    scroll.current.current += (scroll.current.target - scroll.current.current) * k;
    // Idle drift on Y so the globe is never frozen.
    g.rotation.y += dt * 0.05;
    // Additive scroll-driven tilt + nudge — independent from OrbitControls,
    // which only orbits the camera.
    g.rotation.x = scroll.current.current * 0.9;
    g.rotation.z = scroll.current.current * 0.25;
  });

  const pointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    if (typeof document !== 'undefined') document.body.style.cursor = 'grab';
  };
  const pointerOut = () => {
    setHovered(false);
    if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
  };
  const pointerDown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setPressed(true);
  };
  const pointerUp = () => setPressed(false);

  // a.group from @react-spring/three accepts SpringValue for scale.
  return (
    <a.group
      ref={groupRef as unknown as React.Ref<THREE.Group>}
      scale={scale}
      onPointerOver={pointerOver}
      onPointerOut={pointerOut}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <GlassSphere />
      <GlobeDots />
    </a.group>
  );
}

/* ─── Public component ────────────────────────────────────────────────── */
interface Globe3DProps {
  /** Canvas height in px. Width is 100% of the container. */
  height?: number;
  className?: string;
}

export function Globe3D({ height = 520, className }: Globe3DProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height,
        // Let the page still scroll vertically with a finger over the canvas.
        // Horizontal drag is captured by OrbitControls for spin.
        touchAction: 'pan-y',
      }}
    >
      <Canvas
        // Clamp DPR — phones love to report 3+, which kills MeshPhysicalMaterial.
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 3.2], fov: 35 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          // Slightly cooler exposure so silver dots read crisp on white.
          toneMappingExposure: 1.05,
        }}
        shadows={false}
        // No need to re-render when the scene is fully idle — OrbitControls
        // damping + scroll lerp will request frames as needed via invalidate,
        // but our useFrame work is cheap enough that "always" is fine on
        // desktop. Comment this in if you want extra mobile savings:
        // frameloop="demand"
      >
        <color attach="background" args={['#ffffff']} />

        {/* Studio key + fill so the glass refraction reads against pure white. */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#dfe5f0" />

        <Suspense fallback={null}>
          {/* Reflections — the glass + metallic dots need an env map to feel real. */}
          <Environment preset="studio" />
          <GlobeGroup />
          {/* The soft floor shadow that sells "floating on the page". */}
          <ContactShadows
            position={[0, -1.18, 0]}
            opacity={0.32}
            scale={5}
            blur={3.2}
            far={2}
            color="#1a2335"
            frames={1}
          />
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.6}
          // Slight polar clamp prevents flipping upside down and losing context.
          minPolarAngle={Math.PI * 0.18}
          maxPolarAngle={Math.PI * 0.82}
        />
      </Canvas>
    </div>
  );
}

export default Globe3D;
