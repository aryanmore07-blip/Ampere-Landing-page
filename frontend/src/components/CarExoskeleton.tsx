import { useId } from 'react'
import { cn } from '../lib/cn'

/**
 * Wireframe ("exoskeleton") top view of a car. Shows only what Ampere reasons about:
 * the usable battery pack (cells fill with state of charge), the charge inlet and the
 * energy path while a session is active. No vehicle telemetry is implied.
 */
export function CarExoskeleton({
  soc,
  charging = false,
  orientation = 'vertical',
  inletLabel,
  dark = false,
  scan = true,
  className,
}: {
  soc: number
  charging?: boolean
  orientation?: 'vertical' | 'horizontal'
  inletLabel?: string
  dark?: boolean
  scan?: boolean
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const stroke = dark ? '#6d716a' : '#a9aca5'
  const strokeStrong = dark ? '#c7cbc2' : '#5f625c'
  const faint = dark ? '#3a3d39' : '#dcdcd6'
  const volt = '#6fa35c'
  const low = soc <= 10
  const cellFill = low ? '#d4973a' : volt
  const cols = 4
  const rows = 10
  const filled = Math.max(0, Math.min(1, soc / 100)) * cols * rows
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idxFromBottom = (rows - 1 - r) * cols + c
      const f = Math.max(0, Math.min(1, filled - idxFromBottom))
      cells.push(
        <g key={`${r}-${c}`}>
          <rect x={70 + c * 26} y={160 + r * 22.4} width={22} height={18} rx={4} fill="none" stroke={faint} strokeWidth={1.2} />
          {f > 0 ? <rect x={70 + c * 26} y={160 + r * 22.4} width={22} height={18} rx={4} fill={cellFill} opacity={f < 1 ? 0.45 : charging ? 0.95 : 0.85} className={charging && f < 1 ? 'animate-pulse' : undefined} /> : null}
        </g>,
      )
    }
  }

  const body = (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* wheels, seen through the shell */}
      {[
        [20, 92],
        [198, 92],
        [20, 372],
        [198, 372],
      ].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x} y={y} width={22} height={66} rx={9} stroke={stroke} strokeWidth={1.4} strokeDasharray="3 4" />
      ))}
      {/* axles */}
      <path d="M44 125H196M44 405H196" stroke={faint} strokeWidth={1.2} strokeDasharray="2 5" />
      {/* shell */}
      <path
        d="M120 14C160 14 190 26 198 62C202 80 204 104 206 128C212 180 214 300 210 372C208 410 206 440 202 464C196 496 168 508 120 508C72 508 44 496 38 464C34 440 32 410 30 372C26 300 28 180 34 128C36 104 38 80 42 62C50 26 80 14 120 14Z"
        stroke={strokeStrong}
        strokeWidth={2}
      />
      <path d="M120 24C156 24 182 34 188 66C192 88 194 112 196 132C201 182 203 296 199 368C197 404 195 432 192 456C187 484 162 498 120 498C78 498 53 484 48 456C45 432 43 404 41 368C37 296 39 182 44 132C46 112 48 88 52 66C58 34 84 24 120 24Z" stroke={faint} strokeWidth={1.1} />
      {/* hood creases and lights */}
      <path d="M84 40C91 78 93 118 93 150M156 40C149 78 147 118 147 150" stroke={faint} strokeWidth={1.2} />
      <path d="M50 56C62 41 84 34 102 34M190 56C178 41 156 34 138 34" stroke={strokeStrong} strokeWidth={3} />
      <path d="M48 478C61 492 84 499 102 499M192 478C179 492 156 499 138 499" stroke={charging ? volt : strokeStrong} strokeWidth={3} />
      {/* glasshouse */}
      <path d="M58 168C86 150 154 150 182 168L170 222C140 212 100 212 70 222Z" stroke={stroke} strokeWidth={1.4} />
      <path d="M70 232C100 224 140 224 170 232L172 344C140 352 100 352 68 344Z" stroke={stroke} strokeWidth={1.4} fill={dark ? '#ffffff06' : '#0e0f0e05'} />
      <path d="M68 356C100 364 140 364 172 356L182 404C150 418 90 418 58 404Z" stroke={stroke} strokeWidth={1.4} />
      <path d="M58 172L54 402M182 172L186 402M34 270H54M206 270H186" stroke={faint} strokeWidth={1.2} />
      {/* mirrors */}
      <path d="M36 184C22 180 14 188 16 197C18 204 28 205 37 200M204 184C218 180 226 188 224 197C222 204 212 205 203 200" stroke={stroke} strokeWidth={1.4} />
    </g>
  )

  const pack = (
    <g>
      <rect x={62} y={152} width={116} height={238} rx={16} fill="none" stroke={charging ? volt : stroke} strokeWidth={1.4} strokeDasharray="5 5" />
      {cells}
    </g>
  )

  const inlet = (
    <g>
      <path id={`${id}-cable`} d="M30 84C46 84 52 104 58 126C62 140 66 148 72 154" fill="none" stroke={charging ? volt : stroke} strokeWidth={charging ? 2.4 : 1.4} strokeDasharray={charging ? '4 8' : '2 4'} className={charging ? 'animate-flow' : undefined} />
      {charging ? (
        <circle r={3.5} fill={volt}>
          <animateMotion dur="1.4s" repeatCount="indefinite" path="M30 84C46 84 52 104 58 126C62 140 66 148 72 154" />
        </circle>
      ) : null}
      <circle cx={30} cy={84} r={7} fill={dark ? '#161716' : '#fff'} stroke={charging ? volt : strokeStrong} strokeWidth={2} />
      <circle cx={30} cy={84} r={2.5} fill={charging ? volt : '#d4973a'} />
      {charging ? (
        <circle cx={30} cy={84} r={7} fill="none" stroke={volt} strokeWidth={2}>
          <animate attributeName="r" values="7;20" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" />
        </circle>
      ) : null}
    </g>
  )

  const scanLine = scan ? (
    <g>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M120 14C160 14 190 26 198 62C202 80 204 104 206 128C212 180 214 300 210 372C208 410 206 440 202 464C196 496 168 508 120 508C72 508 44 496 38 464C34 440 32 410 30 372C26 300 28 180 34 128C36 104 38 80 42 62C50 26 80 14 120 14Z" />
        </clipPath>
        <linearGradient id={`${id}-scan`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={volt} stopOpacity="0" />
          <stop offset="1" stopColor={volt} stopOpacity={dark ? 0.35 : 0.22} />
        </linearGradient>
      </defs>
      <rect x={10} width={220} height={36} fill={`url(#${id}-scan)`} clipPath={`url(#${id}-clip)`}>
        <animate attributeName="y" values="0;476;0" dur={charging ? '2.4s' : '5s'} repeatCount="indefinite" />
      </rect>
    </g>
  ) : null

  const content = (
    <>
      {body}
      {pack}
      {inlet}
      {scanLine}
    </>
  )

  const label = `Wireframe car, battery ${Math.round(soc)} percent${charging ? ', charging' : ''}`

  if (orientation === 'horizontal') {
    return (
      <div className={cn('relative', className)}>
        <svg viewBox="0 0 520 240" className="h-full w-full" role="img" aria-label={label}>
          <g transform="translate(0 240) rotate(-90)">{content}</g>
        </svg>
        {inletLabel ? <InletTag label={inletLabel} charging={charging} className="left-[8%] top-[78%]" /> : null}
      </div>
    )
  }
  return (
    <div className={cn('relative', className)}>
      <svg viewBox="0 0 240 520" className="h-full w-full" role="img" aria-label={label}>
        {content}
      </svg>
      {inletLabel ? <InletTag label={inletLabel} charging={charging} className="-left-2 top-[10%]" /> : null}
    </div>
  )
}

function InletTag({ label, charging, className }: { label: string; charging: boolean; className?: string }) {
  return (
    <span className={cn('absolute -translate-y-full whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-soft', charging ? 'bg-volt text-white' : 'bg-surface text-ink-2', className)}>
      {label}
    </span>
  )
}
