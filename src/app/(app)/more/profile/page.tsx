import { ProfileCard } from "@/components/more/profile-card";
import { SubHeader } from "@/components/more/sub-header";

export default function ProfileSettingsPage() {
  return (
    <main>
      <SubHeader title="My Profile" />
      <div className="animate-fade-up p-4">
        <ProfileCard />
      </div>
    </main>
  );
}
