import json
import re
import struct
import sys
from pathlib import Path
from zipfile import ZipFile

apk = Path(sys.argv[1])
mapping = Path(sys.argv[2]) if len(sys.argv) == 3 else None
module = "com.kinddevs.logiccoin.YandexAdsModule"
descriptor = "L" + module.replace(".", "/") + ";"
if mapping:
    pattern = rf"^{re.escape(module)} -> ([\w.$]+):$"
    mapped = re.search(pattern, mapping.read_text(), re.MULTILINE)
    assert mapped, "R8 mapping does not include YandexAdsModule"
    descriptor = "L" + mapped[1].replace(".", "/") + ";"


def methods_for_class(data: bytes, descriptor: str) -> set[str]:
    assert data.startswith(b"dex\n"), "Expected ordinary Android DEX"
    _, strings, type_count, types = struct.unpack_from("<IIII", data, 56)
    method_count, methods, class_count, classes = struct.unpack_from("<IIII", data, 88)

    def string(index: int) -> bytes:
        (offset,) = struct.unpack_from("<I", data, strings + index * 4)
        while data[offset] & 128:
            offset += 1
        offset += 1
        return data[offset:data.index(0, offset)]

    type_id = next((index for index in range(type_count)
                    if string(struct.unpack_from("<I", data, types + index * 4)[0]) == descriptor.encode()), None)
    if type_id is None or not any(struct.unpack_from("<I", data, classes + i * 32)[0] == type_id for i in range(class_count)):
        return set()
    names = set()
    for (method_class, _, name_index) in struct.iter_unpack("<HHI", data[methods:methods + method_count * 8]):
        if method_class == type_id:
            names.add(string(name_index).decode("ascii"))
    return names


expected_methods = {"initialize", "loadRewarded", "showRewarded", "showInterstitial", "showAppOpen", "isRewardedLoaded"}
with ZipFile(apk) as archive:
    names = archive.namelist()
    abis = {name.split("/")[1] for name in names if name.startswith("lib/") and name.endswith(".so")}
    assert abis == {"arm64-v8a", "armeabi-v7a"}, abis
    fingerprint = archive.read("assets/fingerprint").decode("ascii").strip()
    assert re.fullmatch("[a-fA-F0-9]{40,64}", fingerprint), "Invalid Expo runtime fingerprint"
    with archive.open("assets/index.android.bundle") as bundle:
        header = bundle.read(12).hex()
    assert header == "c61fbc03c103191f62000000", "Hermes bytecode differs from the current release engine"
    for entry in names:
        if not re.fullmatch(r"classes\d*\.dex", entry):
            continue
        methods = methods_for_class(archive.read(entry), descriptor)
        if methods:
            assert expected_methods <= methods, f"Missing React Native Yandex binding(s): {sorted(expected_methods-methods)}"
            break
    else:
        raise AssertionError("YandexAdsModule is missing from the signed release DEX")

print(json.dumps({
    "apkBytes": apk.stat().st_size,
    "runtimeFingerprint": fingerprint,
    "hermesHeader": header,
    "abis": sorted(abis),
    "yandexBridgeDex": entry,
    "yandexBridgeDescriptor": descriptor,
    "yandexBridgeMethods": sorted(expected_methods),
}, indent=2))
