import { supabase } from '../../supabaseClient';

const HOMEWORK_BUCKET = import.meta.env.VITE_SUPABASE_HOMEWORK_BUCKET || 'homework-files';

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

function normalizeNameToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function resolveClassNameById(classId) {
  const normalizedId = Number(classId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return '';
  }

  const { data, error } = await supabase.from('classes').select('name').eq('id', normalizedId).maybeSingle();
  if (error) {
    return '';
  }

  return String(data?.name ?? '').trim();
}

async function resolveCurrentProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return null;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, class_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const className = await resolveClassNameById(profile.class_id);

  return {
    userId,
    role: String(profile.role ?? ''),
    fullName: String(profile.full_name ?? '').trim(),
    classId: profile.class_id,
    className
  };
}

async function prefillStudentFromProfile(root) {
  const studentNameInput = root.querySelector('#studentName');
  const studentClassInput = root.querySelector('#studentClass');

  const currentProfile = await resolveCurrentProfile();
  if (!currentProfile) {
    return;
  }

  const { role, userId, fullName, className, classId } = currentProfile;

  if (role === 'parent') {
    const { data: linksData, error: linksError } = await supabase
      .from('parent_students')
      .select('student_id, students(full_name, class_id, classes(name))')
      .eq('parent_user_id', userId)
      .limit(1);

    if (!linksError && Array.isArray(linksData) && linksData.length > 0) {
      const firstStudent = linksData[0]?.students;
      if (studentNameInput && !studentNameInput.value) {
        studentNameInput.value = String(firstStudent?.full_name ?? '').trim();
      }

      if (studentClassInput && !studentClassInput.value) {
        const className = String(firstStudent?.classes?.name ?? '').trim();
        if (className) {
          studentClassInput.value = className;
        }
      }
    }

    return;
  }

  if (role !== 'student') {
    if (role === 'teacher') {
      if (studentNameInput && !studentNameInput.value) {
        studentNameInput.value = fullName;
      }

      if (studentClassInput && !studentClassInput.value && className) {
        studentClassInput.value = className;
      }
    }

    return;
  }

  if (studentNameInput && !studentNameInput.value) {
    studentNameInput.value = fullName;
  }

  if (studentClassInput && !studentClassInput.value) {
    const studentClassName = className || (await resolveClassNameById(classId));
    if (studentClassName) {
      studentClassInput.value = studentClassName;
    }
  }
}

function normalizeClassToken(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const number = raw.match(/\d+/)?.[0] ?? '';
  return number || raw;
}

function isReplyNameMatch(rowName, targetName) {
  const normalizedRowName = normalizeNameToken(rowName);
  const normalizedTargetName = normalizeNameToken(targetName);

  if (!normalizedRowName || !normalizedTargetName) {
    return false;
  }

  if (normalizedRowName === normalizedTargetName) {
    return true;
  }

  if (normalizedRowName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedRowName)) {
    return true;
  }

  const targetFirstName = normalizedTargetName.split(' ')[0];
  if (targetFirstName && normalizedRowName.includes(targetFirstName)) {
    return true;
  }

  return false;
}

async function buildReplyTargets(root) {
  const targets = [];
  const addTarget = (name, studentClass) => {
    const normalizedName = normalizeNameToken(name);
    const normalizedClass = normalizeClassToken(studentClass);
    if (!normalizedName || !normalizedClass) {
      return;
    }

    targets.push({
      name: normalizedName,
      studentClass: normalizedClass
    });
  };

  const typedName = String(root.querySelector('#studentName')?.value ?? '').trim();
  const typedClass = String(root.querySelector('#studentClass')?.value ?? '').trim();

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (userId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name, class_id')
      .eq('user_id', userId)
      .maybeSingle();

    const role = String(profile?.role ?? '');

    if (role === 'student') {
      const className = await resolveClassNameById(profile?.class_id);
      addTarget(profile?.full_name, className || typedClass);
    }

    if (role === 'parent') {
      const { data: linksData, error: linksError } = await supabase
        .from('parent_students')
        .select('student_id, students(full_name, class_id, classes(name))')
        .eq('parent_user_id', userId)
        .limit(100);

      if (!linksError && Array.isArray(linksData)) {
        for (const item of linksData) {
          addTarget(item?.students?.full_name, item?.students?.classes?.name);
        }
      }
    }
  }

  addTarget(typedName, typedClass);

  const deduped = [...new Map(targets.map((item) => [`${item.name}|${item.studentClass}`, item])).values()];
  return deduped;
}

