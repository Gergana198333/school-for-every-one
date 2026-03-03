import { supabase } from '../../supabaseClient';

const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  if (ADMIN_EMAILS.length === 0) {
    return false;
  }

  return ADMIN_EMAILS.includes(String(email ?? '').trim().toLowerCase());
}

function setMessage(element, text, variant) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove('d-none', 'text-success', 'text-danger', 'text-body-secondary');

  if (variant === 'success') {
    element.classList.add('text-success');
    return;
  }

  if (variant === 'error') {
    element.classList.add('text-danger');
    return;
  }

  element.classList.add('text-body-secondary');
}

function renderStats(statsRoot, stats) {
  if (!statsRoot) {
    return;
  }

  const cards = [
    { label: 'Ученици', value: stats.students },
    { label: 'Уроци', value: stats.lessons },
    { label: 'Предадени домашни', value: stats.submissions },
    { label: 'Съобщения', value: stats.messages }
  ];

  statsRoot.innerHTML = cards
    .map(
      (card) => `
      <div class="col-6 col-lg-3">
        <article class="card bg-white shadow-sm p-3 h-100">
          <p class="mb-1 text-body-secondary">${card.label}</p>
          <p class="h4 mb-0">${card.value}</p>
        </article>
      </div>
    `
    )
    .join('');
}

async function loadSelectOptions(root) {
  const classSelect = root.querySelector('#lessonClass');
  const subjectSelect = root.querySelector('#lessonSubject');

  const [{ data: classesData, error: classesError }, { data: subjectsData, error: subjectsError }] = await Promise.all([
    supabase.from('classes').select('id, name').order('name', { ascending: true }),
    supabase.from('subjects').select('id, name').order('name', { ascending: true })
  ]);

  if (!classesError && Array.isArray(classesData) && classSelect) {
    classSelect.innerHTML = classesData
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join('');
  }

  if (!subjectsError && Array.isArray(subjectsData) && subjectSelect) {
    subjectSelect.innerHTML = subjectsData
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join('');
  }
}

async function loadStats(root) {
  const statsRoot = root.querySelector('#admin-stats');

  const [studentsCount, lessonsCount, submissionsCount, messagesCount] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('lessons').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase.from('contact_messages').select('*', { count: 'exact', head: true })
  ]);

  renderStats(statsRoot, {
    students: studentsCount.count ?? 0,
    lessons: lessonsCount.count ?? 0,
    submissions: submissionsCount.count ?? 0,
    messages: messagesCount.count ?? 0
  });
}

