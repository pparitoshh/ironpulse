'use client'
import { useRef, useState } from 'react'
import type { MachineScan } from '@/lib/machine'

/** Shrink a phone photo to ≤1280 px JPEG and return base64 (no data: prefix). */
export async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('Could not read the image'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not read the image'))
    i.src = dataUrl
  })
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.width * scale))
  c.height = Math.max(1, Math.round(img.height * scale))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Could not process the image')
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8).split(',')[1] || ''
}

/** "📷 Snap machine" button: camera -> /api/scan-machine -> onResult(exercise). */
export default function MachineScanButton({ onResult }: { onResult: (ex: MachineScan) => void }) {
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(file?: File | null) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const base64Image = await compressImage(file)
      const res = await fetch('/api/scan-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, mimeType: 'image/jpeg' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not read the machine')
      onResult(data as MachineScan)
    } catch (e: any) {
      setError(e?.message || 'Could not read the machine')
    } finally {
      setBusy(false)
      if (camRef.current) camRef.current.value = ''
      if (galRef.current) galRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={() => camRef.current?.click()} disabled={busy}
          className="flex-1 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all disabled:opacity-70"
          style={{ background: '#f97316', color: '#fff', boxShadow: '0 3px 0 #c2410c' }}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block animate-spin rounded-full" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
              Reading machine…
            </span>
          ) : '📷 Snap machine sign'}
        </button>
        <button onClick={() => galRef.current?.click()} disabled={busy} title="Pick a photo"
          className="px-4 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all"
          style={{ background: '#1c1c2e', color: '#f0f0f0', border: '1px solid #2a2a40' }}>
          🖼️
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      {error && <p className="text-sm font-semibold mt-2" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}
