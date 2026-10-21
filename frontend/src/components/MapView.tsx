import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLng } from '../domain/types'
import type { PublicSite } from '../server/discovery'

const BOLT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>'
const HOME = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 4l9 7v9H3z"/><path d="M12 20v-6"/></svg>'

function pinIcon(selected: boolean, directory: boolean, residential: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="amp-pin ${selected ? 'is-selected' : ''} ${directory ? 'is-directory' : ''}">${residential ? HOME : BOLT}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

const originIcon = L.divIcon({ className: '', html: '<div class="amp-origin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

export interface MapSite {
  site: PublicSite
  reservable: boolean
  label: string
}

function FitView({ origin, sites, budgetM }: { origin: LatLng; sites: MapSite[]; budgetM: number }) {
  const map = useMap()
  const key = `${origin.lat},${origin.lng},${sites.map((s) => s.site.id).join()},${budgetM}`
  useEffect(() => {
    const fit = () => {
      const el = map.getContainer()
      if (!el.clientWidth || !el.clientHeight) return
      map.invalidateSize()
      const pts = [L.latLng(origin.lat, origin.lng), ...sites.map((s) => L.latLng(s.site.lat, s.site.lng))]
      const bounds = L.latLngBounds(pts)
      // With no pins, show the (illustrative) budget ring instead, capped to keep the view local.
      if (!sites.length && budgetM > 0) bounds.extend(L.latLng(origin.lat, origin.lng).toBounds(Math.min(budgetM, 6000) * 2))
      map.fitBounds(bounds.pad(0.15), { paddingTopLeft: [24, 140], paddingBottomRight: [24, 200], maxZoom: 15 })
    }
    const raf = requestAnimationFrame(fit)
    const ro = new ResizeObserver(() => fit())
    ro.observe(map.getContainer())
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [target, map])
  return null
}

export function MapView({
  origin,
  budgetM,
  sites,
  selectedId,
  onSelect,
  className,
}: {
  origin: LatLng
  budgetM: number
  sites: MapSite[]
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}) {
  const [tileErrors, setTileErrors] = useState(0)
  const selected = useMemo(() => sites.find((s) => s.site.id === selectedId)?.site ?? null, [sites, selectedId])
  return (
    <div className={className}>
      <MapContainer center={[origin.lat, origin.lng]} zoom={14} zoomControl={false} attributionControl className="h-full w-full" style={{ background: '#161716' }}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          className="amp-dark-tiles"
          eventHandlers={{ tileerror: () => setTileErrors((n) => n + 1), tileload: () => setTileErrors(0) }}
        />
        <FitView origin={origin} sites={sites} budgetM={budgetM} />
        <FlyTo target={selected ? { lat: selected.lat, lng: selected.lng } : null} />
        {budgetM > 0 ? (
          <Circle center={[origin.lat, origin.lng]} radius={budgetM} interactive={false} pathOptions={{ color: '#6fa35c', weight: 1.5, dashArray: '6 8', fillColor: '#6fa35c', fillOpacity: 0.05 }} />
        ) : null}
        <Marker position={[origin.lat, origin.lng]} icon={originIcon} keyboard={false}>
          <Tooltip className="amp-tip" direction="top" offset={[0, -10]}>
            You are here
          </Tooltip>
        </Marker>
        {sites.map(({ site, reservable, label }) => (
          <div key={site.id}>
            {site.location_precision === 'APPROXIMATE' ? <Circle center={[site.lat, site.lng]} radius={350} interactive={false} pathOptions={{ color: '#c7cbc2', weight: 1, dashArray: '3 6', fillOpacity: 0.06 }} /> : null}
            <Marker
              position={[site.lat, site.lng]}
              icon={pinIcon(site.id === selectedId, !reservable, site.location_precision === 'APPROXIMATE')}
              eventHandlers={{ click: () => onSelect(site.id), keypress: () => onSelect(site.id) }}
              title={label}
              alt={label}
            />
          </div>
        ))}
      </MapContainer>
      {tileErrors > 3 ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-[500] mx-auto w-fit rounded-full bg-night-2/90 px-4 py-2 text-xs font-semibold text-white">
          Map tiles unavailable — schematic view. The list stays fully usable.
        </div>
      ) : null}
    </div>
  )
}
