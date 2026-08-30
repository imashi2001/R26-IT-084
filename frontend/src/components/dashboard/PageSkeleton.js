import { skeletonPulse } from "./dashboardTheme";

export default function PageSkeleton({ rows = 4 }) {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
      <div className={`${skeletonPulse} h-20`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${skeletonPulse} h-24`} />
        ))}
      </div>
      <div className={`${skeletonPulse} h-64`} />
      {rows > 0
        ? Array.from({ length: rows }, (_, i) => (
            <div key={i} className={`${skeletonPulse} h-16`} />
          ))
        : null}
    </div>
  );
}
