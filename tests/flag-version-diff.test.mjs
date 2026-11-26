import test from 'node:test';
import assert from 'node:assert/strict';
import { diffFlagSnapshots } from '../scripts/diff-flag-snapshots.mjs';

test('reports new and removed candidate identifiers without editing catalog', () => {
  const a={gboardVersion:'18.5.4',names:['abc_flag','xyz_flag']};
  const b={gboardVersion:'18.6.0',names:['abc_flag','new_flag']};
  const report=diffFlagSnapshots(a,b);
  assert.deepEqual(report.added,['new_flag']);
  assert.deepEqual(report.removed,['xyz_flag']);
  assert.equal(report.unchanged,1);
});
test('rejects malformed snapshots', () => {
  assert.throws(()=>diffFlagSnapshots({names:[]},{names:['not allowed']}),/Expected/);
});