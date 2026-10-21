import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { useSession } from './app/hooks'
import { homePath, Shell } from './components/Shell'
import { Spinner } from './components/ui'
import { runExpiryWorker } from './server/bookings'
import { ensureSeeded } from './server/db'
import { signIn } from './server/session'

const Welcome = lazy(() => import('./pages/Welcome'))
const SignIn = lazy(() => import('./pages/SignIn'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
const Discover = lazy(() => import('./pages/Discover'))
const Station = lazy(() => import('./pages/Station'))
const Booking = lazy(() => import('./pages/Booking'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Receipt = lazy(() => import('./pages/Receipt'))
const Vehicle = lazy(() => import('./pages/Vehicle'))
const InboxPage = lazy(() => import('./pages/Inbox'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const HostDashboard = lazy(() => import('./pages/HostDashboard'))
const HostListings = lazy(() => import('./pages/HostListings'))
const NewListing = lazy(() => import('./pages/NewListing'))
const HostEarnings = lazy(() => import('./pages/HostEarnings'))
const Admin = lazy(() => import('./pages/Admin'))
const Jury = lazy(() => import('./pages/Jury'))

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center text-muted">
      <Spinner className="size-6" />
    </div>
  )
}

function Authed({ children }: { children: ReactNode }) {
  const user = useSession()
  const loc = useLocation()
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Shell user={user}>{children}</Shell>
}

function Root() {
  const user = useSession()
  // Landing-page demo link (/?demo=driver): sign in as the demo driver and open the driver dashboard.
  const demo = useSearchParams()[0].get('demo') === 'driver'
  useEffect(() => {
    if (demo) signIn('u-driver')
  }, [demo])
  if (demo) return user?.id === 'u-driver' ? <Navigate to="/home" replace /> : null
  let seen = false
  try {
    seen = localStorage.getItem('ampere.welcomed') === '1'
  } catch {
    /* ignore */
  }
  if (user) return <Navigate to={homePath(user)} replace />
  return <Navigate to={seen ? '/signin' : '/welcome'} replace />
}

export function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    ensureSeeded().then(() => setReady(true))
    // Expiry worker. Every tab may run it; each append re-checks under the resource and booking locks.
    const t = setInterval(() => void runExpiryWorker(), 4000)
    return () => clearInterval(t)
  }, [])
  if (!ready) return <Loading />
  const a = (el: ReactNode) => <Authed>{el}</Authed>
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/home" element={a(<DriverHome />)} />
        <Route path="/discover" element={a(<Discover />)} />
        <Route path="/station/:siteId" element={a(<Station />)} />
        <Route path="/booking/:id" element={a(<Booking />)} />
        <Route path="/bookings" element={a(<Bookings />)} />
        <Route path="/receipt/:id" element={a(<Receipt />)} />
        <Route path="/vehicle" element={a(<Vehicle />)} />
        <Route path="/inbox" element={a(<InboxPage />)} />
        <Route path="/settings" element={a(<SettingsPage />)} />
        <Route path="/host" element={a(<HostDashboard />)} />
        <Route path="/host/listings" element={a(<HostListings />)} />
        <Route path="/host/listings/new" element={a(<NewListing />)} />
        <Route path="/host/earnings" element={a(<HostEarnings />)} />
        <Route path="/admin" element={a(<Admin />)} />
        <Route path="/jury" element={a(<Jury />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
