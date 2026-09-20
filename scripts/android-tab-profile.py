"""Collect a manually exercised tab on one already-running Android device.

Example: python scripts/android-tab-profile.py --label before-home --duration 20
Repeat with the same device, tab and gestures after updating the app yourself.
Physical devices are required by default; --allow-emulator explicitly opts in to
an already-running isolated emulator. Emulator timing is not phone performance.
The only device mutation is resetting this package's gfxinfo counters. The script
does not launch, install, stop, clear, navigate, or read account/application data.

References:
https://developer.android.com/tools/dumpsys#ui
https://android.googlesource.com/platform/frameworks/base/+/562ae3a/docs/html/training/testing/performance.jd
"""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / ".qa"
DEFAULT_PACKAGE = "com.kinddevs.logiccoin"
LONG_MAX = (1 << 63) - 1
PROCESS_HEADER = re.compile(r"\*\* Graphics info for pid (\d+) \[([^\]]+)\] \*\*")


def percentile(values, percent):
    """Linearly interpolated percentile; unavailable samples remain None."""
    if not 0 <= percent <= 100:
        raise ValueError("Percentile must be between 0 and 100")
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * percent / 100
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def parse_gfxinfo(text):
    """Keep Android's cumulative counts separate from the recent frame ring buffer.

    Only Flags=0 rows with valid IntendedVsync/FrameCompleted are timed. Sentinels
    in optional fields such as OldestInputEvent do not invalidate a frame.
    No refresh rate or 16.67ms threshold is assumed to manufacture a jank count.
    """
    processes = []
    current = None
    columns = None
    headers_seen = 0
    rows_seen = 0
    exclusions = {"flags": 0, "invalid_timestamps": 0, "malformed": 0, "before_reset": 0}
    durations = []

    def ensure_process():
        nonlocal current
        if current is None:
            current = {"pid": None, "name": None, "stats_since_ns": None,
                       "total_frames": None, "janky_frames": None}
            processes.append(current)
        return current

    for line in text.splitlines():
        line = line.strip()
        process_match = PROCESS_HEADER.search(line)
        if process_match:
            current = {"pid": int(process_match[1]), "name": process_match[2],
                       "stats_since_ns": None, "total_frames": None, "janky_frames": None}
            processes.append(current)
            columns = None
            continue
        match = re.match(r"Stats since:\s*(\d+)ns", line)
        if match:
            ensure_process()["stats_since_ns"] = int(match[1])
        match = re.match(r"Total frames rendered:\s*([\d,]+)", line)
        if match:
            ensure_process()["total_frames"] = int(match[1].replace(",", ""))
        match = re.match(r"Janky frames:\s*([\d,]+)", line)
        if match:
            ensure_process()["janky_frames"] = int(match[1].replace(",", ""))
        if line == "---PROFILEDATA---":
            columns = None
            continue
        cells = [cell.strip() for cell in line.rstrip(",").split(",")]
        if cells and cells[0].lower() == "flags":
            names = [name.lower().replace("_", "") for name in cells]
            if all(name in names for name in ("flags", "intendedvsync", "framecompleted")):
                columns = {name: names.index(name) for name in ("flags", "intendedvsync", "framecompleted")}
                headers_seen += 1
                ensure_process()
            else:
                columns = None
            continue
        if columns is None or not line:
            continue
        if "," not in line:
            columns = None
            continue
        rows_seen += 1
        try:
            flags, intended, completed = (int(cells[columns[name]]) for name in
                                          ("flags", "intendedvsync", "framecompleted"))
        except (ValueError, IndexError):
            exclusions["malformed"] += 1
            continue
        if flags != 0:
            exclusions["flags"] += 1
            continue
        if not (0 < intended < LONG_MAX and intended < completed < LONG_MAX):
            exclusions["invalid_timestamps"] += 1
            continue
        since = ensure_process()["stats_since_ns"]
        if since is not None and intended < since:
            exclusions["before_reset"] += 1
            continue
        durations.append((completed - intended) / 1_000_000)

    totals = [item["total_frames"] for item in processes]
    janks = [item["janky_frames"] for item in processes]
    total = sum(totals) if totals and all(value is not None for value in totals) else None
    janky = sum(janks) if janks and all(value is not None for value in janks) else None
    consistent = total is not None and janky is not None and 0 <= janky <= total
    return {
        "android_reported": {
            "available": consistent,
            "total_frames": total,
            "janky_frames": janky,
            "janky_percent": round(janky / total * 100, 4) if consistent and total > 0 else None,
            "processes": processes,
            "definition": "Counts reported by Android gfxinfo since its counter reset; Android's jank definition varies by release.",
        },
        "recent_frame_samples": {
            "available": bool(durations),
            "headers_seen": headers_seen,
            "rows_seen": rows_seen if headers_seen else None,
            "valid_frames": len(durations) if headers_seen else None,
            "excluded_rows": exclusions if headers_seen else None,
            "median_ms": percentile(durations, 50),
            "p95_ms": percentile(durations, 95),
            "max_ms": max(durations) if durations else None,
            "definition": "FrameCompleted minus IntendedVsync for Flags=0 valid rows; percentile uses linear interpolation.",
            "limitations": [
                "The recent-frame ring buffer is bounded and may not cover the full capture interval.",
                "Flagged layout/skipped frames are excluded, so these percentiles do not characterize every transition frame.",
                "Rows older than Stats since are excluded where that timestamp is available.",
                "No FPS or fixed-refresh-rate jank count is derived from these samples.",
            ],
        },
    }


