import type { Metadata } from "next";
import { allFlashcards } from "@/content";
import { renderMarkdown } from "@/lib/markdown";
import { Flashcards } from "@/components/arena/Flashcards";

export const metadata: Metadata = { title: "Mock Interview Cards" };

export default async function FlashcardsPage() {
  const cards = await Promise.all(
    allFlashcards().map(async (c) => ({ id: c.id, worldId: c.worldId, lessonTitle: c.lessonTitle, q: c.q, freq: c.freq, html: await renderMarkdown(c.a) })),
  );
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <Flashcards cards={cards} />
    </div>
  );
}
