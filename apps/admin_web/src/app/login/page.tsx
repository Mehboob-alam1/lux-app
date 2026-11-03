'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@lux.test');
  const [password, setPassword] = useState('LuxTest123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    router.replace('/');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      setError(String(err));
    } finally {
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
        <h1>Sign in to ops</h1>
        <p className="sub">
          Live Firebase admin for bookings, drivers, and dispatch — never mock
          rows.
        </p>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="err">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Enter command center'}
        </button>
        <p className="hint">Seeded: admin@lux.test · LuxTest123!</p>
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
          animation: lux-rise 0.55s ease both;
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
        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        button:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        .err {
          color: var(--lux-danger);
          font-size: 0.85rem;
          margin: 0;
        }
        .hint {
          margin: 0;
          text-align: center;
          color: var(--lux-muted);
          font-size: 0.78rem;
        }
      `}</style>
    </main>
  );
}
