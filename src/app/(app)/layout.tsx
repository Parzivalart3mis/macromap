import { BottomNav } from "@/components/shell/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      {/* Clears the fixed bottom nav, whose height grows with the bottom inset. */}
      <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <BottomNav />
    </div>
  );
}
