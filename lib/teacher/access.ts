import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { AuthError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Teacher-side authorization. A teacher manages only their own classes, the
 * students in them and the tasks they authored; an admin may manage everything.
 */

export async function teacherClassIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.role === "ADMIN") return "all";
  return (await db.schoolClass.findMany({ where: { teacherId: user.id }, select: { id: true } })).map((c) => c.id);
}

/** Throws FORBIDDEN unless the user teaches this class (or is an admin). */
export async function assertTeachesClass(user: SessionUser, classId: string) {
  if (user.role === "ADMIN") return;
  const klass = await db.schoolClass.findFirst({ where: { id: classId, teacherId: user.id }, select: { id: true } });
  if (!klass) throw new AuthError("FORBIDDEN");
}

/** Throws FORBIDDEN unless the user authored the task (or is an admin). */
export async function assertOwnsTask(user: SessionUser, taskId: string) {
  if (user.role === "ADMIN") return;
  const task = await db.task.findFirst({ where: { id: taskId, authorId: user.id }, select: { id: true } });
  if (!task) throw new AuthError("FORBIDDEN");
}

/** Throws FORBIDDEN unless the student is in one of the user's classes. */
export async function assertTeachesStudent(user: SessionUser, studentId: string) {
  if (user.role === "ADMIN") return;
  const m = await db.classMember.findFirst({
    where: { studentId, class: { teacherId: user.id } },
    select: { studentId: true },
  });
  if (!m) throw new AuthError("FORBIDDEN");
}

/* ---------------------------------------------------------------- helpers */

// No 0/O/1/I/L — easy to read aloud and to type from a board.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 6-character class invite code, unique. */
export async function newInviteCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    if (!(await db.schoolClass.findUnique({ where: { inviteCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("could not generate a unique invite code");
}

/** Readable one-time password for accounts a teacher creates, e.g. "kitap-4821". */
export function temporaryPassword(): string {
  const words = ["kala", "kitap", "soz", "aspan", "kun", "zhuldyz", "tau", "ozen", "gul", "bulak"];
  return `${words[randomInt(words.length)]}-${randomInt(1000, 10000)}`;
}

const TRANSLIT: Record<string, string> = {
  а: "a",
  ә: "a",
  б: "b",
  в: "v",
  г: "g",
  ғ: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  і: "i",
  к: "k",
  қ: "k",
  л: "l",
  м: "m",
  н: "n",
  ң: "n",
  о: "o",
  ө: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ұ: "u",
  ү: "u",
  ф: "f",
  х: "h",
  һ: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Unique login from a name: "Аружан Қасымова" → "aruzhan.k" (then aruzhan.k2, …). */
export async function suggestLogin(firstName: string, lastName: string): Promise<string> {
  const latin = (s: string) =>
    [...s.toLowerCase()].map((ch) => TRANSLIT[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "")).join("");
  const base = `${latin(firstName) || "student"}.${latin(lastName).slice(0, 1) || "x"}`.slice(0, 28);
  for (let n = 1; n < 1000; n++) {
    const login = n === 1 ? base : `${base}${n}`;
    if (!(await db.user.findUnique({ where: { login }, select: { id: true } }))) return login;
  }
  return `${base}${randomBytes(3).toString("hex")}`;
}
