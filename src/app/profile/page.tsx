import type { Metadata } from "next";
import { ProfileView } from "@/components/account/ProfileView";

export const metadata: Metadata = { title: "Profile & achievements" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <ProfileView />
    </div>
  );
}
