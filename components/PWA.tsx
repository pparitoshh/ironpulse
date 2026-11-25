'use client'
import { useEffect, useState } from 'react'

// Registers the service worker and offers an "Install app" banner:
// Android/desktop Chrome via beforeinstallprompt, iOS Safari via Share-sheet hint.
const DISMISS_KEY = 'ip-install-dismissed'

export default function PWA() {
  const [deferred, setDeferred] = useState<any>(null)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (standalone || localStorage.getItem(DISMISS_KEY)) return

    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) setIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDeferred(null)
    setIosHint(false)
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice.catch(() => null)
    setDeferred(null)
  }

  if (!deferred && !iosHint) return null
  return (
    <div className="fixed left-3 right-3 bottom-24 z-50 rounded-2xl p-4 flex items-center gap-3 animate-fade-in"
      style={{ background: '#14141f', border: '2px solid #f97316', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
      <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base" style={{ color: '#f0f0f0' }}>Install IronPulse</div>
        <div className="text-sm" style={{ color: '#b4b4c8' }}>
          {deferred ? 'Full-screen app on your home screen' : 'Tap Share ⬆️ then “Add to Home Screen”'}
        </div>
      </div>
      {deferred && (
        <button onClick={install} className="px-4 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all"
          style={{ background: '#f97316', color: '#fff' }}>Install</button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="px-2 text-lg" style={{ color: '#b4b4c8' }}>✕</button>
    </div>
  )
}
