import type { CSSProperties, ReactNode } from 'react'
import styles from './CityHorizon.module.css'

/**
 * F96: Terra Nova seen from the lake, painted in one SVG. No model, no texture, no extra request.
 * Depth is aerial (far shore lighter and smaller), the near shore stands in the water, and its
 * reflection is the same drawing mirrored. Motion is a breath, not a show: a few windows, the
 * spire, the moon's path on the water.
 */

const FAR_SHORE = 640
const NEAR_SHORE = 700
const VIEW_H = 1120

type Lit = 'warm' | 'ice'
type Tower = readonly [x: number, w: number, h: number, lit?: Lit]

/** Distant shore: small, no windows, so it reads as far. */
const FAR: readonly Tower[] = [
  [20, 54, 34],
  [86, 28, 62],
  [128, 70, 26],
  [214, 22, 78],
  [252, 48, 40],
  [318, 18, 90],
  [352, 60, 28],
  [430, 26, 52],
  [474, 44, 36],
  [540, 16, 70],
  [572, 58, 24],
  [650, 24, 48],
  [692, 40, 32],
  [760, 18, 84],
  [796, 66, 22],
  [880, 20, 58],
  [918, 36, 30],
  [980, 14, 74],
  [1012, 52, 26],
  [1088, 22, 64],
  [1128, 46, 34],
  [1196, 18, 88],
  [1232, 70, 24],
  [1320, 28, 56],
  [1366, 40, 38],
  [1424, 16, 72],
  [1456, 48, 28],
  [1524, 36, 46],
]

/**
 * Near shore. The gap around x=900 is the view down the lake: the moon sits there,
 * and the ice spire (Nova) stands just to its right.
 */
/** Close enough that a window is a window. A gap under the moon keeps the view down the lake. */
const NEAR: readonly Tower[] = [
  [0, 128, 168, 'warm'],
  [140, 72, 248, 'warm'],
  [224, 160, 120, 'warm'],
  [400, 56, 300, 'warm'],
  [468, 108, 190, 'ice'],
  [590, 190, 100, 'warm'],
  [800, 64, 260, 'warm'],
  [876, 96, 170, 'warm'],
  [986, 130, 96, 'warm'],
  [1130, 78, 150, 'warm'],
  [1220, 56, 196, 'warm'],
  [1288, 48, 280, 'ice'],
  [1348, 86, 210, 'warm'],
  [1446, 154, 130, 'warm'],
]

const WARM = '#ffb56a'
const ICE = '#c8f4ff'

/** A handful of stars that breathe; the rest of the field is painted in CSS. */
const TWINKLE: readonly (readonly [string, string, string])[] = [
  ['18%', '14%', '0s'],
  ['41%', '8%', '-2.2s'],
  ['63%', '18%', '-4.1s'],
  ['76%', '6%', '-1.3s'],
  ['88%', '16%', '-3.4s'],
  ['29%', '22%', '-5s'],
]

function skyline(towers: readonly Tower[], ground: number, fill: string, prefix: string): ReactNode[] {
  const out: ReactNode[] = []
  for (const [i, tower] of towers.entries()) {
    const [x, w, h, lit] = tower
    const top = ground - h
    const crown = h > 150 ? Math.round(h * 0.22) : 0
    const crownW = Math.round(w * 0.56)
    const crownX = x + (w - crownW) / 2
    const tone = prefix === 'near' && i % 4 === 0 ? '#10283a' : fill
    out.push(
      <g key={`${prefix}-${x}`}>
        <rect x={x} y={top + crown} width={w} height={h - crown} fill={tone} />
        {crown > 0 && <rect x={crownX} y={top} width={crownW} height={crown + 1} fill={tone} />}
        {/* the moon is on the right, so that edge catches the light */}
        <rect x={x} y={top + crown} width={2} height={h - crown} fill="rgba(0, 0, 0, 0.4)" />
        <rect x={x + w - 2} y={top + crown} width={2} height={h - crown} fill="rgba(198, 228, 244, 0.42)" />
        {lit === 'ice' && h > 240 && (
          <polygon points={`${x},${top + 36} ${x + w / 2},${top - 18} ${x + w},${top + 36}`} fill={tone} />
        )}
        <rect x={x} y={ground - 7} width={w} height={7} fill="url(#nova-foot)" />
        {h > 250 && (
          <line
            x1={x + w / 2}
            y1={top}
            x2={x + w / 2}
            y2={top - 26}
            stroke="#b7dff0"
            strokeWidth={1}
          />
        )}
        {lit && windows(x, w, h, ground, crown, crownX, crownW, lit, `${prefix}-${x}`)}
        {lit === 'ice' && h > 240 && (
          <g className={styles.beacon} transform={`translate(${x + w / 2} ${top - 26})`}>
            <circle className={styles.halo} r="7" fill="none" stroke={ICE} strokeWidth="0.7" />
            <circle r="2.1" fill={ICE} />
          </g>
        )}
      </g>,
    )
  }
  return out
}

