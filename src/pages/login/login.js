import { supabase } from '../../supabaseClient';

const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

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

function isAdmin(email) {
  return ADMIN_EMAILS.includes(String(email ?? '').trim().toLowerCase());
}

function getUserRedirect(email) {
  if (isAdmin(email)) {
    return '/admin/';
  }

  return '/classes/';
}

function isCodeBasedRole(role) {
  return role === 'student' || role === 'parent';
}

function updateRoleDependentFields(root) {
  const roleSelect = root.querySelector('#authRole');
  const classWrap = root.querySelector('#auth-class-wrap');
  const classSelect = root.querySelector('#authClass');
  const codeWrap = root.querySelector('#auth-code-wrap');
  const codeInput = root.querySelector('#authSchoolCode');

  const role = String(roleSelect?.value ?? 'student').trim();
  const requiresCode = isCodeBasedRole(role);

  classWrap?.classList.toggle('d-none', requiresCode);
  if (classSelect) {
    classSelect.required = !requiresCode;
  }

  codeWrap?.classList.toggle('d-none', !requiresCode);
  if (codeInput) {
    codeInput.required = requiresCode;
  }
}

async function loadClasses(root) {
  const classSelect = root.querySelector('#authClass');
  if (!classSelect) {
    return;
  }

  const { data, error } = await supabase.from('classes').select('id, name').order('name', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) {
    classSelect.innerHTML = '<option value="">Няма класове</option>';
    return;
  }

  classSelect.innerHTML = data.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
}

async function createTeacherProfile(authData, formData) {
  const userId = authData?.user?.id;
  if (!userId) {
    return;
  }

  const classIdRaw = String(formData.get('classId') ?? '').trim();
  const classId = classIdRaw ? Number(classIdRaw) : null;

  const { error } = await supabase.from('user_profiles').upsert(
    [
      {
        user_id: userId,
        full_name: String(formData.get('fullName') ?? '').trim(),
        role: 'teacher',
        class_id: Number.isFinite(classId) ? classId : null
      }
    ],
    { onConflict: 'user_id' }
  );

  if (error) {
    throw error;
  }
}

async function claimEnrollmentCode(formData, expectedRole) {
  const code = String(formData.get('schoolCode') ?? '').trim().toUpperCase();

  const { error } = await supabase.rpc('claim_enrollment_code', {
    p_code: code,
    p_full_name: String(formData.get('fullName') ?? '').trim() || null,
    p_expected_role: expectedRole
  });

  if (error) {
    throw error;
  }
}

async function handleLogin(root, form) {
  const message = root.querySelector('#auth-message');
  const formData = new FormData(form);

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  setMessage(message, 'Влизане...', 'neutral');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setMessage(message, `Неуспешен вход: ${error.message}`, 'error');
    return;
  }

  setMessage(message, 'Успешен вход.', 'success');
  window.location.href = getUserRedirect(data?.user?.email ?? email);
}

async function handleSignUp(root, form) {
  const message = root.querySelector('#auth-message');
  const formData = new FormData(form);

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const selectedRole = String(formData.get('role') ?? 'student').trim();
  const schoolCode = String(formData.get('schoolCode') ?? '').trim().toUpperCase();
  const teacherClass = String(formData.get('classId') ?? '').trim();

  if (!email || !password) {
    setMessage(message, 'Попълнете имейл и парола.', 'error');
    return;
  }

  if (isCodeBasedRole(selectedRole)) {
    const codePattern = /^\d{1,2}R?U\d{3,10}$/i;
    if (!schoolCode || !codePattern.test(schoolCode)) {
      setMessage(message, 'Въведете валиден училищен код (пример: 5U00234 или 5RU00234).', 'error');
      return;
    }
  }

  if (selectedRole === 'teacher' && !teacherClass) {
    setMessage(message, 'За учител изберете клас.', 'error');
    return;
  }

  setMessage(message, 'Регистрация...', 'neutral');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: String(formData.get('fullName') ?? '').trim(),
        role: selectedRole
      }
    }
  });

  if (error) {
    setMessage(message, `Неуспешна регистрация: ${error.message}`, 'error');
    return;
  }

  try {
    if (isCodeBasedRole(selectedRole)) {
      if (!data?.session) {
        setMessage(
          message,
          'Регистрацията е приета. Потвърдете имейла си, влезте и активирайте кода отново.',
          'success'
        );
        return;
      }

      await claimEnrollmentCode(formData, selectedRole);
    } else {
      await createTeacherProfile(data, formData);
    }
  } catch (profileError) {
    setMessage(
      message,
      `Регистрацията е създадена, но не можа да се активира профилът/кодът: ${profileError.message}`,
      'error'
    );
    return;
  }

  if (data?.session) {
    setMessage(message, 'Успешна регистрация и вход.', 'success');
    window.location.href = getUserRedirect(data?.user?.email ?? email);
    return;
  }

  setMessage(message, 'Регистрацията е приета. Проверете имейла си за потвърждение.', 'success');
}

export async function init(root) {
  const form = root.querySelector('#auth-form');
  const signupButton = root.querySelector('#signup-btn');
  const message = root.querySelector('#auth-message');
  const roleSelect = root.querySelector('#authRole');

  await loadClasses(root);
  updateRoleDependentFields(root);

  const { data: sessionData } = await supabase.auth.getSession();
  const currentEmail = sessionData?.session?.user?.email;

  if (currentEmail) {
    window.location.href = getUserRedirect(currentEmail);
    return;
  }

  roleSelect?.addEventListener('change', () => {
    updateRoleDependentFields(root);
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleLogin(root, form);
  });

  signupButton?.addEventListener('click', async () => {
    if (!form) {
      return;
    }

    try {
      await handleSignUp(root, form);
    } catch (error) {
      setMessage(message, `Грешка: ${error.message}`, 'error');
    }
  });
}
