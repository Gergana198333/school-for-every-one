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
  - За admin достъп: попълни `VITE_ADMIN_EMAILS` (списък с имейли, разделени със запетая)

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
  - `http://localhost:5000/admin/`

## Админ панел

- Страница: `/admin/`
- Вход: Supabase Auth с имейл и парола (`signInWithPassword`)
- Админ панелът позволява:
  - създаване на уроци (`lessons`)
  - публикуване на новини (`news_posts`)
  - преглед на прогрес (`lesson_progress`), последни предавания (`submissions`) и общи статистики

Важно:
- Трябва да имаш създаден потребител в Supabase Auth (Email/Password), за да влезеш в `/admin/`.
- Ако `VITE_ADMIN_EMAILS` е зададен, само имейлите в този allowlist имат достъп до dashboard-а.
- Ако `VITE_ADMIN_EMAILS` липсва или е празен, admin dashboard е блокиран за всички (strict mode).

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

## SQL Migration (Supabase)

- Готов SQL файл: `supabase/migrations/001_initial_school_schema.sql`
- Допълнителен SQL файл за новини: `supabase/migrations/002_news_posts_table.sql`
- В Supabase Dashboard отвори **SQL Editor**
- Постави съдържанието на файла и изпълни заявката
- Това ще създаде базовите таблици и релации за `classes`, `subjects`, `students`, `parent_students`, `lessons`, `lesson_progress`, `submissions`, `contact_messages`, `news_posts`

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
