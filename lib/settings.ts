import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Platform settings (spec §2.4) stored in PlatformSetting as JSON values.
 * Every setting here is enforced somewhere in the app — no decorative switches:
 *  - registration.studentsByInviteCode → /join pages and actions
 *  - scoring.defaultMode               → building settings of a newly created class
 *  - auth.maxLoginFailures             → login throttling (lib/auth/actions.ts)
 */
export const SETTING_SCHEMAS = {
  "registration.studentsByInviteCode": z.boolean(),
  "scoring.defaultMode": z.enum(["BEST", "AVERAGE", "REQUIRED_ONLY"]),
  "auth.maxLoginFailures": z.number().int().min(3).max(20),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTING_SCHEMAS)[K]> };

export const DEFAULT_SETTINGS: Settings = {
  "registration.studentsByInviteCode": true,
  "scoring.defaultMode": "BEST",
  "auth.maxLoginFailures": 5,
};

const KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

/** All settings, falling back to the default for missing or malformed rows. */
export async function getSettings(): Promise<Settings> {
  const rows = await db.platformSetting.findMany({ where: { key: { in: KEYS } } });
  const out = { ...DEFAULT_SETTINGS } as Record<SettingKey, unknown>;
  for (const row of rows) {
    const parsed = SETTING_SCHEMAS[row.key as SettingKey].safeParse(row.value);
    if (parsed.success) out[row.key as SettingKey] = parsed.data;
  }
  return out as Settings;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

export async function saveSettings(values: Settings) {
  await db.$transaction(
    KEYS.map((key) =>
      db.platformSetting.upsert({
        where: { key },
        update: { value: values[key] as never },
        create: { key, value: values[key] as never },
      }),
    ),
  );
}
