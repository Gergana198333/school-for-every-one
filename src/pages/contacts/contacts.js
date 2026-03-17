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

async function prefillStudentFromProfile(root) {
  const studentNameInput = root.querySelector('#studentName');
  const studentClassInput = root.querySelector('#studentClass');

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) {
    return;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, class_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    return;
  }

  const role = String(profile.role ?? '');

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
    return;
  }

  if (studentNameInput && !studentNameInput.value) {
    studentNameInput.value = String(profile.full_name ?? '').trim();
  }

  if (studentClassInput && !studentClassInput.value) {
    const className = await resolveClassNameById(profile.class_id);
    if (className) {
      studentClassInput.value = className;
    }
  }
}

function normalizeClassToken(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  const number = raw.match(/\d+/)?.[0] ?? '';
  return number || raw;
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

  if (!repliesBody) {
    return;
  }

  const replyTargets = await buildReplyTargets(root);

  if (replyTargets.length === 0) {
    repliesBody.innerHTML = '<tr><td colspan="3" class="text-body-secondary">Попълнете име и клас, за да видите отговорите.</td></tr>';
    return;
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, message, reply_text, replied_at, created_at, student_class')
    .ilike('student_name', studentName)
    .not('reply_text', 'is', null)
    .order('replied_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('Student replies load failed:', error.message);
    repliesBody.innerHTML = '<tr><td colspan="3">Временно недостъпни отговори.</td></tr>';
    setMessage(repliesMessage, `Грешка при зареждане: ${error.message}`, 'error');
    return;
  }

  const filteredRows = (Array.isArray(data) ? data : []).filter((row) => {
    const rowNameToken = normalizeNameToken(row.student_name);
    const rowClassToken = normalizeClassToken(row.student_class);
    return replyTargets.some((target) => target.name === rowNameToken && target.studentClass === rowClassToken);
  });

  if (filteredRows.length === 0) {
    repliesBody.innerHTML = '<tr><td colspan="3" class="text-body-secondary">Все още няма отговори към вашите съобщения.</td></tr>';
    setMessage(repliesMessage, 'Няма налични отговори.', 'neutral');
    return;
  }

  repliesBody.innerHTML = filteredRows
    .map(
      (row) => `
        <tr>
          <td>${row.message ?? '—'}</td>
          <td>${row.reply_text ?? '—'}</td>
          <td>${row.replied_at ? new Date(row.replied_at).toLocaleString('bg-BG') : (row.created_at ? new Date(row.created_at).toLocaleString('bg-BG') : '-')}</td>
        </tr>
      `
    )
    .join('');

  setMessage(repliesMessage, `Намерени отговори: ${filteredRows.length}.`, 'success');
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
  const submitButton = form?.querySelector('button[type="submit"]');
  const loadRepliesButton = root.querySelector('#load-student-replies-btn');
  const studentNameInput = root.querySelector('#studentName');
  const studentClassInput = root.querySelector('#studentClass');

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

  studentNameInput?.addEventListener('blur', async () => {
    await loadStudentReplies(root);
  });

  studentClassInput?.addEventListener('blur', async () => {
    await loadStudentReplies(root);
  });
}
