import { ShieldCheck } from "lucide-react";

/** Green shield with a white check — marks official/curated items. */
export function VerifiedBadge() {
  return (
    <ShieldCheck
      className="size-4 shrink-0 fill-[var(--verified)] text-white dark:text-card"
      strokeWidth={2}
      aria-label="Verified"
      role="img"
    />
  );
}
