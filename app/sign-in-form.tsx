'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/client'

type SignInFormProps = {
  initialError?: string
}

export function SignInForm({ initialError }: SignInFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="signin-brand">
          <div className="brand-mark"><Users size={20} strokeWidth={2.2} /></div>
          <span>Ethan Pull</span>
        </div>
        <div className="signin-heading">
          <span className="eyebrow"><ShieldCheck size={14} /> PRIVATE WORKSPACE</span>
          <h1>Welcome back.</h1>
          <p>Sign in to manage your members and departments.</p>
        </div>

        <form className="signin-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@organization.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <div className="password-label">
            <label htmlFor="password">Password</label>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="primary-button signin-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="signin-footnote">
          Accounts are managed by your workspace administrator.
        </p>
      </section>
    </main>
  )
}
