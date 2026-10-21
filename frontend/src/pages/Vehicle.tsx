import { Check } from 'lucide-react'
import { useSession } from '../app/hooks'
import { CarExoskeleton } from '../components/CarExoskeleton'
import { Page, PageHeader } from '../components/Shell'
import { Card, Chip, Field, Notice, Range, SectionTitle, useAction } from '../components/ui'
import { rangeBudget } from '../domain/calc'
import { CONNECTOR_LABEL, VEHICLE_MODELS, modelById } from '../domain/catalogue'
import { POLICY } from '../domain/policy'
import { cn } from '../lib/cn'
import { km } from '../lib/format'
import { api } from '../server/api'
import { useMyVehicle } from './DriverHome'

export default function Vehicle() {
  const user = useSession()!
  const vehicle = useMyVehicle()
  const { run } = useAction()
  if (!vehicle) return <Page><Notice>This account has no car profile.</Notice></Page>
  const model = modelById(vehicle.model_id)!
  const budget = rangeBudget(model, vehicle.soc, POLICY)
  return (
    <>
      <PageHeader back title="Car profile" subtitle={user.display_name} />
      <Page>
        <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-10">
          <div className="mx-auto max-w-[260px] lg:max-w-none">
            <CarExoskeleton soc={vehicle.soc} inletLabel={model.connectors.map((c) => `${CONNECTOR_LABEL[c.standard]} ${c.mode}`).join(' · ')} className="mx-auto aspect-[240/520] w-full" />
          </div>
          <div>
            <Card className="mt-4 lg:mt-0">
              <div className="text-2xl font-semibold tracking-tight">
                {model.make} {model.model}
              </div>
              <div className="text-sm text-muted">{model.variant}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>{(model.usable_battery_wh / 1000).toFixed(0)} kWh usable</Chip>
                <Chip>AC ≤ {model.ac_limit_kw} kW</Chip>
                <Chip>DC ≤ {model.dc_limit_kw} kW</Chip>
                <Chip>{model.consumption_kwh_per_km} kWh/km (conservative)</Chip>
                {model.connectors.map((c) => (
                  <Chip key={c.standard} tone="volt">
                    {CONNECTOR_LABEL[c.standard]} {c.mode}
                  </Chip>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">{model.evidence_note}</p>
            </Card>
            <Card className="mt-3 space-y-5">
              <Field label={`Battery now: ${vehicle.soc}%`} hint={`Range budget ${km(budget.range_budget_m)} after ${POLICY.reserve_pct}% reserve and ×${POLICY.uncertainty} uncertainty.`}>
                <Range label="Battery now" value={vehicle.soc} min={0} max={100} onChange={(v) => void api.updateVehicle(vehicle.id, { soc: v })} />
              </Field>
              <Field label={`Charge target: ${vehicle.target_soc}%`}>
                <Range label="Charge target" value={vehicle.target_soc} min={10} max={100} onChange={(v) => void api.updateVehicle(vehicle.id, { target_soc: v })} />
              </Field>
            </Card>
            <SectionTitle>Reviewed catalogue</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {VEHICLE_MODELS.map((m) => (
                <button key={m.id} onClick={() => run('m', () => api.updateVehicle(vehicle.id, { model_id: m.id, nickname: m.model }), `Car set to ${m.make} ${m.model}`)} className={cn('flex items-center gap-3 rounded-2xl border bg-surface p-3 text-left', m.id === model.id ? 'border-ink' : 'border-line')}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {m.make} {m.model}
                    </div>
                    <div className="truncate text-xs text-muted">{m.variant}</div>
                  </div>
                  {m.id === model.id ? <Check className="size-4" /> : null}
                </button>
              ))}
            </div>
            <Notice className="mt-4">Battery percentage is entered by you each time — Ampere doesn’t read live vehicle telemetry. Unsupported models need manual, clearly unverified data (not enabled in this demo).</Notice>
          </div>
        </div>
      </Page>
    </>
  )
}
