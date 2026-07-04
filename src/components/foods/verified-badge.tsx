import { BadgeCheck } from "lucide-react";

/** Green verified badge for official store items. */
export function VerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-verified/10 px-1.5 py-0.5 text-[10px] font-semibold text-verified"
      title="Official store item"
    >
      <BadgeCheck className="size-3" aria-hidden />
      Verified
    </span>
  );
}
