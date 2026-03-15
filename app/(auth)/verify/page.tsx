'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function VerifyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      const routes = {
        ADMIN: '/admin/dashboard',
        TEACHER: '/teacher/dashboard',
        STUDENT: '/student/dashboard',
      }
      router.replace(routes[session.user.role] ?? '/student/dashboard')
    }
  }, [status, session, router])

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(t)
  }, [])

  if (timedOut && status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-auto px-6 py-12 bg-white rounded-2xl shadow-sm text-center">
          <p className="text-gray-600 text-sm mb-4">Something took too long. Try signing in again.</p>
          <a
            href="/login"
            className="text-indigo-600 hover:underline text-sm font-medium"
          >
            Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto px-6 py-12 bg-white rounded-2xl shadow-sm text-center">
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Signing you in…</h2>
        <p className="text-sm text-gray-500">You'll be redirected automatically.</p>
      </div>
    </div>
  )
}
