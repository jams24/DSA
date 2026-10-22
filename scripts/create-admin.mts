// Creates (or promotes) an admin account. Credentials come from the environment, never the repo:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' [ADMIN_USERNAME=name] npm run create-admin
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !email.includes("@") || !password || password.length < 8) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 8 characters).");
  process.exit(1);
}
const username = (process.env.ADMIN_USERNAME ?? email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20);

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 10);
const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
const user = existing
  ? await prisma.user.update({ where: { id: existing.id }, data: { email, role: "admin", passwordHash } })
  : await prisma.user.create({ data: { username, email, passwordHash, role: "admin", avatar: "wizard" } });
console.log(`${existing ? "Updated" : "Created"} admin "${user.username}" (${user.email}). Sign in with the username or the email.`);
await prisma.$disconnect();
