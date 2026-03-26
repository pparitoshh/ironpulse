'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard', icon: '⚡', label: 'Home' },
  { href: '/workout', icon: '🏋️', label: 'Workout' },
  { href: '/food', icon: '🍽️', label: 'Food' },
  { href: '/progress', icon: '📈', label: 'Progress' },
]

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex max-w-lg mx-auto"
      style={{ background: '#0a0a14', borderTop: '1px solid #1c1c2e' }}>
      {TABS.map(tab => {
        const active = path === tab.href
        return (
          <Link key={tab.href} href={tab.href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all"
            style={{ color: active ? '#f97316' : '#555' }}>
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium tracking-wide">{tab.label}</span>
            {active && (
              <div className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: '#f97316' }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
