import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PILOTS, insideCircle, pilotForHost } from './pilots.js';

const [GBS] = PILOTS;

describe('pilot sites', () => {
  test('a host serves the pilot its first label names, with or without a port', () => {
    for (const host of ['gbs.fixplease.work', 'GBS.FixPlease.work', 'gbs.fixplease.work:443', 'gbs.localhost:5180']) {
      assert.equal(pilotForHost(host)?.id, 'gbs', host);
    }
    for (const host of ['fixplease.work', 'www.fixplease.work', 'xgbs.fixplease.work', 'gbs', 'localhost:5180', '127.0.0.1:8787', '', undefined]) {
      assert.equal(pilotForHost(host), null, String(host));
    }
  });

  test('the Greenbelt Station circle takes its streets and refuses places just outside it', () => {
    const inside: Record<string, [number, number]> = {
      'Davis Point Lane': [39.0011018, -76.9156078],
      'North Channel Drive': [39.0029119, -76.9151924],
      'Rock Quarry Avenue': [39.0003018, -76.9189954],
      'Stream Bank Lane': [39.0014667, -76.9145643],
      '350 m north of the centre': [GBS.center.latitude + 350 / 111_195, GBS.center.longitude],
    };
    const outside: Record<string, [number, number]> = {
      '450 m north of the centre': [GBS.center.latitude + 450 / 111_195, GBS.center.longitude],
      'Greenbelt Metro station': [39.0111, -76.9108],
      'Campus Drive, College Park': [38.9869, -76.9426],
    };
    for (const [name, [latitude, longitude]] of Object.entries(inside)) assert.ok(insideCircle(GBS, { latitude, longitude }), name);
    for (const [name, [latitude, longitude]] of Object.entries(outside)) assert.ok(!insideCircle(GBS, { latitude, longitude }), name);
  });
});
