'use client';

type LatLng = { lat: number; lng: number; label?: string };

function mapsKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
}

function staticMapsUrl(points: LatLng[], size = '640x360') {
  const key = mapsKey();
  if (!key || points.length === 0) return null;
  const markers = points
    .map((p, i) => {
      const color = i === 0 ? 'green' : i === points.length - 1 ? 'red' : 'blue';
      const label = String.fromCharCode(65 + Math.min(i, 25));
      return `markers=color:${color}%7Clabel:${label}%7C${p.lat},${p.lng}`;
    })
    .join('&');
  const path =
    points.length > 1
      ? `&path=color:0x111813ff%7Cweight:4%7C${points
          .map((p) => `${p.lat},${p.lng}`)
          .join('%7C')}`
      : '';
  return `https://maps.googleapis.com/maps/api/staticmap?size=${size}&scale=2&maptype=roadmap&${markers}${path}&key=${key}`;
}

export function OpsMap({
  points,
  title = 'Route map',
}: {
  points: LatLng[];
  title?: string;
}) {
  const valid = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );
  const url = staticMapsUrl(valid);

  if (valid.length === 0) {
    return (
      <div className="ops-map empty">
        <p>No coordinates on this trip yet.</p>
      </div>
    );
  }

  return (
    <div className="ops-map">
      <div className="ops-map-head">
        <strong>{title}</strong>
        <span>{valid.length} pin{valid.length === 1 ? '' : 's'}</span>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="ops-map-img" />
      ) : (
        <div className="ops-map-fallback">
          <p>Map preview needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.</p>
          <ul>
            {valid.map((p, i) => (
              <li key={`${p.lat}-${p.lng}-${i}`}>
                <strong>{p.label ?? `Stop ${i + 1}`}</strong>
                <span>
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="ops-map-legend">
        {valid.map((p, i) => (
          <li key={`leg-${i}`}>
            <span className="ops-map-pin">{String.fromCharCode(65 + Math.min(i, 25))}</span>
            {p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function itineraryToPoints(
  itinerary: unknown,
): LatLng[] {
  if (!Array.isArray(itinerary)) return [];
  const out: LatLng[] = [];
  for (const stop of itinerary) {
    if (!stop || typeof stop !== 'object') continue;
    const place = (stop as { place?: Record<string, unknown> }).place;
    const loc =
      (place?.location as { lat?: number; lng?: number } | undefined) ??
      (stop as { location?: { lat?: number; lng?: number } }).location;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const label =
      String(
        place?.label ??
          place?.formattedAddress ??
          (stop as { label?: string }).label ??
          '',
      ) || undefined;
    out.push({ lat, lng, label });
  }
  return out;
}
