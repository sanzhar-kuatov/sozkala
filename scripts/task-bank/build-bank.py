"""
Builds content/task-bank/*.json from the task documents in docs/ (01–04 *.docx).

    python scripts/task-bank/build-bank.py            # reads docs/0[1-4]_*.docx, writes content/task-bank/

Each document holds "Вариант N. … K класс" sections with "1. question / Ответ: answer" pairs.
Choice tasks get wrong options from rules (sentence words, case/gender lists, punctuation
variants) and from the hand-written lists below; teacher-graded tasks (04) get the rubric.
After editing a document or a list here, rebuild, review the JSON, then import with
scripts/import-task-bank.ts.
"""
import glob, hashlib, json, os, re, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "content", "task-bank")

def read_docx(path):
    x = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    for p in re.findall(r"<w:p[ >].*?</w:p>", x, flags=re.S):
        t = "".join(re.findall(r"<w:t(?: [^>]*)?>(.*?)</w:t>", p, flags=re.S))
        t = t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
        style = re.search(r'<w:pStyle w:val="([^"]+)"', p)
        if t.strip():
            yield (style.group(1) if style else ""), t

def parse(path):
    variants, cur, q = [], None, None
    for style, line in read_docx(path):
        if style == "Heading1":
            cur = {"title": line, "notes": [], "questions": []}; variants.append(cur); continue
        if cur is None:
            continue
        m = re.match(r"(\d+)\. (.*)", line)
        if m:
            q = {"n": int(m.group(1)), "q": m.group(2)}; cur["questions"].append(q); continue
        a = re.match(r"Ответ: (.*)", line)
        if a and q:
            q["a"] = a.group(1); continue
        cur["notes"].append("[] " + line)
    return variants

docs = {os.path.basename(f)[:-5]: parse(f) for f in sorted(glob.glob(os.path.join(ROOT, "docs", "0[1-4]_*.docx")))}

def seeded_shuffle(items, seed):
    return sorted(items, key=lambda x: hashlib.sha1((seed + "|" + x).encode()).hexdigest())

def choice_q(qid, prompt, correct, distractors, seed):
    seen, opts = set(), []
    for o in [correct] + list(distractors):
        k = o.strip().lower().replace("ё", "е")
        if k in seen:
            continue
        seen.add(k)
        opts.append(o.strip())
    assert len(opts) >= 2, (qid, prompt, correct, distractors)
    order = seeded_shuffle(opts, seed)
    options = [{"id": f"o{i+1}", "text": t} for i, t in enumerate(order)]
    cid = next(o["id"] for o in options if o["text"] == correct.strip())
    return {"id": qid, "prompt": prompt, "options": options}, {"correct": cid}

def grade_of(title):
    return int(re.search(r"(\d+) класс", title).group(1))

def difficulty(grade):
    return 1 if grade <= 6 else 2 if grade <= 8 else 3

# ------------------------------------------------------------------ helpers
PREPS = {"в", "во", "на", "у", "к", "с", "со", "о", "об", "по", "из", "за", "под", "над", "при", "от", "до"}

def quoted(prompt):
    m = re.search(r"«(.+?)»", prompt)
    return m.group(1) if m else None

def sentence_words(s):
    toks = re.findall(r"[А-Яа-яЁё-]+", s)
    out, i = [], 0
    while i < len(toks):
        t = toks[i].lower()
        if t in PREPS and i + 1 < len(toks):
            out.append(t + " " + toks[i + 1].lower()); i += 2
        else:
            out.append(t); i += 1
    return out