async function loadStudentReplies(root) {
  const repliesBody = root.querySelector('#student-replies-table tbody');
  const repliesMessage = root.querySelector('#student-replies-message');
  const repliesTitle = root.querySelector('#student-replies-title');

  if (!repliesBody) {
    return;
  }

  const currentProfile = await resolveCurrentProfile();
  const role = String(currentProfile?.role ?? '');
  const isTeacher = role === 'teacher';
  const teacherClassToken = normalizeClassToken(currentProfile?.className);

  if (repliesTitle) {
    repliesTitle.textContent = isTeacher ? 'Съобщения за класа' : 'Отговори към ученика';
  }

  if (isTeacher && !teacherClassToken) {
    repliesBody.innerHTML = '<tr><td colspan="4" class="text-body-secondary">Липсва клас в учителския профил.</td></tr>';
    setMessage(repliesMessage, 'Добавете class_id в user_profiles за учителя.', 'error');
    return;
  }

  const replyTargets = await buildReplyTargets(root);

  if (!isTeacher && replyTargets.length === 0) {
    repliesBody.innerHTML = '<tr><td colspan="4" class="text-body-secondary">Попълнете име и клас, за да видите отговорите.</td></tr>';
    return;
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, student_name, student_class, message, reply_text, replied_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.warn('Student replies load failed:', error.message);
    repliesBody.innerHTML = '<tr><td colspan="4">Временно недостъпни отговори.</td></tr>';
    setMessage(repliesMessage, `Грешка при зареждане: ${error.message}`, 'error');
    return;
  }

  const filteredRows = (Array.isArray(data) ? data : []).filter((row) => {
    const rowNameToken = normalizeNameToken(row.student_name);
    const rowClassToken = normalizeClassToken(row.student_class);

    if (isTeacher) {
      return rowClassToken === teacherClassToken;
    }

    if (!row.reply_text) {
      return false;
    }

    return replyTargets.some((target) => {
      const classMatches = target.studentClass === rowClassToken;
      const nameMatches = isReplyNameMatch(rowNameToken, target.name);
      return classMatches && nameMatches;
    });
  });

  if (filteredRows.length === 0) {
    repliesBody.innerHTML = `<tr><td colspan="4" class="text-body-secondary">${isTeacher ? 'Все още няма съобщения за вашия клас.' : 'Все още няма отговори към вашите съобщения.'}</td></tr>`;
    setMessage(repliesMessage, isTeacher ? 'Няма налични съобщения за класа.' : 'Няма налични отговори.', 'neutral');
    return;
  }

  repliesBody.innerHTML = filteredRows
    .map(
      (row) => `
        <tr>
          <td><div class="fw-semibold">${row.student_name ?? '—'}</div><div class="small text-body-secondary">${row.message ?? '—'}</div></td>
          <td>${row.reply_text ?? '—'}</td>
          <td>${row.replied_at ? new Date(row.replied_at).toLocaleString('bg-BG') : (row.created_at ? new Date(row.created_at).toLocaleString('bg-BG') : '-')}</td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-danger js-delete-reply" data-message-id="${row.id}">Изтрий</button>
          </td>
        </tr>
      `
    )
    .join('');

  setMessage(repliesMessage, isTeacher ? `Намерени съобщения за класа: ${filteredRows.length}.` : `Намерени отговори: ${filteredRows.length}.`, 'success');
}

async function deleteReplyMessage(root, messageId) {
  const repliesMessage = root.querySelector('#student-replies-message');
  const normalizedId = Number(messageId);

  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    setMessage(repliesMessage, 'Невалиден запис за изтриване.', 'error');
    return;
  }

  const { error } = await supabase
    .from('contact_messages')
    .delete()
    .eq('id', normalizedId);

  if (error) {
    console.warn('Delete contact message failed:', error.message);
    setMessage(repliesMessage, `Грешка при изтриване: ${error.message}`, 'error');
    return;
  }

  setMessage(repliesMessage, 'Съобщението е изтрито.', 'success');
  await loadStudentReplies(root);
}

