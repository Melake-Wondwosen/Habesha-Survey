import { useEffect, useRef, useState } from 'react'
import { markRead, subscribeNotes } from '../notes'

const KIND = {
  flag: { dot: 'bg-ink', label: 'Alert' },
  request: { dot: 'bg-gold', label: 'Request' },
  approved: { dot: 'bg-gold', label: 'Approved' },
  rejected: { dot: 'bg-ink/40', label: 'Declined' },
  notice: { dot: 'bg-ink', label: 'Message' },
  local: { dot: 'bg-gold-dark', label: 'This phone' },
}

function when(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export default function Bell({ onOpenItem }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [seen, setSeen] = useState(new Set())
  const [ring, setRing] = useState(0)
  const prevUnread = useRef(null)
  const box = useRef(null)

  useEffect(
    () =>
      subscribeNotes((list, s) => {
        setItems(list)
        setSeen(s)
      }),
    [],
  )

  const unread = items.filter((n) => !seen.has(n.id)).length

  // Swing the bell when something new arrives
  useEffect(() => {
    if (prevUnread.current != null && unread > prevUnread.current) setRing((r) => r + 1)
    prevUnread.current = unread
  }, [unread])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(n) {
    markRead([n.id])
    if (onOpenItem) {
      setOpen(false)
      onOpenItem(n)
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`bell relative w-11 h-11 rounded-full flex items-center justify-center text-paper hover:bg-paper/10 ${open ? 'bg-paper/10' : ''}`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <svg key={ring} className={ring ? 'anim-ring' : ''} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span key={unread} className="anim-pop absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[11px] font-bold leading-[18px] text-center ring-2 ring-ink">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-panel fixed left-3 right-3 top-[68px] sm:absolute sm:left-auto sm:right-0 sm:top-[52px] sm:w-[380px] z-[1500] rounded-2xl bg-white text-ink shadow-2xl border border-ink/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10">
            <p className="font-serif text-lg">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markRead(items.map((n) => n.id))} className="text-xs font-semibold text-gold-dark hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto stagger">
            {!items.length && <li className="px-4 py-10 text-center text-sm text-ink/55">No notifications</li>}
            {items.map((n, i) => {
              const k = KIND[n.kind] || KIND.notice
              const fresh = !seen.has(n.id)
              return (
                <li key={n.id} style={{ '--i': i }}>
                  <button type="button" onClick={() => pick(n)} className={`row-hover w-full text-left px-4 py-3 flex gap-3 border-b border-ink/5 ${fresh ? 'bg-gold/[0.06]' : ''}`}>
                    <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${k.dot} ${fresh ? '' : 'opacity-30'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className={`flex-1 text-sm ${fresh ? 'font-semibold' : ''}`}>{n.title}</span>
                        <span className="text-[11px] text-ink/45 shrink-0">{when(n.date)}</span>
                      </span>
                      {n.body && <span className="block text-xs text-ink/65 mt-0.5 line-clamp-2">{n.body}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
