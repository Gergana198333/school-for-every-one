# Уча България (Vite Multi-Page App)

## Стартиране

1. Инсталиране на зависимости:

   ```bash
   npm install
   ```

2. Supabase настройки:

  - Копирай `.env.example` като `.env`
  - Попълни `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
  - По избор: смени `VITE_SUPABASE_HOMEWORK_BUCKET` (по подразбиране `homework-files`)

3. Стартиране на dev сървър:

   ```bash
   npm run dev
   ```

4. Отвори приложението на:

   - `http://localhost:5000/`
   - `http://localhost:5000/classes`
   - `http://localhost:5000/about`
   - `http://localhost:5000/contacts`
   - `http://localhost:5000/news`

## Supabase таблици

- `classes` (използва се в страница „Класове")
- `subjects`
- `lessons` (за страница „Класове"), примерни колони:
  - `title` или `lesson` или `next_lesson`
  - `teacher` или `teacher_name`
  - `class_id` → foreign key към `classes.id`
  - `subject_id` → foreign key към `subjects.id`
- `contact_messages` с колони:
  - `student_name` (text)
  - `student_class` (text)
  - `message` (text)
  - `homework_file_name` (text, nullable)
  - `homework_file_url` (text, nullable)

## Supabase Storage

- Създай bucket `homework-files` (или името от `VITE_SUPABASE_HOMEWORK_BUCKET`)
- Разреши `insert` за качване на файлове за anon/authenticated role според нужните policies

## Структура на приложението

Проектът е организиран като **multi-page app** с чисти URL адреси (без `#`).

- Всяка страница има собствен `index.html`:
  - `/index.html` → Начало
  - `/classes/index.html` → Класове
  - `/about/index.html` → За училището
  - `/contacts/index.html` → Контакти
  - `/news/index.html` → Новини

- Общият app loader е в `src/main.js`:
  - зарежда HTML фрагменти за `header` и `footer`
  - зарежда HTML/CSS/JS за активната страница

- Всеки UI компонент има собствена папка с отделни файлове:
  - `src/components/header/{header.html, header.css, header.js}`
  - `src/components/footer/{footer.html, footer.css, footer.js}`
  - `src/pages/<page>/{<page>.html, <page>.css, <page>.js}`

## Как работи навигацията

- Навигацията е в `header.html` с линкове към clean URL адреси (`/classes`, `/about` и т.н.)
- При смяна на страница браузърът зарежда съответния page entry и URL адресът се променя
- В `header.js` активният линк се маркира според текущия `pathname`

## Подходящо за училищни ресурси

Приложението е подготвено за:

- преглед на уроци и информация по класове
- публикуване на училищни новини
- изпращане на въпроси и домашни към учители чрез форма в страницата „Контакти"
