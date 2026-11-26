#!/usr/bin/env python3
"""Download Gboard APKs from multiple mirrors, validate identity, and compare DEX candidate strings."""
import hashlib
import io
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

PACKAGE = "com.google.android.inputmethod.latin"
PREFIXES = frozenset("allow disable emoji enable force is max min pref show supported use".split())
NAME = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
DEX = re.compile(r"classes(?:\d+)?\.dex$")
SOURCES = ("apkpure", "uptodown", "apkcombo", "apkmirror", "apk20")


def read_uleb(blob, pos):
    val = 0
    for i in range(5):
        b = blob[pos + i]
        val |= (b & 127) << (7 * i)
        if b < 128:
            return pos + i + 1
    raise ValueError("Invalid DEX ULEB128")


def extract_dex(blob):
    if len(blob) < 112 or not blob.startswith(b"dex\n"):
        raise ValueError("Invalid DEX header")
    count, offset = struct.unpack_from("<II", blob, 56)
    if count > 2000000 or offset + count * 4 > len(blob):
        raise ValueError("Invalid DEX string table")
    names = set()
    for i in range(count):
        pos = struct.unpack_from("<I", blob, offset + 4 * i)[0]
        if pos >= len(blob):
            continue
        try:
            start = read_uleb(blob, pos)
            end = blob.find(b"\0", start, min(start + 160, len(blob)))
            if end <= start:
                continue
            s = blob[start:end].decode("ascii")
            if 6 <= len(s) <= 150 and NAME.fullmatch(s) and s.split("_", 1)[0] in PREFIXES:
                names.add(s)
        except (IndexError, UnicodeDecodeError, ValueError):
            continue
    return names


def scan_apk(content, expected):
    from androguard.core.apk import APK
    app = APK(content, raw=True)
    pkg, version = app.get_package(), str(app.get_androidversion_name() or "")
    if pkg != PACKAGE:
        raise ValueError("Wrong package: " + pkg)
    if not version.startswith(expected):
        raise ValueError("Wrong version: " + version + " != " + expected)
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        dex_files = [i for i in z.infolist() if DEX.fullmatch(i.filename)]
        if not dex_files:
            raise ValueError("APK lacks DEX")
        names = set()
        for f in dex_files:
            if f.file_size > 150000000:
                raise ValueError("Oversized DEX")
            names |= extract_dex(z.read(f))
        return names


def scan_package(path, expected):
    if path.stat().st_size > 230000000:
        raise ValueError("Oversized downloaded package")
    data = path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    if path.suffix.lower() == ".apk":
        return scan_apk(data, expected), sha
    if path.suffix.lower() not in (".xapk", ".apks", ".apkm"):
        raise ValueError("Unexpected package format")
    with zipfile.ZipFile(io.BytesIO(data)) as bundle:
        names = set()
        for member in bundle.infolist():
            if not member.filename.lower().endswith(".apk") or member.file_size > 200000000:
                continue
            try:
                names |= scan_apk(bundle.read(member), expected)
            except ValueError as e:
                if "Wrong package" in str(e):
                    raise
                continue
        if not names:
            raise ValueError("No matching base APK with DEX in bundle")
        return names, sha


def acquire(version, directory):
    errors = []
    for source in SOURCES:
        out = directory / source
        out.mkdir()
        cmd = [sys.executable, "-m", "justapk", "download", PACKAGE,
               "-s", source, "-v", version, "--no-convert", "-o", str(out)]
        try:
            run = subprocess.run(cmd, capture_output=True, text=True, timeout=170)
            if run.returncode:
                raise ValueError((run.stderr or run.stdout)[-300:])
            info = json.loads(run.stdout)
            if info.get("package") != PACKAGE:
                raise ValueError("Downloader returned different package")
            path = Path(info["path"]).resolve()
            if not path.is_file() or not path.is_relative_to(out.resolve()):
                raise ValueError("Downloader returned file outside temporary directory")
            names, sha = scan_package(path, version)
            if len(names) < 100:
                raise ValueError("Incomplete DEX flag scan (under 100 candidate strings)")
            return names, sha, source
        except Exception as exc:
            errors.append(source + ": " + str(exc).replace("\n", " ")[:280])
    raise RuntimeError("; ".join(errors))


