import { useEffect, useState } from "react";
import {
  DEFAULT_LITTER_POPUP_SETTINGS,
  LITTER_POPUP_SETTINGS_EVENT,
  fetchLitterPopupSettings,
} from "../utils/litterPopupSettings";

const REFRESH_MS = 60_000;

/** Litter popup switches, refreshed every minute and instantly after Settings saves. */
export default function useLitterPopupSettings() {
  const [settings, setSettings] = useState(DEFAULT_LITTER_POPUP_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchLitterPopupSettings()
        .then((s) => {
          if (!cancelled) setSettings(s);
        })
        .catch(() => {});
    const onSaved = (e) => {
      if (e.detail) setSettings(e.detail);
    };

    load();
    const t = setInterval(load, REFRESH_MS);
    window.addEventListener(LITTER_POPUP_SETTINGS_EVENT, onSaved);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener(LITTER_POPUP_SETTINGS_EVENT, onSaved);
    };
  }, []);

  return settings;
}
