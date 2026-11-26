#!/usr/bin/env node
// Compare two explicitly acquired DEX-string snapshots; does not download or redistribute APKs.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function diffFlagSnapshots(before, after) {
  const validate = (snapshot) => {
    if (!snapshot || !Array.isArray(snapshot.names) || snapshot.names.some(s => typeof s !== 'string' || !/^[a-z][a-z0-9_]+$/.test(s))) {
      throw new Error('Expected a Gboard candidate-flag snapshot with a names[] array');
    }
    return new Set(snapshot.names);
  };
  const old = validate(before), next = validate(after);
  return {
    from: before.gboardVersion ?? 'unknown',
    to: after.gboardVersion ?? 'unknown',
    previousCount: old.size,
    currentCount: next.size,
    added: [...next].filter(name => !old.has(name)).sort(),
    removed: [...old].filter(name => !next.has(name)).sort(),
    unchanged: [...next].filter(name => old.has(name)).length,
    warning: 'Candidate strings only: additions/removals do not establish usable switches or changed behavior.'
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [newFile, oldFile = 'data/flag-identifiers.json'] = process.argv.slice(2);
  if (!newFile) {
    console.error('Usage: node scripts/diff-flag-snapshots.mjs new-snapshot.json [old-snapshot.json]');
    process.exitCode = 2;
  } else {
    try {
      const report = diffFlagSnapshots(JSON.parse(fs.readFileSync(oldFile, 'utf8')), JSON.parse(fs.readFileSync(newFile, 'utf8')));
      console.log(JSON.stringify(report, null, 2));
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1;
    }
  }
}