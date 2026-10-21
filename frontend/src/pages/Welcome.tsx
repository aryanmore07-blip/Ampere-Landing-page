import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CarExoskeleton } from '../components/CarExoskeleton'
import { Logo } from '../components/Shell'
import { Button } from '../components/ui'
import { cn } from '../lib/cn'

const SLIDES = [
  { title: 'Charge where it fits', body: 'Only chargers your car can reach on its remaining range — and plug into — ever reach your map.', soc: 4, charging: false },
  { title: 'Hosts confirm first', body: 'Cafés, offices and neighbours share their chargers. Every slot is confirmed by the host before you set off.', soc: 38, charging: false },
  { title: 'Every step on record', body: 'Each booking is an append-only event history. Refresh any time — your booking is rebuilt from the record.', soc: 72, charging: true },
]
const DURATION = 5200

export default function Welcome() {
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const finish = () => {
    try {
      localStorage.setItem('ampere.welcomed', '1')
    } catch {
      /* ignore */
    }
    nav('/signin')
  }
  useEffect(() => {
    const t = setTimeout(() => setI((x) => (x + 1) % SLIDES.length), DURATION)
    return () => clearTimeout(t)
  }, [i])
  const s = SLIDES[i]
  return (
    <div className="pt-safe pb-safe relative flex min-h-dvh flex-col overflow-hidden bg-night text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pt-6 lg:flex-row lg:items-center lg:gap-16 lg:px-12">
        <div className="relative z-10 lg:flex-1">
          <div className="flex gap-2" role="tablist" aria-label="Introduction">
            {SLIDES.map((_, k) => (
              <button key={k} role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                <span className={cn('block h-full rounded-full bg-white', k < i ? 'w-full' : k > i ? 'w-0' : '')} style={k === i ? { animation: `grow ${DURATION}ms linear forwards` } : undefined} />
              </button>
            ))}
          </div>
          <style>{'@keyframes grow{from{width:0}to{width:100%}}'}</style>
          <div className="mt-10">
            <Logo dark className="text-white" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }}>
              <h1 className="mt-8 text-[44px] font-light leading-[1.05] tracking-tight sm:text-6xl">{s.title}</h1>
              <p className="mt-4 max-w-md text-lg text-white/60">{s.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 hidden gap-3 lg:flex">
            <Button size="lg" className="!bg-white !text-ink hover:!bg-white/90" onClick={finish}>
              Get started
            </Button>
          </div>
        </div>
        <div className="relative -mx-6 mt-6 flex flex-1 items-end justify-center lg:mx-0 lg:mt-0 lg:h-[640px] lg:flex-none lg:basis-[380px]">
          <CarExoskeleton soc={s.soc} charging={s.charging} dark className="h-[52vh] max-h-[560px] w-auto translate-y-10 lg:h-full lg:translate-y-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent lg:hidden" />
        </div>
      </div>
      <div className="relative z-10 flex gap-3 px-6 pb-6 lg:hidden">
        <Button variant="night" size="lg" className="flex-1" onClick={finish}>
          Skip
        </Button>
        <Button size="lg" className="flex-[2] !bg-white !text-ink" onClick={() => (i === SLIDES.length - 1 ? finish() : setI(i + 1))}>
          {i === SLIDES.length - 1 ? 'Get started' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
