"""Switch only the update channel of a known APK; the CI signer re-signs it."""

import hashlib
import re
import sys
from pathlib import Path
from zipfile import ZipFile

source, output = map(Path, sys.argv[1:])
if hashlib.sha256(source.read_bytes()).hexdigest() != (
    "e0ffc8ad5d64a41d3ca185402c8d580df35255445b52ed2c02d0a488ebebaf7a"
):
    raise ValueError("Unexpected baseline APK")

runtime = b"7526790f614351f211c457606290cbf4f4522a70"
before = '{"expo-channel-name":"production"}'
after = '{"expo-channel-name":"chatheadqa"}'
assert len(before) == len(after)

with ZipFile(source) as baseline, ZipFile(output, "w") as candidate:
    assert baseline.read("assets/fingerprint").strip() == runtime
    assert len(baseline.namelist()) == len(set(baseline.namelist()))
    changed = 0
    for entry in baseline.infolist():
        if re.fullmatch(r"META-INF/(?:MANIFEST\.MF|[^/]+\.(?:RSA|DSA|EC|SF))", entry.filename, re.I):
            continue
        data = baseline.read(entry.filename)
        if entry.filename == "AndroidManifest.xml":
            for encoding in ("utf-8", "utf-16-le"):
                old = before.encode(encoding)
                changed += data.count(old)
                data = data.replace(old, after.encode(encoding))
        candidate.writestr(entry, data)
    if changed != 1:
        raise ValueError(f"Expected one Android update channel, found {changed}")
