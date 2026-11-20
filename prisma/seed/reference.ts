/**
 * Reference data every installation needs. Safe to run repeatedly (upserts),
 * including in production: it never deletes or overwrites user data.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { DecorationKind, Role, ScoringMode } from "../../generated/prisma/enums";
import { hashPassword } from "../../lib/auth/password";
import { BUILDINGS } from "../../lib/domain/buildings";

/** Achievements from spec §6 plus two that reward effort. `rule` is evaluated in Stage 8. */
export const ACHIEVEMENTS = [
  {
    key: "word_architect",
    nameKk: "Сөз сәулетшісі",
    nameRu: "Архитектор слова",
    descriptionKk: "Алғашқы ғимаратыңды салдың",
    descriptionRu: "Построено первое здание",
    icon: "pencil-ruler",
    color: "sky",
    rule: { type: "buildings_built", count: 1, minLevel: 1 },
  },
  {
    key: "spelling_master",
    nameKk: "Емле шебері",
    nameRu: "Мастер орфографии",
    descriptionKk: "Грамматика сарайы 5-деңгейге жетті",
    descriptionRu: "Дворец грамматики достиг 5-го уровня",
    icon: "spell-check",
    color: "violet",
    rule: { type: "building_level", building: "grammar", level: 5 },
  },
  {
    key: "literature_researcher",
    nameKk: "Әдебиет зерттеушісі",
    nameRu: "Исследователь литературы",
    descriptionKk: "Театр мен кітапхана 3-деңгейден жоғары",
    descriptionRu: "Театр и библиотека — 3-й уровень и выше",
    icon: "book-open-text",
    color: "grass",
    rule: { type: "buildings_level", buildings: ["theatre", "library"], level: 3 },
  },
  {
    key: "chief_architect",
    nameKk: "Сөзқаланың бас сәулетшісі",
    nameRu: "Главный архитектор Словограда",
    descriptionKk: "Барлық 8 ғимарат 3-деңгейден жоғары",
    descriptionRu: "Все 8 зданий — 3-й уровень и выше",
    icon: "crown",
    color: "sun",
    rule: { type: "all_buildings", level: 3 },
  },
  {
    key: "perfect_ten",
    nameKk: "Мінсіз ондық",
    nameRu: "Идеальная десятка",
    descriptionKk: "Тапсырманы 10 балға орындадың",
    descriptionRu: "Задание выполнено на 10 баллов",
    icon: "sparkles",
    color: "violet",
    rule: { type: "perfect_score" },
  },
  {
    key: "persistent_builder",
    nameKk: "Табанды құрылысшы",
    nameRu: "Упорный строитель",
    descriptionKk: "Қайта орындап, нәтижеңді жақсарттың",
    descriptionRu: "Улучшил результат при повторной попытке",
    icon: "hammer",
    color: "coral",
    rule: { type: "improved_retake" },
  },
] as const;

/** Spec §6: tree, flower, road, bench, lamp, fountain. Prices are in building materials. */
export const DECORATIONS = [
  { key: "tree_round", kind: DecorationKind.TREE, nameKk: "Емен", nameRu: "Дуб", costMaterials: 10 },
  { key: "tree_pine", kind: DecorationKind.TREE, nameKk: "Шырша", nameRu: "Ель", costMaterials: 10 },
  { key: "flower_bed", kind: DecorationKind.FLOWER, nameKk: "Гүлзар", nameRu: "Клумба", costMaterials: 8 },
  { key: "road_tile", kind: DecorationKind.ROAD, nameKk: "Жаяу жол", nameRu: "Дорожка", costMaterials: 4 },
  { key: "bench", kind: DecorationKind.BENCH, nameKk: "Орындық", nameRu: "Скамейка", costMaterials: 12 },
  { key: "lamp", kind: DecorationKind.LAMP, nameKk: "Шам", nameRu: "Фонарь", costMaterials: 15 },
  { key: "fountain", kind: DecorationKind.FOUNTAIN, nameKk: "Субұрқақ", nameRu: "Фонтан", costMaterials: 40 },
] as const;

/** Must match lib/settings.ts (every key there is enforced by the app; /admin/settings edits them). */
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  "registration.studentsByInviteCode": true,
  "scoring.defaultMode": ScoringMode.BEST,
  "auth.maxLoginFailures": 5,
};

export async function seedReference(db: PrismaClient) {
  for (const [i, b] of BUILDINGS.entries()) {
    const data = {
      nameKk: b.name.kk,
      nameRu: b.name.ru,
      areaKk: b.area.kk,
      areaRu: b.area.ru,
      icon: b.icon,
      sortOrder: i + 1,
      mapCol: b.map.col,
      mapRow: b.map.row,
    };
    await db.buildingType.upsert({ where: { key: b.key }, update: data, create: { key: b.key, ...data } });
  }

  for (const [i, a] of ACHIEVEMENTS.entries()) {
    const data = { ...a, rule: a.rule, sortOrder: i + 1 };
    await db.achievement.upsert({ where: { key: a.key }, update: data, create: data });
  }

  for (const [i, d] of DECORATIONS.entries()) {
    const data = { ...d, sortOrder: i + 1 };
    await db.decoration.upsert({ where: { key: d.key }, update: data, create: data });
  }

  // Platform-wide certificate thresholds (classId = null). Classes may override.
  if (!(await db.certificatePolicy.findFirst({ where: { classId: null } }))) {
    await db.certificatePolicy.create({ data: {} });
  }

  if ((await db.certificateTemplate.count()) === 0) {
    await db.certificateTemplate.create({
      data: {
        name: "Default",
        titleKk: "СӨЗҚАЛАНЫҢ БАС СӘУЛЕТШІСІ",
        titleRu: "ГЛАВНЫЙ АРХИТЕКТОР СЛОВОГРАДА",
        design: { orientation: "landscape", accent: "#00AFCA", skyline: true },
      },
    });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  }

  // First administrator. Created once; its password is never reset by the seed.
  const adminLogin = process.env.SEED_ADMIN_LOGIN ?? "admin";
  if (!(await db.user.findUnique({ where: { login: adminLogin } }))) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
    await db.user.create({
      data: {
        login: adminLogin,
        passwordHash: await hashPassword(password),
        role: Role.ADMIN,
        firstName: "Әкімші",
        lastName: "Сөзқала",
      },
    });
    console.log(`  admin user "${adminLogin}" created`);
  }

  console.log(
    `  reference: ${BUILDINGS.length} buildings, ${ACHIEVEMENTS.length} achievements, ${DECORATIONS.length} decorations`,
  );
}
