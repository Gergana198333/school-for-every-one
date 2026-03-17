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

  if (!profile || String(profile.role ?? '') !== 'student') {
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

async function loadStudentReplies(root) {
  const repliesBody = root.querySelector('#student-replies-table tbody');
  const repliesMessage = root.querySelector('#student-replies-message');
  const studentName = String(root.querySelector('#studentName')?.value ?? '').trim();
  const studentClass = String(root.querySelector('#studentClass')?.value ?? '').trim();

  if (!repliesBody) {
    return;
  }

  if (!studentName || !studentClass) {
    repliesBody.innerHTML = '<tr><td colspan="3" class="text-body-secondary">Попълнете име и клас, за да видите отговорите.</td></tr>';
    return;
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, message, reply_text, replied_at, created_at')
    .ilike('student_name', studentName)
    .ilike('student_class', studentClass)
    .not('reply_text', 'is', null)
    .order('replied_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('Student replies load failed:', error.message);
    repliesBody.innerHTML = '<tr><td colspan="3">Временно недостъпни отговори.</td></tr>';
    setMessage(repliesMessage, `Грешка при зареждане: ${error.message}`, 'error');
    return;
  }

  if (!Array.isArray(data) || data.length === 0) {
    repliesBody.innerHTML = '<tr><td colspan="3" class="text-body-secondary">Все още няма отговори към вашите съобщения.</td></tr>';
    setMessage(repliesMessage, 'Няма налични отговори.', 'neutral');
    return;
  }

  repliesBody.innerHTML = data
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

  setMessage(repliesMessage, `Намерени отговори: ${data.length}.`, 'success');
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
    form.reset();
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
