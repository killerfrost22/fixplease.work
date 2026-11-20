import { pilotForHost } from '../../shared/pilots';

/** The pilot this page serves (`gbs.fixplease.work` → Greenbelt Station), or `null` on fixplease.work. */
export const PILOT = pilotForHost(window.location.host);
