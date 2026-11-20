/**
 * The 8 learning buildings (spec §3). Single source for the seed and the UI.
 * Keys, names and map positions match design/iso/buildings.js (Stage 0 art).
 */
export const BUILDING_KEYS = [
  "grammar",
  "bridge",
  "library",
  "theatre",
  "tower",
  "academy",
  "park",
  "townhall",
] as const;

export type BuildingKey = (typeof BUILDING_KEYS)[number];

export type BuildingInfo = {
  key: BuildingKey;
  name: { kk: string; ru: string };
  area: { kk: string; ru: string };
  /** lucide icon name */
  icon: string;
  /** Position on the 3×3 city map (the corner [2,2] is the welcome square). */
  map: { col: number; row: number };
};

export const BUILDINGS: readonly BuildingInfo[] = [
  {
    key: "grammar",
    name: { kk: "Грамматика сарайы", ru: "Дворец грамматики" },
    area: { kk: "Емле және грамматика", ru: "Орфография и грамматика" },
    icon: "spell-check",
    map: { col: 1, row: 2 },
  },
  {
    key: "bridge",
    name: { kk: "Сөйлемдер көпірі", ru: "Мост предложений" },
    area: { kk: "Синтаксис және тыныс белгілері", ru: "Синтаксис и пунктуация" },
    icon: "git-commit-horizontal",
    map: { col: 2, row: 1 },
  },
  {
    key: "library",
    name: { kk: "Білім кітапханасы", ru: "Библиотека знаний" },
    area: { kk: "Оқу және мәтінді талдау", ru: "Чтение и анализ текста" },
    icon: "library",
    map: { col: 2, row: 0 },
  },
  {
    key: "theatre",
    name: { kk: "Кейіпкерлер театры", ru: "Театр героев" },
    area: { kk: "Әдеби кейіпкерлер мен олардың іс-әрекеті", ru: "Литературные герои и их поступки" },
    icon: "drama",
    map: { col: 0, row: 1 },
  },
  {
    key: "tower",
    name: { kk: "Сөздер мұнарасы", ru: "Башня слов" },
    area: { kk: "Лексика және фразеология", ru: "Лексика и фразеология" },
    icon: "castle",
    map: { col: 1, row: 0 },
  },
  {
    key: "academy",
    name: { kk: "Шығармашылық академиясы", ru: "Академия творчества" },
    area: { kk: "Эссе және шығармашылық жұмыс", ru: "Эссе и творческие работы" },
    icon: "palette",
    map: { col: 0, row: 2 },
  },
  {
    key: "park",
    name: { kk: "Поэзия саябағы", ru: "Парк поэзии" },
    area: { kk: "Өлең және көркемдегіш құралдар", ru: "Стихи и средства выразительности" },
    icon: "feather",
    map: { col: 0, row: 0 },
  },
  {
    key: "townhall",
    name: { kk: "Білім ратушасы", ru: "Ратуша знаний" },
    area: { kk: "Қорытынды тапсырмалар", ru: "Итоговые задания" },
    icon: "landmark",
    map: { col: 1, row: 1 },
  },
];

export const isBuildingKey = (v: string): v is BuildingKey => (BUILDING_KEYS as readonly string[]).includes(v);
