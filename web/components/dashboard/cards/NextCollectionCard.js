"use client";
import { Truck, CalendarDays } from "lucide-react";
import Card from "../Card";

/*
 * Next Collection card.
 *
 * Per the locked spec, "Next Collection" is computed from the engine's
 * `rotting_hours`: collect BEFORE the bin starts to rot. We add a small safety
 * margin (collect ~2h before predicted rot start) and round to 30 minutes so
 * the wall-clock time looks like a real schedule slot.
 *
 * Fallbacks:
 *   - No rotting estimate (non-organic, no capture, etc.)  -> default 07:00 next day
 *     (matches "Municipal Cleaning Schedule" in the mockup).
 *   - rotting_hours <= safety margin -> "Schedule pickup now".
 */

const SAFETY_MARGIN_HOURS = 2;
const ROUND_MINUTES = 30;

function roundDown(date, minutes) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / minutes) * minutes);
  return d;
}

function formatRelative(target) {
  const now = new Date();
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate();

  if (sameDay) return "Today";
  if (isTomorrow) return "Tomorrow";
  return target.toLocaleDateString([], { month: "short", day: "numeric" });
}

function defaultMunicipalNext() {
  // "Tomorrow 07:00 AM" baseline matching the mockup.
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(7, 0, 0, 0);
  return t;
}

export default function NextCollectionCard({ snapshot }) {
  const hRaw = Number(snapshot?.extras?.rotting_hours);
  const hasH = Number.isFinite(hRaw) && hRaw >= 0;

  let target;
  let basis;
  let urgent = false;

  if (hasH) {
    if (hRaw <= SAFETY_MARGIN_HOURS) {
      urgent = true;
      target = new Date();
    } else {
      const ms = (hRaw - SAFETY_MARGIN_HOURS) * 60 * 60 * 1000;
      target = roundDown(new Date(Date.now() + ms), ROUND_MINUTES);
    }
    basis = "Computed from rotting estimate";
  } else {
    target = defaultMunicipalNext();
    basis = "Municipal Cleaning Schedule";
  }

  const dayLabel = urgent ? "Now" : formatRelative(target);
  const timeLabel = urgent
    ? "Schedule pickup"
    : target.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

  return (
    <Card>
      <Card.Header
        icon={Truck}
        accent={urgent ? "text-red-600" : "text-brand-600"}
        title="Next Collection"
        right={
          <CalendarDays className="h-4 w-4 text-ink-400" aria-hidden="true" />
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        <div className="text-xs text-ink-500">Estimated collection time</div>
        <div
          className={`mt-1 text-2xl font-bold ${urgent ? "text-red-700" : "text-brand-700"}`}
        >
          {dayLabel}
        </div>
        <div className="text-base font-semibold text-ink-900">{timeLabel}</div>
      </Card.Body>

      <Card.Footer>{basis}</Card.Footer>
    </Card>
  );
}
