import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './pin-map.css';
import { Crosshair } from 'lucide-react';
import { insideCircle } from '../../shared/pilots';
import type { Coordinates, Place } from '../../shared/types';
import { RING_PATH } from '../components/Mark';
import { PILOT } from '../lib/pilot';
import type { PinSource } from './state';

interface PinMapProps {
  point: Coordinates | null;
  source: PinSource | null;
  onPick: (point: Coordinates) => void;
  /** Search results to plot as numbered markers, matching the numbers in the list. */
  candidates?: Place[] | null;
  activeCandidate?: number | null;
  onPreviewCandidate?: (index: number | null) => void;
  onChooseCandidate?: (index: number) => void;
}

const OVERVIEW: L.LatLngTuple = [39.5, -98.35];
const OVERVIEW_ZOOM = 4;
const SPOT_ZOOM = 18;
/** The pilot's circle as map bounds; `null` off a pilot site. */
const PILOT_BOUNDS = PILOT ? L.latLng(PILOT.center.latitude, PILOT.center.longitude).toBounds(PILOT.radiusMeters * 2) : null;

const pinIcon = L.divIcon({
  className: 'pin-icon',
  html: `<span class="pin-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="${RING_PATH}"/><circle cx="24" cy="24" r="4.5"/></svg></span>`,
  iconSize: [56, 56],
  iconAnchor: [28, 28],
});

function stampIn(marker: L.Marker) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  marker
    .getElement()
    ?.querySelector('.pin-mark')
    ?.animate(
      [
        { transform: 'scale(1.7) rotate(-24deg)', opacity: 0 },
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
      ],
      { duration: 360, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
}

/** Leaflet map with a draggable survey-paint pin. Loaded with `React.lazy` only when the pin step opens. */
export default function PinMap({
  point,
  source,
  onPick,
  candidates,
  activeCandidate,
  onPreviewCandidate,
  onChooseCandidate,
}: PinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const candidateMarkers = useRef<L.Marker[]>([]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const candidateHandlers = useRef({ onPreviewCandidate, onChooseCandidate });
  candidateHandlers.current = { onPreviewCandidate, onChooseCandidate };
  const [tilesFailing, setTilesFailing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      // The map sits inside a long page; wheel zoom would hijack page scrolling. Buttons and double-click still zoom.
      scrollWheelZoom: false,
    });
    // A pilot opens on its own area, marked out the way a surveyor paints a boundary. Clicks go through to the map.
    if (PILOT && PILOT_BOUNDS) {
      map.fitBounds(PILOT_BOUNDS, { padding: [12, 12], animate: false });
      L.circle([PILOT.center.latitude, PILOT.center.longitude], {
        radius: PILOT.radiusMeters,
        interactive: false,
        className: 'pilot-area',
      }).addTo(map);
    } else {
      map.setView(OVERVIEW, OVERVIEW_ZOOM);
    }
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" rel="noopener noreferrer" target="_blank">Leaflet</a>');
    let loaded = 0;
    let failed = 0;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a> contributors',
    })
      .on('tileload', () => {
        loaded += 1;
        setTilesFailing(false);
      })
      .on('tileerror', () => {
        failed += 1;
        if (failed >= 4 && loaded === 0) setTilesFailing(true);
      })
      .addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    container.setAttribute('aria-label', 'Map. Arrow keys move the map, plus and minus zoom.');
    container.setAttribute('role', 'application');
    mapRef.current = map;

    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latLng = L.latLng(point.latitude, point.longitude);
    let marker = markerRef.current;
    if (!marker) {
      marker = L.marker(latLng, { icon: pinIcon, draggable: true, keyboard: false, autoPan: true }).addTo(map);
      marker.on('dragend', () => {
        const at = marker!.getLatLng();
        onPickRef.current({ latitude: at.lat, longitude: at.lng });
      });
      markerRef.current = marker;
    } else {
      marker.setLatLng(latLng);
    }
    if (source !== 'map') {
      if (PILOT && PILOT_BOUNDS && !insideCircle(PILOT, point)) {
        // Outside the pilot: frame the pin and the circle together, so why it can't be confirmed is on screen.
        const both = L.latLngBounds(PILOT_BOUNDS.getSouthWest(), PILOT_BOUNDS.getNorthEast()).extend(latLng);
        map.fitBounds(both, { padding: [28, 28], maxZoom: SPOT_ZOOM - 1, animate: false });
      } else {
        map.setView(latLng, Math.max(map.getZoom(), SPOT_ZOOM - 1), { animate: false });
      }
    }
    stampIn(marker);
  }, [point, source]);

  // Numbered markers for search results. The list is the keyboard route; markers are for pointers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !candidates || candidates.length === 0) return;
    const markers = candidates.map((place, index) => {
      const marker = L.marker([place.latitude, place.longitude], {
        icon: L.divIcon({
          className: 'cand-icon',
          html: `<span class="cand-mark">${index + 1}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        keyboard: false,
        riseOnHover: true,
      }).addTo(map);
      marker.on('click', () => candidateHandlers.current.onChooseCandidate?.(index));
      marker.on('mouseover', () => candidateHandlers.current.onPreviewCandidate?.(index));
      marker.on('mouseout', () => candidateHandlers.current.onPreviewCandidate?.(null));
      return marker;
    });
    candidateMarkers.current = markers;
    const bounds = L.latLngBounds(candidates.map((place) => [place.latitude, place.longitude] as L.LatLngTuple));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17, animate: false });
    return () => {
      for (const marker of markers) marker.remove();
      candidateMarkers.current = [];
    };
  }, [candidates]);

  // Previewing a result lifts its marker and brings it into view, so you can tell same-named places apart.
  useEffect(() => {
    const map = mapRef.current;
    candidateMarkers.current.forEach((marker, index) => {
      const active = index === activeCandidate;
      marker.getElement()?.classList.toggle('is-active', active);
      marker.setZIndexOffset(active ? 1000 : 0);
      if (active && map && !map.getBounds().pad(-0.1).contains(marker.getLatLng())) {
        map.panTo(marker.getLatLng(), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
      }
    });
  }, [activeCandidate, candidates]);

  function pinAtCentre() {
    const centre = mapRef.current?.getCenter();
    if (centre) onPick({ latitude: centre.lat, longitude: centre.lng });
  }

  return (
    <div className="pin-map">
      <div className="pin-map-frame">
        <div ref={containerRef} className="pin-map-canvas" />
        <span className="pin-map-crosshair" aria-hidden="true" />
        {tilesFailing && (
          <p className="pin-map-failed" role="status">
            The map isn’t loading right now. You can still search for an address or enter coordinates.
          </p>
        )}
      </div>
      <div className="pin-map-tools">
        <p className="pin-map-hint">
          {point ? 'Drag the pin, or tap the map to move it.' : PILOT ? 'Tap inside the dashed circle to drop the pin.' : 'Tap the map to drop the pin.'}
        </p>
        <button type="button" className="btn btn--sm" onClick={pinAtCentre}>
          <Crosshair size={18} aria-hidden="true" />
          Pin the map’s centre
        </button>
      </div>
    </div>
  );
}
