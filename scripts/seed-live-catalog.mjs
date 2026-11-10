#!/usr/bin/env node
/**
 * Seed demo market/catalog into a live Firebase project using the
 * firebase-tools OAuth token (project Owner/Editor required).
 *
 * Usage: node scripts/seed-live-catalog.mjs [projectId]
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectId = process.argv[2] || 'uberclone-6e4a0';
const tokenStore = JSON.parse(
  readFileSync(join(homedir(), '.config/configstore/firebase-tools.json'), 'utf8'),
);
const token = tokenStore.tokens?.access_token;
if (!token) {
  console.error('No firebase-tools access token. Run: firebase login');
  process.exit(1);
}

const now = new Date().toISOString();

function s(v) {
  return { stringValue: String(v) };
}
function b(v) {
  return { booleanValue: Boolean(v) };
}
function i(v) {
  return { integerValue: String(v) };
}

async function upsert(path, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${path}: ${JSON.stringify(body.error || body)}`);
  }
  console.log('OK', path);
}

const docs = [
  [
    'markets/yyz',
    {
      marketId: s('yyz'),
      displayName: s('Toronto (Demo)'),
      timezone: s('America/Toronto'),
      currency: s('CAD'),
      active: b(true),
      bookingPaused: b(false),
      updatedAt: s(now),
    },
  ],
  [
    'pricing_rules/yyz-demo-v1',
    {
      ruleVersion: s('yyz-demo-v1'),
      marketId: s('yyz'),
      notice: s('DEMO ONLY — not production commercial rates'),
      currency: s('CAD'),
      baseMinor: i(3500),
      minimumMinor: i(4500),
      perKmMinor: i(220),
      perMinuteMinor: i(80),
      airportFeeMinor: i(1200),
      effectiveFrom: s(now),
    },
  ],
  [
    'policy_versions/yyz-wait-v1',
    {
      marketId: s('yyz'),
      waitingIncludedMinutes: i(15),
      noShowMinWaitMinutes: i(10),
      quoteExpiryMinutes: i(15),
    },
  ],
  [
    'airports/YYZ',
    {
      airportId: s('YYZ'),
      marketId: s('yyz'),
      name: s('Toronto Pearson'),
    },
  ],
  [
    'system_health/global',
    {
      status: s('NORMAL'),
      listenersFresh: b(true),
      updatedAt: s(now),
      notice: s('Live demo catalog seeded'),
    },
  ],
];

const classes = [
  ['COMFORT', 3, 2],
  ['EXECUTIVE', 3, 2],
  ['FIRST_CLASS', 3, 2],
  ['LUXURY_SUV', 5, 5],
  ['VIP_SPRINTER', 12, 12],
  ['LIMO_COACH', 20, 20],
];
for (const [id, p, l] of classes) {
  docs.push([
    `vehicle_classes/${id}`,
    {
      id: s(id),
      displayName: s(id.replaceAll('_', ' ')),
      capacityPassengers: i(p),
      capacityLuggage: i(l),
      active: b(true),
    },
  ]);
}

for (const [path, fields] of docs) {
  await upsert(path, fields);
}
console.log(JSON.stringify({ ok: true, projectId, count: docs.length }));