def parse_meminfo(text):
    # The stable named TOTAL PSS field is preferable to guessing column positions
    # in vendor-specific legacy tables. Keep unsupported formats as raw evidence.
    totals = re.findall(r"\bTOTAL PSS:\s*([\d,]+)", text)
    values = [int(value.replace(",", "")) for value in totals]
    return {"available": bool(values), "total_pss_kb": sum(values) if values else None,
            "reported_process_totals_kb": values or None,
            "definition": "Sum of named TOTAL PSS fields in the package-scoped dump; snapshot only."}


def select_device(listing, requested, allow_emulator=False):
    devices = []
    for line in listing.splitlines():
        parts = line.split()
        if len(parts) >= 2 and not line.startswith(("List of devices", "*")):
            devices.append((parts[0], parts[1]))
    if requested:
        matches = [entry for entry in devices if entry[0] == requested]
        if len(matches) != 1:
            raise ValueError("Requested serial is not uniquely present in adb devices")
        selected = matches[0]
    else:
        if len(devices) != 1:
            raise ValueError("Connect exactly one device, or pass --serial for an explicitly selected device")
        selected = devices[0]
    if selected[1] != "device":
        raise ValueError(f"Selected device is {selected[1]}; authorize USB debugging/connect it first")
    if selected[0].startswith("emulator-") and not allow_emulator:
        raise ValueError("Emulator selected; explicitly pass --allow-emulator to profile it")
    return selected[0]


