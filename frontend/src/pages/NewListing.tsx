import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../app/hooks'
import { Page, PageHeader } from '../components/Shell'
import { Button, Card, Field, inputClass, Notice, Segmented, useAction } from '../components/ui'
import type { ConnectorStandard } from '../domain/types'
import { api } from '../server/api'

export default function NewListing() {
  useSession()
  const nav = useNavigate()
  const { run, busy } = useAction()
  const [f, setF] = useState({
    name: '',
    site_type: 'RESIDENTIAL' as 'RESIDENTIAL' | 'CAFE' | 'OFFICE',
    public_area: '',
    lat: '18.5410',
    lng: '73.8985',
    full_address: '',
    entrance_instructions: '',
    access_summary: '',
    connector: 'TYPE2' as ConnectorStandard,
    power_kw: '7.2',
    start: '08:00',
    end: '20:00',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const submit = async () => {
    const r = await api.createDraft({ ...f, lat: Number(f.lat), lng: Number(f.lng), power_kw: Number(f.power_kw), start_min: mins(f.start), end_min: f.end === '00:00' ? 1440 : mins(f.end) })
    if (!r.ok) {
      setErrors(r.error.fields ?? {})
      await run('x', async () => r)
      return
    }
    await run('ok', async () => r, 'Draft saved — submit it for review when ready')
    nav('/host/listings')
  }
  return (
    <>
      <PageHeader back title="New listing" subtitle="Saved as a draft until you submit it" />
      <Page className="mx-auto max-w-2xl">
        <Card className="space-y-4">
          <Field label="Listing name" error={errors.name}>
            <input className={inputClass} value={f.name} onChange={set('name')} placeholder="e.g. Lane 3 driveway charger" />
          </Field>
          <Field label="Host type">
            <Segmented value={f.site_type} onChange={(v) => setF({ ...f, site_type: v })} options={[{ value: 'RESIDENTIAL', label: 'Home' }, { value: 'CAFE', label: 'Café' }, { value: 'OFFICE', label: 'Office' }]} />
          </Field>
          <Field label="Public area" hint={f.site_type === 'RESIDENTIAL' ? 'Drivers see only this and an approximate pin until a booking is confirmed.' : undefined} error={errors.public_area}>
            <input className={inputClass} value={f.public_area} onChange={set('public_area')} placeholder="e.g. Koregaon Park" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude (private)">
              <input className={inputClass} inputMode="decimal" value={f.lat} onChange={set('lat')} />
            </Field>
            <Field label="Longitude (private)">
              <input className={inputClass} inputMode="decimal" value={f.lng} onChange={set('lng')} />
            </Field>
          </div>
          <Field label="Full address (private)" error={errors.full_address}>
            <input className={inputClass} value={f.full_address} onChange={set('full_address')} placeholder="Shared only with confirmed drivers" />
          </Field>
          <Field label="Entrance instructions (private)">
            <textarea className={inputClass + ' !h-20 py-3'} value={f.entrance_instructions} onChange={set('entrance_instructions')} />
          </Field>
          <Field label="Public access summary">
            <input className={inputClass} value={f.access_summary} onChange={set('access_summary')} placeholder="e.g. Gated society, visitor bay" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Connector" error={errors.connector}>
              <select className={inputClass} value={f.connector} onChange={set('connector')}>
                <option value="TYPE2">Type 2 (AC)</option>
                <option value="CCS2">CCS2 (DC)</option>
              </select>
            </Field>
            <Field label="Rated power (kW)" error={errors.power_kw}>
              <input className={inputClass} inputMode="decimal" value={f.power_kw} onChange={set('power_kw')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Available from (IST)" error={errors.schedule}>
              <input type="time" step={900} className={inputClass} value={f.start} onChange={set('start')} />
            </Field>
            <Field label="Until">
              <input type="time" step={900} className={inputClass} value={f.end} onChange={set('end')} />
            </Field>
          </div>
          <Notice>General household sockets and unverified adapters can’t be listed. After submission an administrator reviews identity, property access, equipment and paid-operation eligibility separately.</Notice>
          <Button size="lg" className="w-full" loading={busy === 'ok'} onClick={submit}>
            Save draft
          </Button>
        </Card>
      </Page>
    </>
  )
}
