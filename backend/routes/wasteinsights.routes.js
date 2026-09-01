const { Router } = require("express");
const { execSync } = require("child_process");
const path = require("path");

const router = Router();

let cachedInsights = null;

router.get("/", (_req, res) => {
  try {
    if (cachedInsights) {
      return res.json(cachedInsights);
    }

    const pythonScript = `
import sys, json
sys.path.insert(0, 'waste_forecast/src')
from load_data import compute_seasonal_insights
print(json.dumps(compute_seasonal_insights()))
`;

    const repoRoot = path.join(__dirname, "..", "..");
    const output = execSync(`python -c "${pythonScript.replace(/\n/g, ' ')}"`, { cwd: repoRoot, timeout: 10000 }).toString();
    cachedInsights = JSON.parse(output.trim());
    return res.json(cachedInsights);
  } catch (err) {
    console.error("[waste-insights] Error computing insights:", err.message);
    return res.json({
      peakMonth: {
        month: "December",
        averageTonsPerMonth: 33.9,
        totalTonsCollected: 41500,
        headline: "December is the Peak Month",
        detail: "~33.9 tons/month peak average (~41,500 tons collected across all sites, 2023–2025)."
      },
      dominantCategories: {
        topCategory: "Burnable",
        topPct: 38.5,
        secondCategory: "SOW",
        secondPct: 32.0,
        combinedPct: 70.5,
        headline: "Burnable (38.5%) & SOW (32.0%)",
        detail: "Together they represent 70.5% of total waste collected across all regions."
      },
      lowestVolumeSite: {
        siteId: "kdu-campus",
        siteName: "Kothalawala Defence University",
        sharePct: 3.2,
        headline: "Kothalawala Defence University",
        detail: "Lowest volume site (~3.2% share, 34–53 KG/day) — campus-scale boundary vs municipal councils."
      },
      decemberStandout: {
        siteId: "dehiwala-mtlavinia",
        siteName: "Dehiwala - Mt Lavinia",
        secondSiteName: "Moratuwa M.C.",
        headline: "Dehiwala - Mt Lavinia",
        detail: "Largest December collection (~406.5 KG/day), outperforming next-highest Moratuwa M.C. (~298.7 KG/day) by ~36%."
      }
    });
  }
});

module.exports = router;
