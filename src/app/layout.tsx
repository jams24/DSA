import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Press_Start_2P, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { buildCatalog } from "@/content";
import { GameProvider } from "@/components/game/GameProvider";
import { LevelUpModal, Toaster } from "@/components/game/Toaster";
import { TopBar } from "@/components/game/TopBar";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });
const pixel = Press_Start_2P({ variable: "--font-pixel", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: {
    default: "DSA Quest — the interview prep RPG",
    template: "%s · DSA Quest",
  },
  description:
    "Learn data structures, algorithms, system design, distributed systems and AI inference through interactive visualizations, quizzes and boss battles.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const catalog = buildCatalog();
  return (
    <html lang="en" className={`${geist.variable} ${space.variable} ${mono.variable} ${pixel.variable} h-full antialiased`}>
      <body className="relative flex min-h-full flex-col">
        <GameProvider catalog={catalog}>
          <TopBar />
          <main className="relative z-10 flex-1">{children}</main>
          <footer className="relative z-10 mt-24 border-t border-line/70">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-pixel text-[10px] text-dim">DSA QUEST</span> · learn it, see it, code it, defend it in the interview.
              </p>
              <div className="flex gap-4">
                <Link href="/worlds" className="hover:text-ink">Worlds</Link>
                <Link href="/cheatsheets" className="hover:text-ink">Cheat sheets</Link>
                <Link href="/questions" className="hover:text-ink">Question bank</Link>
                <a href="https://github.com/jams24/DSA" className="hover:text-ink">GitHub</a>
              </div>
            </div>
          </footer>
          <Toaster />
          <LevelUpModal />
        </GameProvider>
      </body>
    </html>
  );
}
