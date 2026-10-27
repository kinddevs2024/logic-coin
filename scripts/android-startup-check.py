"""Exercise the signed release on a disposable emulator, without creating accounts."""
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "com.kinddevs.logiccoin"
EVIDENCE = Path("artifacts/startup")
EVIDENCE.mkdir(parents=True, exist_ok=True)
results = []


def adb(*args, timeout=60, check=True):
    result = subprocess.run(["adb", *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"adb {args[0]} failed: {result.stderr or result.stdout}")
    return result.stdout


def ui(name):
    adb("shell", "uiautomator", "dump", "/sdcard/logiccoin-ui.xml")
    xml = adb("shell", "cat", "/sdcard/logiccoin-ui.xml")
    (EVIDENCE / f"{name}.xml").write_text(xml, encoding="utf-8")
    return ET.fromstring(xml)


def wait_for(label, name):
    labels = (label,) if isinstance(label, str) else label
    for _ in range(18):
        if not adb("shell", "pidof", PACKAGE, check=False).strip():
            raise RuntimeError(f"App process exited while waiting for {name}")
        root = ui(name)
        for node in root.iter("node"):
            if any(text in node.get("text", "") or text in node.get("content-desc", "") for text in labels):
                return node
        time.sleep(3)
    raise RuntimeError(f"Expected UI not rendered: {name} ({label})")


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds", "")))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def capture(name):
    (EVIDENCE / f"{name}.png").write_bytes(subprocess.check_output(["adb", "exec-out", "screencap", "-p"], timeout=30))


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


try:
    abi = adb("shell", "getprop", "ro.product.cpu.abilist").strip()
    (EVIDENCE / "device.txt").write_text(adb("shell", "getprop"), encoding="utf-8")
    if "arm64-v8a" not in abi:
        raise RuntimeError(f"Test device cannot run the ARM release: {abi}")
    previous = Path("artifacts/previous/logic-coin.apk")
    previous_ready = False
    if previous.exists():
        adb("install", "-r", str(previous), timeout=180)
        original_install_time = installed_property("firstInstallTime")
        try:
            launch()
            onboarding("previous")
            previous_ready = True
            results.append("Previous release reaches its login screen")
        except RuntimeError as error:
            results.append(f"Previous release startup failed (baseline only): {error}")
            (EVIDENCE / "previous-crash.txt").write_text(adb("logcat", "-d", "-b", "crash"), encoding="utf-8")
    adb("logcat", "-b", "all", "-c")
    adb("install", "-r", "artifacts/release/logic-coin.apk", timeout=180)
    if previous.exists():
        if installed_property("firstInstallTime") != original_install_time:
            raise RuntimeError("Package was reinstalled instead of updated in place")
        launch()
        onboarding("updated")
        results.append("In-place update preserves firstInstallTime and renders login")
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
    print("\n".join(results))
finally:
    (EVIDENCE / "checks.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (EVIDENCE / "logcat.txt").write_text(adb("logcat", "-d", "-t", "2000", check=False), encoding="utf-8")
