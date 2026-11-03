'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NAV_ITEMS } from '@/lib/nav';
import { useAuth } from '@/lib/auth';

export function AdminShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="lux-boot">
        <div className="lux-boot-mark">L</div>
        <p>Checking admin session…</p>
      </div>
    );
  }

  return (
    <div className="lux-shell">
      <aside className="lux-sidebar" aria-label="Admin navigation">
        <div className="lux-brand">
          <span className="lux-brand-mark">L</span>
          <div>
            <div className="lux-brand-name">LUX</div>
            <div className="lux-brand-sub">Command</div>
          </div>
        </div>
        <div className="lux-live-rail" aria-hidden>
          <span className="lux-live-dot" />
          Live ops · Firebase
        </div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className="lux-nav-item disabled"
                  title={item.badge}
                  aria-disabled="true"
                >
                  <span>{item.label}</span>
                  <small>{item.badge}</small>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`lux-nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="lux-sidebar-foot">
          Premium mobility ops
          <strong>Toronto demo market</strong>
        </div>
      </aside>
      <div className="lux-main">
        <header className="lux-command-bar">
          <div className="lux-command-left">
            <label>
              Market
              <select defaultValue="yyz" aria-label="Market selector">
                <option value="yyz">Toronto (Demo)</option>
              </select>
            </label>
            <label>
              Window
              <select defaultValue="live" aria-label="Time window">
                <option value="live">Live</option>
                <option value="today">Today</option>
              </select>
            </label>
          </div>
          <div className="lux-command-center">
            <input
              type="search"
              placeholder="Search booking, phone, driver, plate, flight…"
              aria-label="Global search"
            />
          </div>
          <div className="lux-command-right">
            <span className="lux-profile">{user.email ?? 'Admin'}</span>
            <button
              type="button"
              className="ghost"
              onClick={() => logout().then(() => router.push('/login'))}
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="lux-content">
          {title ? <h1 className="page-title">{title}</h1> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
