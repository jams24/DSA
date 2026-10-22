import type { Metadata } from "next";
import { RapidFire } from "@/components/arena/RapidFire";

export const metadata: Metadata = { title: "Rapid Fire" };

export default function RapidFirePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <RapidFire />
    </div>
  );
}
