import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCaptureAt, captureCountdown } from '../dist/refresh-schedule.js';

test('countdown follows UTC schedule across capture and day boundaries',()=>{
 for(const [now,next,countdown] of [
  ['2026-10-21T00:16:59Z','2026-10-21T00:17:00Z','00:00:01'],
  ['2026-10-21T00:17:00Z','2026-10-21T06:17:00Z','06:00:00'],
  ['2026-10-21T18:18:00Z','2026-10-22T00:17:00Z','05:59:00'],
  ['2026-12-31T23:59:59Z','2027-01-01T00:17:00Z','00:17:01']
 ]){
  assert.equal(nextCaptureAt(Date.parse(now)),Date.parse(next));
  assert.equal(captureCountdown(Date.parse(now)),countdown);
 }
});