/** Lit windows only, so the dark façade stays a solid shape. A few of them breathe. */
function windows(
  x: number,
  w: number,
  h: number,
  ground: number,
  crown: number,
  crownX: number,
  crownW: number,
  lit: Lit,
  key: string,
): ReactNode[] {
  const out: ReactNode[] = []
  const top = ground - h
  let n = 0
  let row = 0
  for (let y = top + 18; y < ground - 20; y += 26) {
    const stagger = row % 2 === 0 ? 0 : 7
    let col = 0
    for (let px = x + 11 + stagger; px < x + w - 9; px += 20) {
      const inCrown = y < top + crown
      const outsideCrown = inCrown && (px < crownX + 4 || px > crownX + crownW - 8)
      // mostly dark glass: scattered clusters, the way a tower reads at night
      if (!outsideCrown && (col * 4 + row * 7 + (x % 11)) % 5 < 2) {
        n += 1
        const tone = (col + row + x) % 7
        const color = lit === 'ice' && tone < 3 ? ICE : tone === 1 ? '#fff1d2' : tone === 2 ? '#ff9448' : WARM
        const spark = n % 11 === 0
        const style: CSSProperties | undefined = spark ? { animationDelay: `${-((row % 5) * 0.8)}s` } : undefined
        out.push(
          <rect
            key={`${key}-${n}`}
            className={spark ? styles.spark : undefined}
            x={px}
            y={y}
            width={3.6}
            height={6}
            fill={color}
            opacity={spark ? 1 : 0.45 + ((col + row) % 4) * 0.13}
            style={style}
          />,
        )
      }
      col += 1
    }
    row += 1
  }
  return out
}

/** `fixed` keeps the lake behind the airlock while the form scrolls. The city pages let it scroll away. */
export function CityHorizon({ fixed = false }: { fixed?: boolean }) {
  return (
    <div className={fixed ? styles.fixed : styles.stage} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.stars} />
      {TWINKLE.map(([left, top, delay]) => (
        <span key={left + top} className={styles.star} style={{ left, top, animationDelay: delay }} />
      ))}
      <svg className={styles.canvas} viewBox={`0 0 1600 ${VIEW_H}`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="nova-facade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#24557a" />
            <stop offset="1" stopColor="#10283c" />
          </linearGradient>
          <linearGradient id="nova-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e567c" />
            <stop offset="0.4" stopColor="#0e3454" />
            <stop offset="1" stopColor="#071422" />
          </linearGradient>
          <linearGradient id="nova-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c5dff0" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c5dff0" stopOpacity="0.16" />
            <stop offset="1" stopColor="#c5dff0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nova-foot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#02060c" stopOpacity="0.55" />
            <stop offset="1" stopColor="#02060c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nova-sink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" />
            <stop offset="0.35" stopColor="white" stopOpacity="0.28" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id="nova-haze" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <filter id="nova-ripple" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.03" numOctaves="2" seed="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="A" />
          </filter>
          <radialGradient id="nova-moon" cx="38%" cy="38%" r="62%">
            <stop offset="0" stopColor="#fffaf3" />
            <stop offset="0.55" stopColor="#f0e2cf" />
            <stop offset="1" stopColor="#e4d2bc" />
          </radialGradient>
          <mask id="nova-water-mask" maskUnits="userSpaceOnUse" x="0" y={NEAR_SHORE} width="1600" height={VIEW_H - NEAR_SHORE}>
            <rect x="0" y={NEAR_SHORE} width="1600" height={VIEW_H - NEAR_SHORE} fill="url(#nova-sink)" />
          </mask>
        </defs>

        {/* farthest ridge, lighter: air between here and the city */}
        <path
          fill="#6d8ea8"
          opacity="0.22"
          d="M0 700 C160 650 280 590 460 640 C620 590 700 550 860 610 C1040 660 1140 580 1320 630 C1460 660 1540 640 1600 660 L1600 740 L0 740 Z"
        />
        <path
          fill="#102436"
          d="M0 730 C140 690 240 630 400 680 C540 640 640 600 800 660 C960 710 1080 630 1260 680 C1400 710 1500 690 1600 700 L1600 770 L0 770 Z"
        />

        <ellipse className={styles.ember} cx="700" cy={FAR_SHORE} rx="420" ry="70" fill="rgba(255, 148, 78, 0.22)" />
        <ellipse cx="1180" cy={FAR_SHORE - 8} rx="200" ry="40" fill="rgba(90, 210, 235, 0.12)" />

        <g className={styles.far} filter="url(#nova-haze)">
          {skyline(FAR, FAR_SHORE, '#1a3d56', 'far')}
        </g>

        <rect x="0" y={FAR_SHORE} width="1600" height={VIEW_H - FAR_SHORE} fill="url(#nova-lake)" />
        <rect x="0" y={FAR_SHORE - 50} width="1600" height="110" fill="url(#nova-mist)" />

        {/* moon over the gap in the near shore, clear of the page title */}
        <circle cx="1210" cy="390" r="20" fill="url(#nova-moon)" />
        <circle cx="1210" cy="390" r="58" fill="rgba(255, 236, 214, 0.08)" />

        <g id="nova-near" className={styles.near}>
          {skyline(NEAR, NEAR_SHORE, 'url(#nova-facade)', 'near')}
        </g>

        <g className={styles.reflection} mask="url(#nova-water-mask)" filter="url(#nova-ripple)" opacity="0.72">
          <use href="#nova-near" transform={`translate(0 ${NEAR_SHORE * 2}) scale(1 -1)`} />
        </g>

        <g fill="none" stroke="rgba(186, 224, 240, 0.2)" strokeWidth="1.2">
          <path d="M0 830 Q400 820 800 830 T1600 830" />
          <path d="M0 920 Q400 908 800 920 T1600 920" opacity="0.6" />
          <path d="M0 1020 Q400 1008 800 1020 T1600 1020" opacity="0.35" />
        </g>
        <ellipse cx="1210" cy="900" rx="10" ry="110" fill="rgba(255, 228, 196, 0.22)" />
        <ellipse className={styles.sheen} cx="640" cy="860" rx="240" ry="7" fill="rgba(200, 246, 255, 0.18)" />
      </svg>
      <div className={styles.vignette} />
    </div>
  )
}
