import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import BrandLogo from "../BrandLogo";

export const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#find", label: "Find Bin" },
  { href: "#map", label: "Live Map" },
  { href: "#guide", label: "Waste Guide" },
  { href: "#about", label: "About" },
];

export default function PublicNav({ dark, onToggleTheme, onFindClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const solid = scrolled || menuOpen;
  const navTheme = solid ? (dark ? "dark" : "light") : "dark";

  return (
    <header
      className={[
        "sticky top-0 z-50 border-b transition-all duration-300",
        solid
          ? dark
            ? "border-white/10 bg-ink-950/95 shadow-lg backdrop-blur-md"
            : "border-slate-200/80 bg-white/95 shadow-md backdrop-blur-md"
          : "border-transparent bg-gradient-to-b from-black/55 to-transparent backdrop-blur-[2px]",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem]">
        <a href="#home" className="flex shrink-0 items-center no-underline">
          <BrandLogo variant="landing" theme={navTheme} />
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={[
                "rounded-lg px-3 py-2 text-sm font-semibold no-underline transition",
                solid
                  ? dark
                    ? "text-ink-300 hover:bg-white/10 hover:text-white"
                    : "text-ink-600 hover:bg-eco-light hover:text-eco-primary"
                  : "text-white/90 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFindClick}
            className={[
              "hidden rounded-full px-4 py-2 text-sm font-bold transition sm:inline-flex",
              solid
                ? "bg-eco-primary text-white shadow-sm hover:bg-eco-dark"
                : "bg-white text-eco-primary shadow-lg hover:bg-eco-light",
            ].join(" ")}
          >
            Find nearest bin
          </button>

          <select
            aria-label="Language"
            className={[
              "hidden rounded-lg border px-2 py-1.5 text-xs font-semibold sm:block",
              solid
                ? dark
                  ? "border-ink-700 bg-ink-900 text-ink-200"
                  : "border-slate-200 bg-white text-ink-700"
                : "border-white/25 bg-black/20 text-white",
            ].join(" ")}
            defaultValue="en"
          >
            <option value="en">EN</option>
            <option value="si">SI</option>
            <option value="ta">TA</option>
          </select>

          <button
            type="button"
            aria-label="Notifications"
            className={[
              "hidden h-9 w-9 items-center justify-center rounded-full border transition sm:inline-flex",
              solid
                ? dark
                  ? "border-ink-700 text-ink-300 hover:bg-ink-800"
                  : "border-slate-200 text-ink-500 hover:bg-eco-light"
                : "border-white/25 text-white hover:bg-white/10",
            ].join(" ")}
          >
            <Bell className="h-4 w-4" />
          </button>

          <Link
            to="/login"
            className={[
              "hidden rounded-lg px-3 py-1.5 text-xs font-semibold no-underline transition sm:inline-flex",
              solid
                ? dark
                  ? "text-ink-300 hover:bg-white/10 hover:text-white"
                  : "text-ink-500 hover:bg-eco-light hover:text-eco-primary"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            Staff login
          </Link>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-full border transition",
              solid
                ? dark
                  ? "border-ink-700 text-ink-200 hover:bg-ink-800"
                  : "border-slate-200 text-ink-700 hover:bg-eco-light"
                : "border-white/25 text-white hover:bg-white/10",
            ].join(" ")}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-full border transition lg:hidden",
              solid
                ? dark
                  ? "border-ink-700 text-ink-200 hover:bg-ink-800"
                  : "border-slate-200 text-ink-700 hover:bg-eco-light"
                : "border-white/25 text-white hover:bg-white/10",
            ].join(" ")}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          className={[
            "border-t px-4 py-4 lg:hidden",
            dark ? "border-ink-800 bg-ink-950" : "border-slate-200 bg-white",
          ].join(" ")}
        >
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={[
                  "rounded-xl px-4 py-3 text-sm font-semibold no-underline",
                  dark
                    ? "text-ink-200 hover:bg-ink-900"
                    : "text-ink-700 hover:bg-eco-light",
                ].join(" ")}
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onFindClick?.();
              }}
              className="mt-2 rounded-xl bg-eco-primary px-4 py-3 text-left text-sm font-bold text-white"
            >
              Find nearest bin
            </button>
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className={[
                "mt-1 rounded-xl px-4 py-3 text-sm font-semibold no-underline",
                dark
                  ? "text-ink-200 hover:bg-ink-900"
                  : "text-ink-700 hover:bg-eco-light",
              ].join(" ")}
            >
              Staff login
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
