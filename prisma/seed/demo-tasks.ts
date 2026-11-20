/**
 * Demo learning content (Russian, spec: content language). Covers all 12 task
 * types and all 8 buildings. Every task is validated with lib/tasks/schemas.ts
 * by the seed, so this file doubles as a reference for the JSON shapes.
 */
import { TaskType } from "../../generated/prisma/enums";
import type { BuildingKey } from "../../lib/domain/buildings";
import type { TaskTypeValue } from "../../lib/tasks/schemas";

export type DemoTopic = { key: string; building: BuildingKey; title: string; description?: string };

export type DemoTask = {
  key: string;
  topic: string;
  building: BuildingKey;
  type: TaskTypeValue;
  title: string;
  instruction: string;
  content: unknown;
  answerKey?: unknown;
  criteria?: unknown;
  explanation?: string;
  difficulty: 1 | 2 | 3;
  timeLimitSec?: number;
  maxAttempts?: number;
  /** Required for the class (●) or optional extra task (○). */
  required: boolean;
};

export const DEMO_TOPICS: DemoTopic[] = [
  { key: "nn", building: "grammar", title: "Н и НН в прилагательных" },
  { key: "prefixes", building: "grammar", title: "Приставки ПРЕ- и ПРИ-" },
  { key: "complex", building: "bridge", title: "Сложное предложение" },
  { key: "reading", building: "library", title: "Анализ текста" },
  { key: "captains-daughter", building: "theatre", title: "Герои повести «Капитанская дочка»" },
  { key: "phraseology", building: "tower", title: "Фразеологизмы и лексическое значение" },
  { key: "essay", building: "academy", title: "Сочинение и творческая работа" },
  { key: "expressive", building: "park", title: "Средства выразительности" },
  { key: "final", building: "townhall", title: "Итоговое повторение" },
];

const LIGHTHOUSE =
  "Каждое утро старый смотритель маяка поднимался по узкой винтовой лестнице. Он знал каждую из ста двадцати ступеней и мог бы пройти их с закрытыми глазами. Наверху он протирал стёкла, проверял фонарь и подолгу смотрел на море. Корабли проходили далеко, и никто из моряков не знал его имени, но каждую ночь его свет указывал им путь.";

const CHARACTERS = [
  { id: "grinev", text: "Пётр Гринёв" },
  { id: "shvabrin", text: "Алексей Швабрин" },
  { id: "savelich", text: "Савельич" },
  { id: "pugachev", text: "Емельян Пугачёв" },
  { id: "mironov", text: "Иван Кузьмич Миронов" },
];

const DEVICES = [
  { id: "personification", text: "олицетворение" },
  { id: "epithet", text: "эпитет" },
  { id: "simile", text: "сравнение" },
  { id: "hyperbole", text: "гипербола" },
];

const COMPLEX_KINDS = [
  { id: "ssp", text: "сложносочинённое" },
  { id: "spp", text: "сложноподчинённое" },
  { id: "bsp", text: "бессоюзное" },
];

