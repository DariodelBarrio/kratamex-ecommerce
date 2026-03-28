'use client'

import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store-context'
import { AuthForm } from '@/components/AuthForm'

export default function LoginPage() {
  const router = useRouter()
  const { handleAuth, authUser } = useStore()
  if (authUser) { router.replace('/'); return null }
  return <AuthForm defaultMode="login" onAuth={handleAuth} onDone={() => router.push('/')} />
}
