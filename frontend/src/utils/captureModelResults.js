/**
 * Build a normalized view of all five ML model outputs from a stored capture.
 */

const BIN_FILL_LABELS = new Set(["empty", "half", "overflow"]);

function pct(conf) {
  const n = Number(conf);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function fmtPct(conf) {
  const p = pct(conf);
  return p == null ? null : `${p}%`;
}

export function partitionCapturePredictions(predictions) {
  const animals = [];
  const binFill = [];
  const litterBoxes = [];
  for (const p of predictions || []) {
    const label = String(p.label || "").trim().toLowerCase();
    if (BIN_FILL_LABELS.has(label)) {
      binFill.push(p);
      continue;
    }
    if (label === "littering" || p.model_type === "littering_action") continue;
    if (label === "litter" || p.model_type === "litter") {
      litterBoxes.push(p);
      continue;
    }
    animals.push(p);
  }
  return { animals, binFill, litterBoxes };
}

function bestPrediction(list) {
  if (!list?.length) return null;
  return list.reduce((best, cur) =>
    Number(cur.confidence) > Number(best.confidence) ? cur : best
  );
}

/**
 * @param {{ fill_level?: string|null, model_name?: string|null, predictions?: array, extras?: object|null }} latest
 */
export function buildCaptureModelResults(latest) {
  if (!latest) return null;

  const extras = latest.extras || {};
  const { animals, binFill, litterBoxes } = partitionCapturePredictions(
    latest.predictions
  );
  const bestFill = bestPrediction(binFill);
  const bestAnimal = bestPrediction(animals);
  const fillTier =
    latest.fill_level ||
    (bestFill?.label
      ? String(bestFill.label).charAt(0).toUpperCase() +
        String(bestFill.label).slice(1).toLowerCase()
      : null);

  const wasteLabel = extras.waste_label;
  const wasteConf = extras.waste_confidence;
  const hasWaste = wasteLabel != null && String(wasteLabel).trim() !== "";

  const animalCount = Number(extras.animal_count);
  const hasAnimals =
    (Number.isFinite(animalCount) && animalCount > 0) || animals.length > 0;
  const count =
    Number.isFinite(animalCount) && animalCount > 0
      ? animalCount
      : animals.length;

  const litterSev = extras.litter_severity;
  const litterLsi = extras.litter_lsi;
  const litterCount = extras.litter_detection_count;
  const hasLitterSev =
    litterSev != null ||
    (litterLsi != null && Number.isFinite(Number(litterLsi)));

  const litteringDetected = Boolean(extras.littering_event_detected);
  const litteringCount = Number(extras.littering_event_count) || 0;
  const litteringConf = extras.littering_max_confidence;

  const modelsRun = (latest.model_name || "")
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    modelsRun,
    waste: {
      key: "waste",
      title: "Waste classification",
      env: "MODEL_WASTE_URL",
      status: hasWaste ? "ok" : "muted",
      primary: hasWaste ? String(wasteLabel) : "No result",
      secondary: hasWaste ? fmtPct(wasteConf) : null,
      detail: hasWaste
        ? `${wasteLabel}${fmtPct(wasteConf) ? ` · ${fmtPct(wasteConf)} confidence` : ""}`
        : "Organic vs non-organic not available for this capture.",
    },
    fill: {
      key: "fill",
      title: "Bin fill level",
      env: "MODEL_FILL_URL",
      status:
        fillTier === "Overflow"
          ? "danger"
          : fillTier === "Half"
            ? "warn"
            : fillTier
              ? "ok"
              : "muted",
      primary: fillTier || "No result",
      secondary:
        bestFill && fmtPct(bestFill.confidence)
          ? fmtPct(bestFill.confidence)
          : extras.fill_percentage != null &&
              Number.isFinite(Number(extras.fill_percentage))
            ? `${Math.round(Number(extras.fill_percentage))}% fill`
            : null,
      detail: [
        fillTier ? `Tier: ${fillTier}` : null,
        extras.fill_percentage != null &&
        Number.isFinite(Number(extras.fill_percentage))
          ? `Estimate ${Math.round(Number(extras.fill_percentage))}%`
          : null,
        bestFill?.label && fmtPct(bestFill.confidence)
          ? `Model: ${bestFill.label} (${fmtPct(bestFill.confidence)})`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Fill model did not run or returned no tier.",
    },
    animal: {
      key: "animal",
      title: "Animal detection",
      env: "MODEL_ANIMAL_URL",
      status: hasAnimals ? "warn" : "ok",
      primary: hasAnimals
        ? `${count} detected`
        : count === 0
          ? "None detected"
          : "No result",
      secondary: bestAnimal ? fmtPct(bestAnimal.confidence) : null,
      detail: hasAnimals
        ? [
            `${count} animal(s)`,
            bestAnimal?.label
              ? `Top: ${bestAnimal.label}${fmtPct(bestAnimal.confidence) ? ` (${fmtPct(bestAnimal.confidence)})` : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "No animals in this capture.",
    },
    litterSeverity: {
      key: "litter_severity",
      title: "Litter severity (LSI)",
      env: "MODEL_LITTER_URL",
      status:
        String(litterSev || "").toUpperCase() === "HIGH"
          ? "danger"
          : String(litterSev || "").toUpperCase() === "MEDIUM"
            ? "warn"
            : hasLitterSev
              ? "ok"
              : "muted",
      primary: litterSev || (hasLitterSev ? "LOW" : "No result"),
      secondary:
        litterLsi != null && Number.isFinite(Number(litterLsi))
          ? `LSI ${Number(litterLsi).toFixed(1)}`
          : null,
      detail: hasLitterSev
        ? [
            litterSev ? `Severity ${String(litterSev).toUpperCase()}` : null,
            litterLsi != null && Number.isFinite(Number(litterLsi))
              ? `LSI ${Number(litterLsi).toFixed(1)}`
              : null,
            litterCount != null ? `${litterCount} object(s)` : null,
            litterBoxes.length
              ? `${litterBoxes.length} box(es) on image`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Litter severity model did not run or returned no score.",
    },
    litteringAction: {
      key: "littering_action",
      title: "Littering action",
      env: "MODEL_LITTERING_ACTION_URL",
      status: litteringDetected ? "danger" : "ok",
      primary: litteringDetected ? "Event detected" : "No event",
      secondary: litteringDetected ? fmtPct(litteringConf) : null,
      detail: litteringDetected
        ? [
            litteringCount ? `${litteringCount} event(s)` : null,
            fmtPct(litteringConf)
              ? `Max confidence ${fmtPct(litteringConf)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "No littering action detected in this capture.",
    },
    risk: extras.risk_level
      ? {
          level: extras.risk_level,
          case: extras.risk_case || null,
        }
      : null,
  };
}

export function modelResultRows(results) {
  if (!results) return [];
  return [
    results.waste,
    results.fill,
    results.animal,
    results.litterSeverity,
    results.litteringAction,
  ];
}
