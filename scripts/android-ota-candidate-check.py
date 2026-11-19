"""Exercise a signed candidate on existing APKs in disposable CI Android."""

import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import time
from urllib.request import Request, urlopen
from uuid import UUID
from xml.etree import ElementTree
from zipfile import ZipFile


PACKAGE = "com.kinddevs.logiccoin"
DEVICE_APP = f"/data/data/{PACKAGE}"
DATABASE = f"{DEVICE_APP}/databases/updates.db"
APK_PATHS = (Path("artifacts/previous/logic-coin.apk"), Path("artifacts/release/logic-coin.apk"))
ORIGIN = "https://logic-coin.online/updates"
READY = 1
EVIDENCE = Path("artifacts/startup")


def adb(*args, timeout=45, check=True):
    return subprocess.run(["adb", *args], capture_output=True, timeout=timeout, check=check)


def shell(command):
    return adb("shell", command).stdout.decode().strip()


def running():
    return bool(adb("shell", "pidof", PACKAGE, check=False).stdout.strip())


def apk_candidate(apk, channel):
    with ZipFile(apk) as archive:
        runtime = archive.read("assets/fingerprint").decode().strip()
        config = json.loads(archive.read("assets/app.config"))
    if (
        not re.fullmatch(r"[0-9a-f]{40,64}", runtime)
        or config["android"]["package"] != PACKAGE
        or config["updates"]["url"] != ORIGIN
        or config["updates"]["requestHeaders"].get("expo-channel-name") != "production"
    ):
        raise RuntimeError("Unexpected APK update configuration")
    request = Request(ORIGIN, headers={
        "expo-platform": "android",
        "expo-runtime-version": runtime,
        "expo-channel-name": channel,
        "expo-protocol-version": "1",
    })
    with urlopen(request, timeout=20) as response:
        if response.status != 200 or not response.headers.get("expo-signature"):
            raise RuntimeError("Signed candidate is missing for this APK runtime")
        manifest = json.load(response)
    if manifest["runtimeVersion"] != runtime or manifest["metadata"]["channel"] != channel:
        raise RuntimeError("Expected candidate has the wrong runtime or channel")
    return config["android"]["versionCode"], runtime, UUID(manifest["id"])


def set_candidate_channel(channel):
    shell(f"am force-stop {PACKAGE}")
    owner = shell(f"stat -c '%u:%g' {DEVICE_APP}")
    app_label = shell(f"ls -Zd {DEVICE_APP}").split()[0]
    if not re.fullmatch(r"[0-9]+:[0-9]+", owner) or not re.fullmatch(
        r"u:object_r:[a-z_]+:s[0-9]+(?::c[0-9]+(?:,c[0-9]+)*)?", app_label
    ):
        raise RuntimeError("Could not identify disposable app data ownership and label")
    prefs = f"{DEVICE_APP}/shared_prefs"
    pref_file = f"{prefs}/dev.expo.updates.prefs.xml"
    remote_temp = "/data/local/tmp/logic-coin-ota-candidate.xml"
    pref = ElementTree.Element("map")
    ElementTree.SubElement(pref, "string", name="updatesConfigOverride").text = json.dumps(
        {"requestHeaders": {"expo-channel-name": channel}}
    )
    with tempfile.TemporaryDirectory() as temporary:
        local = Path(temporary) / "override.xml"
        ElementTree.ElementTree(pref).write(local, encoding="utf-8", xml_declaration=True)
        adb("push", str(local), remote_temp)
    shell(
        f"mkdir -p {prefs} && chown {owner} {prefs} && chmod 771 {prefs} && "
        f"cp {remote_temp} {pref_file} && chown {owner} {pref_file} && chmod 600 {pref_file} && "
        f"chcon {app_label} {prefs} {pref_file} && rm -f {remote_temp} {pref_file}.bak"
    )


def launch():
    shell(f"am force-stop {PACKAGE}")
    shell("input keyevent KEYCODE_WAKEUP")
    shell("wm dismiss-keyguard")
    output = shell(f"am start -n {PACKAGE}/.MainActivity")
    if "Error" in output:
        raise RuntimeError(output)
    time.sleep(5)


def wait_for_login():
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        if not running():
            raise RuntimeError("Logic Coin exited before displaying login")
        output = adb("shell", "uiautomator dump /sdcard/logic-coin-ota-ui.xml", check=False)
        if output.returncode != 0:
            continue
        xml = shell("cat /sdcard/logic-coin-ota-ui.xml")
        (EVIDENCE / "latest-ui.xml").write_text(xml, encoding="utf-8")
        try:
            nodes = list(ElementTree.fromstring(xml).iter("node"))
        except ElementTree.ParseError:
            continue
        if any(node.get("package", "") in {"com.google.android.gms", "com.google.android.gsf.login"} for node in nodes):
            if any("account" in node.get("text", "").lower() for node in nodes):
                shell("input keyevent KEYCODE_BACK")
                continue
        for node in nodes:
            label = " ".join((node.get("text", ""), node.get("content-desc", "")))
            if any(text in label for text in ("Email", "Электронная почта", "Elektron pochta", "name@example.com")):
                return
            if any(text in label for text in ("English", "Skip", "Пропустить", "O‘tkazib yuborish")):
                match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
                if match:
                    x1, y1, x2, y2 = map(int, match.groups())
                    shell(f"input tap {(x1 + x2) // 2} {(y1 + y2) // 2}")
                    break
        time.sleep(2)
    raise RuntimeError("Login did not render on Android")


