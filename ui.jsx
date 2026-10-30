import { useEffect } from 'react'
import logo from '../assets/logo.png'
import pattern from '../assets/pattern.png'
import face from '../assets/face.png'

export function Emblem({ className = '' }) {
  return <img src={face} alt="Habesha" className={className} draggable="false" />
}

export function Logo({ className = '', ...rest }) {
  return <img src={logo} alt="Habesha" className={className} draggable="false" {...rest} />
}

export function Pattern({ className = '', ...rest }) {
  return <img src={pattern} alt="" aria-hidden="true" className={`block w-full max-w-xs mx-auto ${className}`} draggable="false" {...rest} />
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
