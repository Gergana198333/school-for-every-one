import { supabase } from '../../supabaseClient';

const LESSON_MATERIAL_BUCKET = import.meta.env.VITE_SUPABASE_LESSON_BUCKET || 'lesson-materials';
const ALLOWED_LESSON_MATERIAL_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
const ALLOWED_LESSON_MATERIAL_EXTENSIONS = new Set(['pdf', 'docx', 'mp4', 'pptx']);

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

async function isAdminProfile(userId) {
  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Admin profile check failed:', error.message);
    return false;
  }

  return String(data?.role ?? '').trim().toLowerCase() === 'admin';
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

function pickFormValue(formData, keys) {
  for (const key of keys) {
    const value = formData.get(key);
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
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
  const subjectInput = root.querySelector('#lessonSubjectInput');
  const subjectList = root.querySelector('#lessonSubjectList');
  const studentClassSelect = root.querySelector('#adminStudentClass');

  const [
    { data: classesData, error: classesError },
    { data: subjectsData, error: subjectsError },
    { data: studentsData, error: studentsError }
  ] = await Promise.all([
    supabase.from('classes').select('id, name').order('name', { ascending: true }),
    supabase.from('subjects').select('id, name').order('name', { ascending: true }),
    supabase.from('students').select('id, full_name, class_id').order('full_name', { ascending: true })
  ]);

  if (!classesError && Array.isArray(classesData) && classSelect) {
    classSelect.innerHTML = classesData
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join('');
  }

  if (!classesError && Array.isArray(classesData) && studentClassSelect) {
    studentClassSelect.innerHTML = classesData
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join('');
  }

  if (!subjectsError && Array.isArray(subjectsData) && subjectList) {
    subjectList.innerHTML = subjectsData.map((item) => `<option value="${item.name}"></option>`).join('');

    if (subjectInput && !subjectInput.value && subjectsData.length > 0) {
      subjectInput.value = subjectsData[0].name;
    }
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

  try {

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
  } catch (error) {
    console.warn('Admin progress table load failed:', error?.message ?? error);
    body.innerHTML = '<tr><td colspan="4">Временно недостъпни данни за прогрес.</td></tr>';
  }
}

async function loadSubmissionsTable(root) {
  const body = root.querySelector('#admin-submissions-table tbody');
  if (!body) {
    return;
  }

  try {

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
  } catch (error) {
    console.warn('Admin submissions table load failed:', error?.message ?? error);
    body.innerHTML = '<tr><td colspan="4">Временно недостъпни предавания.</td></tr>';
  }
}

async function loadMessagesTable(root) {
  const body = root.querySelector('#admin-messages-table tbody');
  if (!body) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, student_name, student_class, message, homework_file_name, homework_file_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !Array.isArray(data) || data.length === 0) {
      body.innerHTML = '<tr><td colspan="5">Няма изпратени съобщения.</td></tr>';
      return;
    }

    body.innerHTML = data
      .map((row) => {
        const fileCell = row.homework_file_url
          ? `<a href="${row.homework_file_url}" target="_blank" rel="noopener noreferrer">${row.homework_file_name ?? 'Файл'}</a>`
          : '—';

        return `
          <tr>
            <td>
              <div>${row.student_name ?? 'Няма данни'}</div>
              <div class="admin-table-meta">${row.student_class ?? 'Няма клас'}</div>
            </td>
            <td class="admin-message-cell">${row.message ?? '—'}</td>
            <td>${fileCell}</td>
            <td>${row.created_at ? new Date(row.created_at).toLocaleString('bg-BG') : '-'}</td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    console.warn('Admin messages table load failed:', error?.message ?? error);
    body.innerHTML = '<tr><td colspan="5">Временно недостъпни съобщения.</td></tr>';
  }
}

async function loadRecentStudentCodes(root) {
  const body = root.querySelector('#admin-student-codes-table tbody');
  if (!body) {
    return;
  }

  const [{ data: classesData }, { data: studentsData, error: studentsError }] = await Promise.all([
    supabase.from('classes').select('id, name'),
    supabase
      .from('students')
      .select('id, full_name, class_id, created_at, enrollment_codes(code, role, created_at)')
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  if (studentsError || !Array.isArray(studentsData) || studentsData.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="text-body-secondary">Няма добавени ученици.</td></tr>';
    return;
  }

  const classNameById = new Map((classesData ?? []).map((item) => [item.id, item.name]));

  body.innerHTML = studentsData
    .map((student) => {
      const codes = Array.isArray(student.enrollment_codes) ? student.enrollment_codes : [];
      const studentCode = codes.find((item) => item.role === 'student')?.code ?? '—';
      const parentCode = codes.find((item) => item.role === 'parent')?.code ?? '—';
      const className = classNameById.get(student.class_id) ?? `Клас #${student.class_id ?? '-'}`;

      return `
        <tr>
          <td>${student.full_name ?? 'Няма данни'}</td>
          <td>${className}</td>
          <td><span class="badge text-bg-light border">${studentCode}</span></td>
          <td><span class="badge text-bg-light border">${parentCode}</span></td>
        </tr>
      `;
    })
    .join('');
}

async function loadRegisteredParentsTable(root) {
  const body = root.querySelector('#admin-parents-table tbody');
  if (!body) {
    return;
  }

  const { data: linksData, error: linksError } = await supabase
    .from('parent_students')
    .select('parent_user_id, student_id, students(full_name, classes(name))')
    .order('id', { ascending: false })
    .limit(100);

  if (linksError || !Array.isArray(linksData) || linksData.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="text-body-secondary">Няма регистрирани родители.</td></tr>';
    return;
  }

  const parentIds = [...new Set(linksData.map((item) => item.parent_user_id).filter(Boolean))];
  const { data: parentProfiles } = await supabase
    .from('user_profiles')
    .select('user_id, full_name, role')
    .in('user_id', parentIds)
    .eq('role', 'parent');

  const parentNameById = new Map((parentProfiles ?? []).map((item) => [item.user_id, item.full_name || 'Родител']));

  body.innerHTML = linksData
    .map((item) => {
      const parentName = parentNameById.get(item.parent_user_id) ?? 'Родител';
      const studentName = item.students?.full_name ?? 'Няма данни';
      const className = item.students?.classes?.name ?? 'Няма данни';

      return `
        <tr>
          <td>${parentName}</td>
          <td>${studentName}</td>
          <td>${className}</td>
        </tr>
      `;
    })
    .join('');
}

async function refreshDashboard(root) {
  await Promise.allSettled([
    loadStats(root),
    loadProgressTable(root),
    loadSubmissionsTable(root),
    loadMessagesTable(root),
    loadRecentStudentCodes(root),
    loadRegisteredParentsTable(root)
  ]);
}

async function getOrCreateSubjectId(subjectName) {
  const normalizedName = String(subjectName ?? '').trim();
  if (!normalizedName) {
    throw new Error('Попълнете предмет.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('name', normalizedName)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('subjects')
    .insert([{ name: normalizedName }])
    .select('id')
    .single();

  if (insertError || !inserted?.id) {
    throw insertError ?? new Error('Неуспешно създаване на предмет.');
  }

  return inserted.id;
}

async function handleLessonCreate(root, form) {
  const message = root.querySelector('#admin-lesson-message');
  const formData = new FormData(form);
  const materialFile = formData.get('lessonMaterial') ?? formData.get('material') ?? formData.get('file');
  const subjectName = String(pickFormValue(formData, ['lessonSubjectInput', 'subject']) ?? '').trim();

  let subjectId;
  try {
    subjectId = await getOrCreateSubjectId(subjectName);
  } catch (subjectError) {
    setMessage(message, `Грешка при предмет: ${subjectError.message}`, 'error');
    return;
  }

  const payload = {
    title: String(pickFormValue(formData, ['lessonTitle', 'title']) ?? '').trim(),
    description: String(pickFormValue(formData, ['lessonDescription', 'description']) ?? '').trim(),
    class_id: Number(pickFormValue(formData, ['lessonClass', 'classId', 'class_id'])),
    subject_id: subjectId,
    teacher_name: String(pickFormValue(formData, ['lessonTeacher', 'teacherName', 'teacher_name']) ?? '').trim(),
    published_at: new Date().toISOString()
  };

  const hasMaterial = materialFile instanceof File && materialFile.name;

  if (hasMaterial) {
    const fileType = String(materialFile.type ?? '').trim();
    const extension = materialFile.name.includes('.') ? materialFile.name.split('.').pop()?.toLowerCase() : '';
    const typeAllowed = fileType ? ALLOWED_LESSON_MATERIAL_TYPES.has(fileType) : false;
    const extensionAllowed = extension ? ALLOWED_LESSON_MATERIAL_EXTENSIONS.has(extension) : false;

    if (!typeAllowed && !extensionAllowed) {
      setMessage(message, 'Позволени файлове: PDF, DOCX, MP4, PPTX.', 'error');
      return;
    }
  }

  const { data: lessonRow, error } = await supabase.from('lessons').insert([payload]).select('id').single();

  if (error || !lessonRow?.id) {
    setMessage(message, `Грешка при запис на урок: ${error.message}`, 'error');
    return;
  }

  if (hasMaterial) {
    const extension = materialFile.name.includes('.') ? materialFile.name.split('.').pop()?.toLowerCase() : 'bin';
    const safeExtension = extension && /^[a-z0-9]+$/.test(extension) ? extension : 'bin';
    const storagePath = `lessons/${lessonRow.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage
      .from(LESSON_MATERIAL_BUCKET)
      .upload(storagePath, materialFile, { upsert: false });

    if (uploadError) {
      setMessage(
        message,
        `Урокът е записан, но файлът не е качен: ${uploadError.message}. Проверете bucket ${LESSON_MATERIAL_BUCKET}.`,
        'error'
      );
      await refreshDashboard(root);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(LESSON_MATERIAL_BUCKET).getPublicUrl(storagePath);

    const materialPayload = {
      lesson_id: lessonRow.id,
      file_name: materialFile.name,
      file_path: storagePath,
      file_url: publicUrlData?.publicUrl ?? null,
      file_type: materialFile.type
    };

    const { error: materialError } = await supabase.from('lesson_materials').insert([materialPayload]);
    if (materialError) {
      setMessage(
        message,
        `Урокът е записан, но линкът към файла не е записан: ${materialError.message}.`,
        'error'
      );
      await refreshDashboard(root);
      return;
    }
  }

  form.reset();
  setMessage(message, 'Урокът е записан успешно.', 'success');
  await refreshDashboard(root);
}

async function handleNewsCreate(root, form) {
  const message = root.querySelector('#admin-news-message');
  const formData = new FormData(form);

  const payload = {
    title: String(pickFormValue(formData, ['newsTitle', 'title']) ?? '').trim(),
    content: String(pickFormValue(formData, ['newsContent', 'content']) ?? '').trim(),
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

function extractGradeFromClassName(className, classId) {
  const fromName = String(className ?? '').match(/\d+/);
  if (fromName?.[0]) {
    return fromName[0];
  }

  return String(classId ?? '').trim();
}

function padEnrollmentNumber(value) {
  const numeric = String(value ?? '').replace(/\D/g, '');
  return numeric.padStart(5, '0');
}

async function handleStudentCreate(root, form) {
  const message = root.querySelector('#admin-student-message');
  const formData = new FormData(form);

  const studentName = String(formData.get('adminStudentName') ?? '').trim();
  const classId = Number(formData.get('adminStudentClass'));
  const enrollmentNumberRaw = String(formData.get('adminEnrollmentNumber') ?? '').trim();

  if (!studentName || !Number.isFinite(classId)) {
    setMessage(message, 'Попълнете име и клас.', 'error');
    return;
  }

  const enrollmentNumber = padEnrollmentNumber(enrollmentNumberRaw);
  if (!enrollmentNumber || enrollmentNumber.length > 10) {
    setMessage(message, 'Невалиден № записване.', 'error');
    return;
  }

  const classSelect = root.querySelector('#adminStudentClass');
  const selectedClassName = classSelect?.selectedOptions?.[0]?.textContent ?? '';
  const grade = extractGradeFromClassName(selectedClassName, classId);

  if (!grade) {
    setMessage(message, 'Не може да се определи клас за генериране на код.', 'error');
    return;
  }

  const studentCode = `${grade}U${enrollmentNumber}`.toUpperCase();
  const parentCode = `${grade}RU${enrollmentNumber}`.toUpperCase();

  const { data: insertedStudent, error: studentError } = await supabase
    .from('students')
    .insert([
      {
        full_name: studentName,
        class_id: classId
      }
    ])
    .select('id')
    .single();

  if (studentError || !insertedStudent) {
    setMessage(message, `Грешка при създаване на ученик: ${studentError?.message ?? 'неизвестна грешка'}`, 'error');
    return;
  }

  const studentId = insertedStudent.id;
  const { error: codesError } = await supabase.from('enrollment_codes').insert([
    {
      code: studentCode,
      role: 'student',
      class_id: classId,
      student_id: studentId
    },
    {
      code: parentCode,
      role: 'parent',
      class_id: classId,
      student_id: studentId
    }
  ]);

  if (codesError) {
    await supabase.from('students').delete().eq('id', studentId);
    setMessage(
      message,
      `Ученикът не е записан заради кодове: ${codesError.message}. Проверете за дублиран № записване.`,
      'error'
    );
    return;
  }

  form.reset();
  await loadSelectOptions(root);
  await refreshDashboard(root);
  setMessage(message, `Ученикът е записан. Кодове: ${studentCode} и ${parentCode}.`, 'success');
}

function toggleViews(root, isLoggedIn) {
  const loginView = root.querySelector('#admin-login-view');
  const dashboardView = root.querySelector('#admin-dashboard-view');
  const logoutButton = root.querySelector('#admin-logout-btn');

  loginView?.classList.toggle('d-none', isLoggedIn);
  dashboardView?.classList.toggle('d-none', !isLoggedIn);
  logoutButton?.classList.toggle('d-none', !isLoggedIn);
}

async function logoutToLogin(root) {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.warn('Admin logout failed:', error?.message ?? error);
  }

  toggleViews(root, false);
  window.location.href = '/login/';
}

async function enforceAdminAccess(root, session, messageElement) {
  const userEmail = session?.user?.email ?? '';
  const userId = session?.user?.id ?? '';

  if (!session) {
    toggleViews(root, false);
    return false;
  }

  const allowedByEmail = Boolean(userEmail) && isAdminEmail(userEmail);
  const allowedByRole = await isAdminProfile(userId);

  if (allowedByEmail || allowedByRole) {
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
  const lessonForm = root.querySelector('#admin-lesson-form, #lessonForm');
  const newsForm = root.querySelector('#admin-news-form, #newsForm');
  const studentForm = root.querySelector('#admin-student-form');
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

  studentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleStudentCreate(root, studentForm);
  });

  logoutButton?.addEventListener('click', async () => {
    await logoutToLogin(root);
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const isAllowed = await enforceAdminAccess(root, session, loginMessage);

    if (isAllowed) {
      await loadSelectOptions(root);
      await refreshDashboard(root);
    }
  });
}
