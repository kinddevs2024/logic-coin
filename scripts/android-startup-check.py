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
    result = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f"adb {args[0]} failed: {result.stderr or result.stdout}")
    return result.stdout


def ui(name):
    adb("shell", "uiautomator", "dump", "/sdcard/logiccoin-ui.xml")
    xml = adb("shell", "cat", "/sdcard/logiccoin-ui.xml")
    (EVIDENCE / f"{name}.xml").write_text(xml, encoding="utf-8")
    return ET.fromstring(xml)


def wait_for(label, name):
    for _ in range(18):
        if not adb("shell", "pidof", PACKAGE, check=False).strip():
            raise RuntimeError(f"App process exited while waiting for {name}")
        root = ui(name)
        for node in root.iter("node"):
            if label in node.get("text", "") or label in node.get("content-desc", ""):
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
    language = wait_for("English", f"{prefix}-language")
    capture(f"{prefix}-language")
    tap(language)
    skip = wait_for("Skip", f"{prefix}-onboarding")
    capture(f"{prefix}-onboarding")
    tap(skip)
    wait_for("Email", f"{prefix}-login")
    capture(f"{prefix}-login")


try:
    abi = adb("shell", "getprop", "ro.product.cpu.abilist").strip()
    (EVIDENCE / "device.txt").write_text(adb("shell", "getprop"), encoding="utf-8")
    if "arm64-v8a" not in abi:
        raise RuntimeError(f"Test device cannot run the ARM release: {abi}")
    previous = Path("artifacts/previous/logic-coin.apk")
    if previous.exists():
        adb("install", str(previous), timeout=180)
        launch()
        onboarding("previous")
        results.append("Previous release reaches login; English preference is persisted")
    adb("logcat", "-c")
    adb("install", "-r", "artifacts/release/logic-coin.apk", timeout=180)
    if previous.exists():
        launch()
        wait_for("Email", "updated-login")
        capture("updated-login")
        results.append("In-place update succeeds and preserves onboarding/language")
    # This emulator belongs exclusively to this CI job; no real user data exists.
    adb("shell", "pm", "clear", PACKAGE)
    launch()
    onboarding("fresh")
    results.append("Clean install renders language, onboarding and login screens")
    adb("shell", "input", "keyevent", "KEYCODE_HOME")
    time.sleep(3)
    adb("shell", "am", "start", "-W", "-n", f"{PACKAGE}/.MainActivity")
    wait_for("Email", "resumed-login")
    capture("resumed-login")
    results.append("Background/resume succeeds")
    launch()
    wait_for("Email", "cold-login")
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
