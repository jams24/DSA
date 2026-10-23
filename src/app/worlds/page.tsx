import type { Metadata } from "next";
import { contentStats } from "@/content";
import { WorldCards } from "@/components/world/WorldCards";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Worlds",
  description: "Eight worlds from Big-O to LLM inference and Kubernetes. Pick a realm and start climbing.",
};

export default function WorldsPage() {
  const stats = contentStats();
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10">
      <SectionTitle eyebrow="World select" title="Choose your realm">
        {stats.lessons} levels across {stats.worlds} worlds. Go in order for a full interview-prep journey, or jump straight to the realm your next interview needs.
      </SectionTitle>
      <WorldCards large />
    </div>
  );
}
