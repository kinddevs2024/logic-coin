"""Parser contracts only: no ADB calls or phone/emulator interaction."""

import importlib.util
from pathlib import Path
import unittest


MODULE = Path(__file__).resolve().parents[1] / "android-tab-profile.py"
SPEC = importlib.util.spec_from_file_location("android_tab_profile", MODULE)
profile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(profile)


class FrameStatsTests(unittest.TestCase):
    def test_optional_input_sentinel_does_not_discard_a_valid_frame(self):
        fixture = """** Graphics info for pid 123 [com.kinddevs.logiccoin] **
Stats since: 1000000000ns
Total frames rendered: 200
Janky frames: 10 (5.00%)
---PROFILEDATA---
Flags,IntendedVsync,OldestInputEvent,FrameCompleted,
0,1000000000,9223372036854775807,1010000000,
0,1020000000,9223372036854775807,1050000000,
---PROFILEDATA---
"""
        result = profile.parse_gfxinfo(fixture)
        self.assertEqual(result["android_reported"]["total_frames"], 200)
        self.assertEqual(result["android_reported"]["janky_frames"], 10)
        self.assertEqual(result["android_reported"]["janky_percent"], 5)
        self.assertEqual(result["recent_frame_samples"]["valid_frames"], 2)
        self.assertEqual(result["recent_frame_samples"]["median_ms"], 20)
        self.assertEqual(result["recent_frame_samples"]["p95_ms"], 29)

    def test_flags_sentinels_zero_reversed_and_old_timestamps_are_excluded(self):
        fixture = """Stats since: 1000000000ns
---PROFILEDATA---
Flags,FrameCompleted,IntendedVsync,
1,1020000000,1000000000,
0,9223372036854775807,1000000000,
0,1020000000,0,
0,999999999,1000000000,
0,1020000000,900000000,
0,1020000000,-1,
0,nope,1000000000,
0,1016000000,1000000000,
---PROFILEDATA---
"""
        result = profile.parse_gfxinfo(fixture)["recent_frame_samples"]
        self.assertEqual(result["valid_frames"], 1)
        self.assertEqual(result["median_ms"], 16)
        self.assertEqual(result["excluded_rows"], {"flags": 1, "invalid_timestamps": 4,
                                                  "before_reset": 1, "malformed": 1})

    def test_missing_metrics_remain_null_and_known_zero_is_distinct(self):
        missing = profile.parse_gfxinfo("No process found for: com.kinddevs.logiccoin")
        self.assertIsNone(missing["android_reported"]["total_frames"])
        self.assertIsNone(missing["recent_frame_samples"]["valid_frames"])
        self.assertIsNone(missing["recent_frame_samples"]["p95_ms"])
        empty = profile.parse_gfxinfo("Total frames rendered: 0\nJanky frames: 0 (0.00%)\n"
                                      "---PROFILEDATA---\nFlags,IntendedVsync,FrameCompleted,\n---PROFILEDATA---")
        self.assertEqual(empty["android_reported"]["total_frames"], 0)
        self.assertIsNone(empty["android_reported"]["janky_percent"])
        self.assertEqual(empty["recent_frame_samples"]["valid_frames"], 0)
        self.assertFalse(empty["recent_frame_samples"]["available"])

    def test_android_legacy_jank_count_is_not_double_counted(self):
        fixture = """Total frames rendered: 1,000
Janky frames: 50 (5.0%)
Janky frames (legacy): 70 (7.0%)
"""
        result = profile.parse_gfxinfo(fixture)["android_reported"]
        self.assertEqual(result["total_frames"], 1000)
        self.assertEqual(result["janky_frames"], 50)

    def test_percentile_handles_empty_single_and_interpolation(self):
        self.assertIsNone(profile.percentile([], 95))
        self.assertEqual(profile.percentile([7], 95), 7)
        self.assertEqual(profile.percentile([40, 10, 20, 30], 50), 25)
        self.assertEqual(profile.percentile([10, 20, 30, 40], 95), 38.5)
        with self.assertRaises(ValueError):
            profile.percentile([1], 101)

    def test_each_process_keeps_its_own_reset_timestamp(self):
        fixture = """** Graphics info for pid 10 [com.example.app] **
Stats since: 1000000000ns
Total frames rendered: 20
Janky frames: 2 (10%)
Flags,IntendedVsync,FrameCompleted,
0,1000000000,1010000000,
---PROFILEDATA---
** Graphics info for pid 20 [com.example.app:remote] **
Stats since: 2000000000ns
Total frames rendered: 10
Janky frames: 3 (30%)
Flags,IntendedVsync,FrameCompleted,
0,1900000000,1910000000,
0,2000000000,2020000000,
---PROFILEDATA---
"""
        result = profile.parse_gfxinfo(fixture)
        self.assertEqual(result["android_reported"]["total_frames"], 30)
        self.assertEqual(result["android_reported"]["janky_frames"], 5)
        self.assertEqual(result["recent_frame_samples"]["valid_frames"], 2)
        self.assertEqual(result["recent_frame_samples"]["excluded_rows"]["before_reset"], 1)


class DeviceSelectionTests(unittest.TestCase):
    def test_only_an_unambiguous_authorized_physical_device_is_selected(self):
        self.assertEqual(profile.select_device("List of devices attached\nphone1 device product:test\n", None), "phone1")
        self.assertEqual(profile.select_device("phone1 device\nphone2 device\n", "phone2"), "phone2")
        for listing, selected in (("", None), ("phone1 unauthorized", None),
                                  ("phone1 offline", "phone1"), ("phone1 device\nphone2 device", None),
                                  ("emulator-5554 device", None), ("phone1 device", "missing")):
            with self.subTest(listing=listing, selected=selected), self.assertRaises(ValueError):
                profile.select_device(listing, selected)

    def test_emulator_requires_explicit_opt_in_without_weakening_other_checks(self):
        self.assertEqual(profile.select_device("emulator-5554 device", None, allow_emulator=True), "emulator-5554")
        self.assertEqual(profile.select_device("phone1 device\nemulator-5554 device", "emulator-5554", allow_emulator=True), "emulator-5554")
        for listing in ("emulator-5554 unauthorized", "emulator-5554 offline",
                        "phone1 device\nemulator-5554 device"):
            with self.subTest(listing=listing), self.assertRaises(ValueError):
                profile.select_device(listing, None, allow_emulator=True)
        self.assertFalse(profile.build_parser().parse_args(["--label", "home"]).allow_emulator)
        self.assertTrue(profile.build_parser().parse_args(["--label", "home", "--allow-emulator"]).allow_emulator)


if __name__ == "__main__":
    unittest.main()
