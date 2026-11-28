'use client'
import { CSSProperties, useEffect, useRef, useState } from 'react'

/**
 * Number field that keeps exactly what you type.
 * <input type="number"> bound to a number state shows "010" on Android Chrome: the box holds "0",
 * the keyboard appends "10", and React won't rewrite the text because "010" still parses to 10.
 * Here the text is its own state: leading zeros are dropped, "," works as a decimal point
 * (German keyboards), 0 shows as an empty box with a grey placeholder, and the whole number is
 * selected when you tap so typing replaces it.
 */
export function cleanNumText(raw: string, decimals: boolean): string {
  let t = raw.replace(',', '.').replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '')
  if (decimals) {
    const dot = t.indexOf('.')
    if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '')
    if (t.startsWith('.')) t = '0' + t
  }
  return t.replace(/^0+(?=\d)/, '')
}

const show = (v: number) => (v ? String(v) : '')

export default function NumInput({
  value, onChange, decimals = true, placeholder = '0', className, style, onBlur, title,
}: {
  value: number
  onChange: (n: number) => void
  decimals?: boolean
  placeholder?: string
  className?: string
  style?: CSSProperties
  onBlur?: () => void
  title?: string
}) {
  const [text, setText] = useState(show(value))
  const typed = useRef(value)

  // Outside changes (copy from Previous, prefill) replace the text; our own typing doesn't.
  useEffect(() => {
    if (value !== typed.current) { typed.current = value; setText(show(value)) }
  }, [value])

  return (
    <input
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      enterKeyHint="done"
      value={text}
      placeholder={placeholder}
      title={title}
      onFocus={e => {
        // Select after the tap settles (Android moves the caret on touch), but never once typing has started.
        const el = e.currentTarget, at = el.value
        el.select()
        setTimeout(() => { if (document.activeElement === el && el.value === at) el.select() }, 0)
      }}
      onChange={e => {
        const t = cleanNumText(e.target.value, decimals)
        setText(t)
        const n = t === '' || t === '.' ? 0 : parseFloat(t)
        if (Number.isFinite(n)) { typed.current = n; onChange(n) }
      }}
      onBlur={() => { if (text.endsWith('.')) setText(text.slice(0, -1)); onBlur?.() }}
      className={className}
      style={style}
    />
  )
}
