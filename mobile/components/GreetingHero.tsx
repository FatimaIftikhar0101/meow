import React from 'react';
import { Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { DayPart } from '../lib/format';
import { GREETING } from '../lib/format';
import { CatMark } from './CatMark';

/**
 * The four time-of-day scenes from the design artifact, re-authored into a
 * 284×270 hero viewBox (the artifact drew them full-screen at 284×596).
 *
 * The wrapper sets `aspectRatio` rather than a fixed height so the scene scales
 * with the device width and the medallion stays a circle. The mark is nested
 * inside the same coordinate space as its circle — positioning it with an
 * absolute overlay drifts, because the viewBox is letterboxed and its units are
 * not device pixels.
 */

const HERO_W = 284;
const HERO_H = 270;

/** Four layered hills, at the same proportions as the artifact's originals. */
const HILLS = [
  'M0 150 Q56 136 112 146 T222 141 T284 148 V270 H0Z',
  'M0 178 Q70 164 140 174 T284 169 V270 H0Z',
  'M0 205 Q84 192 168 202 T284 197 V270 H0Z',
  'M0 232 Q92 220 184 230 T284 225 V270 H0Z',
];

const STARS: [number, number, number, number][] = [
  [44, 46, 1.3, 0.9], [96, 30, 1, 0.65], [158, 40, 1.4, 0.85], [238, 26, 1.1, 0.6],
  [70, 74, 1, 0.5], [196, 68, 1.2, 0.75], [124, 18, 0.9, 0.45], [30, 90, 1, 0.55],
  [258, 82, 0.9, 0.5],
];

interface Scene {
  sky: [string, string, string];
  hills: [string, string, string, string];
  hillOpacity: [number, number, number, number];
  medallion: { fill: string; stroke: string };
  cat: { color: string; pupil: string; eyesClosed: boolean };
  text: { title: string; sub: string };
}

const SCENES: Record<DayPart, Scene> = {
  morning: {
    sky: ['#F6F8F1', '#E7F1DF', '#D6E7CD'],
    hills: ['#CBDDC2', '#B2CDA8', '#9CBE93', '#8FB489'],
    hillOpacity: [0.85, 1, 1, 1],
    medallion: { fill: '#F4F8EE', stroke: '#C3D9BA' },
    cat: { color: '#2C5F33', pupil: '#F4F8EE', eyesClosed: false },
    text: { title: '#121714', sub: '#31402F' },
  },
  afternoon: {
    sky: ['#F9FAF6', '#EDF3E7', '#E0EBD9'],
    hills: ['#D3E1CB', '#BAD1B1', '#A3C39A', '#93B78C'],
    hillOpacity: [0.85, 1, 1, 1],
    medallion: { fill: '#F9FBF6', stroke: '#C9DCC1' },
    cat: { color: '#2C5F33', pupil: '#F9FBF6', eyesClosed: false },
    text: { title: '#121714', sub: '#31402F' },
  },
  evening: {
    sky: ['#F2D6A2', '#D19A5C', '#8A6844'],
    hills: ['#A8794E', '#7C5836', '#513E28', '#2C2B21'],
    hillOpacity: [0.55, 0.9, 1, 1],
    medallion: { fill: '#46351F', stroke: '#6B5232' },
    cat: { color: '#F6E6C6', pupil: '#46351F', eyesClosed: false },
    text: { title: '#F9F5EC', sub: '#E4DAC4' },
  },
  night: {
    sky: ['#080D0A', '#121A14', '#1C281E'],
    hills: ['#17211A', '#121A14', '#0E1410', '#0A0F0C'],
    hillOpacity: [1, 1, 1, 1],
    medallion: { fill: '#121A14', stroke: '#28352B' },
    // The only place in the app where the cat sleeps, besides a delivered
    // transfer. Keeping it rare is what makes it mean anything.
    cat: { color: '#E0B259', pupil: '#121A14', eyesClosed: true },
    text: { title: '#EDF2EA', sub: '#A3B0A0' },
  },
};

/** The base colour behind the scene, so the status bar area cannot mismatch. */
export function heroBaseColor(part: DayPart): string {
  return SCENES[part].sky[0];
}

export function heroTextColor(part: DayPart): { title: string; sub: string } {
  return SCENES[part].text;
}

function Sun({ part }: { part: DayPart }) {
  if (part === 'morning') {
    return (
      <>
        <Circle cx={142} cy={96} r={62} fill="#CFE7B4" opacity={0.32} />
        <Circle cx={142} cy={96} r={42} fill="url(#sunGrad)" />
        <G stroke="#A9C6A0" strokeWidth={1.5} fill="none" opacity={0.65} strokeLinecap="round">
          <Path d="M52 42q6-6 12 0" />
          <Path d="M64 42q6-6 12 0" />
          <Path d="M206 24q5-5 10 0" />
          <Path d="M216 24q5-5 10 0" />
        </G>
      </>
    );
  }
  if (part === 'afternoon') {
    return (
      <>
        <Circle cx={214} cy={52} r={40} fill="#F0DDA8" opacity={0.3} />
        <Circle cx={214} cy={52} r={24} fill="url(#sunGrad)" />
      </>
    );
  }
  if (part === 'evening') {
    // Sits low enough that the hills eat its lower half — it is setting.
    return (
      <>
        <Circle cx={142} cy={170} r={74} fill="#E7B267" opacity={0.28} />
        <Circle cx={142} cy={170} r={50} fill="url(#sunGrad)" />
      </>
    );
  }
  return (
    <>
      <G fill="#E9EFE6">
        {STARS.map(([x, y, r, o], i) => (
          <Circle key={i} cx={x} cy={y} r={r} opacity={o} />
        ))}
      </G>
      <Circle cx={212} cy={58} r={42} fill="url(#moonGlow)" />
      <Path d="M212 36a22 22 0 1 0 17 33 26 26 0 0 1-17-33z" fill="#E7C480" />
    </>
  );
}

export function GreetingHero({
  part,
  name,
  line,
}: {
  part: DayPart;
  name: string;
  /** The live status line. Reports state, never a slogan. */
  line: React.ReactNode;
}) {
  const scene = SCENES[part];

  return (
    <View style={{ width: '100%', aspectRatio: HERO_W / HERO_H, position: 'relative' }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${HERO_W} ${HERO_H}`}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={scene.sky[0]} />
            <Stop offset={part === 'night' ? '52%' : part === 'evening' ? '44%' : '46%'} stopColor={scene.sky[1]} />
            <Stop offset="100%" stopColor={scene.sky[2]} />
          </LinearGradient>
          <RadialGradient id="sunGrad" cx="50%" cy="50%">
            <Stop
              offset="0%"
              stopColor={
                part === 'morning' ? '#FAF2D2' : part === 'afternoon' ? '#FCF3D6' : '#FCEEC8'
              }
            />
            <Stop
              offset="100%"
              stopColor={
                part === 'morning' ? '#DBEDB6' : part === 'afternoon' ? '#EBCE8B' : '#DA9E48'
              }
            />
          </RadialGradient>
          <RadialGradient id="moonGlow" cx="50%" cy="50%">
            <Stop offset="0%" stopColor="#E0B259" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#E0B259" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect width={HERO_W} height={HERO_H} fill="url(#sky)" />
        <Sun part={part} />
        {HILLS.map((d, i) => (
          <Path key={i} d={d} fill={scene.hills[i]} opacity={scene.hillOpacity[i]} />
        ))}
        <Circle
          cx={142}
          cy={104}
          r={38}
          fill={scene.medallion.fill}
          stroke={scene.medallion.stroke}
          strokeWidth={1}
        />
      </Svg>

      {/* The mark is centred on the medallion by percentage of the same box the
          SVG fills, so the two cannot drift apart across screen widths. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${((104 - 23) / HERO_H) * 100}%`,
          alignItems: 'center',
        }}
      >
        <CatMark
          size={46}
          color={scene.cat.color}
          pupil={scene.cat.pupil}
          eyesClosed={scene.cat.eyesClosed}
        />
      </View>

      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 16 }}>
        <Text
          style={{
            fontSize: 25,
            fontWeight: '700',
            letterSpacing: -0.85,
            lineHeight: 29,
            color: scene.text.title,
          }}
        >
          {GREETING[part]},{'\n'}
          {name}
        </Text>
        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 18,
            marginTop: 7,
            color: scene.text.sub,
            fontWeight: '500',
          }}
        >
          {line}
        </Text>
      </View>
    </View>
  );
}
