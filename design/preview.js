/* СӨЗҚАЛА — design preview interactions (Stage 0). */
(function () {
  'use strict';
  const I = window.SozqalaIso, C = window.SozqalaCity;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ------------------------------------------------------------------ i18n */
  const T = {
    kk: {
      brand: 'СӨЗҚАЛА', brandSub: 'Дизайн жүйесі · 0-кезең',
      'nav.colors': 'Түстер', 'nav.type': 'Қаріп', 'nav.components': 'Компоненттер', 'nav.buildings': 'Ғимараттар', 'nav.city': 'Қала', 'nav.screens': 'Экрандар', 'nav.cert': 'Сертификат',
      'hero.kicker': 'Орыс тілі мен әдебиеті · 5–11 сынып', 'hero.t1': 'Біліміңмен', 'hero.t2': 'қалаңды сал!', 'hero.lead': 'Әр тапсырма — бір кірпіш. Нәтиже неғұрлым жоғары болса, ғимарат соғұрлым көркем.',
      'role.student': 'Оқушы', 'role.teacher': 'Мұғалім', 'role.parent': 'Ата-ана', 'role.admin': 'Әкімші',
      's1.title': 'Дизайн қағидалары',
      'p1.t': 'Нәтиже — қала', 'p1.d': 'Әр балл қалада көрінеді. Ғимарат — оқу нәтижесінің визуалды айнасы.',
      'p2.t': 'Ешқашан бұзылмайды', 'p2.d': 'Төмен балл ғимаратты бұзбайды. Тек өсу бар — қорқыныш жоқ.',
      'p3.t': 'Ойын, бірақ оқу', 'p3.d': 'Жарқын ойын стилі — бірақ тапсырма мәтіні таза, ірі, оқуға ыңғайлы.',
      'p4.t': 'Кез келген экран', 'p4.d': 'Телефоннан бастап жобалаймыз: 360px, 44px түймелер, саусақпен басқару.',
      's2.title': 'Түстер', 's2.d': 'Көк пен күн-сары — Қазақстан туының реңктері. Қызыл «қорқынышты» емес, жұмсақ маржан.', 's2.brand': 'Бренд', 's2.score': 'Балл шкаласы → ғимарат деңгейі', 's2.roles': 'Рөлдер · сертификат деңгейлері · әлем',
      's3.title': 'Типография', 's3.d': 'Rubik — тақырыптар, Nunito — мәтін. Екеуі де қазақ әріптерін толық қолдайды.', 's3.glyphs': 'Қазақ әріптері', 's3.rules': 'Ережелер',
      's3.r1': 'Тапсырма мәтіні — кемінде 18px, жол аралығы 1.5.', 's3.r2': 'Мәтін ені — 70 таңбадан аспайды.', 's3.r3': 'Балл мен сандар — Rubik 800, анық және ірі.', 's3.r4': 'Оқу мазмұны (тапсырмалар) — орыс тілінде, интерфейс — қаз/орыс.',
      's4.title': 'Компоненттер', 's4.buttons': 'Түймелер', 's4.fields': 'Енгізу өрістері', 's4.score': 'Балл және деңгей', 's4.progress': 'Қаланың аяқталуы', 's4.resources': 'Ресурстар', 's4.badges': 'Жетістік белгілері', 's4.notifs': 'Хабарламалар', 's4.tasktypes': 'Тапсырма түрлері', 's4.tasknote': 'Жасыл — автоматты тексеріледі. Күлгін — мұғалім қолмен бағалайды.',
      'btn.build': 'Салу', 'btn.reward': 'Марапат алу', 'btn.check': 'Тексеру', 'btn.cancel': 'Бас тарту', 'btn.delete': 'Жою', 'btn.locked': 'Жабық',
      'f.login': 'Логин', 'f.loginHint': 'Мұғалім берген логин', 'f.pass': 'Құпиясөз', 'f.passErr': 'Кемінде 8 таңба',
      'city.done': 'Қала дайын', 'city.rand': 'Кездейсоқ', 'city.empty': 'Бос қала', 'city.max': 'Толық қала',
      'res.points': 'ұпай', 'res.materials': 'материал', 'res.stars': 'жұлдыз', 'res.levelup': '+1 деңгей!', 'res.built': 'Толық ғимарат салынды', 'res.mistakes': 'Қателер мен түсіндірме', 'res.retry': 'Қайта орындау', 'res.city': 'Қалаға',
      's5.title': '8 ғимарат × 5 деңгей', 's5.d': 'Барлық графика кодпен салынған SVG: 2:1 изометрия, жарық сол жақ жоғарыдан. Бос телімде болашақ ғимараттың «елесі» көрінеді.',
      'sim.title': 'Бағалау симуляторы', 'sim.d': 'Тапсырманы «орындаңыз» — балл таңдаңыз. Ғимарат тек жақсарады.', 'sim.mode': 'Жиынтық балл тәсілі', 'sim.submit': 'Әрекет нәтижесі', 'sim.history': 'Әрекеттер тарихы', 'sim.agg': 'Жиынтық балл', 'sim.level': 'Деңгей', 'sim.reset': 'Қайта бастау',
      'sim.kept': 'Балл төмендеді, бірақ ғимарат сақталды — деңгей ешқашан түспейді.', 'sim.up': 'Ғимарат жаңа деңгейге көтерілді!', 'sim.same': 'Деңгей өзгерген жоқ. Келесі деңгейге: ',
      'mode.best': 'Ең үздік нәтиже', 'mode.avg': 'Орташа балл', 'mode.last': 'Соңғы әрекет',
      's6.title': 'Оқушының қаласы', 's6.d': '3×3 тор: ортада — Білім ратушасы, бұрышта — қала атауы жазылған алаң. Ғимаратты басыңыз; масштабтау — дөңгелекпен немесе екі саусақпен.',
      's7.title': 'Негізгі экрандар', 's7.d': 'Әр рөлдің басты экранының жоғары сапалы макеті. Толық wireframe-дер: docs/design/03-ux-wireframes.md',
      'scr.student': 'Оқушы · басты бет (компьютер)', 'scr.task': 'Оқушы · тапсырма (телефон)', 'scr.result': 'Оқушы · нәтиже (телефон)', 'scr.parent': 'Ата-ана · кабинет (телефон)', 'scr.teacher': 'Мұғалім · басқару тақтасы (компьютер)',
      'task.q': 'Сұрақ', 'b.grammar': 'Грамматика сарайы',
      'parent.child': 'Балам: Аружан К., 7«Ә»', 'parent.hard': 'Қиын тақырыптар', 'parent.ro': 'Тек қарау: баға өзгерту мүмкін емес',
      't.dash': 'Сынып: 7«Ә» · 26 оқушы', 't.newtask': 'Жаңа тапсырма', 't.tasks': 'Тапсырмалар', 't.avg': 'Орташа балл', 't.done': 'Орындалды', 't.pending': 'Тексеруді күтуде', 't.buildings': 'Салынған ғимараттар', 't.bytopic': 'Тақырып бойынша нәтиже', 't.queue': 'Тексеру кезегі', 't.student': 'Оқушы', 't.work': 'Жұмыс', 't.grade': 'Бағалау',
      's8.title': 'Сертификат және тексеру беті', 's8.d': 'PDF, A4 альбомдық. QR-код тексеру бетіне апарады — онда жеке деректер көрсетілмейді.', 's8.tiers': 'Деңгейлер (шектерін мұғалім/әкімші баптайды)',
      'tier.bronze': 'Қола', 'tier.silver': 'Күміс', 'tier.gold': 'Алтын', 'tier.platinum': 'Платина',
      'v.title': 'Сертификат жарамды', 'v.level': 'Деңгей', 'v.date': 'Берілген күні', 'v.privacy': 'Оқушының аты-жөні мен мектебі жария көрсетілмейді.',
      's9.title': 'Қозғалыс', 'm1.t': 'Құрылыс', 'm1.d': 'Ғимарат төменнен «өседі» (900ms, bounce) + шаң бұлттары. Тек деңгей өскенде.', 'm2.t': 'Тірі қала', 'm2.d': 'Желбіреген тулар, субұрқақ, жыпылықтаған жұлдыздар — 5-деңгейде.', 'm3.t': 'Басу', 'm3.d': 'Түймелер 4px «басылады». Hover-де ғимарат көтеріледі.', 'm4.t': 'Қолжетімділік', 'm4.d': 'prefers-reduced-motion кезінде барлық анимация өшеді.',
      'toast.built': 'Грамматика сарайы 4-деңгейге көтерілді!', footer: 'СӨЗҚАЛА · 0-кезең дизайн жүйесі · tokens.css + iso-engine.js → 1/4-кезеңдер',
      'lvl.0': 'Бос телім', 'lvl.1': 'Іргетас және қаңқа', 'lvl.2': 'Шағын ғимарат', 'lvl.3': 'Толық ғимарат', 'lvl.4': 'Көрікті ғимарат', 'lvl.5': 'Ең жоғары деңгей',
      'lvlr.0': 'әрекет жоқ', 'lvlr.1': '1–3 балл', 'lvlr.2': '4–5 балл', 'lvlr.3': '6–7 балл', 'lvlr.4': '8–9 балл', 'lvlr.5': '10 балл',
      'info.level': 'Деңгей', 'info.score': 'Ең үздік балл', 'info.area': 'Бағыт', 'info.tasks': 'Тапсырмалар', 'info.open': 'Тапсырмаларды ашу', 'info.test': 'Деңгейді көтеру (тест)', 'info.hint': 'Картадағы ғимаратты таңдаңыз',
      'tt.single': 'Бір дұрыс жауап', 'tt.multi': 'Бірнеше дұрыс жауап', 'tt.match': 'Сәйкестендіру', 'tt.gaps': 'Бос орынды толтыру', 'tt.order': 'Сөздерді ретімен қою', 'tt.fix': 'Қатені түзету', 'tt.punct': 'Тыныс белгілерін қою', 'tt.analysis': 'Мәтін мен дәйексөз талдау', 'tt.character': 'Кейіпкерді анықтау', 'tt.essay': 'Шағын эссе', 'tt.creative': 'Шығармашылық жұмыс', 'tt.audio': 'Аудиотапсырма',
      'ach.1': 'Сөз сәулетшісі', 'ach.1d': 'Алғашқы ғимарат', 'ach.2': 'Емле шебері', 'ach.2d': 'Сарай 5-деңгейде', 'ach.3': 'Әдебиет зерттеушісі', 'ach.3d': 'Театр + кітапхана', 'ach.4': 'Сөзқаланың бас сәулетшісі', 'ach.4d': 'Барлық 8 ғимарат',
      'n.1': 'Балаңыз жаңа ғимарат салды!', 'n.2': 'Бүгін 5 тапсырма орындалды.', 'n.3': 'Күрделі сөйлем тақырыбы бойынша нәтиже: 8/10.', 'n.4': 'Қаланы аяқтауға 20% қалды.', 'n.5': 'Балаңыз сертификат алды!',
      'n.t1': '2 мин бұрын', 'n.t2': 'бүгін, 16:40', 'n.t3': 'кеше', 'n.t4': '3 күн бұрын', 'n.t5': '18.11.2026',
    },
    ru: {
      brand: 'СЛОВОГРАД', brandSub: 'Дизайн-система · Этап 0',
      'nav.colors': 'Цвета', 'nav.type': 'Шрифты', 'nav.components': 'Компоненты', 'nav.buildings': 'Здания', 'nav.city': 'Город', 'nav.screens': 'Экраны', 'nav.cert': 'Сертификат',
      'hero.kicker': 'Русский язык и литература · 5–11 класс', 'hero.t1': 'Построй свой город', 'hero.t2': 'знаниями!', 'hero.lead': 'Каждое задание — кирпичик. Чем выше результат, тем красивее здание.',
      'role.student': 'Ученик', 'role.teacher': 'Учитель', 'role.parent': 'Родитель', 'role.admin': 'Администратор',
      's1.title': 'Принципы дизайна',
      'p1.t': 'Результат — это город', 'p1.d': 'Каждый балл виден в городе. Здание — визуальное отражение учёбы.',
      'p2.t': 'Ничего не рушится', 'p2.d': 'Низкий балл не разрушает здание. Только рост — без страха.',
      'p3.t': 'Игра, но учёба', 'p3.d': 'Яркий игровой стиль — но текст задания чистый, крупный и удобный для чтения.',
      'p4.t': 'Любой экран', 'p4.d': 'Проектируем от телефона: 360px, кнопки 44px, управление пальцем.',
      's2.title': 'Цвета', 's2.d': 'Голубой и солнечно-жёлтый — оттенки флага Казахстана. Красный не «страшный», а мягкий коралловый.', 's2.brand': 'Бренд', 's2.score': 'Шкала баллов → уровень здания', 's2.roles': 'Роли · уровни сертификата · мир',
      's3.title': 'Типографика', 's3.d': 'Rubik — заголовки, Nunito — текст. Оба полностью поддерживают казахский алфавит.', 's3.glyphs': 'Казахские буквы', 's3.rules': 'Правила',
      's3.r1': 'Текст задания — не меньше 18px, межстрочный 1.5.', 's3.r2': 'Ширина строки — не больше 70 символов.', 's3.r3': 'Баллы и числа — Rubik 800, крупно и чётко.', 's3.r4': 'Учебный контент (задания) — на русском, интерфейс — каз/рус.',
      's4.title': 'Компоненты', 's4.buttons': 'Кнопки', 's4.fields': 'Поля ввода', 's4.score': 'Балл и уровень', 's4.progress': 'Готовность города', 's4.resources': 'Ресурсы', 's4.badges': 'Достижения', 's4.notifs': 'Уведомления', 's4.tasktypes': 'Типы заданий', 's4.tasknote': 'Зелёные — проверяются автоматически. Фиолетовые — оценивает учитель.',
      'btn.build': 'Построить', 'btn.reward': 'Забрать награду', 'btn.check': 'Проверить', 'btn.cancel': 'Отмена', 'btn.delete': 'Удалить', 'btn.locked': 'Закрыто',
      'f.login': 'Логин', 'f.loginHint': 'Логин, выданный учителем', 'f.pass': 'Пароль', 'f.passErr': 'Не меньше 8 символов',
      'city.done': 'Город готов', 'city.rand': 'Случайно', 'city.empty': 'Пустой город', 'city.max': 'Полный город',
      'res.points': 'очков', 'res.materials': 'материалов', 'res.stars': 'звёзд', 'res.levelup': '+1 уровень!', 'res.built': 'Здание построено', 'res.mistakes': 'Ошибки и объяснения', 'res.retry': 'Пересдать', 'res.city': 'В город',
      's5.title': '8 зданий × 5 уровней', 's5.d': 'Вся графика — SVG, нарисованный кодом: изометрия 2:1, свет слева сверху. На пустом участке виден «призрак» будущего здания.',
      'sim.title': 'Симулятор оценивания', 'sim.d': '«Выполните» задание — выберите балл. Здание только улучшается.', 'sim.mode': 'Способ итогового балла', 'sim.submit': 'Результат попытки', 'sim.history': 'История попыток', 'sim.agg': 'Итоговый балл', 'sim.level': 'Уровень', 'sim.reset': 'Сбросить',
      'sim.kept': 'Балл снизился, но здание сохранилось — уровень никогда не падает.', 'sim.up': 'Здание поднялось на новый уровень!', 'sim.same': 'Уровень не изменился. До следующего: ',
      'mode.best': 'Лучший результат', 'mode.avg': 'Средний балл', 'mode.last': 'Последняя попытка',
      's6.title': 'Город ученика', 's6.d': 'Сетка 3×3: в центре — Ратуша знаний, в углу — площадь с названием города. Нажмите на здание; масштаб — колесом или двумя пальцами.',
      's7.title': 'Ключевые экраны', 's7.d': 'Макеты главных экранов каждой роли. Полные wireframe: docs/design/03-ux-wireframes.md',
      'scr.student': 'Ученик · главная (компьютер)', 'scr.task': 'Ученик · задание (телефон)', 'scr.result': 'Ученик · результат (телефон)', 'scr.parent': 'Родитель · кабинет (телефон)', 'scr.teacher': 'Учитель · панель (компьютер)',
      'task.q': 'Вопрос', 'b.grammar': 'Дворец грамматики',
      'parent.child': 'Ребёнок: Аружан К., 7«Ә»', 'parent.hard': 'Трудные темы', 'parent.ro': 'Только просмотр: менять оценки нельзя',
      't.dash': 'Класс: 7«Ә» · 26 учеников', 't.newtask': 'Новое задание', 't.tasks': 'Заданий', 't.avg': 'Средний балл', 't.done': 'Выполнено', 't.pending': 'Ждут проверки', 't.buildings': 'Построено зданий', 't.bytopic': 'Результаты по темам', 't.queue': 'Очередь проверки', 't.student': 'Ученик', 't.work': 'Работа', 't.grade': 'Оценить',
      's8.title': 'Сертификат и страница проверки', 's8.d': 'PDF, A4 альбомный. QR-код ведёт на страницу проверки без персональных данных.', 's8.tiers': 'Уровни (пороги настраивает учитель/админ)',
      'tier.bronze': 'Бронза', 'tier.silver': 'Серебро', 'tier.gold': 'Золото', 'tier.platinum': 'Платина',
      'v.title': 'Сертификат действителен', 'v.level': 'Уровень', 'v.date': 'Дата выдачи', 'v.privacy': 'Имя ученика и школа публично не показываются.',
      's9.title': 'Анимация', 'm1.t': 'Стройка', 'm1.d': 'Здание «вырастает» снизу (900ms, bounce) + облачка пыли. Только при росте уровня.', 'm2.t': 'Живой город', 'm2.d': 'Флаги, фонтаны, мерцающие звёзды — на 5-м уровне.', 'm3.t': 'Нажатие', 'm3.d': 'Кнопки «нажимаются» на 4px. При наведении здание приподнимается.', 'm4.t': 'Доступность', 'm4.d': 'При prefers-reduced-motion вся анимация отключается.',
      'toast.built': 'Дворец грамматики поднялся до 4-го уровня!', footer: 'СЛОВОГРАД · дизайн-система этапа 0 · tokens.css + iso-engine.js → этапы 1/4',
      'lvl.0': 'Пустой участок', 'lvl.1': 'Фундамент и каркас', 'lvl.2': 'Небольшое здание', 'lvl.3': 'Полное здание', 'lvl.4': 'Украшенное здание', 'lvl.5': 'Высший уровень',
      'lvlr.0': 'нет попыток', 'lvlr.1': '1–3 балла', 'lvlr.2': '4–5 баллов', 'lvlr.3': '6–7 баллов', 'lvlr.4': '8–9 баллов', 'lvlr.5': '10 баллов',
      'info.level': 'Уровень', 'info.score': 'Лучший балл', 'info.area': 'Раздел', 'info.tasks': 'Задания', 'info.open': 'Открыть задания', 'info.test': 'Повысить уровень (тест)', 'info.hint': 'Выберите здание на карте',
      'tt.single': 'Один верный ответ', 'tt.multi': 'Несколько верных ответов', 'tt.match': 'Сопоставление', 'tt.gaps': 'Заполнить пропуски', 'tt.order': 'Порядок слов', 'tt.fix': 'Исправить ошибки', 'tt.punct': 'Расставить знаки', 'tt.analysis': 'Анализ текста и цитаты', 'tt.character': 'Узнать героя', 'tt.essay': 'Мини-эссе', 'tt.creative': 'Творческая работа', 'tt.audio': 'Аудиозадание',
      'ach.1': 'Архитектор слова', 'ach.1d': 'Первое здание', 'ach.2': 'Мастер орфографии', 'ach.2d': 'Дворец на 5-м уровне', 'ach.3': 'Исследователь литературы', 'ach.3d': 'Театр + библиотека', 'ach.4': 'Главный архитектор Словограда', 'ach.4d': 'Все 8 зданий',
      'n.1': 'Ваш ребёнок построил новое здание!', 'n.2': 'Сегодня выполнено 5 заданий.', 'n.3': 'Результат по теме «Сложное предложение»: 8/10.', 'n.4': 'До завершения города осталось 20%.', 'n.5': 'Ваш ребёнок получил сертификат!',
      'n.t1': '2 мин назад', 'n.t2': 'сегодня, 16:40', 'n.t3': 'вчера', 'n.t4': '3 дня назад', 'n.t5': '18.11.2026',
    },
  };
  let lang = 'kk';
  try { lang = localStorage.getItem('sz-lang') || 'kk'; } catch (e) { /* storage unavailable */ }
  const t = (k) => (T[lang] && T[lang][k]) || T.kk[k] || k;

  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  /* --------------------------------------------------------------- helpers */
  const icons = () => { if (window.lucide) window.lucide.createIcons(); };
  const LV_COLORS = ['var(--score-0)', 'var(--score-1)', 'var(--score-2)', 'var(--score-3)', 'var(--score-4)', 'var(--score-5)'];
  const pill = (L) => `<span class="pill" style="--lv:${LV_COLORS[L]}"><b>${L}</b>${t('lvl.' + L)}</span>`;
  const bname = (b) => b.name[lang];

  /* ------------------------------------------------------------ brand mark */
  function brandMark() {
    const s = I.box(0, 0, 0, 1, 1, 0.9, '#00AFCA') + I.onLeft(1, 0, 0.9, I.ftext(0.5, 0.45, 'С', 0.55, '#fff', { weight: 800 })) + I.pyramid(-0.05, -0.05, 0.9, 1.1, 1.1, 0.75, '#FFC72C');
    $('#brand-mark').innerHTML = s;
    $('#brand-mark').setAttribute('viewBox', '-36 -46 72 82');
  }

  /* -------------------------------------------------------------- swatches */
  function swatches() {
    const css = getComputedStyle(document.documentElement);
    const sw = (v, name) => `<div class="swatch"><i style="background:var(${v})"></i><div><b>${name}</b><code>${v}<br>${css.getPropertyValue(v).trim()}</code></div></div>`;
    $('#sw-brand').innerHTML = [
      ['--sz-sky-500', 'Sky 500 · primary'], ['--sz-sky-700', 'Sky 700 · edge'], ['--sz-sky-100', 'Sky 100'],
      ['--sz-sun-500', 'Sun 500 · accent'], ['--sz-sun-100', 'Sun 100'], ['--sz-coral-500', 'Coral · danger'],
      ['--sz-grass-500', 'Grass · success'], ['--sz-violet-500', 'Violet · achievements'],
      ['--sz-ink-900', 'Ink 900 · text'], ['--sz-ink-500', 'Ink 500 · muted'], ['--sz-paper', 'Paper · bg'], ['--sz-cream', 'Cream · surface-alt'],
    ].map(([v, n]) => sw(v, n)).join('');
    $('#sw-score').innerHTML = [0, 1, 2, 3, 4, 5].map((L) => sw('--score-' + L, `L${L} · ${t('lvlr.' + L)}`)).join('');
    $('#sw-other').innerHTML = [
      ['--role-student', t('role.student')], ['--role-teacher', t('role.teacher')], ['--role-parent', t('role.parent')], ['--role-admin', t('role.admin')],
      ['--tier-bronze', t('tier.bronze')], ['--tier-silver', t('tier.silver')], ['--tier-gold', t('tier.gold')], ['--tier-platinum', t('tier.platinum')],
      ['--iso-grass', 'Grass'], ['--iso-road', 'Road'], ['--iso-water', 'Water'], ['--iso-sky-top', 'Sky'],
    ].map(([v, n]) => sw(v, n)).join('');
  }

  /* ------------------------------------------------------------ components */
  function components() {
    $('#level-pills').innerHTML = [1, 3, 5].map(pill).join('');
    const ach = [['pencil-ruler', '--sz-sky-500', '--sz-sky-700', false], ['spell-check', '--sz-violet-500', '--sz-violet-700', false], ['book-open-text', '--sz-grass-500', '--sz-grass-700', false], ['crown', '--sz-sun-500', '--sz-sun-700', true]];
    $('#badges').innerHTML = ach.map(([ic, c, e, locked], i) => `<div class="badge${locked ? ' is-locked' : ''}"><div class="badge-medal" style="--m:var(${c});--m-edge:var(${e})"><i data-lucide="${locked ? 'lock' : ic}"></i></div><b>${t('ach.' + (i + 1))}</b><small>${t('ach.' + (i + 1) + 'd')}</small></div>`).join('');
    const nIcons = ['building-2', 'list-checks', 'chart-line', 'map', 'award'];
    const nHtml = (n) => nIcons.slice(0, n).map((ic, i) => `<div class="notif${i < 2 ? ' is-unread' : ''}"><div class="ic"><i data-lucide="${ic}"></i></div><div><b>${t('n.' + (i + 1))}</b><small>${t('n.t' + (i + 1))}</small></div></div>`).join('');
    $('#notifs').innerHTML = nHtml(5);
    $('#mock-notifs').innerHTML = nHtml(3);
    const types = [['single', 'circle-dot', 1], ['multi', 'list-checks', 1], ['match', 'link', 1], ['gaps', 'text-cursor-input', 1], ['order', 'arrow-down-up', 1], ['fix', 'pen-line', 1], ['punct', 'quote', 1], ['analysis', 'scan-text', 0], ['character', 'user-search', 1], ['essay', 'notebook-pen', 0], ['creative', 'sparkles', 0], ['audio', 'mic', 0]];
    $('#task-types').innerHTML = types.map(([k, ic, auto]) => `<span class="chip ${auto ? 'chip--auto' : 'chip--manual'}"><i data-lucide="${ic}"></i>${t('tt.' + k)}</span>`).join('');
  }

  /* ------------------------------------------------------ building gallery */
  let curB = C.BUILDINGS[0];
  function buildingTabs() {
    $('#b-tabs').innerHTML = C.BUILDINGS.map((b) => `<button role="tab" data-key="${b.key}" aria-selected="${b === curB}"><i data-lucide="${b.icon}"></i>${bname(b)}</button>`).join('');
    $('#b-levels').innerHTML = [0, 1, 2, 3, 4, 5].map((L) => `<div class="lvl">${C.buildingSvg(curB, L)}<b>L${L} · ${t('lvl.' + L)}</b><small>${t('lvlr.' + L)}</small></div>`).join('');
    icons();
  }
  $('#b-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]'); if (!btn) return;
    curB = C.byKey[btn.dataset.key]; buildingTabs(); simReset();
  });

  /* ------------------------------------------------------------- simulator */
  const sim = { attempts: [], level: 0 };
  function simAgg() {
    const a = sim.attempts; if (!a.length) return null;
    const mode = $('#sim-mode').value;
    if (mode === 'best') return Math.max(...a);
    if (mode === 'last') return a[a.length - 1];
    return Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  }
  function simRender(animate, note) {
    const stage = $('#sim-stage');
    const lu = $('#levelup');
    stage.innerHTML = C.buildingSvg(curB, sim.level, { animate });
    stage.appendChild(lu);
    const agg = simAgg();
    $('#sim-agg').textContent = agg == null ? '—' : `${agg} / 10`;
    $('#sim-level').innerHTML = pill(sim.level);
    const best = sim.attempts.length ? Math.max(...sim.attempts) : null;
    $('#sim-history').innerHTML = sim.attempts.map((s) => `<span class="${s === best ? 'best' : ''}">${s}</span>`).join('');
    $('#sim-note').textContent = note || '';
  }
  function simSubmit(score) {
    sim.attempts.push(score);
    const target = C.levelForScore(simAgg());
    const prev = sim.level;
    let note;
    if (target > prev) {
      sim.level = target; note = t('sim.up');
      const lu = $('#levelup'); lu.textContent = `+${target - prev} · L${target}`; lu.classList.remove('show'); void lu.offsetWidth; lu.classList.add('show');
    } else if (target < prev) note = t('sim.kept');
    else note = prev < 5 ? t('sim.same') + [1, 4, 6, 8, 10][prev] + '+' : '';
    simRender(target > prev, note);
  }
  function simReset() { sim.attempts = []; sim.level = 0; simRender(false); }
  $('#score-keys').innerHTML = Array.from({ length: 11 }, (_, i) => `<button type="button" data-s="${i}" style="color:${LV_COLORS[C.levelForScore(i)]}">${i}</button>`).join('') ;
  $('#score-keys').addEventListener('click', (e) => { const b = e.target.closest('button[data-s]'); if (b) simSubmit(+b.dataset.s); });
  $('#sim-mode').addEventListener('change', () => {
    const target = C.levelForScore(simAgg());
    if (target > sim.level) { sim.level = target; simRender(true, t('sim.up')); } else simRender(false, target < sim.level ? t('sim.kept') : '');
  });
  $('#sim-reset').addEventListener('click', simReset);

  /* ------------------------------------------------------------------ city */
  const DEMO = { grammar: 3, bridge: 2, library: 4, theatre: 1, tower: 5, academy: 0, park: 2, townhall: 0 };
  let cityLevels = Object.assign({}, DEMO);
  let selected = 'grammar';
  const view = { s: 1, x: 0, y: 0 };
  const cityName = () => (lang === 'kk' ? 'СӨЗҚАЛА' : 'СЛОВОГРАД');

  function cityRender(animateKey) {
    $('#city-canvas').innerHTML = C.citySvg(cityLevels, { cityName: cityName(), animateKey });
    $('#city-pct').textContent = C.completion(cityLevels) + '%';
    applyView(); markSelected(); cityInfo();
  }
  function markSelected() { $$('#city-canvas .plot').forEach((p) => p.classList.toggle('is-selected', p.dataset.key === selected)); }
  function cityInfo() {
    const b = C.byKey[selected];
    if (!b) { $('#city-info').innerHTML = `<p class="note">${t('info.hint')}</p>`; return; }
    const L = cityLevels[b.key] || 0;
    const score = [null, 3, 5, 7, 9, 10][L];
    $('#city-info').innerHTML = `<div class="label">${t('info.area')}: ${b.area[lang]}</div><h3>${bname(b)}</h3>
      <div class="bld-preview">${C.buildingSvg(b, L)}</div>
      <dl class="kv"><dt>${t('info.level')}</dt><dd>${pill(L)}</dd><dt>${t('info.score')}</dt><dd>${score == null ? '—' : score + ' / 10'}</dd><dt>${t('info.tasks')}</dt><dd>${Math.min(L + 1, 4)} / 4</dd></dl>
      <div class="btn-row" style="margin-top:14px"><button class="btn btn--sm"><i data-lucide="play"></i>${t('info.open')}</button>
      <button class="btn btn--sm btn--accent" id="lvl-up" ${L >= 5 ? 'disabled' : ''}><i data-lucide="arrow-up"></i>${t('info.test')}</button></div>`;
    icons();
    const up = $('#lvl-up');
    if (up) up.addEventListener('click', () => { cityLevels[b.key] = Math.min(5, L + 1); cityRender(b.key); });
  }

  // pan & zoom (mouse wheel, drag, pinch)
  const cv = $('#city-view');
  function applyView() { const s = $('#city-canvas svg'); if (s) s.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`; }
  function zoomAt(f, cx, cy) {
    const ns = Math.max(1, Math.min(3, view.s * f)); const k = ns / view.s;
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.s = ns;
    if (ns === 1) { view.x = 0; view.y = 0; }
    applyView();
  }
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  $('#zin').addEventListener('click', () => zoomAt(1.3, cv.clientWidth / 2, cv.clientHeight / 2));
  $('#zout').addEventListener('click', () => zoomAt(1 / 1.3, cv.clientWidth / 2, cv.clientHeight / 2));
  const ptrs = new Map(); let moved = 0, pinch0 = 0;
  cv.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const r = cv.getBoundingClientRect();
      if (pinch0) zoomAt(d / pinch0, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pinch0 = d; moved = 99; return;
    }
    if (view.s > 1) { view.x += e.clientX - prev[0]; view.y += e.clientY - prev[1]; applyView(); }
    moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#city-canvas').addEventListener('click', (e) => {
    if (moved > 6) return;
    const p = e.target.closest('.plot'); if (!p || p.dataset.key === '__square') return;
    selected = p.dataset.key; markSelected(); cityInfo();
  });
  $('#city-canvas').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const p = e.target.closest('.plot'); if (!p) return; e.preventDefault(); selected = p.dataset.key; markSelected(); cityInfo();
  });
  $('#city-rand').addEventListener('click', () => { C.BUILDINGS.forEach((b) => { cityLevels[b.key] = Math.floor(Math.random() * 6); }); cityRender(); });
  $('#city-empty').addEventListener('click', () => { C.BUILDINGS.forEach((b) => { cityLevels[b.key] = 0; }); cityRender(); });
  $('#city-max').addEventListener('click', () => { C.BUILDINGS.forEach((b) => { cityLevels[b.key] = 5; }); cityRender(); });

  /* ---------------------------------------------------------------- mockups */
  function mockups() {
    const lv = DEMO;
    const city = C.citySvg(lv, { cityName: cityName() });
    $('#hero-city').innerHTML = C.citySvg({ grammar: 5, bridge: 4, library: 5, theatre: 3, tower: 5, academy: 4, park: 5, townhall: 2 }, { cityName: cityName() });
    $('#mock-city').innerHTML = city;
    $('#mock-parent-city').innerHTML = city;
    const pct = C.completion(lv);
    $('#mock-pct').textContent = pct + '%';
    $('#mock-progress').style.setProperty('--p', pct + '%');
    $('#mock-blist').innerHTML = C.BUILDINGS.map((b) => `<div class="b-row"><span class="ic" style="color:${b.colors.roof}"><i data-lucide="${b.icon}"></i></span><div><b>${bname(b)}</b><small>${b.area[lang]}</small></div>${pill(lv[b.key])}</div>`).join('');
    const res = $('#mock-result-bld'); const badge = res.querySelector('.levelup');
    res.innerHTML = C.buildingSvg('grammar', 3); res.appendChild(badge);
    const topics = [['Н / НН', 52], ['Причастия', 71], ['Сложное предложение', 80], ['Лексика', 88], ['Анализ стихотворения', 76]];
    $('#mock-bars').innerHTML = topics.map(([n, p]) => `<div class="bar"><span>${n}</span><i style="--p:${p}%;--c:${p < 60 ? 'var(--score-1)' : p < 75 ? 'var(--score-3)' : 'var(--score-4)'}"></i><b>${(p / 10).toFixed(1)}</b></div>`).join('');
  }

  /* ------------------------------------------------------- QR placeholder */
  function qr() {
    let s = '<rect width="21" height="21" fill="#fff"/>';
    const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#1E2A3B"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#1E2A3B"/>`;
    let seed = 7;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const inF = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      if (!inF && rand() > 0.52) s += `<rect x="${x}" y="${y}" width="1" height="1" fill="#1E2A3B"/>`;
    }
    $('#qr').innerHTML = s + finder(0, 0) + finder(14, 0) + finder(0, 14);
    $('#cert-city').innerHTML = ['library', 'tower', 'townhall', 'grammar', 'theatre'].map((k) => C.buildingSvg(k, 5)).join('');
  }

  /* ------------------------------------------------------------------ boot */
  function renderAll() {
    applyI18n(); swatches(); components(); buildingTabs(); simRender(false); mockups(); cityRender(); icons();
  }
  $$('.lang button').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang;
    try { localStorage.setItem('sz-lang', lang); } catch (e) { /* ignore */ }
    renderAll();
  }));
  $('#defs').innerHTML = I.defsSvg();
  brandMark(); qr(); renderAll();
  if (window.matchMedia('(max-width: 900px)').matches) $('#cert-grid').style.gridTemplateColumns = 'minmax(0, 1fr)';
})();