def main():
    versions = json.loads(Path("data/upstream-versions.json").read_text()).get("mirror") or {}
    state_file = Path("data/apk-scan-state.json")
    state = json.loads(state_file.read_text())
    baseline = set(json.loads(Path("data/flag-identifiers.json").read_text())["names"])
    outputs, failures, issues = [], [], []
    updated = False
    for channel in ("stable", "beta"):
        version = versions.get(channel)
        if not version or not re.fullmatch(r"\d+(?:\.\d+){3}", version):
            continue
        prev = state.get("channels", {}).get(channel)
        if prev and prev.get("version") == version:
            outputs.append(channel + ": " + version + " already analyzed")
            continue
        try:
            with tempfile.TemporaryDirectory(prefix="atlas-gboard-") as tmp:
                names, checksum, mirror = acquire(version, Path(tmp))
            previous = set()
            if prev and Path(prev["snapshot"]).is_file():
                previous = set(json.loads(Path(prev["snapshot"]).read_text())["names"])
            if previous and len(previous & names) < len(previous) / 2:
                raise ValueError("Too many identifiers vanished; likely an incompatible scan")
            out = Path("data/version-snapshots") / (channel + "-" + version + ".json")
            out.parent.mkdir(exist_ok=True, parents=True)
            now = datetime.now(timezone.utc).isoformat()
            out.write_text(json.dumps({
                "schemaVersion": 1, "kind": "candidate-flag-identifiers", "gboardVersion": version,
                "source": mirror, "channel": channel, "scannedAt": now, "sourceSHA256": checksum,
                "caveat": "APK DEX string candidates only; not confirmed developer toggles.",
                "names": sorted(names)
            }, indent=2) + "\n")
            state.setdefault("channels", {})[channel] = {
                "version": version, "snapshot": str(out), "scannedAt": now,
                "source": mirror, "sha256": checksum, "candidates": len(names)
            }
            state.setdefault("history", []).append({
                "channel": channel, "version": version, "date": now, "count": len(names),
                "added": len(names - previous) if previous else None,
                "removed": len(previous - names) if previous else None
            })
            state["history"] = state["history"][-100:]
            updated = True
            outputs.append(channel + " " + version + ": " + str(len(names)) + " candidates; " +
                           str(len(names & baseline)) + " match Atlas baseline; source " + mirror)
            if previous and (names != previous):
                issues.append((channel, version, sorted(names - previous), sorted(previous - names)))
        except Exception as exc:
            failures.append(channel + " " + version + ": " + str(exc)[:1400])
    state_file.write_text(json.dumps(state, indent=2) + "\n")
    report = ["# Gboard APK candidate flag tracking", "",
              "This report does not claim that candidate strings are working switches.", ""]
    report += ["- " + x for x in outputs]
    for channel, version, added, removed in issues:
        report += ["", "## " + channel + " " + version, "",
                   "Added candidates (" + str(len(added)) + "):"]
        report += ["- " + s for s in added[:200]]
        report += ["", "Removed candidates (" + str(len(removed)) + "):"]
        report += ["- " + s for s in removed[:200]]
    if failures:
        report += ["", "## Download or validation failures", ""]
        report += ["- " + x for x in failures]
    report += ["", "All original APK binaries were deleted after read-only scanning.",
               "New candidate names require interpretation and review before appearing as documented flags."]
    Path("/tmp/gboard-apk-report.md").write_text("\n".join(report) + "\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write("\n".join(report) + "\n")
    if os.environ.get("GITHUB_OUTPUT"):
        fingerprint = hashlib.sha256(json.dumps(issues, sort_keys=True).encode()).hexdigest()[:12]
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write("updated=" + str(updated).lower() + "\n")
            f.write("notify=" + str(bool(issues)).lower() + "\n")
            f.write("issue_key=" + fingerprint + "\n")
    print(json.dumps({"updates": outputs, "issues": len(issues), "failures": failures}, indent=2))


if __name__ == "__main__":
    main()
