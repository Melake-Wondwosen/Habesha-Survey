import { useEffect } from 'react'
import logo from '../assets/logo.png'
import pattern from '../assets/pattern.png'
import face from '../assets/face.png'
import logoFace from '../assets/logo-face.png'
import logoWord from '../assets/logo-word.png'

export function Emblem({ className = '' }) {
  return <img src={face} alt="Habesha" className={className} draggable="false" />
}

export function Logo({ className = '', ...rest }) {
  return <img src={logo} alt="Habesha" className={className} draggable="false" {...rest} />
}

// Sign-in logo whose eyes react to the form. Her eyes are redrawn as shapes
// over logo-face.png (222 x 220) so they can move:
//   idle      looks straight at you
//   watch     follows the text as you type (squints at a password)
//   confused  head tilt, one eye half shut, a "?" beside her
const EYES = [80, 142] // centre x of each eye; both sit at y 132
const almond = (cx) => `M${cx - 21} 132Q${cx - 2} 118 ${cx + 20} 131Q${cx - 2} 147 ${cx - 21} 132Z`

export function WatchingLogo({ mood = 'idle', field = null, progress = 0, glow = false, className = '', ...rest }) {
  const watching = mood === 'watch'
  const confused = mood === 'confused'
  // Pupils: across with the text, down towards the form while typing
  const px = watching ? -8 + 16 * Math.min(1, progress) : confused ? 2 : 0
  const py = watching ? (field === 'password' ? 5 : 3.5) : confused ? -2 : 0
  // Upper lids: 0 open, 1 shut
  const lid = (i) => (watching && field === 'password' ? 0.5 : confused && i === 1 ? 0.55 : 0)

  return (
    <div className={`flex flex-col items-center ${className}`} {...rest}>
      <div className="relative w-[69%]">
        <div className="face-tilt relative" style={{ transform: confused ? 'rotate(-9deg)' : 'rotate(0deg)' }}>
          <img src={logoFace} alt="Habesha" className={`block w-full ${glow ? 'logo-night' : ''}`} draggable="false" />
          <svg viewBox="0 0 222 220" aria-hidden="true" className="absolute inset-0 w-full h-full">
            <defs>
              {EYES.map((cx, i) => (
                <clipPath key={i} id={`eye-clip-${i}`}>
                  <path d={almond(cx)} />
                </clipPath>
              ))}
            </defs>
            {EYES.map((cx, i) => (
              <g key={i}>
                <path d={almond(cx)} fill="rgb(202, 233, 245)" />
                <g clipPath={`url(#eye-clip-${i})`}>
                  <g className="eye-move" style={{ transform: `translate(${px}px, ${py}px)` }}>
                    <circle cx={cx} cy="132" r="8.6" fill="#1d1612" />
                    <circle cx={cx + 3.4} cy="129.6" r="1.7" fill="#fff" />
                  </g>
                  <rect
                    className="eye-lid"
                    x={cx - 23}
                    y="117"
                    width="46"
                    height="16"
                    fill="rgb(131, 81, 39)"
                    stroke="#1b120b"
                    strokeWidth="2.4"
                    style={{ transform: `scaleY(${lid(i)})` }}
                  />
                </g>
                <path d={almond(cx)} fill="none" stroke="#1b120b" strokeWidth="3.4" strokeLinejoin="round" />
              </g>
            ))}
            </g>
          </svg>
        </div>
        <span
          aria-hidden="true"
          className={`absolute -right-3 -top-1 font-serif font-bold text-3xl text-gold-dark transition-all duration-300 ${confused ? 'opacity-100 scale-100 rotate-12' : 'opacity-0 scale-50 rotate-0'}`}
        >
          ?
        </span>
      </div>
      <img src={logoWord} alt="" aria-hidden="true" className={`block w-full -mt-px ${glow ? 'logo-night' : ''}`} draggable="false" />
    </div>
  )
}

export function Pattern({ className = '', ...rest }) {
  return <img src={pattern} alt="" aria-hidden="true" className={`block w-full max-w-xs mx-auto ${className}`} draggable="false" {...rest} />
}

// Moving version of the pattern band for the sign-in screen. The diamonds are
// drawn as shapes so each one can move: the band drifts sideways in a seamless
// loop, the motifs swell in a wave, and a light glint passes over them.
const PT_UNIT = 180
const pd = (cx, cy, r) => `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`

