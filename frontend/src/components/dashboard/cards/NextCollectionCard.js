import { Truck, CalendarDays } from "lucide-react";
import Card from "../Card";

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
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate();
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();
  if (sameDay) return "Today";
  if (isTomorrow) return "Tomorrow";
  return target.toLocaleDateString([], { month: "short", day: "numeric" });
}

function defaultMunicipalNext() {
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
    basis = "From rotting estimate";
  } else {
    target = defaultMunicipalNext();
    basis = "Municipal schedule";
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
    <Card glow={!urgent}>
      <Card.Header
        icon={Truck}
        accent={urgent ? "text-red-400" : "text-brand-400"}
        title="Next Collection"
        right={
          <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
        }
      />

      <Card.Body className="flex flex-col items-center justify-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 shadow-glow-brand">
          <Truck className="h-7 w-7" />
        </div>
        <div className="text-xs text-slate-500">Estimated collection time</div>
        <div
          className={`mt-1 text-2xl font-bold ${urgent ? "text-red-400" : "text-brand-400"}`}
        >
          {dayLabel}
        </div>
        <div className="text-lg font-semibold text-white">{timeLabel}</div>
      </Card.Body>

      <Card.Footer>{basis}</Card.Footer>
    </Card>
  );
}
