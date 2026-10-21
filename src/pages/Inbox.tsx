import { Bell } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNow, useSession } from '../app/hooks'
import { useNotifications } from '../app/notifications'
import { Page, PageHeader } from '../components/Shell'
import { Card, Dot, EmptyState } from '../components/ui'
import { relativeAge } from '../lib/format'
import { api } from '../server/api'

export default function Inbox() {
  const user = useSession()!
  const { items } = useNotifications(user)
  const now = useNow(15000)
  const unreadIds = items.filter((n) => n.unread).map((n) => n.event.event_id).join()
  useEffect(() => {
    if (!unreadIds) return
    const t = setTimeout(() => void api.markNotificationsRead(unreadIds.split(',')), 1500)
    return () => clearTimeout(t)
  }, [unreadIds])
  return (
    <>
      <PageHeader back title="Inbox" subtitle="In-app notices from committed booking events" />
      <Page className="mx-auto max-w-2xl">
        {!items.length ? (
          <EmptyState icon={<Bell className="size-6" />} title="Nothing yet">Requests, confirmations and session updates will show up here.</EmptyState>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <Link key={n.event.event_id} to={`/booking/${n.booking_id}`} className="block">
                <Card className="flex items-center gap-3 !p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{n.title}</span>
                      <span className="shrink-0 text-xs text-muted">{relativeAge(n.event.recorded_at, now)}</span>
                    </div>
                    <div className="text-sm text-muted">{n.body}</div>
                  </div>
                  {n.unread ? <Dot tone="amber" /> : null}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Page>
    </>
  )
}
