'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    user,
    loading,
    projectLabel,
    usingEmulators,
  } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        if (password !== confirm) {
          throw new Error('Passwords do not match.');
        }
        await signUp(email, password, name || 'LUX Admin');
      } else {
        await signIn(email, password);
      }
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      // Redirects away to Google — no popup. Page returns to /login then home.
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="stage" aria-hidden>
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="grid" />
      </div>
      <form onSubmit={onSubmit} className="card">
        <div className="mark">L</div>
        <p className="eyebrow">LUX Command</p>
        <h1>{mode === 'signin' ? 'Sign in to ops' : 'Create admin account'}</h1>
        <p className="sub">
          Live Firebase admin for bookings, drivers, and dispatch — never mock
          rows.
        </p>
        <p className={`project${usingEmulators ? ' warn' : ''}`}>
          {projectLabel}
        </p>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === 'signin' ? 'active' : ''}
            disabled={busy}
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            className={mode === 'signup' ? 'active' : ''}
            disabled={busy}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Create account
          </button>
        </div>

        {mode === 'signup' ? (
          <label>
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Ops lead"
              disabled={busy}
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            type="email"
            required
            placeholder="you@company.com"
            disabled={busy}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
            required
            minLength={6}
            disabled={busy}
          />
        </label>
        {mode === 'signup' ? (
          <label>
            Confirm password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
              disabled={busy}
            />
          </label>
        ) : null}

        {error ? <p className="err">{error}</p> : null}

        <button type="submit" disabled={busy}>
          {busy
            ? mode === 'signup'
              ? 'Creating…'
              : 'Signing in…'
            : mode === 'signup'
              ? 'Create account'
              : 'Enter command center'}
        </button>

        <div className="divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="google"
          disabled={busy}
          onClick={onGoogle}
        >
          <span className="g">G</span>
          {busy ? 'Redirecting to Google…' : 'Continue with Google'}
        </button>

        <p className="hint">
          Open admin only at <code>http://localhost:3000/login</code>. In Firebase
          Console → Authentication → Settings → Authorized domains, add{' '}
          <code>localhost</code> and <code>127.0.0.1</code>. Enable Email/Password
          + Google under Sign-in method.
        </p>
        <a
          className="console"
          href="https://console.firebase.google.com/project/uberclone-6e4a0/authentication/settings"
          target="_blank"
          rel="noreferrer"
        >
          Open Firebase Auth settings →
        </a>
      </form>
      <style>{`
        .login {
          position: relative;
          isolation: isolate;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 1.75rem;
          overflow: hidden;
        }
        .stage {
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(900px 500px at 15% 10%, rgba(223, 245, 0, 0.22), transparent 55%),
            radial-gradient(700px 420px at 90% 80%, rgba(18, 20, 26, 0.18), transparent 50%),
            linear-gradient(160deg, #11141b 0%, #1b1f2a 45%, #0f1116 100%);
        }
        .grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(circle at 50% 40%, black, transparent 75%);
          opacity: 0.55;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(8px);
          animation: drift 12s ease-in-out infinite alternate;
        }
        .orb-a {
          width: 280px;
          height: 280px;
          left: 8%;
          top: 18%;
          background: radial-gradient(circle, rgba(223,245,0,0.45), transparent 70%);
        }
        .orb-b {
          width: 360px;
          height: 360px;
          right: 5%;
          bottom: 8%;
          background: radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%);
          animation-delay: -4s;
        }
        @keyframes drift {
          from { transform: translateY(0) scale(1); }
          to { transform: translateY(-18px) scale(1.05); }
        }
        .card {
          width: min(440px, 100%);
          background: rgba(251, 250, 247, 0.94);
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 28px;
          padding: 1.85rem 1.75rem 1.55rem;
          display: grid;
          gap: 0.85rem;
          box-shadow: 0 30px 80px rgba(0,0,0,0.35);
          backdrop-filter: blur(16px);
        }
        .mark {
          width: 52px;
          height: 52px;
          border-radius: 999px;
          background: var(--lux-lime);
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.35rem;
          box-shadow: 0 10px 28px var(--lux-lime-glow);
        }
        .eyebrow {
          margin: 0.35rem 0 0;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--lux-muted);
        }
        h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 2rem;
          letter-spacing: -0.04em;
        }
        .sub {
          margin: 0;
          color: var(--lux-muted);
          line-height: 1.5;
        }
        .project {
          margin: 0;
          font-size: 0.78rem;
          font-weight: 700;
          color: #2f7d32;
        }
        .project.warn { color: var(--lux-danger); }
        .tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem;
          padding: 0.25rem;
          background: #eceae4;
          border-radius: 14px;
        }
        .tabs button {
          margin: 0;
          box-shadow: none;
          background: transparent;
          border-radius: 11px;
          padding: 0.65rem;
          font-size: 0.9rem;
        }
        .tabs button.active {
          background: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        label {
          display: grid;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--lux-ink-soft);
        }
        input {
          border: 1px solid var(--lux-line-strong);
          border-radius: 14px;
          padding: 0.85rem 0.95rem;
          background: #fff;
          outline: none;
          text-transform: none;
          letter-spacing: normal;
          font-weight: 500;
        }
        input:focus {
          border-color: color-mix(in srgb, var(--lux-lime) 55%, var(--lux-line));
          box-shadow: 0 0 0 3px var(--lux-lime-glow);
        }
        button {
          border: 0;
          border-radius: 16px;
          background: var(--lux-lime);
          color: var(--lux-ink);
          font-family: var(--font-display);
          font-weight: 800;
          padding: 0.95rem;
          cursor: pointer;
          margin-top: 0.25rem;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 12px 28px var(--lux-lime-glow);
        }
        button:hover:not(:disabled) { transform: translateY(-1px); }
        button:disabled { opacity: 0.7; cursor: wait; }
        .google {
          background: #fff;
          border: 1px solid var(--lux-line-strong);
          box-shadow: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
        }
        .g {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: #f4f4f2;
          display: grid;
          place-items: center;
          color: #4285f4;
          font-weight: 900;
        }
        .divider {
          display: grid;
          place-items: center;
          position: relative;
          color: var(--lux-muted);
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0.15rem 0;
        }
        .divider::before {
          content: '';
          position: absolute;
          inset: 50% 0 auto;
          height: 1px;
          background: var(--lux-line);
        }
        .divider span {
          position: relative;
          background: rgba(251, 250, 247, 0.94);
          padding: 0 0.6rem;
        }
        .err {
          color: var(--lux-danger);
          font-size: 0.85rem;
          margin: 0;
          line-height: 1.4;
        }
        .hint {
          margin: 0;
          text-align: center;
          color: var(--lux-muted);
          font-size: 0.78rem;
          line-height: 1.4;
        }
        .hint code {
          font-size: 0.74rem;
        }
        .console {
          text-align: center;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--lux-ink);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </main>
  );
}
