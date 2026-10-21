import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { CircleAlert, Check, Info, X } from 'lucide-react'
import { cn } from '../lib/cn'

/* ---------------- Button ---------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'volt' | 'danger' | 'night'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-black active:bg-black/90 disabled:bg-ink/30',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 disabled:text-muted',
  ghost: 'bg-transparent text-ink hover:bg-ink/5 disabled:text-muted',
  volt: 'bg-volt text-white hover:bg-volt-strong disabled:bg-volt/40',
  danger: 'bg-danger-soft text-danger hover:bg-danger/15 disabled:opacity-50',
  night: 'bg-night-3 text-white hover:bg-night-2 disabled:opacity-50',
}
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-14 px-6 text-base gap-2.5',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn('inline-flex select-none items-center justify-center rounded-full font-semibold transition-colors duration-150', VARIANTS[variant], SIZES[size], className)}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, dot, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; dot?: boolean }) {
  return (
    <button {...rest} aria-label={label} title={label} className={cn('relative grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-soft transition hover:bg-surface-2', className)}>
      {children}
      {dot ? <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-amber ring-2 ring-surface" /> : null}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-hidden />
}

/* ---------------- Surfaces ---------------- */

export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As {...rest} className={cn('rounded-[var(--radius-card)] bg-surface p-4 shadow-soft', className)}>
      {children}
    </As>
  )
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 mt-6 flex items-center justify-between', className)}>
      <h2 className="text-[17px] font-semibold tracking-tight text-ink-2">{children}</h2>
      {action}
    </div>
  )
}

type Tone = 'neutral' | 'volt' | 'amber' | 'danger' | 'night' | 'outline'
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  volt: 'bg-volt-soft text-volt-strong',
  amber: 'bg-amber-soft text-[#8a5a12]',
  danger: 'bg-danger-soft text-danger',
  night: 'bg-ink text-white',
  outline: 'border border-line text-ink-2',
}

export function Chip({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', TONES[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function Dot({ tone = 'volt', className }: { tone?: 'volt' | 'amber' | 'danger' | 'muted'; className?: string }) {
  const c = { volt: 'bg-volt', amber: 'bg-amber', danger: 'bg-danger', muted: 'bg-muted' }[tone]
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', c, className)} aria-hidden />
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <Chip tone="outline" className={cn('!px-2 !py-0.5 text-[10px] uppercase tracking-wider', className)}>
      Demo
    </Chip>
  )
}

export function StatTile({ icon, label, value, unit, aside, children, className }: { icon?: ReactNode; label: string; value?: ReactNode; unit?: string; aside?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex items-center gap-2 text-sm text-muted">
        {icon}
        <span>{label}</span>
      </div>
      {value !== undefined ? (
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="text-[34px] font-medium leading-none tracking-tight text-ink">
            {value}
            {unit ? <span className="ml-1 text-lg font-normal text-muted">{unit}</span> : null}
          </div>
          {aside ? <div className="text-xs text-muted">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </Card>
  )
}

/** Segmented bar gauge, as in the reference battery tiles. */
export function BarGauge({ value, segments = 12, className, tone = 'volt', height = 'h-12' }: { value: number; segments?: number; className?: string; tone?: 'volt' | 'amber' | 'danger'; height?: string }) {
  const filled = (value / 100) * segments
  const color = { volt: 'bg-volt', amber: 'bg-amber', danger: 'bg-danger' }[tone]
  return (
    <div className={cn('flex items-end gap-[5px]', height, className)} role="img" aria-label={`${Math.round(value)} percent`}>
      {Array.from({ length: segments }, (_, i) => {
        const f = Math.max(0, Math.min(1, filled - i))
        return (
          <span key={i} className="relative h-full flex-1 overflow-hidden rounded-full bg-line">
            <span className={cn('absolute inset-x-0 bottom-0 rounded-full transition-all duration-500', color)} style={{ height: `${f * 100}%`, opacity: f > 0 && f < 1 ? 0.55 : 1 }} />
          </span>
        )
      })}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-ink/[0.06]', className)} />
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon ? <div className="mb-4 grid size-14 place-items-center rounded-full bg-surface text-ink-2 shadow-soft">{icon}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children ? <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Notice({ tone = 'neutral', title, children, icon, className, action }: { tone?: 'neutral' | 'volt' | 'amber' | 'danger'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string; action?: ReactNode }) {
  const t = { neutral: 'bg-surface-2 text-ink-2', volt: 'bg-volt-soft text-[#2f4f25]', amber: 'bg-amber-soft text-[#6d4710]', danger: 'bg-danger-soft text-[#7d2c1b]' }[tone]
  return (
    <div className={cn('flex gap-3 rounded-2xl p-3.5 text-sm', t, className)} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="mt-0.5 shrink-0">{icon ?? (tone === 'danger' || tone === 'amber' ? <CircleAlert className="size-4" /> : <Info className="size-4" />)}</div>
      <div className="min-w-0 flex-1">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div> : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  )
}

/* ---------------- Inputs ---------------- */

export function Segmented<T extends string>({ value, options, onChange, className, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className={cn('flex rounded-full bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('flex-1 rounded-full font-semibold transition', size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm', value === o.value ? 'bg-ink text-white shadow-soft' : 'text-ink-2 hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export const inputClass = 'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none transition placeholder:text-muted focus:border-ink'

export function Range({ value, min, max, step = 1, onChange, label, className }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; className?: string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-ink)]', className)}
      style={{ background: `linear-gradient(90deg, var(--color-volt) ${pct}%, var(--color-line) ${pct}%)` }}
    />
  )
}

/* ---------------- Sheet ---------------- */

export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            className={cn('pb-safe relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-float sm:max-w-lg sm:rounded-[28px]', className)}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">{title}</div>
              <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-surface-2 hover:bg-line">
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

/* ---------------- Toasts (only after a committed server action) ---------------- */

type Toast = { id: number; tone: 'ok' | 'err' | 'info'; text: string; detail?: string }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((x) => [...x.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.tone === 'err' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex flex-col items-center gap-2 p-3 pt-safe" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="pointer-events-auto mt-2 flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-float"
            >
              <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', t.tone === 'ok' ? 'bg-volt' : t.tone === 'err' ? 'bg-danger' : 'bg-white/20')}>
                {t.tone === 'ok' ? <Check className="size-3" /> : t.tone === 'err' ? <X className="size-3" /> : <Info className="size-3" />}
              </span>
              <div className="min-w-0">
                <div className="font-semibold">{t.text}</div>
                {t.detail ? <div className="mt-0.5 text-white/70">{t.detail}</div> : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/** Runs an API call; toasts only after commit, and shows the error code on failure. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }>, success?: string | ((d: T) => string)) => {
      setBusy(key)
      try {
        const r = await fn()
        if (r.ok) {
          if (success) toast({ tone: 'ok', text: typeof success === 'function' ? success(r.data) : success })
          return r.data
        }
        toast({ tone: 'err', text: r.error.message, detail: r.error.code })
        return null
      } finally {
        setBusy(null)
      }
    },
    [toast],
  )
  return { run, busy }
}