def strip_punct(s):
    s = re.sub(r"\s*[,:—]\s*", " ", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s if s.endswith((".", "?", "!")) else s + "."

NO_MARK_AFTER = PREPS | {"и", "не", "но", "а", "ни", "или"}

def punct_variants(raw, answer):
    """Wrong punctuations of `answer` (the correctly punctuated sentence), most instructive first."""
    plain = strip_punct(answer)
    swaps, moves = [], []
    # Asyndetic sentences test colon vs dash. A comma is left out on purpose: for a
    # sequence of events ("Дверь открылась, вошёл учитель") it can be defended as correct.
    if " — " in answer:
        swaps.append(answer.replace(" — ", ": "))
    if ": " in answer:
        swaps.append(answer.replace(": ", " — "))
    words = answer.rstrip(".").split(" ")
    for i, w in enumerate(words[:-1]):
        if w[-1] == ",":  # only commas are moved; colon/dash questions are about the sign itself
            mark = w[-1]
            base = words[:i] + [w[:-1]] + words[i + 1:]
            for j in (i + 1, i - 1):
                if 0 <= j < len(base) - 1 and base[j][-1] not in ",:" and base[j].lower() not in NO_MARK_AFTER:
                    moves.append(" ".join(base[:j] + [base[j] + mark] + base[j + 1:]) + ".")
    if plain == answer:  # nothing is needed: tempting extra commas
        ws = plain.rstrip(".").split(" ")
        prefer = [j for j, w in enumerate(ws) if j > 0 and w.lower() in {"и", "но", "а", "не", "или"}]
        others = [j for j in range(1, len(ws)) if j not in prefer and ws[j - 1].lower() not in NO_MARK_AFTER]
        moves += [" ".join(ws[:j - 1] + [ws[j - 1] + ","] + ws[j:]) + "." for j in prefer + others]
    out = []
    for c in ([plain] if plain != answer else []) + swaps + moves:
        if c != answer and c not in out and ",," not in c:
            out.append(c)
    return out[:3]

CASES = ["именительный", "родительный", "дательный", "винительный", "творительный", "предложный"]
GENDERS = ["мужской", "женский", "средний"]
DECL = ["первое", "второе", "третье"]
CLAUSES = ["изъяснительное", "определительное", "причины", "условия", "цели", "времени", "места", "уступки", "следствия"]
CONFUSE = {"и": ["ы", "е"], "ы": ["и", "е"], "а": ["о", "я"], "о": ["а", "ё"], "у": ["ю", "о"],
           "е": ["и", "я"], "я": ["е", "а"], "ю": ["у", "е"]}

def gap_words(pattern, answer):
    """ж_раф + жираф → жираф, жыраф, жераф."""
    pre, post = pattern.split("_", 1)
    letter = answer[len(pre):len(answer) - len(post)] if post else answer[len(pre):]
    assert pre + letter + post == answer, (pattern, answer)
    return [pre + alt + post for alt in CONFUSE.get(letter, [])]

# ------------------------------------------------ hand-written wrong options
# key: "<doc>.<variant>.<question>"  → distractors (the correct answer comes from the document)
G = {
 # Дворец грамматики, вариант 1 (5 класс) — only used if the teacher wants it replaced
 "g.1.13": ["прилагательное", "глагол"], "g.1.14": ["существительное", "глагол"], "g.1.15": ["существительное", "прилагательное"],
 "g.1.16": ["единственное"], "g.1.17": ["мужской", "женский"],
 # вариант 2
 "g.2.1": ["лесн", "ес", "лесной"], "g.2.2": ["водн", "од", "водный"], "g.2.3": ["по-", "подпи-", "пис-"],
 "g.2.4": ["пр-", "прие-", "ех-"], "g.2.5": ["-к-", "-ок-", "-омик-"], "g.2.6": ["-ик-", "-есн-", "-сник-"],
 "g.2.7": ["-га", "-ига", "нулевое"], "g.2.8": ["-лы", "-олы", "нулевое"],
 "g.2.9": ["храбрый", "отважный", "весёлый"], "g.2.10": ["просторный", "длинный", "высокий"],
 "g.2.11": ["трусливый", "робкий", "быстрый"], "g.2.12": ["некрасивый", "уродливый", "простой"],
 "g.2.13": ["2", "4"], "g.2.14": ["2", "4"],
 "g.2.15": ["суффикс", "окончание", "основа"], "g.2.16": ["приставка", "окончание", "основа"],
 "g.2.17": ["синонимы", "омонимы", "паронимы"], "g.2.18": ["антонимы", "омонимы", "паронимы"],
 # вариант 3
 "g.3.13": ["не друг", "не-друг"], "g.3.14": ["слитно", "через дефис"], "g.1.12": ["граза", "гриза"],
 "g.3.15": ["только единственное", "единственное и множественное", "единственное"],
 "g.3.16": ["только множественное", "единственное и множественное", "множественное"],
 "g.3.17": ["поллимона", "пол лимона"], "g.3.18": ["поляблока", "пол яблока"],
 # вариант 4
 "g.4.1": ["невысокий", "не-высокий"], "g.4.2": ["не большой", "не-большой"],
 "g.4.3": ["красивый", "красива", "красивее"], "g.4.4": ["умная", "умён", "умны"],
 "g.4.5": ["превосходная", "положительная"], "g.4.6": ["сравнительная", "положительная"],
 "g.4.7": ["древне-русский", "древне русский"], "g.4.8": ["северозападный", "северо западный"],
 "g.4.9": ["количественное числительное", "собирательное числительное", "существительное"],
 "g.4.10": ["порядковое числительное", "собирательное числительное", "наречие"],
 "g.4.11": ["пятьнадцать", "петнадцать", "пятнадцат"], "g.4.12": ["пятдесят", "пятьдесять", "пядьдесят"],
 "g.4.13": ["шестсот", "шестьсто", "шесть сот"], "g.4.14": ["девяноста", "девеносто", "девятьдесят"],
 "g.4.15": ["-ого", "-го", "-него"], "g.4.16": ["-ему", "-му", "-ному"],
 "g.4.17": ["по русски", "порусски"], "g.4.18": ["по-новому", "поновому"],
 # вариант 5
 "g.5.1": ["прочитать", "считать", "читаться"], "g.5.2": ["писать", "надписать", "переписать"],
 "g.5.3": ["прочитанный"], "g.5.4": ["ведущий"],
 "g.5.5": ["не прочитанная", "не-прочитанная"], "g.5.6": ["непрочитанная мной", "не-прочитанная мной"],
 "g.5.7": ["одна"], "g.5.8": ["две"], "g.5.9": ["одна"], "g.5.10": ["одна"],
 "g.5.11": ["прошедшем", "будущем"], "g.5.12": ["настоящем", "будущем"],
 "g.5.13": ["-ущ-", "-ащ-", "-вш-"], "g.5.14": ["-ящ-", "-ущ-", "-ющ-"],
 "g.5.15": ["да, одна запятая", "нет"], "g.5.16": ["да, одна запятая", "да, две запятые"],
 "g.5.17": ["что делая?", "что делает?", "как?"],
 "g.5.18": ["глагол и наречие", "существительное и прилагательное", "наречие и прилагательное"],
 # вариант 6
 "g.6.1": ["нечитая", "не-читая"], "g.6.2": ["не навидя", "не-навидя"],
 "g.6.3": ["что сделав?", "что делает?", "какой?"], "g.6.4": ["что делая?", "что сделал?", "какой?"],
 "g.6.5": ["нет"], "g.6.6": ["нет"],
 "g.6.7": ["по дружески", "подружески"], "g.6.8": ["по прежнему", "попрежнему"],
 "g.6.9": ["в начале", "в-начале"], "g.6.10": ["вначале", "в-начале"],
 "g.6.11": ["на встречу", "на-встречу"], "g.6.12": ["навстречу", "на-встречу"],
 "g.6.13": ["не громко", "не-громко"], "g.6.14": ["негромко", "не-громко"],
 "g.6.15": ["существительное", "прилагательное", "глагол"], "g.6.16": ["прилагательное", "глагол", "деепричастие"],
 "g.6.17": ["деепричастие", "наречие", "союз"], "g.6.18": ["из далека", "из-далека"],
 # вариант 7
 "g.7.6": ["простое глагольное", "составное глагольное"], "g.7.7": ["простое глагольное", "составное именное"],
 "g.7.8": ["составное глагольное", "составное именное"],
 "g.7.9": ["нет"], "g.7.11": ["1", "3"], "g.7.12": ["2", "3"],
 "g.7.13": ["двусоставное", "неполное", "сложное"], "g.7.14": ["односоставное", "неполное", "сложное"],
 "g.7.15": ["определённо-личное", "неопределённо-личное", "назывное"],
 "g.7.16": ["безличное", "неопределённо-личное", "назывное"],
 "g.7.17": ["нет"], "g.7.18": ["точка", "восклицательный знак", "многоточие"],
 # вариант 8
 "g.8.9": ["нет"], "g.8.10": ["нет"], "g.8.11": ["нет"], "g.8.12": ["да"],
 "g.8.13": ["но", "а", "или"], "g.8.14": ["и", "или", "либо"], "g.8.15": ["нет"], "g.8.16": ["да"],
 "g.8.17": ["2", "3"], "g.8.18": ["точкой с запятой", "тире", "двоеточием"],
 # вариант 9
 "g.9.1": ["сложноподчинённое", "бессоюзное сложное", "простое осложнённое"],
 "g.9.2": ["сложносочинённое", "бессоюзное сложное", "простое осложнённое"],
 "g.9.3": ["сложносочинённое", "сложноподчинённое", "простое осложнённое"],
 "g.9.4": ["чтобы", "как", "если"], "g.9.5": ["потому", "что", "так как"], "g.9.6": ["если", "что", "как"],
 "g.9.16": ["2", "4"], "g.9.17": ["тире", "двоеточием", "точкой с запятой"],
 "g.9.18": ["сложносочинённое", "сложноподчинённое", "простое"],
 # вариант 10
 "g.10.1": ["прикрасный"], "g.10.2": ["прибывать"], "g.10.3": ["пребывать"],
 "g.10.4": ["безидейный", "бесыдейный"], "g.10.5": ["межынститутский", "межъинститутский"],
 "g.10.6": ["сверхынтересный", "сверхъинтересный"], "g.10.7": ["разписать", "росписать"],
 "g.10.8": ["безвучный", "бесзвучный"], "g.10.9": ["пол Москвы", "полмосквы"], "g.10.10": ["пол-часа", "пол часа"],
 "g.10.11": ["ошибки нет", "нужно «более лучшее»", "нужно «самый лучше»"],
 "g.10.12": ["ошибки нет", "нужно «ихов дом»", "нужно «их дома»"],
 "g.10.13": ["ошибки нет", "нужно «одевать пальто»", "нужно «наодеть пальто»"],
 "g.10.14": ["ошибки нет", "нужно «заплатить проезд»", "нужно «оплатить о проезде»"],
 "g.10.15": ["ошибки нет", "нужно «благодаря дождём»", "нужно «благодаря дожде»"],
 "g.10.16": ["в течении дня", "втечение дня"], "g.10.17": ["в следствие дождя", "вследствии дождя"],
 "g.10.18": ["не смотря на трудности", "несмотря на трудностях"],
}

# Corrections of the source document (prompt fixes)
PROMPT_FIX = {
 # the prompt quoted the hyphenated (wrong) spelling, which gave the answer away
 "g.4.18": "Как пишется «(по)новому» в «пойти (по)новому пути»?",
 "g.3.14": "Как пишется «не(друг), а враг» — слитно или раздельно?",
 "g.4.17": "Как пишется «(по)русски» в «говорить (по)русски»?",
 "g.5.7": "Сколько Н в слове «написа(н/нн)ый»?",
 "g.5.8": "Сколько Н в слове «краше(н/нн)ый» (без зависимых слов)?",
 "g.5.9": "Сколько Н в слове «покраше(н/нн)ый»?",
 "g.5.10": "Как пишется «решё(н/нн)ая задача» — с одной Н или двумя?",
 "g.5.15": "Нужны ли запятые: «Книга прочитанная летом понравилась»?",
 "g.5.16": "Нужны ли запятые: «Прочитанная летом книга понравилась»?",
 "g.6.5": "Нужна ли запятая: «Улыбаясь он вошёл»?",
 "g.6.6": "Нужна ли запятая: «Он вошёл улыбаясь»?",
 "g.6.8": "Как пишется «(по)прежнему» в «жить (по)прежнему»?",
 "g.6.9": "Как пишется «(в)начале» в «(в)начале подумай»?",
 "g.6.10": "Как пишется «(в)начале» в «(в)начале урока»?",
 "g.6.11": "Как пишется «(на)встречу» в «идти (на)встречу другу»?",
 "g.6.12": "Как пишется «(на)встречу» в «идти (на)встречу с другом»?",
 "g.6.14": "Как пишется «(не)громко, а тихо»?",
 "g.7.9": "Нужно ли тире: «Москва столица России»?",
 "g.7.17": "Нужно ли обособить обращение: «Мама послушай»?",
 "g.8.9": "Нужно ли двоеточие: «Я люблю три предмета русский, историю и музыку»?",
 "g.8.10": "Нужно ли тире: «Русский, история, музыка мои любимые предметы»?",
 "g.8.11": "Является ли «к счастью» вводным в «К счастью дождь кончился»?",
}

def grammar_question(v, n, prompt, ans):
    key = f"g.{v}.{n}"
    prompt = PROMPT_FIX.get(key, prompt)
    pl = prompt.lower()
    if key in G:
        d = G[key]
    elif "как пишется слово:" in pl or (re.search(r"«?[а-яё]+_[а-яё]+»?", prompt) and "_" in prompt and v == 1):
        pat = re.search(r"слово: ([а-яё_]+)", prompt).group(1)
        d = gap_words(pat, ans)
    elif "какой род" in pl:
        d = [g for g in GENDERS if g != ans]
    elif "какой падеж" in pl:
        d = [c for c in CASES if c != ans]
    elif "какое склонение" in pl:
        d = [c for c in DECL if c != ans]
    elif pl.startswith("найдите"):
        d = [w for w in sentence_words(quoted(prompt)) if w != ans.lower()]
    elif pl.startswith("поставьте знак"):
        d = punct_variants(quoted(prompt), ans)
    elif pl.startswith(("тип:", "вид придаточного")):
        d = [c for c in CLAUSES if c != ans][:3] if "вид" in pl else []
        if "тип:" in pl:
            d = [t for t in ["сложносочинённое", "сложноподчинённое", "бессоюзное сложное"] if t != ans]
        else:
            d = seeded_shuffle([c for c in CLAUSES if c != ans], key)[:3]
    elif "нужно ли" in pl or "является ли" in pl or "обособляется ли" in pl:
        d = ["нет"] if ans.startswith(("да", "обычно да")) else ["да"]
        ans = "да" if ans.startswith("обычно да") else ans
    else:
        raise SystemExit(f"no rule for {key}: {prompt} => {ans}")
    return prompt, ans, d

def bridge_question(v, n, prompt, ans):
    key = f"b.{v}.{n}"
    pl = prompt.lower()
    if pl.startswith("найдите") or pl.startswith("к какому"):
        d = [w for w in sentence_words(quoted(prompt)) if w != ans.lower()]
    elif pl.startswith(("расставьте", "вставьте")):
        d = punct_variants(quoted(prompt), ans)
    elif "тип сложного" in pl:
        d = [t for t in ["ССП", "СПП", "БСП"] if t != ans]
    elif "вид придаточного" in pl:
        d = seeded_shuffle([c for c in CLAUSES if c != ans], key)[:3]
    else:
        raise SystemExit(f"no rule for {key}: {prompt} => {ans}")
    return prompt, ans, d

# ---------------------------------------------------------- Библиотека героев
AUTHORS = ["И. А. Крылов", "А. С. Пушкин", "И. С. Тургенев", "Н. В. Гоголь", "М. Ю. Лермонтов", "А. С. Грибоедов", "Л. Н. Толстой", "А. П. Чехов"]
GENRES = ["басня", "литературная сказка", "рассказ", "повесть", "роман", "поэма", "комедия", "элегия", "трагедия"]
GENRE_TWINS = {"роман (незавершённый)": {"роман"}, "историческая повесть": {"повесть"}, "повесть": {"историческая повесть"}}
# for each work: other works whose answers are safe wrong options (different theme family)
LIB_SOURCES = {1: [4, 6, 10], 2: [4, 7, 9], 3: [1, 4, 10], 4: [2, 8, 5], 5: [1, 4, 8],
               6: [2, 4, 10], 7: [1, 8, 10], 8: [4, 6, 10], 9: [2, 4, 5], 10: [1, 2, 8]}
FALLBACK = [4, 2, 1, 8, 10, 5, 3, 7, 9, 6]
GENERIC_BAN = {"ответственность за поступки"}  # fits almost any work → never a wrong option
LIB_Q11 = {
 1: ["беречь честь смолоду", "уметь отстаивать убеждения", "обдумывать цену выбора и верности"],
 2: ["беречь честь смолоду", "уметь отстаивать убеждения", "обдумывать цену выбора и верности"],
 3: ["не доверять корыстной лести", "уметь довольствоваться и быть благодарным", "бережно относиться к природе"],
 4: ["не доверять корыстной лести", "беречь честь смолоду", "критически относиться к лицемерию и коррупции"],
 5: ["не доверять корыстной лести", "уметь довольствоваться и быть благодарным", "критически относиться к лицемерию и коррупции"],
 6: ["не доверять корыстной лести", "уметь довольствоваться и быть благодарным", "бережно относиться к природе"],
 7: ["не доверять корыстной лести", "уметь довольствоваться и быть благодарным", "критически относиться к лицемерию и коррупции"],
 8: ["беречь честь смолоду", "уметь довольствоваться и быть благодарным", "бережно относиться к природе"],
 9: ["уметь довольствоваться и быть благодарным", "обдумывать цену выбора и верности", "бережно относиться к природе"],
 10: ["не доверять корыстной лести", "уметь довольствоваться и быть благодарным", "критически относиться к лицемерию и коррупции"],
}
Q12_WRONG = ["пересказ сюжета без опоры на текст", "перечисление всех персонажей произведения", "указание года написания произведения"]

def library_variants(variants):
    answers = {i + 1: {q["n"]: q["a"] for q in v["questions"]} for i, v in enumerate(variants)}
    def build(v, n, prompt, ans):
        seed = f"l.{v}.{n}"
        if n == 1:
            d = seeded_shuffle([a for a in AUTHORS if a != ans], seed)[:3]
        elif n == 2:
            d = seeded_shuffle([g for g in GENRES if g != ans and g not in GENRE_TWINS.get(ans, set())], seed)[:3]
        elif n == 12:
            d = Q12_WRONG
        elif n == 11:
            d = LIB_Q11[v]
        else:
            d = []
            for src in LIB_SOURCES[v] + FALLBACK:
                if src == v:
                    continue
                cand = answers[src][n]
                if cand != ans and cand not in d and cand not in GENERIC_BAN:
                    d.append(cand)
                if len(d) == 3:
                    break
        cap = lambda x: x[:1].upper() + x[1:]  # consistent look: every option starts with a capital
        return prompt, cap(ans), [cap(x) for x in d]
    return build

# ------------------------------------------------------------------- output
BUILDINGS = {"01_Dvorets_grammatiki_180": ("grammar", "g"), "03_Most_predlozheniy_120": ("bridge", "b"),
             "02_Biblioteka_geroev_120": ("library", "l"), "04_Teatr_personazhey_150": ("theatre", "t")}

def variant_meta(doc, title):
    m = re.match(r"Вариант (\d+)\. (.*)", title)
    num, rest = int(m.group(1)), m.group(2)
    grade = grade_of(title)
    if doc.startswith("02"):
        work = rest.split(" | ")[0]
        topic = work
        name = f"{work}: вопросы по произведению"
    elif doc.startswith("04"):
        work = re.sub(r"\s*\(\d+ класс\)", "", rest)
        topic = work
        name = f"{work}: анализ героев и произведения"
    else:
        topic = rest.split(". ", 1)[1]
        name = topic
    return num, grade, topic, f"{name} ({grade} класс, вариант {num})"

RUBRIC = [{"id": "facts", "title": "Точность фактов", "max": 4}, {"id": "text", "title": "Опора на текст", "max": 3},
          {"id": "argument", "title": "Аргументация", "max": 2}, {"id": "literacy", "title": "Грамотность", "max": 1}]

os.makedirs(OUT, exist_ok=True)
for doc, variants in docs.items():
    building, prefix = BUILDINGS[doc]
    tasks = []
    lib_build = library_variants(variants) if prefix == "l" else None
    for v in variants:
        num, grade, topic, title = variant_meta(doc, v["title"])
        nq = len(v["questions"])
        task = {"key": f"{building}-v{num}", "title": title, "building": building, "grade": grade, "topic": topic,
                "difficulty": difficulty(grade)}
        if prefix == "t":
            guide = " ".join(x.replace("[] ", "") for x in v["notes"]).replace("Ориентиры для учителя: ", "")
            task.update({
                "type": "ESSAY",
                "instruction": "Ответьте развёрнуто на каждый вопрос (2–5 предложений), опираясь на текст произведения: называйте факты, приводите цитаты и объясняйте свою мысль.",
                "timeLimitMin": None, "maxAttempts": 1,
                "explanation": f"Ориентиры для проверки: {guide}" if guide else None,
                "content": {"questions": [{"id": f"q{q['n']}", "prompt": q["q"]} for q in v["questions"]]},
                "answerKey": None, "criteria": RUBRIC,
            })
        else:
            qs, key = [], {}
            for q in v["questions"]:
                if prefix == "g":
                    p, a, d = grammar_question(num, q["n"], q["q"], q["a"])
                elif prefix == "b":
                    p, a, d = bridge_question(num, q["n"], q["q"], q["a"])
                else:
                    p, a, d = lib_build(num, q["n"], q["q"], q["a"])
                qq, kk = choice_q(f"q{q['n']}", p, a, d, f"{building}.{num}.{q['n']}")
                qs.append(qq); key[qq["id"]] = kk
            task.update({
                "type": "SINGLE_CHOICE",
                "instruction": "Выберите один правильный ответ в каждом вопросе.",
                "timeLimitMin": 15 if nq > 12 else 10, "maxAttempts": 2, "explanation": None,
                "content": {"questions": qs}, "answerKey": key, "criteria": None,
            })
        tasks.append(task)
    name = {"grammar": "01-grammar", "library": "02-library", "bridge": "03-bridge", "theatre": "04-theatre"}[building]
    json.dump({"source": doc + ".docx", "building": building, "tasks": tasks},
              open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(name, len(tasks), "tasks,", sum(len(t["content"]["questions"]) for t in tasks), "questions")
