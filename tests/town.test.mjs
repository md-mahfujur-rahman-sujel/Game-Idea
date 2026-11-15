import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureTown, MAX_TOWN_LEVEL } from '../src/core/town.js';

test('town save repair safely clamps large saga chapter numbers', () => {
  const profile = {
    townLevel: 1,
    story: { chapter: MAX_TOWN_LEVEL + 1, step: 0 },
  };

  assert.equal(ensureTown(profile), profile);
  assert.equal(profile.story.chapter, MAX_TOWN_LEVEL);
});
