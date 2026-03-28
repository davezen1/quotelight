import assert from 'node:assert';
import { test } from 'node:test';
import { truncateForPreview } from '../content/content.js';

test('truncateForPreview leaves short text intact', () => {
  const result = truncateForPreview('Short quote');
  assert.strictEqual(result, 'Short quote');
});

test('truncateForPreview truncates at ~120 chars', () => {
  const longText = 'A'.repeat(200);
  const result = truncateForPreview(longText);
  assert.ok(result.length <= 121);
  assert.ok(result.endsWith('\u2026'));
});