class Capture:
    def __init__(self, adb, serial, output):
        self.adb = adb
        self.serial = serial
        self.output = output
        self.commands = []

    def command(self, name, *args, timeout=15):
        started = datetime.now(timezone.utc).isoformat()
        clock = time.monotonic()
        try:
            result = subprocess.run([self.adb, "-s", self.serial, "shell", *args],
                                    capture_output=True, text=True, encoding="utf-8",
                                    errors="replace", timeout=timeout)
            stdout, stderr, code = result.stdout, result.stderr, result.returncode
            timed_out = False
        except subprocess.TimeoutExpired as error:
            def decode(value):
                return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else value or ""
            stdout, stderr, code = decode(error.stdout), decode(error.stderr), None
            timed_out = True
        (self.output / f"{name}.txt").write_text(stdout, encoding="utf-8")
        if stderr:
            (self.output / f"{name}.stderr.txt").write_text(stderr, encoding="utf-8")
        record = {"name": name, "shell_args": list(args), "started_utc": started,
                  "duration_seconds": round(time.monotonic() - clock, 4),
                  "returncode": code, "timed_out": timed_out, "raw_file": f"{name}.txt"}
        self.commands.append(record)
        return stdout, record

    def pids(self, name, package):
        stdout, record = self.command(name, "pidof", package, timeout=5)
        if record["returncode"] != 0 or not re.fullmatch(r"\d+(?:\s+\d+)*", stdout.strip()):
            return []
        return [int(value) for value in stdout.split()]


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--package", default=DEFAULT_PACKAGE)
    parser.add_argument("--serial", help="ADB serial; required when more than one device is listed")
    parser.add_argument("--allow-emulator", action="store_true", help="Opt in to an already-running isolated emulator; results are not phone timings")
    parser.add_argument("--label", required=True, help="Scenario label, e.g. before-home or after-games")
    parser.add_argument("--duration", type=float, default=20, help="Manual exercise duration in seconds (1-300)")
    parser.add_argument("--output", type=Path, help="New evidence directory inside repository .qa (default: timestamp-label)")
    parser.add_argument("--adb", default="adb", help="ADB executable name or path")
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+", args.package):
        parser.error("Invalid Android package name")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", args.label):
        parser.error("Label must contain only letters, numbers, dot, underscore or hyphen")
    if not math.isfinite(args.duration) or not 1 <= args.duration <= 300:
        parser.error("Duration must be between 1 and 300 seconds")
    adb = shutil.which(args.adb)
    if not adb:
        parser.error("ADB not found; add Android SDK platform-tools to PATH or use --adb")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S-%fZ")
    output = args.output or QA / "android-tabs-profile" / f"{timestamp}-{args.label}"
    output = (ROOT / output).resolve() if not output.is_absolute() else output.resolve()
    if not output.is_relative_to(QA.resolve()) or output == QA.resolve():
        parser.error("Output must be a new directory inside this repository's .qa folder")
    if output.exists():
        parser.error("Output already exists; choose a new directory to preserve prior evidence")
    try:
        listing = subprocess.run([adb, "devices", "-l"], capture_output=True, text=True,
                                 encoding="utf-8", errors="replace", timeout=10, check=True)
        serial = select_device(listing.stdout, args.serial, args.allow_emulator)
    except (ValueError, subprocess.SubprocessError) as error:
        parser.error(str(error))

    output.mkdir(parents=True)
    capture = Capture(adb, serial, output)
    summary = {"label": args.label, "package": args.package, "serial": serial,
               "device_kind": "emulator" if serial.startswith("emulator-") else None,
               "allow_emulator": args.allow_emulator,
               "requested_duration_seconds": args.duration, "completed": False,
               "capture_duration_seconds": None, "gfx_counters_reset": False,
               "error": None, "device": {}, "installed_app": {}, "frames": None,
               "memory_before": None, "memory_after": None,
               "cpu": {"percent": None, "samples": [], "available": False, "raw_available": False,
                       "definition": "Raw top snapshots limited to current pidof(package) PID(s). Numeric CPU is intentionally not inferred from vendor-specific output.",
                       "limitations": ["Named subprocesses such as package:service are not included by exact pidof.",
                                       "Sampling itself adds overhead; compare captures using the same script and interval."]},
               "limitations": [
                   "Manual gestures, selected tab and foreground state are not verified or controlled.",
                   "Compare release builds on the same phone, network, refresh-rate setting and similar temperature.",
                   "Only gfxinfo counters are reset. This is not an application restart or cold-start benchmark.",
                   "Stats collection is package-scoped; recent samples may omit GPU/SurfaceView work and are not a JS-thread profiler.",
                   "Unavailable or unrecognized values remain null, not zero.",
               ],
               "sources": ["https://developer.android.com/tools/dumpsys#ui",
                           "https://android.googlesource.com/platform/frameworks/base/+/562ae3a/docs/html/training/testing/performance.jd"]}
    try:
        qemu, qemu_result = capture.command("emulator-check", "getprop", "ro.kernel.qemu")
        is_emulator = serial.startswith("emulator-") or qemu.strip() == "1"
        summary["device_kind"] = "emulator" if is_emulator else "physical" if qemu_result["returncode"] == 0 else None
        if is_emulator and not args.allow_emulator:
            raise RuntimeError("Qemu device detected; explicitly pass --allow-emulator to profile it")
        if is_emulator:
            summary["limitations"].append("Emulator capture: these timings do not establish performance on the user's phone.")
        for key, prop in (("model", "ro.product.model"), ("android_version", "ro.build.version.release"),
                          ("android_sdk", "ro.build.version.sdk")):
            value, _ = capture.command(key, "getprop", prop)
            summary["device"][key] = value.strip() or None
        for key in ("size", "density"):
            value, _ = capture.command(f"display-{key}", "wm", key)
            summary["device"][key] = value.strip() or None
        package, _ = capture.command("installed-package", "dumpsys", "package", args.package)
        for key, expression in (("version_name", r"\bversionName=([^\r\n]+)"),
                                ("version_code", r"\bversionCode=(\d+)")):
            match = re.search(expression, package)
            summary["installed_app"][key] = match[1].strip() if match else None
        initial_pids = capture.pids("pids-before", args.package)
        if not initial_pids:
            raise RuntimeError("The selected package is not running. Open the app and desired tab manually, then retry")
        summary["initial_pids"] = initial_pids
        memory, _ = capture.command("meminfo-before", "dumpsys", "meminfo", args.package)
        summary["memory_before"] = parse_meminfo(memory)
        print(f"Ready: {args.label}, {args.duration:g}s. Manually use the selected tab/scroll when capture starts.", flush=True)
        for remaining in (3, 2, 1):
            print(f"Starts in {remaining}...", flush=True)
            time.sleep(1)
        reset, result = capture.command("gfxinfo-reset", "dumpsys", "gfxinfo", args.package, "reset")
        if result["returncode"] != 0 or re.search(r"No process found|Permission Denial|Can't find service", reset, re.I):
            raise RuntimeError("Package gfxinfo counters could not be reset; capture aborted")
        summary["gfx_counters_reset"] = True
        started = time.monotonic()
        deadline = started + args.duration
        summary["capture_started_utc"] = datetime.now(timezone.utc).isoformat()
        print("CAPTURING: perform the same tab gestures used for the comparison.", flush=True)
        index = 0
        interrupted = False
        try:
            while time.monotonic() < deadline:
                remaining = deadline - time.monotonic()
                if remaining < 2:
                    time.sleep(max(0, remaining))
                    break
                pids = capture.pids(f"cpu-{index:03d}-pids", args.package)
                if not pids:
                    summary["error"] = "App process disappeared during capture"
                    interrupted = True
                    break
                raw_cpu, record = capture.command(f"cpu-{index:03d}-top", "top", "-b", "-n", "2", "-d", "1", "-p",
                                                  ",".join(map(str, pids)), timeout=min(4, max(1, deadline - time.monotonic())))
                summary["cpu"]["samples"].append({"pids": pids, "offset_seconds": round(time.monotonic() - started, 4),
                                                    "raw_file": record["raw_file"], "returncode": record["returncode"],
                                                    "timed_out": record["timed_out"], "has_output": bool(raw_cpu.strip())})
                index += 1
                pause = min(4 - (time.monotonic() - started) % 4, deadline - time.monotonic())
                if pause > 0:
                    time.sleep(pause)
        except KeyboardInterrupt:
            interrupted = True
            summary["error"] = "Capture interrupted by user; partial evidence retained"
        summary["capture_duration_seconds"] = round(time.monotonic() - started, 4)
        print("Capture window ended. Collecting final package statistics...", flush=True)
        summary["gfx_collection_started_seconds"] = round(time.monotonic() - started, 4)
        gfx, _ = capture.command("gfxinfo-framestats", "dumpsys", "gfxinfo", args.package, "framestats")
        summary["gfx_collection_completed_seconds"] = round(time.monotonic() - started, 4)
        summary["frames"] = parse_gfxinfo(gfx)
        memory, _ = capture.command("meminfo-after", "dumpsys", "meminfo", args.package)
        summary["memory_after"] = parse_meminfo(memory)
        summary["final_pids"] = capture.pids("pids-after", args.package)
        if set(initial_pids) != set(summary["final_pids"]):
            summary["limitations"].append("App PID set changed: counters may not cover a single continuous process lifetime.")
        summary["cpu"]["raw_available"] = any(item["returncode"] == 0 and item["has_output"]
                                               for item in summary["cpu"]["samples"])
        summary["completed"] = not interrupted
    except (RuntimeError, OSError, KeyboardInterrupt) as error:
        summary["error"] = str(error) or "Interrupted"
    finally:
        summary["commands"] = capture.commands
        (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"Evidence: {output}", flush=True)
    if summary["error"]:
        print(summary["error"], file=sys.stderr)
    return 0 if summary["completed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
