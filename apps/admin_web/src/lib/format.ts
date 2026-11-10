export function money(minor?: number | null, currency = 'CAD') {
  if (minor == null || Number.isNaN(Number(minor))) return '—';
  return `${(Number(minor) / 100).toFixed(2)} ${currency}`;
}

export function shortId(id?: string | null, keep = 10) {
  if (!id) return '—';
  return id.length <= keep ? id : `${id.slice(0, keep)}…`;
}

export function when(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