export const DEMO_TASKS: DemoTask[] = [
  // ------------------------------------------------------------ grammar
  {
    key: "nn-adjectives",
    topic: "nn",
    building: "grammar",
    type: TaskType.MULTIPLE_CHOICE,
    title: "Н или НН?",
    instruction: "Отметьте все подходящие варианты.",
    difficulty: 2,
    timeLimitSec: 600,
    maxAttempts: 3,
    required: true,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Выберите слова, в которых пишется НН.",
          options: [
            { id: "a", text: "деревя..ый" },
            { id: "b", text: "серебря..ый" },
            { id: "c", text: "стекля..ый" },
            { id: "d", text: "кожа..ый" },
          ],
        },
        {
          id: "q2",
          prompt: "Выберите слова, в которых пишется НН.",
          options: [
            { id: "a", text: "осе..ий" },
            { id: "b", text: "ветре..ый (день)" },
            { id: "c", text: "лимо..ый" },
            { id: "d", text: "ю..ый" },
          ],
        },
        {
          id: "q3",
          prompt: "Выберите слова, в которых пишется одна Н.",
          options: [
            { id: "a", text: "гуси..ый" },
            { id: "b", text: "карма..ый" },
            { id: "c", text: "соломе..ый" },
            { id: "d", text: "свино..ой" },
          ],
        },
      ],
    },
    answerKey: { q1: { correct: ["a", "c"] }, q2: { correct: ["a", "c"] }, q3: { correct: ["a", "d"] } },
    explanation:
      "В суффиксах -АН-, -ЯН-, -ИН- пишется одна Н (кожаный, серебряный, гусиный), кроме слов-исключений стеклянный, оловянный, деревянный. В суффиксе -ЕНН- (осенний, соломенный) и когда корень оканчивается на Н, а суффикс -Н- (лимонный, карманный), пишется НН. Ветреный — исключение, пишется одна Н.",
  },
  {
    key: "pre-pri",
    topic: "prefixes",
    building: "grammar",
    type: TaskType.FILL_GAPS,
    title: "ПРЕ- или ПРИ-?",
    instruction: "Вставьте пропущенную букву.",
    difficulty: 1,
    timeLimitSec: 300,
    maxAttempts: 3,
    required: false,
    content: {
      questions: [
        { id: "q1", prompt: "Вставьте букву.", text: "пр[[g1]]красный день", bank: ["е", "и"] },
        { id: "q2", prompt: "Вставьте букву.", text: "пр[[g1]]ехать в город", bank: ["е", "и"] },
        { id: "q3", prompt: "Вставьте букву.", text: "пр[[g1]]одолеть трудности", bank: ["е", "и"] },
        { id: "q4", prompt: "Вставьте букву.", text: "пр[[g1]]клеить марку", bank: ["е", "и"] },
      ],
    },
    answerKey: {
      q1: { gaps: { g1: ["е"] } },
      q2: { gaps: { g1: ["и"] } },
      q3: { gaps: { g1: ["е"] } },
      q4: { gaps: { g1: ["и"] } },
    },
    explanation:
      "ПРЕ- имеет значение «очень» или близко к «пере-» (прекрасный, преодолеть). ПРИ- обозначает приближение, присоединение или неполноту действия (приехать, приклеить).",
  },

  // ------------------------------------------------------------ bridge
  {
    key: "commas-spp",
    topic: "complex",
    building: "bridge",
    type: TaskType.PUNCTUATION,
    title: "Запятые в сложноподчинённом предложении",
    instruction: "Нажмите на промежуток между словами и поставьте нужный знак.",
    difficulty: 2,
    timeLimitSec: 600,
    maxAttempts: 3,
    required: true,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Расставьте знаки препинания.",
          tokens: ["Когда", "солнце", "село", "мы", "пошли", "домой."],
          marks: [",", "—", ":"],
        },
        {
          id: "q2",
          prompt: "Расставьте знаки препинания.",
          tokens: ["Я", "знаю", "что", "ты", "придёшь", "вовремя."],
          marks: [",", "—", ":"],
        },
        {
          id: "q3",
          prompt: "Расставьте знаки препинания.",
          tokens: ["Дом", "в", "котором", "я", "живу", "стоит", "у", "реки."],
          marks: [",", "—", ":"],
        },
      ],
    },
    answerKey: { q1: { marks: { "2": "," } }, q2: { marks: { "1": "," } }, q3: { marks: { "0": ",", "4": "," } } },
    explanation: "Придаточная часть сложноподчинённого предложения отделяется от главной запятыми с обеих сторон.",
  },
  {
    key: "word-order",
    topic: "complex",
    building: "bridge",
    type: TaskType.WORD_ORDER,
    title: "Составьте предложение",
    instruction: "Расставьте слова в правильном порядке.",
    difficulty: 1,
    timeLimitSec: 300,
    maxAttempts: 3,
    required: true,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Составьте предложение.",
          tokens: [
            { id: "t1", text: "осенью" },
            { id: "t2", text: "Ранней" },
            { id: "t3", text: "лес" },
            { id: "t4", text: "золотым." },
            { id: "t5", text: "становится" },
          ],
        },
        {
          id: "q2",
          prompt: "Составьте предложение.",
          tokens: [
            { id: "t1", text: "мы" },
            { id: "t2", text: "в" },
            { id: "t3", text: "библиотеку." },
            { id: "t4", text: "пошли" },
            { id: "t5", text: "После" },
            { id: "t6", text: "уроков" },
          ],
        },
      ],
    },
    answerKey: { q1: { order: ["t2", "t1", "t3", "t5", "t4"] }, q2: { order: ["t5", "t6", "t1", "t4", "t2", "t3"] } },
    explanation: "Предложение начинается с заглавной буквы и заканчивается точкой — это подсказка к порядку слов.",
  },
  {
    key: "complex-kinds",
    topic: "complex",
    building: "bridge",
    type: TaskType.SINGLE_CHOICE,
    title: "Виды сложных предложений",
    instruction: "Выберите один правильный ответ.",
    difficulty: 2,
    timeLimitSec: 300,
    maxAttempts: 3,
    required: false,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Определите вид предложения: «Наступила весна, и прилетели птицы».",
          options: COMPLEX_KINDS,
        },
        { id: "q2", prompt: "Определите вид предложения: «Я понял, что опоздал».", options: COMPLEX_KINDS },
        { id: "q3", prompt: "Определите вид предложения: «Светит солнце: наступило лето».", options: COMPLEX_KINDS },
      ],
    },
    answerKey: { q1: { correct: "ssp" }, q2: { correct: "spp" }, q3: { correct: "bsp" } },
    explanation:
      "Сложносочинённое — части связаны сочинительным союзом (и, а, но); сложноподчинённое — подчинительным (что, когда, который); в бессоюзном союза нет.",
  },

  // ------------------------------------------------------------ library
  {
    key: "lighthouse",
    topic: "reading",
    building: "library",
    type: TaskType.TEXT_ANALYSIS,
    title: "Смотритель маяка",
    instruction: "Прочитайте текст и ответьте на вопросы.",
    difficulty: 2,
    timeLimitSec: 900,
    maxAttempts: 3,
    required: true,
    content: {
      passage: LIGHTHOUSE,
      questions: [
        {
          id: "q1",
          prompt: "Какова основная мысль текста?",
          options: [
            { id: "a", text: "Незаметный труд бывает очень важен для других людей." },
            { id: "b", text: "Работа на маяке скучная и однообразная." },
            { id: "c", text: "Моряки не уважают смотрителя маяка." },
            { id: "d", text: "Лестница на маяке слишком длинная." },
          ],
        },
        { id: "q2", prompt: "Сколько ступеней было на лестнице маяка? Ответ запишите числом." },
        {
          id: "q3",
          prompt: "К какому типу речи относится текст?",
          options: [
            { id: "a", text: "повествование с элементами описания" },
            { id: "b", text: "рассуждение" },
            { id: "c", text: "только описание" },
          ],
        },
      ],
    },
    answerKey: { q1: { correct: "a" }, q2: { accepted: ["120", "сто двадцать"] }, q3: { correct: "a" } },
    explanation:
      "В тексте рассказывается о последовательных действиях смотрителя (повествование) и есть детали обстановки (описание). Последнее предложение раскрывает главную мысль: о человеке не знают, но его труд спасает других.",
  },

  // ------------------------------------------------------------ theatre
  {
    key: "captains-daughter-heroes",
    topic: "captains-daughter",
    building: "theatre",
    type: TaskType.CHARACTER_ID,
    title: "Узнай героя",
    instruction: "По описанию определите героя повести.",
    difficulty: 2,
    timeLimitSec: 600,
    maxAttempts: 3,
    required: true,
    content: {
      source: "А. С. Пушкин, «Капитанская дочка»",
      questions: [
        {
          id: "q1",
          prompt:
            "Верный слуга и дядька главного героя. Заботится о барине, ворчит, бережёт его добро и готов ради него на всё.",
          options: CHARACTERS,
        },
        {
          id: "q2",
          prompt:
            "Молодой дворянин, от лица которого ведётся рассказ. Отец отправил его служить в дальнюю крепость с наказом беречь честь смолоду.",
          options: CHARACTERS,
        },
        {
          id: "q3",
          prompt: "Офицер, переведённый в крепость за дуэль. Завистлив и коварен, переходит на сторону бунтовщиков.",
          options: CHARACTERS,
        },
        {
          id: "q4",
          prompt: "Предводитель восстания, который помнит добро и милует героя за подаренный когда-то заячий тулуп.",
          options: CHARACTERS,
        },
      ],
    },
    answerKey: {
      q1: { correct: "savelich" },
      q2: { correct: "grinev" },
      q3: { correct: "shvabrin" },
      q4: { correct: "pugachev" },
    },
    explanation:
      "Савельич — преданный слуга Гринёва; Пётр Гринёв — рассказчик; Швабрин — его соперник и изменник; Пугачёв помнит заячий тулуп, подаренный ему Гринёвым.",
  },

  // ------------------------------------------------------------ tower
  {
    key: "idioms",
    topic: "phraseology",
    building: "tower",
    type: TaskType.MATCHING,
    title: "Фразеологизмы",
    instruction: "Соедините фразеологизм с его значением.",
    difficulty: 2,
    timeLimitSec: 600,
    maxAttempts: 3,
    required: true,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Найдите пары.",
          left: [
            { id: "f1", text: "бить баклуши" },
            { id: "f2", text: "зарубить на носу" },
            { id: "f3", text: "водить за нос" },
            { id: "f4", text: "как с гуся вода" },
            { id: "f5", text: "спустя рукава" },
          ],
          right: [
            { id: "m1", text: "обманывать" },
            { id: "m2", text: "бездельничать" },
            { id: "m3", text: "небрежно, кое-как" },
            { id: "m4", text: "запомнить надолго" },
            { id: "m5", text: "всё нипочём" },
          ],
        },
      ],
    },
    answerKey: { q1: { pairs: { f1: "m2", f2: "m4", f3: "m1", f4: "m5", f5: "m3" } } },
    explanation:
      "Фразеологизм — устойчивое сочетание слов, значение которого не складывается из значений отдельных слов.",
  },
  {
    key: "lexical-meaning",
    topic: "phraseology",
    building: "tower",
    type: TaskType.SINGLE_CHOICE,
    title: "Синонимы, антонимы, значение слова",
    instruction: "Выберите один правильный ответ.",
    difficulty: 1,
    timeLimitSec: 300,
    maxAttempts: 3,
    required: false,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Подберите синоним к слову «смелый».",
          options: [
            { id: "a", text: "храбрый" },
            { id: "b", text: "робкий" },
            { id: "c", text: "хитрый" },
          ],
        },
        {
          id: "q2",
          prompt: "Подберите антоним к слову «щедрый».",
          options: [
            { id: "a", text: "добрый" },
            { id: "b", text: "скупой" },
            { id: "c", text: "богатый" },
          ],
        },
        {
          id: "q3",
          prompt: "Что означает слово «рутина»?",
          options: [
            { id: "a", text: "праздник" },
            { id: "b", text: "редкое событие" },
            { id: "c", text: "однообразная привычная работа" },
          ],
        },
      ],
    },
    answerKey: { q1: { correct: "a" }, q2: { correct: "b" }, q3: { correct: "c" } },
    explanation: "Синонимы близки по значению, антонимы противоположны по значению.",
  },

  // ------------------------------------------------------------ academy
  {
    key: "essay-hero",
    topic: "essay",
    building: "academy",
    type: TaskType.ESSAY,
    title: "Эссе «Мой любимый литературный герой»",
    instruction: "Напишите эссе объёмом 80–150 слов.",
    difficulty: 3,
    maxAttempts: 2,
    required: true,
    content: {
      questions: [
        {
          id: "q1",
          prompt:
            "Расскажите о своём любимом литературном герое. Объясните, чем он вам близок, и приведите пример его поступка из произведения.",
          minWords: 80,
          maxWords: 150,
        },
      ],
    },
    criteria: [
      { id: "content", title: "Содержание и аргументы", max: 4 },
      { id: "literacy", title: "Грамотность", max: 3 },
      { id: "structure", title: "Композиция", max: 3 },
    ],
    explanation: "Хорошее эссе: тезис во вступлении, 1–2 аргумента с примером из текста, вывод.",
  },
  {
    key: "creative-lighthouse",
    topic: "essay",
    building: "academy",
    type: TaskType.CREATIVE,
    title: "Продолжение истории",
    instruction: "Придумайте продолжение истории (не меньше 60 слов).",
    difficulty: 2,
    maxAttempts: 2,
    required: false,
    content: {
      passage: LIGHTHOUSE,
      questions: [
        {
          id: "q1",
          prompt: "Что случилось однажды ночью, когда свет маяка погас? Придумайте продолжение истории.",
          minWords: 60,
        },
      ],
    },
    criteria: [
      { id: "idea", title: "Замысел и сюжет", max: 4 },
      { id: "language", title: "Выразительность речи", max: 3 },
      { id: "literacy", title: "Грамотность", max: 3 },
    ],
  },

  // ------------------------------------------------------------ park
  {
    key: "devices",
    topic: "expressive",
    building: "park",
    type: TaskType.SINGLE_CHOICE,
    title: "Средства выразительности",
    instruction: "Определите средство выразительности.",
    difficulty: 1,
    timeLimitSec: 300,
    maxAttempts: 3,
    required: true,
    content: {
      questions: [
        { id: "q1", prompt: "«Шепчет ветер в тишине»", options: DEVICES },
        { id: "q2", prompt: "«Золотая осень»", options: DEVICES },
        { id: "q3", prompt: "«Глаза, как море»", options: DEVICES },
        { id: "q4", prompt: "«Я сто раз тебе говорил!»", options: DEVICES },
      ],
    },
    answerKey: {
      q1: { correct: "personification" },
      q2: { correct: "epithet" },
      q3: { correct: "simile" },
      q4: { correct: "hyperbole" },
    },
    explanation:
      "Олицетворение — неживое наделяется свойствами живого; эпитет — образное определение; сравнение — сопоставление с помощью «как», «словно»; гипербола — преувеличение.",
  },
  {
    key: "reading-aloud",
    topic: "expressive",
    building: "park",
    type: TaskType.AUDIO,
    title: "Выразительное чтение",
    instruction: "Прочитайте отрывок выразительно и запишите аудио.",
    difficulty: 2,
    maxAttempts: 2,
    required: true,
    content: {
      source: "А. С. Пушкин, «Зимнее утро»",
      questions: [
        {
          id: "q1",
          prompt: "Выразительно прочитайте отрывок стихотворения.",
          readText:
            "Мороз и солнце; день чудесный!\nЕщё ты дремлешь, друг прелестный —\nПора, красавица, проснись:\nОткрой сомкнуты негой взоры",
          maxSeconds: 120,
        },
      ],
    },
    criteria: [
      { id: "expression", title: "Выразительность", max: 4 },
      { id: "pronunciation", title: "Правильность произношения", max: 3 },
      { id: "pace", title: "Темп и паузы", max: 3 },
    ],
  },

  // ------------------------------------------------------------ townhall
  {
    key: "final-errors",
    topic: "final",
    building: "townhall",
    type: TaskType.ERROR_CORRECTION,
    title: "Итоговая работа: исправьте ошибки",
    instruction: "В каждом предложении одна ошибка. Нажмите на неверное слово и исправьте его.",
    difficulty: 3,
    timeLimitSec: 900,
    maxAttempts: 2,
    required: true,
    content: {
      questions: [
        {
          id: "q1",
          prompt: "Найдите и исправьте ошибку.",
          tokens: ["Вчера", "мы", "ходили", "в", "музей", "и", "видили", "старинные", "картины."],
        },
        {
          id: "q2",
          prompt: "Найдите и исправьте ошибку.",
          tokens: ["Ученики", "внимательно", "слушали", "учителя", "и", "записывали", "новые", "правилла."],
        },
        {
          id: "q3",
          prompt: "Найдите и исправьте ошибку.",
          tokens: ["Мы", "встретились", "около", "школьной", "калитке."],
        },
      ],
    },
    answerKey: {
      q1: { fixes: { "6": ["видели"] } },
      q2: { fixes: { "7": ["правила.", "правила"] } },
      q3: { fixes: { "4": ["калитки.", "калитки"] } },
    },
    explanation:
      "Видели — проверочное слово «вид». Правило пишется с одной Л. «Около» требует родительного падежа: около (чего?) калитки.",
  },
];
