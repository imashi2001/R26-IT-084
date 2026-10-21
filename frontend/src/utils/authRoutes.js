/** Public citizen home vs municipal staff dashboard routes. */

export const PUBLIC_HOME = "/";
export const STAFF_HOME = "/dashboard";

const PUBLIC_EXACT = new Set(["/", "/login", "/register"]);

/**
 * After staff sign-in, land on the dashboard unless they were gated from
 * another protected staff route (e.g. /forecast).
 */
export function resolveStaffHomePath(from) {
  if (!from || typeof from !== "string") return STAFF_HOME;
  const path = from.split("?")[0].split("#")[0];
  if (PUBLIC_EXACT.has(path)) return STAFF_HOME;
  return from;
}

export function isPublicPath(pathname) {
  if (!pathname) return true;
  const path = pathname.split("?")[0].split("#")[0];
  return PUBLIC_EXACT.has(path);
}
