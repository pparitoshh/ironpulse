'use client'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push('/dashboard')
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#080810' }}>
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-sm w-full text-center animate-fade-in">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="font-display text-7xl tracking-wider" style={{ color: '#f97316', lineHeight: 1 }}>
            IRON<br />PULSE
          </h1>
          <p className="mt-3 text-sm tracking-widest uppercase" style={{ color: '#666' }}>
            Your AI Gym Coach
          </p>
        </div>

        {/* Features */}
        <div className="mb-10 space-y-3 text-left">
          {[
            { icon: '🤖', text: 'AI workout plan based on your goals & equipment' },
            { icon: '📊', text: 'Log sets, reps, weight — track every PR' },
            { icon: '🍽️', text: 'Food logger with AI macro estimation & photo scan' },
            { icon: '📈', text: 'Progress charts, muscle heatmap, body measurements' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#0f0f1a', border: '1px solid #1c1c2e' }}>
              <span className="text-xl">{f.icon}</span>
              <span className="text-sm" style={{ color: '#aaa' }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Sign in */}
        <button
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-95"
          style={{ background: '#f97316', color: '#fff' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-4 text-xs" style={{ color: '#444' }}>
          Free to use · Powered by Groq + Gemini
        </p>
      </div>
    </main>
  )
}
