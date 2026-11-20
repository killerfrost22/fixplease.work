import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PILOTS } from '../shared/pilots.js';
import { pilotShell } from './pilot-shell.js';

const INDEX_HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function valueOf(html: string, key: string, attribute: 'content' | 'href'): string | undefined {
  return html.match(new RegExp(`<(?:meta|link)\\b[^>]*\\s${key}[^>]*\\s${attribute}="([^"]*)"`))?.[1];
}

for (const pilot of PILOTS) {
  test(`${pilot.id}: every link-preview tag in index.html describes the pilot, not the nationwide lookup`, () => {
    const html = pilotShell(INDEX_HTML, pilot);
    const url = `https://${pilot.id}.fixplease.work/`;
    assert.match(html, new RegExp(`<title>Fix Please · ${pilot.area} pilot</title>`));
    assert.equal(valueOf(html, 'rel="canonical"', 'href'), url);
    assert.equal(valueOf(html, 'property="og:url"', 'content'), url);
    for (const key of ['property="og:title"', 'name="twitter:title"']) {
      assert.equal(valueOf(html, key, 'content'), `Fix Please · ${pilot.area} pilot`, key);
    }
    for (const key of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
      assert.match(valueOf(html, key, 'content') ?? '', new RegExp(`${pilot.area}.+${pilot.organization}`), key);
    }
    for (const key of ['property="og:image"', 'name="twitter:image"']) {
      assert.equal(valueOf(html, key, 'content'), `${url}og-${pilot.id}.png`, key);
    }
    assert.ok(existsSync(new URL(`../public/og-${pilot.id}.png`, import.meta.url)), 'the share image is in public/');
    // Nothing from the main site's head survives: no research claims, no fixplease.work addresses.
    assert.doesNotMatch(html, /who fixes it|office that covers it|shows you the sources/i);
    assert.doesNotMatch(html, /"https:\/\/fixplease\.work\//);
  });
}
