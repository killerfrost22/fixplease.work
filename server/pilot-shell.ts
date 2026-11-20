/**
 * The app shell for a pilot host. Link previews and search results read the page's head before any script runs,
 * so on a pilot host it has to describe the pilot (one inbox, no office research), not the nationwide lookup.
 */
import { pilotTitle, siteHost, type Pilot } from '../shared/pilots.js';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Sets `attribute` on the `<meta>` or `<link>` tag that carries `key`, such as `property="og:url"`. */
function setAttribute(html: string, key: string, attribute: 'content' | 'href', value: string): string {
  return html.replace(new RegExp(`<(?:meta|link)\\b[^>]*\\s${key}[^>]*>`), (tag) =>
    tag.replace(new RegExp(`(\\s${attribute}=)"[^"]*"`), (_match, prefix: string) => `${prefix}"${escapeHtml(value)}"`),
  );
}

/** `index.html` as a pilot host serves it. A tag missing from `html` is left out, never an error. */
export function pilotShell(html: string, pilot: Pilot): string {
  const url = `https://${siteHost(pilot)}/`;
  const title = pilotTitle(pilot);
  const description = `Something broken in ${pilot.area}? Pin the spot and say what’s wrong (a photo is optional). Fix Please writes the email to the ${pilot.organization} for you to send.`;
  const share = `Pin something broken in ${pilot.area} and get an email to the ${pilot.organization}, ready to send. A photo is optional.`;
  // public/og-<id>.png, drawn like the main share image.
  const image = `${url}og-${pilot.id}.png`;
  const imageAlt = `Fix Please, ${pilot.area} pilot: Something broken? Tell ${pilot.shortName}. The words fix and broken are circled in orange survey paint.`;
  const tags: Array<[key: string, attribute: 'content' | 'href', value: string]> = [
    ['name="description"', 'content', description],
    ['rel="canonical"', 'href', url],
    ['property="og:title"', 'content', title],
    ['property="og:description"', 'content', share],
    ['property="og:url"', 'content', url],
    ['property="og:image"', 'content', image],
    ['property="og:image:alt"', 'content', imageAlt],
    ['name="twitter:title"', 'content', title],
    ['name="twitter:description"', 'content', share],
    ['name="twitter:image"', 'content', image],
    ['name="twitter:image:alt"', 'content', imageAlt],
  ];
  return tags.reduce(
    (page, [key, attribute, value]) => setAttribute(page, key, attribute, value),
    html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`),
  );
}
