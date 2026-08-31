/**
 * Vision Waste brand mark — replaces the old Leaf + "VisionWaste" placeholder.
 *
 * Assets live in /public/brand/:
 *   vision-waste-logo.png       — transparent/dark background (sidebar, dashboard)
 *   vision-waste-logo-light.png — light background (auth, light landing header)
 */

export const BRAND = {
  logoDark: "/brand/vision-waste-logo.png",
  logoLight: "/brand/vision-waste-logo-light.png",
  heroDefault: "/brand/dashboard-hero.png",
  name: "Vision Waste",
  tagline: "Smart Vision. Cleaner Tomorrow.",
};

const SIZE = {
  sidebar: "h-12 w-auto max-w-[11rem]",
  auth: "h-16 w-auto max-w-[14rem]",
  landing: "h-11 w-auto max-w-[10rem]",
  footer: "h-9 w-auto max-w-[9rem]",
  compact: "h-8 w-auto max-w-[8rem]",
  nav: "h-9 w-auto max-w-[9rem]",
};

export default function BrandLogo({
  variant = "sidebar",
  theme = "dark",
  className = "",
  showTagline = false,
}) {
  const src = theme === "light" ? BRAND.logoLight : BRAND.logoDark;
  const sizeClass = SIZE[variant] || SIZE.sidebar;

  return (
    <div className={`flex flex-col ${className}`}>
      <img
        src={src}
        alt={BRAND.name}
        className={`object-contain object-left ${sizeClass}`}
        decoding="async"
      />
      {showTagline ? (
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {BRAND.tagline}
        </span>
      ) : null}
    </div>
  );
}