async function submitToSupabase(form) {
  const formData = new FormData(form);
  const file = formData.get('homeworkFile');
  const hasHomeworkFile = file instanceof File && file.name;

  let uploadedFilePath = null;
  let uploadedFileUrl = null;

  if (hasHomeworkFile) {
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
    const safeExtension = extension && /^[a-z0-9]+$/.test(extension) ? extension : 'bin';
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;
    const storagePath = `homework/${uniqueFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(HOMEWORK_BUCKET)
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      return { error: uploadError };
    }

    uploadedFilePath = storagePath;

    const { data: publicUrlData } = supabase.storage
      .from(HOMEWORK_BUCKET)
      .getPublicUrl(storagePath);

    uploadedFileUrl = publicUrlData?.publicUrl ?? null;
  }

  const payload = {
    student_name: String(formData.get('studentName') ?? '').trim(),
    student_class: String(formData.get('studentClass') ?? '').trim(),
    message: String(formData.get('questionText') ?? '').trim(),
    homework_file_name: hasHomeworkFile ? file.name : null,
    homework_file_url: uploadedFileUrl
  };

  return supabase.from('contact_messages').insert([payload]);
}

export function init(root) {
  const form = root.querySelector('#contact-form');
  const message = root.querySelector('#form-message');
  const candidateNote = root.querySelector('#candidate-contact-note');
  const submitButton = form?.querySelector('button[type="submit"]');
  const loadRepliesButton = root.querySelector('#load-student-replies-btn');
  const repliesTable = root.querySelector('#student-replies-table');
  const studentNameInput = root.querySelector('#studentName');
  const studentClassInput = root.querySelector('#studentClass');
  const queryParams = new URLSearchParams(window.location.search);
  const isApplyFlow = queryParams.get('apply') === '1';

  supabase.auth.getSession().then(({ data }) => {
    const isLoggedIn = Boolean(data?.session?.user);
    candidateNote?.classList.toggle('d-none', isLoggedIn || !isApplyFlow);
  });

  prefillStudentFromProfile(root).finally(() => {
    loadStudentReplies(root);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    submitButton?.setAttribute('disabled', 'disabled');
    setMessage(message, 'Изпращане...', 'neutral');

    let error = null;
    try {
      const result = await submitToSupabase(form);
      error = result?.error ?? null;
    } catch (runtimeError) {
      error = runtimeError;
    }

    submitButton?.removeAttribute('disabled');

    if (error) {
      const details = error?.message ? ` (${error.message})` : '';
      console.error('Contact form submit failed:', error);
      setMessage(message, `Възникна грешка при изпращане. Опитайте отново.${details}`, 'error');
      return;
    }

    setMessage(message, 'Формата е изпратена успешно.', 'success');
    const nameValue = String(studentNameInput?.value ?? '');
    const classValue = String(studentClassInput?.value ?? '');
    form.reset();
    if (studentNameInput) {
      studentNameInput.value = nameValue;
    }
    if (studentClassInput) {
      studentClassInput.value = classValue;
    }
    await loadStudentReplies(root);
  });

  loadRepliesButton?.addEventListener('click', async () => {
    await loadStudentReplies(root);
  });

  repliesTable?.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.js-delete-reply');
    if (!deleteButton) {
      return;
    }

    const { messageId } = deleteButton.dataset;
    if (!window.confirm('Сигурни ли сте, че искате да изтриете това съобщение?')) {
      return;
    }

    deleteButton.setAttribute('disabled', 'disabled');
    await deleteReplyMessage(root, messageId);
    deleteButton.removeAttribute('disabled');
  });

  studentNameInput?.addEventListener('blur', async () => {
    await loadStudentReplies(root);
  });

  studentClassInput?.addEventListener('blur', async () => {
    await loadStudentReplies(root);
  });
}
