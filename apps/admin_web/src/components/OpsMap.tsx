'use client';

import { useEffect, useId, useRef, useState } from 'react';

type LatLng = { lat: number; lng: number; label?: string };

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          el: HTMLElement,
          opts: Record<string, unknown>,
        ) => {
          fitBounds: (b: unknown, padding?: number) => void;
          setCenter: (c: LatLng) => void;
          setZoom: (z: number) => void;
        };
        Marker: new (opts: Record<string, unknown>) => unknown;
        Polyline: new (opts: Record<string, unknown>) => unknown;
        LatLngBounds: new () => {
          extend: (p: LatLng) => void;
        };
      };
    };
    __luxMapsReady?: boolean;
    __luxMapsCallbacks?: Array<() => void>;
  }
}

function mapsKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    'AIzaSyCORTEDxkmT71axjYEqcifFKEb1VPAkC_0'
  );
}

function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.__luxMapsReady && window.google?.maps) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    window.__luxMapsCallbacks = window.__luxMapsCallbacks ?? [];
    window.__luxMapsCallbacks.push(() => resolve());
    const existing = document.getElementById('lux-google-maps-js');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'lux-google-maps-js';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.onload = () => {
      window.__luxMapsReady = true;
      (window.__luxMapsCallbacks ?? []).forEach((cb) => cb());
      window.__luxMapsCallbacks = [];
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps JS'));
    document.head.appendChild(script);
  });
}

function mountMap(el: HTMLElement, pins: LatLng[]) {
  if (!window.google?.maps || pins.length === 0) return;
  const g = window.google.maps;
  const center = pins[0];
  const map = new g.Map(el, {
    center,
    zoom: 12,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
    gestureHandling: 'greedy',
  });
  const bounds = new g.LatLngBounds();
  pins.forEach((p, i) => {
    new g.Marker({
      map,
      position: p,
      label: String.fromCharCode(65 + Math.min(i, 25)),
      title: p.label ?? `Stop ${i + 1}`,
    });
    bounds.extend(p);
  });
  if (pins.length > 1) {
    new g.Polyline({
      map,
      path: pins,
      strokeColor: '#111813',
      strokeWeight: 4,
      strokeOpacity: 0.9,
    });
    map.fitBounds(bounds, 48);
  } else {
    map.setCenter(center);
    map.setZoom(13);
  }
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
  const hostId = useId().replace(/:/g, '');
  const mapRef = useRef<HTMLDivElement | null>(null);
  const fullRef = useRef<HTMLDivElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const pointsKey = valid.map((p) => `${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (valid.length === 0 || !mapRef.current) return;
    let cancelled = false;
    const pins = valid;
    (async () => {
      try {
        await loadGoogleMaps(mapsKey());
        if (cancelled || !mapRef.current) return;
        mountMap(mapRef.current, pins);
      } catch {
        // legend still shows coordinates
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  useEffect(() => {
    if (!expanded || valid.length === 0 || !fullRef.current) return;
    let cancelled = false;
    const pins = valid;
    (async () => {
      try {
        await loadGoogleMaps(mapsKey());
        if (cancelled || !fullRef.current) return;
        mountMap(fullRef.current, pins);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, pointsKey]);

  if (valid.length === 0) {
    return (
      <div className="ops-map empty">
        <p>No coordinates on this trip yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="ops-map">
        <div className="ops-map-head">
          <strong>{title}</strong>
          <div className="ops-map-actions">
            <span>
              {valid.length} pin{valid.length === 1 ? '' : 's'} · Google Maps
            </span>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setExpanded(true)}
            >
              Open full map
            </button>
          </div>
        </div>
        <div
          id={`lux-map-${hostId}`}
          ref={mapRef}
          className="ops-map-canvas"
          role="img"
          aria-label={title}
        />
        <ul className="ops-map-legend">
          {valid.map((p, i) => (
            <li key={`leg-${i}`}>
              <span className="ops-map-pin">
                {String.fromCharCode(65 + Math.min(i, 25))}
              </span>
              {p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
            </li>
          ))}
        </ul>
      </div>

      {expanded ? (
        <div className="ops-map-fullscreen" role="dialog" aria-modal="true">
          <div className="ops-map-fullscreen-bar">
            <strong>{title}</strong>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setExpanded(false)}
            >
              Close
            </button>
          </div>
          <div ref={fullRef} className="ops-map-fullscreen-canvas" />
        </div>
      ) : null}
    </>
  );
}

export function itineraryToPoints(itinerary: unknown): LatLng[] {
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
