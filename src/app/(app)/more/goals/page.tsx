import { GoalsManager } from "@/components/more/goals-manager";
import { SubHeader } from "@/components/more/sub-header";

export default function GoalsPage() {
  return (
    <main>
      <SubHeader title="Goals" />
      <div className="animate-fade-up p-4">
        <GoalsManager />
      </div>
    </main>
  );
}
