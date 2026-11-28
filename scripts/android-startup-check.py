"""Exercise the signed release on a disposable emulator, without creating accounts."""
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import time
import uuid
import xml.etree.ElementTree as ET

PACKAGE = "com.kinddevs.logiccoin"
EVIDENCE = Path("artifacts/startup")
EVIDENCE.mkdir(parents=True, exist_ok=True)
results = []
serial = None
launcher_dialogs = 0


def adb(*args, timeout=60, check=True):
    command = ["adb", "-s", serial] if serial else ["adb"]
    result = subprocess.run([*command, *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"adb {args[0]} failed: {result.stderr or result.stdout}")
    return result.stdout


def ui(name):
    adb("shell", "uiautomator", "dump", "/sdcard/logiccoin-ui.xml")
    xml = adb("shell", "cat", "/sdcard/logiccoin-ui.xml")
    (EVIDENCE / f"{name}.xml").write_text(xml, encoding="utf-8")
    return ET.fromstring(xml)


def dismiss_optional_google_picker(root, name):
    # Login intentionally opens Google's account picker. A clean emulator has
    # no Google account, so cancel this optional flow before asserting app UI.
    nodes = list(root.iter("node"))
    packages = {node.get("package", "") for node in nodes}
    google = packages.intersection({"com.google.android.gms", "com.google.android.gsf.login"})
    labels = " ".join(node.get("text", "") + " " + node.get("content-desc", "") for node in nodes)
    if not google or not any(label in labels for label in ("Google Accounts", "Google Account", "Choose an account")):
        return False
    capture(f"{name}-google-picker")
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(1)
    return True


def wait_for(label, name):
    labels = (label,) if isinstance(label, str) else label
    for _ in range(18):
        if not adb("shell", "pidof", PACKAGE, check=False).strip():
            raise RuntimeError(f"App process exited while waiting for {name}")
        root = ui(name)
        if dismiss_launcher_dialog(root):
            continue
        if dismiss_optional_google_picker(root, name):
            continue
        for node in root.iter("node"):
            if any(text in node.get("text", "") or text in node.get("content-desc", "") for text in labels):
                return node
        time.sleep(3)
    raise RuntimeError(f"Expected UI not rendered: {name} ({label})")


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds", "")))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def capture(name):
    (EVIDENCE / f"{name}.png").write_bytes(subprocess.check_output(["adb", "-s", serial, "exec-out", "screencap", "-p"], timeout=30))


def dismiss_launcher_dialog(root):
    """Recover only a known emulator launcher failure, never an app ANR."""
    global launcher_dialogs
    nodes = list(root.iter("node"))
    if not any(node.get("text") == "Pixel Launcher isn't responding" for node in nodes):
        return False
    button = next((node for node in nodes if node.get("package") == "android" and node.get("text") == "Close app"), None)
    if button is None or launcher_dialogs >= 2:
        raise RuntimeError("Android emulator launcher repeatedly stopped responding")
    launcher_dialogs += 1
    capture(f"emulator-launcher-dialog-{launcher_dialogs}")
    tap(button)
    results.append("Dismissed an unrelated Pixel Launcher ANR dialog on the disposable emulator")
    time.sleep(2)
    return True


def launch():
    adb("shell", "am", "force-stop", PACKAGE)
    adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity")
    time.sleep(5)


def onboarding(prefix):
    # Current releases may open login directly; older ones show onboarding.
    for _ in range(18):
        if not adb("shell", "pidof", PACKAGE, check=False).strip():
            raise RuntimeError(f"App process exited during {prefix} startup")
        root = ui(f"{prefix}-startup")
        if dismiss_launcher_dialog(root):
            continue
        if dismiss_optional_google_picker(root, f"{prefix}-startup"):
            continue
        nodes = list(root.iter("node"))
        if any(any(label in node.get("text", "") or label in node.get("content-desc", "") for label in LOGIN_LABELS) for node in nodes):
            capture(f"{prefix}-login")
            return
        for labels in (("English",), ("Skip", "Пропустить", "O‘tkazib yuborish")):
            candidate = next((node for node in nodes if any(label in node.get("text", "") or label in node.get("content-desc", "") for label in labels)), None)
            if candidate is not None:
                tap(candidate)
                break
        time.sleep(3)
    raise RuntimeError(f"Neither onboarding nor login completed: {prefix}")


LOGIN_LABELS = ("Email", "Электронная почта", "Elektron pochta", "name@example.com")


def installed_property(name):
    data = adb("shell", "dumpsys", "package", PACKAGE)
    match = re.search(rf"\b{re.escape(name)}=([^\r\n]+)", data)
    if not match:
        raise RuntimeError(f"Missing package property: {name}")
    return match.group(1).strip()


def apk_properties(apk):
    sdk = Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or "/nonexistent")
    tools = sorted(sdk.glob("build-tools/*/aapt"), key=lambda item: tuple(int(part) for part in re.findall(r"\d+", item.parent.name)))
    if not tools:
        raise RuntimeError("Android build-tools/aapt is required to verify the actual signed APK")
    output = subprocess.check_output([str(tools[-1]), "dump", "badging", str(apk)], text=True, timeout=60)
    match = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", output, re.MULTILINE)
    if not match or match.group(1) != PACKAGE:
        raise RuntimeError("Unexpected APK application ID or missing version")
    return {"package": match.group(1), "versionCode": int(match.group(2)), "versionName": match.group(3)}


