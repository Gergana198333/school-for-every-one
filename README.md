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
  - `http://localhost:5000/login/`

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

## Вход и регистрация

- Страница: `/login/`
- На една и съща форма има 2 бутона:
  - `Вход` (`signInWithPassword`)
  - `Регистрация` (`signUp`)
- При регистрация се създава профил в `user_profiles` с роля и клас.
- Посетителите могат да разглеждат публичните страници без вход.
- Класните стаи в `/classes/` са достъпни само за логнати потребители с роля `student|teacher|parent` и зададен `class_id`.

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
- Допълнителен SQL файл за профили и разговори в клас: `supabase/migrations/003_user_profiles_and_class_room_messages.sql`
- Допълнителен SQL файл за RLS политики: `supabase/migrations/004_rls_user_profiles_and_class_room_messages.sql`
- Допълнителен SQL файл за строги родителски политики: `supabase/migrations/005_strict_parent_policies.sql`
- Допълнителен SQL файл за строги учителски политики: `supabase/migrations/006_strict_teacher_policies.sql`
- Допълнителен SQL файл за admin bypass при strict RLS: `supabase/migrations/007_admin_bypass_policies.sql`
- Допълнителен SQL файл за регистрация с кодове: `supabase/migrations/008_enrollment_codes.sql`
- Примерни seed данни за 5 клас (ученици/родители/кодове): `supabase/migrations/009_seed_sample_students_parents.sql`
- Допълнителен SQL файл за свързване на родители по имейл: `supabase/migrations/010_link_parents_by_email.sql`
- Допълнителен SQL файл за admin policy върху кодовете: `supabase/migrations/011_admin_enrollment_codes_policy.sql`
- В Supabase Dashboard отвори **SQL Editor**
- Постави съдържанието на файла и изпълни заявката
- Това ще създаде базовите таблици и релации за `classes`, `subjects`, `students`, `parent_students`, `lessons`, `lesson_progress`, `submissions`, `contact_messages`, `news_posts`, `user_profiles`, `class_room_messages` и по-строги RLS политики за класни стаи, родители, учители и admin bypass.

Препоръчан ред за изпълнение на миграциите: `001` → `002` → `003` → `004` → `005` → `006` → `007` → `008` → `009` (по избор, за примерни данни) → `010` (по избор, за имейл sync) → `011`.

## Admin bypass (DB)

- `007` създава таблица `admin_emails` и функция `is_admin_email()`.
- Добавя RLS policy bypass за админ имейлите върху таблиците със strict RLS.
- Поддържай `admin_emails` в sync с `VITE_ADMIN_EMAILS`, за да съвпадат frontend и database проверките.

## Регистрация с училищни кодове

- Ученици и родители се регистрират с код от училището (напр. `5U00234` за ученик, `5RU00234` за родител).
- При регистрация кодът се валидира и маркира като използван в `enrollment_codes`.
- За родители кодът свързва профила с конкретен ученик в `parent_students`.
- За учители регистрацията остава с избор на клас (без код).

## Свързване на родители по имейл

- `010` добавя таблица `parent_email_student_links` и функция `sync_parent_links_from_emails()`.
- Добавяш редове в `parent_email_student_links` с имейл на родителя и `student_id`.
- Пускаш `select public.sync_parent_links_from_emails();`.
- Функцията намира потребителя в `auth.users` по имейл, създава/обновява `user_profiles` с роля `parent` и добавя връзка в `parent_students`.

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
