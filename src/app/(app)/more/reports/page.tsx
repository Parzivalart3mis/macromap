import { ReportsCard } from "@/components/more/reports-card";
import { SubHeader } from "@/components/more/sub-header";

export default function ReportsPage() {
  return (
    <main>
      <SubHeader title="My Weekly Report" />
      <div className="animate-fade-up p-4">
        <ReportsCard />
      </div>
    </main>
  );
}
