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

/* lat/lng → 3D point on a sphere of the given radius (Y-up, standard equirect). */
function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* Great-circle-ish arc: quadratic Bezier from `from` to `to` with the apex
 * lifted radially out of the sphere by an amount proportional to the chord
 * length. Long flights arch higher than short ones — feels right. */
function arcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const lift = 1.0 + 0.45 * (from.distanceTo(to) / 2);
  mid.normalize().multiplyScalar(lift);
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

/* ─── Silver dot grid ─────────────────────────────────────────────────── */
interface DotsProps {
  samples?: number;
  radius?: number;
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

/* ─── Corridor arcs (gold tubes + travelling pulse + endpoint pins) ──── */
export interface ArcPoint {
  lat: number;
  lng: number;
  label?: string;
}
export interface Arc {
  from: ArcPoint;
  to: ArcPoint;
}

function GlobeArcs({ arcs, radius = 1.012 }: { arcs: Arc[]; radius?: number }) {
  const items = useMemo(() => {
    return arcs.map((a) => {
      const from = latLngToVec3(a.from.lat, a.from.lng, radius);
      const to = latLngToVec3(a.to.lat, a.to.lng, radius);
      const curve = arcCurve(from, to);
      const tube = new THREE.TubeGeometry(curve, 64, 0.004, 6, false);
      return { from, to, curve, tube };
    });
  }, [arcs, radius]);

  // Dispose tube geometries on prop change / unmount to keep the GPU clean.
  useEffect(() => () => items.forEach((it) => it.tube.dispose()), [items]);

  const pulseRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const period = 2.6; // seconds for a pulse to travel a full arc
    items.forEach((item, i) => {
      const t = ((state.clock.elapsedTime + i * 0.7) % period) / period;
      const p = item.curve.getPointAt(t);
      const m = pulseRefs.current[i];
      if (m) {
        m.position.copy(p);
        // Fade in/out near the endpoints so it feels like a sweep rather than
        // a hard particle popping in.
        const fade = Math.sin(t * Math.PI);
        const s = 0.6 + fade * 0.8;
        m.scale.setScalar(s);
        (m.material as THREE.MeshStandardMaterial).opacity = 0.35 + fade * 0.65;
      }
    });
  });

  return (
    <group>
      {items.map((item, i) => (
        <group key={i}>
          <mesh geometry={item.tube}>
            <meshBasicMaterial color="#e0b259" transparent opacity={0.55} depthWrite={false} />
          </mesh>
          {/* endpoint pin: small bright sphere + a halo */}
          {[item.from, item.to].map((p, k) => (
            <group key={k} position={p}>
              <mesh>
                <sphereGeometry args={[0.014, 14, 14]} />
                <meshStandardMaterial
                  color="#fff1c8"
                  emissive="#e0b259"
                  emissiveIntensity={1.2}
                  toneMapped={false}
                />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.028, 16, 16]} />
                <meshBasicMaterial color="#e0b259" transparent opacity={0.18} depthWrite={false} />
              </mesh>
            </group>
          ))}
          {/* travelling pulse */}
          <mesh
            ref={(el) => {
              pulseRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.022, 14, 14]} />
            <meshStandardMaterial
              color="#fff6d8"
              emissive="#ffe9a8"
              emissiveIntensity={2.2}
              transparent
              opacity={0.9}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── The interactive group (hover spring + scroll-driven rotation) ───── */
interface GlobeGroupProps {
  interactive: boolean;
  autoRotateSpeed: number;
  arcs?: Arc[];
  samples?: number;
}

function GlobeGroup({ interactive, autoRotateSpeed, arcs, samples }: GlobeGroupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const scroll = useRef({ current: 0, target: 0 });

  useEffect(() => {
    if (!interactive) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      scroll.current.target = window.scrollY / maxScroll;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [interactive]);

  const { scale } = useSpring({
    scale: pressed ? 0.97 : hovered ? 1.05 : 1.0,
    config: { mass: 1, tension: 240, friction: 18 },
  });

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 6);
    scroll.current.current += (scroll.current.target - scroll.current.current) * k;
    g.rotation.y += dt * autoRotateSpeed;
    if (interactive) {
      g.rotation.x = scroll.current.current * 0.9;
      g.rotation.z = scroll.current.current * 0.25;
    } else {
      // A subtle constant tilt looks nicer than a perfectly upright spin.
      g.rotation.x = -0.32;
    }
  });

  const handlers = interactive
    ? {
        onPointerOver: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setHovered(true);
          if (typeof document !== 'undefined') document.body.style.cursor = 'grab';
        },
        onPointerOut: () => {
          setHovered(false);
          if (typeof document !== 'undefined') document.body.style.cursor = 'auto';
        },
        onPointerDown: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          setPressed(true);
        },
        onPointerUp: () => setPressed(false),
        onPointerCancel: () => setPressed(false),
      }
    : {};

  return (
    <a.group ref={groupRef as unknown as React.Ref<THREE.Group>} scale={scale} {...handlers}>
      <GlassSphere />
      <GlobeDots samples={samples} />
      {arcs && arcs.length > 0 && <GlobeArcs arcs={arcs} />}
    </a.group>
  );
}

/* ─── Public component ────────────────────────────────────────────────── */
export interface Globe3DProps {
  /** Canvas height — px number or any valid CSS value (e.g. "100%", "70vh"). */
  height?: number | string;
  className?: string;
  /** "interactive" = drag, scroll-tilt, hover. "passive" = quiet auto-rotation. */
  mode?: 'interactive' | 'passive';
  /** Radians/second of idle Y rotation. Defaults: 0.05 interactive, 0.22 passive. */
  autoRotateSpeed?: number;
  /** Lit-up corridors with travelling gold pulses. */
  arcs?: Arc[];
  /** Land-dot density. Drop to ~6000 on slow phones. */
  samples?: number;
}

export function Globe3D({
  height = 520,
  className,
  mode = 'interactive',
  autoRotateSpeed,
  arcs,
  samples = 11000,
}: Globe3DProps) {
  const interactive = mode === 'interactive';
  const speed = autoRotateSpeed ?? (interactive ? 0.05 : 0.22);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height,
        touchAction: interactive ? 'pan-y' : 'none',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 3.2], fov: 35 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMappingExposure: 1.05,
        }}
        shadows={false}
      >
        {/* No <color attach="background"> — gl.alpha is on, so the canvas
            is transparent and the page (and any background motif) shows
            through. Otherwise a white square shows up around the round
            silhouette, especially over a tinted page wash. */}

        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#dfe5f0" />

        <Suspense fallback={null}>
          <Environment preset="studio" />
          <GlobeGroup
            interactive={interactive}
            autoRotateSpeed={speed}
            arcs={arcs}
            samples={samples}
          />
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

        {interactive && (
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            enableZoom={false}
            enablePan={false}
            rotateSpeed={0.6}
            minPolarAngle={Math.PI * 0.18}
            maxPolarAngle={Math.PI * 0.82}
          />
        )}
      </Canvas>
    </div>
  );
}

/* Meow's launch corridors — exported so the dashboard / send page can light
 * them up without duplicating the coordinates. */
export const MEOW_CORRIDORS: Arc[] = [
  {
    from: { lat: 43.6532, lng: -79.3832, label: 'Toronto' },
    to: { lat: 24.8607, lng: 67.0011, label: 'Karachi' },
  },
  {
    from: { lat: 43.6532, lng: -79.3832, label: 'Toronto' },
    to: { lat: 19.076, lng: 72.8777, label: 'Mumbai' },
  },
];

export default Globe3D;