async function loadProgressTable(root) {
  const body = root.querySelector('#admin-progress-table tbody');
  if (!body) {
    return;
  }

  const [{ data: studentsData, error: studentsError }, { data: progressData, error: progressError }] = await Promise.all([
    supabase.from('students').select('id, full_name').order('full_name', { ascending: true }),
    supabase.from('lesson_progress').select('student_id, status')
  ]);

  if (studentsError || progressError || !Array.isArray(studentsData)) {
    body.innerHTML = '<tr><td colspan="4">Няма налични данни за прогрес.</td></tr>';
    return;
  }

  const progressByStudent = new Map();
  for (const row of progressData ?? []) {
    if (!progressByStudent.has(row.student_id)) {
      progressByStudent.set(row.student_id, { completed: 0, total: 0 });
    }

    const entry = progressByStudent.get(row.student_id);
    entry.total += 1;
    if (row.status === 'completed') {
      entry.completed += 1;
    }
  }

  body.innerHTML = studentsData
    .map((student) => {
      const item = progressByStudent.get(student.id) ?? { completed: 0, total: 0 };
      const percent = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;

      return `
        <tr>
          <td>${student.full_name}</td>
          <td>${item.completed}</td>
          <td>${item.total}</td>
          <td>
            <div class="progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar" style="width: ${percent}%">${percent}%</div>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function loadSubmissionsTable(root) {
  const body = root.querySelector('#admin-submissions-table tbody');
  if (!body) {
    return;
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('id, file_name, submitted_at, students(full_name), lessons(title)')
    .order('submitted_at', { ascending: false })
    .limit(10);

  if (error || !Array.isArray(data) || data.length === 0) {
    body.innerHTML = '<tr><td colspan="4">Няма предадени домашни.</td></tr>';
    return;
  }

  body.innerHTML = data
    .map(
      (row) => `
        <tr>
          <td>${row.students?.full_name ?? 'Няма данни'}</td>
          <td>${row.lessons?.title ?? 'Няма данни'}</td>
          <td>${row.file_name ?? 'Няма файл'}</td>
          <td>${row.submitted_at ? new Date(row.submitted_at).toLocaleString('bg-BG') : '-'}</td>
        </tr>
      `
    )
    .join('');
}

async function refreshDashboard(root) {
  await Promise.all([loadStats(root), loadProgressTable(root), loadSubmissionsTable(root)]);
}

async function handleLessonCreate(root, form) {
  const message = root.querySelector('#admin-lesson-message');
  const formData = new FormData(form);

  const payload = {
    title: String(formData.get('lessonTitle') ?? '').trim(),
    description: String(formData.get('lessonDescription') ?? '').trim(),
    class_id: Number(formData.get('lessonClass')),
    subject_id: Number(formData.get('lessonSubject')),
    teacher_name: String(formData.get('lessonTeacher') ?? '').trim(),
    published_at: new Date().toISOString()
  };

  const { error } = await supabase.from('lessons').insert([payload]);

  if (error) {
    setMessage(message, `Грешка при запис на урок: ${error.message}`, 'error');
    return;
  }

  form.reset();
  setMessage(message, 'Урокът е записан успешно.', 'success');
  await refreshDashboard(root);
}

async function handleNewsCreate(root, form) {
  const message = root.querySelector('#admin-news-message');
  const formData = new FormData(form);

  const payload = {
    title: String(formData.get('newsTitle') ?? '').trim(),
    content: String(formData.get('newsContent') ?? '').trim(),
    published_at: new Date().toISOString()
  };

  const { error } = await supabase.from('news_posts').insert([payload]);

  if (error) {
    setMessage(
      message,
      `Грешка при публикуване на новина: ${error.message}. Проверете дали има таблица news_posts.`,
      'error'
    );
    return;
  }

  form.reset();
  setMessage(message, 'Новината е публикувана успешно.', 'success');
}

function toggleViews(root, isLoggedIn) {
  const loginView = root.querySelector('#admin-login-view');
  const dashboardView = root.querySelector('#admin-dashboard-view');
  const logoutButton = root.querySelector('#admin-logout-btn');

  loginView?.classList.toggle('d-none', isLoggedIn);
  dashboardView?.classList.toggle('d-none', !isLoggedIn);
  logoutButton?.classList.toggle('d-none', !isLoggedIn);
}

async function enforceAdminAccess(root, session, messageElement) {
  if (ADMIN_EMAILS.length === 0) {
    if (session) {
      await supabase.auth.signOut();
    }

    toggleViews(root, false);
    setMessage(
      messageElement,
      'Админ достъпът е изключен. Задайте VITE_ADMIN_EMAILS в .env с позволени имейли.',
      'error'
    );
    return false;
  }

  const userEmail = session?.user?.email ?? '';

  if (!session || !userEmail) {
    toggleViews(root, false);
    return false;
  }

  if (isAdminEmail(userEmail)) {
    toggleViews(root, true);
    return true;
  }

  await supabase.auth.signOut();
  toggleViews(root, false);
  setMessage(
    messageElement,
    'Този акаунт няма админ достъп. Добавете имейла в VITE_ADMIN_EMAILS или влезте с админ акаунт.',
    'error'
  );
  return false;
}

export async function init(root) {
  const loginForm = root.querySelector('#admin-login-form');
  const loginMessage = root.querySelector('#admin-login-message');
  const lessonForm = root.querySelector('#admin-lesson-form');
  const newsForm = root.querySelector('#admin-news-form');
  const logoutButton = root.querySelector('#admin-logout-btn');

  const { data: sessionData } = await supabase.auth.getSession();
  const isAllowedSession = await enforceAdminAccess(root, sessionData?.session ?? null, loginMessage);

  if (isAllowedSession) {
    await loadSelectOptions(root);
    await refreshDashboard(root);
  }

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);

    const email = String(formData.get('adminEmail') ?? '').trim();
    const password = String(formData.get('adminPassword') ?? '');

    setMessage(loginMessage, 'Влизане...', 'neutral');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(loginMessage, `Неуспешен вход: ${error.message}`, 'error');
      return;
    }

    const isAllowed = await enforceAdminAccess(root, data?.session ?? null, loginMessage);
    if (!isAllowed) {
      return;
    }

    setMessage(loginMessage, 'Успешен вход.', 'success');
    await loadSelectOptions(root);
    await refreshDashboard(root);
  });

  lessonForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleLessonCreate(root, lessonForm);
  });

  newsForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleNewsCreate(root, newsForm);
  });

  logoutButton?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    toggleViews(root, false);
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const isAllowed = await enforceAdminAccess(root, session, loginMessage);

    if (isAllowed) {
      await loadSelectOptions(root);
      await refreshDashboard(root);
    }
  });
}
