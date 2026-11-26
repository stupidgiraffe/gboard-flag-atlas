#!/usr/bin/env node
// Public upstream VERSION watcher. An APK is needed before flag additions can be verified.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const STATE = 'data/upstream-versions.json';
const PATCH_URL = 'https://raw.githubusercontent.com/jasonwu1994/Gboard-patches/main/patches-list.json';
const MIRROR_URL = 'https://www.apkmirror.com/apk/google-inc/gboard/versions/';
const GBOARD_PACKAGE = 'com.google.android.inputmethod.latin';

const compareVersions = (a, b) => {
  const aa = a.match(/\d+/g)?.map(Number) ?? [], bb = b.match(/\d+/g)?.map(Number) ?? [];
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    if ((aa[i] ?? 0) !== (bb[i] ?? 0)) return (aa[i] ?? 0) - (bb[i] ?? 0);
  }
  return a.localeCompare(b);
};
export function parsePatchCatalog(raw) {
  const data = JSON.parse(raw);
  if (!Array.isArray(data.patches) || !/^\d+\.\d+\.\d+/.test(data.version)) {
    throw new Error('Unrecognized upstream patches-list.json');
  }
  const versions = [...new Set(data.patches.flatMap(p => p.compatiblePackages?.[GBOARD_PACKAGE] ?? []))]
    .filter(v => /^\d+(?:\.\d+){3}-release-[a-z0-9-]+$/.test(v))
    .sort(compareVersions).reverse();
  if (!versions.length) throw new Error('No supported Gboard version in patch manifest');
  return {patchVersion: data.version, supportedGboardVersions: versions};
}
export function parseApkMirror(html) {
  // APKMirror's public versions listing is a best-effort indicator, NOT a Google Play API.
  const re = /Gboard(?:\s*-\s*the Google Keyboard)?\s+(\d{1,2}(?:\.\d+){3})(?:\s+(beta))?/gi;
  const rows = [...html.matchAll(re)].map(m => ({version: m[1], channel: m[2] ? 'beta' : 'stable'}));
  if (!rows.length) throw new Error('Could not parse APKMirror public release list');
  // The listing repeats beta titles in HTML snippets without their beta suffix.
  // Any explicit beta occurrence takes precedence over unlabelled duplicates.
  const channels = new Map();
  for (const row of rows) {
    if (row.channel === 'beta' || !channels.has(row.version)) channels.set(row.version, row.channel);
  }
  const latest = {};
  for (const channel of ['stable', 'beta']) {
    const versions = [...channels].filter(([, type]) => type === channel).map(([version]) => version)
      .sort(compareVersions).reverse();
    if (versions.length) latest[channel] = versions[0];
  }
  return latest;
}
export function changesBetween(oldState, newState) {
  const changed = [];
  if (oldState.patches?.supportedGboardVersions?.length &&
      JSON.stringify(oldState.patches.supportedGboardVersions) !== JSON.stringify(newState.patches.supportedGboardVersions)) {
    changed.push('Morphe-compatible Gboard build');
  }
  if (oldState.mirror && newState.mirror && JSON.stringify(oldState.mirror) !== JSON.stringify(newState.mirror)) {
    changed.push('public Gboard version listing');
  }
  return changed;
}
async function download(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: {'User-Agent': 'GboardFlagAtlas-VersionWatcher/1.0 (public metadata; github.com/stupidgiraffe/gboard-flag-atlas)'}
  });
  if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
  return await response.text();
}
async function main() {
  const old = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const next = structuredClone(old);
  const errors = [];
  let successes = 0;
  try {
    next.patches = parsePatchCatalog(await download(PATCH_URL));
    successes++;
  } catch (err) {errors.push('Morphe manifest: ' + err.message);}
  try {
    next.mirror = parseApkMirror(await download(MIRROR_URL));
    successes++;
  } catch (err) {errors.push('APKMirror: ' + err.message);}
  if (!successes) throw new Error('Both public sources unavailable: ' + errors.join(' | '));
  const changed = changesBetween(old, next);
  const eventKey = createHash('sha256').update(JSON.stringify({patches: next.patches.supportedGboardVersions, mirror: next.mirror})).digest('hex').slice(0,12);
  // Version numbers changing does NOT establish a change in flag identifiers.
  const stateChanged = JSON.stringify(old.patches) !== JSON.stringify(next.patches) ||
                       JSON.stringify(old.mirror) !== JSON.stringify(next.mirror);
  const now = new Date().toISOString();
  if (stateChanged) {
    next.history = [...(old.history ?? []), {
      observedAt: now,
      patches: next.patches,
      mirror: next.mirror,
      changeTypes: changed.length ? changed : ['initial source baseline / patch release']
    }].slice(-120);
    fs.writeFileSync(STATE, JSON.stringify(next, null, 2) + '\n');
  }
  const warn = errors.length ? '\nUnavailable sources (retaining last known values):\n- ' + errors.join('\n- ') : '';
  const report = [
    '# Gboard version change detected',
    '',
    'Detected: ' + now,
    'Changed: ' + changed.join(', '),
    '',
    'Morphe patches version: ' + next.patches.patchVersion,
    'Morphe-compatible Gboard: ' + next.patches.supportedGboardVersions.join(', '),
    'Public Gboard versions (APKMirror): ' + JSON.stringify(next.mirror ?? {}),
    '',
    'Sources: ' + PATCH_URL + ' ; ' + MIRROR_URL,
    '',
    '**An updated version does not prove new flags exist.** To compare flags, acquire the correct new APK and run a fresh identifier scan; then use the local diff script.',
    warn
  ].join('\n');
  fs.writeFileSync('/tmp/gboard-version-report.md', report + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
    'state_changed=' + stateChanged + '\n' + 'notify=' + Boolean(changed.length) + '\n' + 'event_key=' + eventKey + '\n');
  console.log(JSON.stringify({stateChanged, changed, patch: next.patches, mirror: next.mirror, errors}, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {console.error(error); process.exitCode = 1;});
}