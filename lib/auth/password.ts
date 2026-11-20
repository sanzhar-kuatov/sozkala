/**
 * Password hashing (spec §11 "passwords stored in protected form").
 * Argon2id via @node-rs/argon2 (prebuilt binaries, no native build step).
 * Not marked `server-only` because the seed script (plain Node) uses it too;
 * never import it from a Client Component.
 */
import { hash, verify } from "@node-rs/argon2";

/** OWASP-recommended Argon2id baseline: 19 MiB memory, 2 iterations, 1 lane. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // malformed hash → treat as a failed login, never throw
  }
}
