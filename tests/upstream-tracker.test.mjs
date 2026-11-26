import test from 'node:test';
import assert from 'node:assert/strict';
import { parseApkMirror, parsePatchCatalog, changesBetween } from '../scripts/check-upstream-versions.mjs';

test('reads version compatibility from upstream patch manifest', () => {
  const list = {version:'4.5.0',patches:[
    {compatiblePackages:{'com.google.android.inputmethod.latin':['18.5.4.993608717-release-arm64-v8a']}},
    {compatiblePackages:{'com.google.android.inputmethod.latin':['18.6.1.100000000-release-arm64-v8a','18.5.4.993608717-release-arm64-v8a']}}
  ]};
  assert.deepEqual(parsePatchCatalog(JSON.stringify(list)),{
    patchVersion:'4.5.0',
    supportedGboardVersions:['18.6.1.100000000-release-arm64-v8a','18.5.4.993608717-release-arm64-v8a']
  });
});
test('separately tracks beta and stable APKMirror versions', () => {
  const html = '<h3>Gboard - the Google Keyboard 18.8.1.1022711984 beta</h3>' +
               '<h3>Gboard - the Google Keyboard 18.6.9.1002251336</h3>' +
               '<h3>Gboard - the Google Keyboard 18.6.10.1002251336</h3>';
  assert.deepEqual(parseApkMirror(html), {stable:'18.6.10.1002251336',beta:'18.8.1.1022711984'});
});
test('treats first observation as a baseline, not a new release', () => {
  const latest = {patches:{patchVersion:'4.5.0',supportedGboardVersions:['18.5.4.993608717-release-arm64-v8a']},mirror:{stable:'18.6.10.1002251336'}};
  const old = {patches:latest.patches,mirror:null};
  assert.deepEqual(changesBetween(old,latest),[]);
  assert.deepEqual(changesBetween(latest,{...latest,mirror:{stable:'18.6.11.1002251336'}}),['public Gboard version listing']);
});
test('ignores patch-only releases, catches new compatible build', () => {
  const old={patches:{patchVersion:'4.5.0',supportedGboardVersions:['18.5.4.993608717-release-arm64-v8a']}};
  assert.deepEqual(changesBetween(old,{patches:{...old.patches,patchVersion:'4.6.0'}}),[]);
  assert.deepEqual(changesBetween(old,{patches:{...old.patches,supportedGboardVersions:['18.6.0.1002251336-release-arm64-v8a']}}),['Morphe-compatible Gboard build']);
});
test('rejects malformed metadata instead of silently claiming no updates', () => {
  assert.throws(()=>parseApkMirror('<html>Access denied</html>'),/Could not parse/);
  assert.throws(()=>parsePatchCatalog('{}'),/Unrecognized/);
});