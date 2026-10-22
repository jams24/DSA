import { z } from "zod";

const choice = z.number().int().min(-1).max(12);
const graded = z.object({ id: z.string().max(160), choice });

export const ActionRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("read"), lessonKey: z.string().max(120) }),
  z.object({ type: z.literal("visualize"), lessonKey: z.string().max(120) }),
  z.object({ type: z.literal("quiz"), lessonKey: z.string().max(120), answers: z.array(choice).max(40) }),
  z.object({ type: z.literal("boss"), worldId: z.string().max(60), answers: z.array(graded).max(20) }),
  z.object({ type: z.literal("arena"), answers: z.array(graded).max(150) }),
  z.object({ type: z.literal("daily"), answers: z.array(choice).max(20) }),
  z.object({ type: z.literal("review"), cardId: z.string().max(200), knew: z.boolean() }),
  z.object({ type: z.literal("solve"), slug: z.string().max(120), solved: z.boolean() }),
]);
export type ActionRequest = z.infer<typeof ActionRequest>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const GuestState = z.object({
  xp: z.number().default(0),
  streak: z.number().default(0),
  bestStreak: z.number().default(0),
  lastActiveDay: day.nullable().default(null),
  progress: z
    .record(
      z.string().max(120),
      z.object({
        read: z.boolean().default(false),
        visualized: z.boolean().default(false),
        bestScore: z.number().default(0),
        stars: z.number().default(0),
        completedAt: z.string().max(40).nullable().optional(),
      }),
    )
    .default({}),
  achievements: z.array(z.string().max(80)).max(200).default([]),
  cards: z
    .record(z.string().max(200), z.object({ box: z.number(), dueAt: z.string().max(40), reviews: z.number() }))
    .default({}),
  stats: z
    .object({
      arenaCorrect: z.number().optional(),
      dailyCount: z.number().optional(),
      reviews: z.number().optional(),
      claims: z.array(z.string().max(40)).max(60).optional(),
      solved: z.array(z.string().max(120)).max(200).optional(),
    })
    .default({}),
});
export type GuestState = z.infer<typeof GuestState>;

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only");

export const AVATARS = ["wizard", "knight", "ninja", "robot", "alien", "dragon", "fox", "astronaut"] as const;

export const SignupRequest = z.object({
  username,
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  avatar: z.enum(AVATARS).default("wizard"),
  guest: z.unknown().optional(),
});

export const LoginRequest = z.object({
  // username or email address
  username: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(100),
  guest: z.unknown().optional(),
});

export const ProfileRequest = z.object({ avatar: z.enum(AVATARS) });