def update_state(candidate, runtime):
    # Read a disposable emulator snapshot. The DB and WAL can change between reads.
    with tempfile.TemporaryDirectory() as temporary:
        database = Path(temporary) / "updates.db"
        raw = adb("exec-out", "cat", DATABASE, check=False).stdout
        if not raw.startswith(b"SQLite format 3"):
            return None
        database.write_bytes(raw)
        wal = adb("exec-out", "cat", DATABASE + "-wal", check=False).stdout
        if wal.startswith((b"\x37\x7f\x06\x82", b"\x37\x7f\x06\x83")):
            database.with_suffix(".db-wal").write_bytes(wal)
        try:
            with sqlite3.connect(database) as connection:
                row = connection.execute(
                    "SELECT status, successful_launch_count, failed_launch_count "
                    "FROM updates WHERE id = ? AND runtime_version = ?",
                    (candidate.bytes, runtime),
                ).fetchone()
        except sqlite3.OperationalError:
            return None
        return row


def wait_for_update(candidate, runtime, previous_launches=None):
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        row = update_state(candidate, runtime)
        if row and row[0] == READY:
            if row[2] > 0:
                raise RuntimeError(f"Expo recorded a failed launch for candidate {candidate}")
            if previous_launches is None or row[1] > previous_launches:
                return row[1]
        if not running():
            raise RuntimeError("Logic Coin stopped while testing OTA")
        time.sleep(4)
    raise RuntimeError(f"Timed out verifying candidate {candidate}")


def main():
    channel = os.environ["CANDIDATE_CHANNEL"]
    if channel != "production" and not re.fullmatch(r"android-[a-z0-9-]*candidate-[a-z0-9-]+", channel):
        raise RuntimeError("Use a dedicated Android candidate channel or the current production control")
    serial = adb("get-serialno").stdout.decode().strip()
    if not re.fullmatch(r"emulator-[0-9]+", serial) or shell("getprop ro.kernel.qemu") != "1":
        raise RuntimeError("Use an isolated Android emulator")
    adb("root")
    adb("wait-for-device")
    if shell("id -u") != "0" or "arm64-v8a" not in shell("getprop ro.product.cpu.abilist"):
        raise RuntimeError("A rooted emulator with ARM translation is required")
    shell("svc power stayon true")
    shell("settings put system screen_off_timeout 1800000")

    EVIDENCE.mkdir(parents=True, exist_ok=True)
    evidence = EVIDENCE / "ota-candidate.json"
    results = []
    first_install = None
    for apk in (path for path in APK_PATHS if path.exists()):
        version, runtime, candidate = apk_candidate(apk, channel)
        adb("install", "-r", str(apk), timeout=180)
        stamp = re.search(r"\bfirstInstallTime=([^\r\n]+)", shell(f"dumpsys package {PACKAGE}"))
        if not stamp:
            raise RuntimeError("Could not verify package install time")
        if first_install and first_install != stamp[1]:
            raise RuntimeError("APK upgrade unexpectedly reinstalled the app")
        first_install = stamp[1]

        if channel != "production":
            set_candidate_channel(channel)
        adb("logcat", "-c")
        print(f"Launching installed APK {version} for candidate {candidate}", flush=True)
        launch()
        launches_before_restart = wait_for_update(candidate, runtime)
        print(f"APK {version} downloaded signed update, restarting from disk", flush=True)
        time.sleep(4)
        launch()
        launches_after_restart = wait_for_update(candidate, runtime, launches_before_restart)
        print(f"APK {version} ran exact candidate with launch count {launches_after_restart}", flush=True)
        wait_for_login()
        results.append({
            "versionCode": version,
            "runtime": runtime,
            "channel": channel,
            "candidateId": str(candidate),
            "downloaded": True,
            "successfulLaunchesBeforeRestart": launches_before_restart,
            "successfulLaunchesAfterRestart": launches_after_restart,
            "loginAfterRestart": True,
            "inPlaceUpgrade": len(results) > 0,
        })
        evidence.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(results[-1]))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pic = adb("exec-out", "screencap", "-p", check=False).stdout
        if pic.startswith(b"\x89PNG"):
            (EVIDENCE / "latest-screen.png").write_bytes(pic)
        diagnostic = adb("logcat", "-d", "-s", "AndroidRuntime", "ReactNativeJS", "ReactNative", "ExpoUpdates", "ActivityTaskManager", check=False)
        lines = [line for line in diagnostic.stdout.decode(errors="replace").splitlines() if not re.search(r"uiautomator|using default boot image|leaving lock profiling|Shutting down VM|^.* START .*RuntimeInit", line, re.I)]
        print("\n".join(lines)[-24000:], flush=True)
        raise
