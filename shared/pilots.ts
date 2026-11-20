/**
 * Pilot sites: a subdomain of fixplease.work for one neighborhood. Inside its circle, every report is addressed to
 * the partner that runs the pilot instead of the office research would find; a pin outside the circle can't be
 * confirmed. The partner's inbox still shows only if its own contact page, loaded during the report, prints it.
 */
import type { Coordinates } from './types.js';

export interface Circle {
  center: Coordinates;
  radiusMeters: number;
}

export interface Pilot extends Circle {
  /** The subdomain's first label: `gbs` serves gbs.fixplease.work, and gbs.localhost in development. */
  id: string;
  /** The area as residents name it. */
  area: string;
  /** Who every report in the area is addressed to, as its own website names it. */
  organization: string;
  /** What residents call it, for the headline ("Tell the HOA."). Its contact page says "Greenbelt Station HOA". */
  shortName: string;
  /** The partner's inbox, lowercase. */
  email: string;
  /** The partner's own page that prints `email`. The server loads it during every pilot report. */
  contactPage: string;
}

export const PILOTS: readonly Pilot[] = [
  {
    id: 'gbs',
    area: 'Greenbelt Station',
    // The smallest circle around OpenStreetMap's "Greenbelt Station South Core" (relation 18591461) has a 328 m
    // radius; 400 m leaves room for pins on the roads along its edge.
    center: { latitude: 39.00144, longitude: -76.91652 },
    radiusMeters: 400,
    organization: 'Greenbelt Station Master Association',
    shortName: 'the HOA',
    email: 'greenhoa@ciramail.com',
    contactPage: 'https://www.greenbeltstation.net/community-information/',
  },
];

/** The pilot a host serves, by its first label (`gbs.fixplease.work` → `gbs`). `host` may carry a port. */
export function pilotForHost(host: string | null | undefined): Pilot | null {
  const labels = (host ?? '').trim().toLowerCase().replace(/:\d+$/, '').split('.');
  if (labels.length < 2) return null;
  return PILOTS.find((pilot) => pilot.id === labels[0]) ?? null;
}

/** The host a page is served on: `gbs.fixplease.work` for a pilot, `fixplease.work` otherwise. */
export function siteHost(pilot: Pilot | null): string {
  return pilot ? `${pilot.id}.fixplease.work` : 'fixplease.work';
}

/** The pilot's page title, in the tab and in link previews. */
export function pilotTitle(pilot: Pilot): string {
  return `Fix Please · ${pilot.area} pilot`;
}

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in meters. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function insideCircle(circle: Circle, point: Coordinates): boolean {
  return distanceMeters(circle.center, point) <= circle.radiusMeters;
}