def installed_state():
    listing = adb("shell", "cmd", "package", "list", "packages", "--user", "0", "-U", PACKAGE)
    uid = re.search(rf"^package:{re.escape(PACKAGE)}\s+uid:(\d+)\b", listing, re.MULTILINE)
    if not uid:
        raise RuntimeError("Cannot determine installed app UID")
    return {
        "versionCode": int(installed_property("versionCode").split()[0]),
        "versionName": installed_property("versionName"),
        "userId": uid.group(1),
        "firstInstallTime": installed_property("firstInstallTime"),
        "dataDir": installed_property("dataDir"),
    }


def verify_installed(expected, name):
    actual = installed_state()
    if any(actual[key] != expected[key] for key in ("versionCode", "versionName")):
        raise RuntimeError(f"Installed version differs from the signed APK: {name}")
    (EVIDENCE / f"{name}-package.json").write_text(json.dumps(actual, indent=2), encoding="utf-8")
    return actual


def block_app_network(uid):
    # The rooted emulator is disposable. Block only this app's UID, leaving ADB
    # usable and preventing production APIs, ads and OTA from changing the test.
    if not uid.isdecimal():
        raise RuntimeError("Invalid app UID")
    for tool in ("iptables", "ip6tables"):
        adb("shell", tool, "-I", "OUTPUT", "1", "-m", "owner", "--uid-owner", uid, "-j", "REJECT")
    (EVIDENCE / "network-policy.json").write_text(json.dumps({"appUid": uid, "ipv4": "blocked", "ipv6": "blocked", "tests": "embedded APK, no production requests"}, indent=2), encoding="utf-8")


try:
    devices = [line.split() for line in adb("devices").splitlines()[1:] if line.strip()]
    if len(devices) != 1 or devices[0][1] != "device" or not devices[0][0].startswith("emulator-"):
        raise RuntimeError("Use exactly one disposable Android emulator, never a personal phone")
    serial = devices[0][0]
    if adb("shell", "getprop", "ro.kernel.qemu").strip() != "1":
        raise RuntimeError("This test clears data and requires a disposable emulator")
    adb("root")
    adb("wait-for-device")
    if adb("shell", "id", "-u").strip() != "0":
        raise RuntimeError("A rooted google_apis emulator is required for isolated upgrade QA")
    abi = adb("shell", "getprop", "ro.product.cpu.abilist").strip()
    (EVIDENCE / "device.txt").write_text(adb("shell", "getprop"), encoding="utf-8")
    if "arm64-v8a" not in abi:
        raise RuntimeError(f"Test device cannot run the ARM release: {abi}")
    previous = Path("artifacts/previous/logic-coin.apk")
    release = Path("artifacts/release/logic-coin.apk")
    expected = apk_properties(release)
    sentinel = f"/data/user/0/{PACKAGE}/.release-upgrade-qa"
    sentinel_value = uuid.uuid4().hex
    if previous.exists():
        previous_expected = apk_properties(previous)
        if expected["versionCode"] <= previous_expected["versionCode"]:
            raise RuntimeError("Candidate versionCode must be greater than the previous release")
        adb("install", "-r", str(previous), timeout=180)
        before = verify_installed(previous_expected, "previous")
        block_app_network(before["userId"])
        launch()
        onboarding("previous")
        results.append("Previous signed release reaches its login screen offline")
        adb("shell", "am", "force-stop", PACKAGE)
        adb("shell", f"printf %s {shlex.quote(sentinel_value)} > {shlex.quote(sentinel)}")
    adb("logcat", "-b", "all", "-c")
    adb("install", "-r", str(release), timeout=180)
    after = verify_installed(expected, "candidate")
    if previous.exists():
        if any(after[key] != before[key] for key in ("userId", "firstInstallTime", "dataDir")):
            raise RuntimeError("Upgrade changed the app UID, first install time or data directory")
        if adb("shell", "cat", sentinel).strip() != sentinel_value:
            raise RuntimeError("In-place upgrade did not preserve the app data sentinel")
        adb("shell", "rm", sentinel)
        launch()
        onboarding("updated")
        results.append(f"In-place update {previous_expected['versionCode']} -> {expected['versionCode']} preserves UID, firstInstallTime and app data, and renders login offline")
    else:
        block_app_network(after["userId"])
    # This emulator belongs exclusively to this CI job; no real user data exists.
    adb("shell", "pm", "clear", PACKAGE)
    launch()
    onboarding("fresh")
    results.append("Clean install reaches login through supported onboarding flow")
    adb("shell", "input", "keyevent", "KEYCODE_HOME")
    time.sleep(3)
    adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity")
    wait_for(LOGIN_LABELS, "resumed-login")
    capture("resumed-login")
    results.append("Background/resume succeeds")
    launch()
    wait_for(LOGIN_LABELS, "cold-login")
    capture("cold-login")
    results.append("Cold restart preserves onboarding and renders login")
    crashes = adb("logcat", "-d", "-b", "crash")
    (EVIDENCE / "crash-buffer.txt").write_text(crashes, encoding="utf-8")
    if PACKAGE in crashes:
        raise RuntimeError("App crash found in Android crash buffer")
    (EVIDENCE / "summary.json").write_text(json.dumps({"passed": True, "release": expected, "previous": previous_expected if previous.exists() else None, "productionNetworkBlocked": True, "adLoadOrShowTested": False, "checks": results}, indent=2), encoding="utf-8")
    print("\n".join(results))
except Exception:
    try:
        capture("failed-screen")
        (EVIDENCE / "crash-buffer.txt").write_text(adb("logcat", "-d", "-b", "crash"), encoding="utf-8")
    except Exception:
        pass
    raise
finally:
    (EVIDENCE / "checks.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (EVIDENCE / "logcat.txt").write_text(adb("logcat", "-d", "-t", "2000", check=False), encoding="utf-8")