function PatternUnit({ x, i }) {
  const big = x + 50
  const mid = x + 140
  return (
    <g>
      <g className="pt-pulse" style={{ animationDelay: `${(i * 2) * 0.35}s` }}>
        <path d={pd(big, 56, 44)} />
        <path d={pd(big, 56, 32)} />
        <path d={pd(big, 56, 20)} />
        <path d={pd(big, 56, 8)} className="pt-solid" />
      </g>
      {[[-46, -34], [46, -34], [-46, 34], [46, 34]].map(([dx, dy], k) => (
        <path key={k} d={pd(big + dx, 56 + dy, 6)} className="pt-twinkle" style={{ animationDelay: `${(i * 2 + k * 0.5) * 0.35}s` }} />
      ))}
      <g className="pt-pulse" style={{ animationDelay: `${(i * 2 + 1) * 0.35}s` }}>
        <path d={pd(mid, 56, 22)} />
        <path d={pd(mid, 56, 11)} />
        <path d={pd(mid, 56, 4)} className="pt-solid" />
      </g>
      {[[0, -36], [0, 36], [-32, 0], [32, 0]].map(([dx, dy], k) => (
        <path key={k} d={pd(mid + dx, 56 + dy, 5)} className="pt-twinkle" style={{ animationDelay: `${(i * 2 + 1 + k * 0.5) * 0.35}s` }} />
      ))}
    </g>
  )
}

export function MovingPattern({ className = '', units = 4, ...rest }) {
  const w = units * PT_UNIT
  const strip = Array.from({ length: units * 2 }, (_, i) => <PatternUnit key={i} x={i * PT_UNIT} i={i % units} />)
  return (
    <div aria-hidden="true" className={`pt-band relative overflow-hidden ${className}`} {...rest}>
      <svg viewBox={`0 0 ${w} 112`} className="block w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pt-gold" x1="0" y1="0" x2={w * 2} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d9bc6a" />
            <stop offset="0.5" stopColor="#b58a35" />
            <stop offset="1" stopColor="#d9bc6a" />
          </linearGradient>
        </defs>
        <g className="pt-drift" style={{ '--pt-shift': `-${w}px` }} fill="none" stroke="url(#pt-gold)" strokeWidth="5" strokeLinejoin="miter">
          {strip}
        </g>
      </svg>
      <span className="pt-glint pointer-events-none absolute inset-y-0 -left-1/3 w-1/3" />
    </div>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'w-full min-h-[52px] rounded-2xl px-5 text-[17px] font-semibold active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-ink text-paper shadow-sm hover:bg-ink-soft',
    gold: 'gold-gradient text-ink shadow-sm hover:shadow-md',
    ghost: 'bg-transparent text-ink border border-ink/20 hover:border-ink/40',
    quiet: 'bg-transparent text-ink/70 underline underline-offset-4 min-h-[44px] hover:text-ink',
    danger: 'bg-ink text-paper hover:bg-ink-soft',
  }
  return <button type="button" className={`${base} ${variant === 'quiet' ? '' : 'btn-hover'} ${styles[variant]} ${className}`} {...props} />
}

// Icon only on narrow phones, icon and word from 380px up
export function SignOutButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Sign out"
      className="btn-hover shrink-0 inline-flex items-center justify-center gap-1.5 text-sm text-paper/85 border border-paper/25 rounded-full w-10 min-[380px]:w-auto min-[380px]:px-4 h-10 hover:bg-paper hover:text-ink hover:border-paper"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      <span className="hidden min-[380px]:inline">Sign out</span>
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-ink/80 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink/50 mt-1">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full min-h-[52px] rounded-xl bg-white border border-ink/15 px-4 text-[17px] text-ink placeholder:text-ink/35 outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20'

export function Spinner() {
  return <span className="inline-block w-5 h-5 border-2 border-current border-r-transparent rounded-full animate-spin align-[-3px]" />
}

export function Notice({ tone = 'error', children, className = '' }) {
  const tones = {
    error: 'bg-paper border-ink/15 border-l-4 border-l-gold text-ink',
    ok: 'bg-gold/10 border-gold/40 text-ink',
    info: 'bg-white border-gold/50 text-ink',
  }
  return <p className={`anim-rise rounded-xl border text-sm px-4 py-3 ${tones[tone]} ${className}`}>{children}</p>
}

// Bottom sheet on phones, centred dialog on wider screens
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div role="dialog" aria-label={title} className="anim-sheet relative w-full md:max-w-lg max-h-[92vh] flex flex-col bg-paper rounded-t-3xl md:rounded-3xl shadow-2xl">
        <div className="md:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between px-5 pt-3 md:pt-5">
          <h2 className="font-serif text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="w-10 h-10 -mr-2 rounded-full text-2xl text-ink/60 hover:bg-ink/5" aria-label="Close">
            ×
          </button>
        </div>
        {children ? <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div> : <div className="h-3" />}
        {footer && <div className="px-5 pt-2 pb-5 safe-bottom border-t border-ink/10">{footer}</div>}
      </div>
    </div>
  )
}

export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={`grid gap-1 rounded-2xl bg-mist p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-[42px] min-w-0 px-1 rounded-xl text-[13px] min-[380px]:text-sm font-semibold truncate ${value === o.value ? 'bg-ink text-paper shadow-sm' : 'text-ink/70 hover:text-ink hover:bg-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
