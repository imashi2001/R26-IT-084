"""Regression tests for calendar_flags_for_date, the single long-weekend definition.

Run: python waste_forecast/src/test_calendar_flags.py   (pytest also works)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from calendar_features import calendar_flags_for_date


def test_plain_monday_after_weekend_is_not_long_weekend():
    # Sat+Sun alone is two off-days; the old JS logic called this a 3-day long weekend.
    flags = calendar_flags_for_date("2026-10-19")
    assert flags["isLongWeekend"] is False
    assert flags["triggerHoliday"] is None


def test_plain_friday_before_weekend_is_not_long_weekend():
    flags = calendar_flags_for_date("2026-01-02")
    assert flags["isLongWeekend"] is False


def test_poya_on_sunday_is_holiday_but_not_long_weekend():
    flags = calendar_flags_for_date("2026-10-25")
    assert flags["isHoliday"] is True
    assert flags["isPoya"] is True
    assert flags["holidays"][0]["name"] == "Vap Full Moon Poya Day"
    assert flags["isLongWeekend"] is False


def test_holiday_friday_makes_three_day_long_weekend_with_named_trigger():
    flags = calendar_flags_for_date("2026-04-04")
    assert flags["isLongWeekend"] is True
    assert flags["longWeekendDates"] == ["2026-04-03", "2026-04-04", "2026-04-05"]
    assert flags["triggerHoliday"]["name"] == "Good Friday"


def test_new_year_four_day_run():
    flags = calendar_flags_for_date("2026-04-14")
    assert flags["longWeekendDays"] == 4
    assert flags["longWeekendDates"] == ["2026-04-11", "2026-04-12", "2026-04-13", "2026-04-14"]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("PASS", t.__name__)
    print(f"{len(tests)} passed")
