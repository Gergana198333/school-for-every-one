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

function getEmailRedirectTo() {
  return `${window.location.origin}/login/`;
}

function isRecoveryMode() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  const hashType = String(hash.get('type') ?? '').toLowerCase();
  const queryType = String(search.get('type') ?? '').toLowerCase();
  return hashType === 'recovery' || queryType === 'recovery';
}

function toggleRecoveryMode(root, enabled) {
  const roleWrap = root.querySelector('#auth-class-wrap');
  const codeWrap = root.querySelector('#auth-code-wrap');
  const roleSelectWrap = root.querySelector('#authRole')?.closest('.mb-3');
  const fullNameWrap = root.querySelector('#authFullName')?.closest('.mb-3');
  const recoveryWrap = root.querySelector('#auth-recovery-wrap');
  const loginButton = root.querySelector('[data-auth-action="login"]');
  const signupButton = root.querySelector('#signup-btn');
  const resetButton = root.querySelector('#reset-password-btn');

  roleWrap?.classList.toggle('d-none', enabled);
  codeWrap?.classList.toggle('d-none', enabled);
  roleSelectWrap?.classList.toggle('d-none', enabled);
  fullNameWrap?.classList.toggle('d-none', enabled);
  recoveryWrap?.classList.toggle('d-none', !enabled);
  loginButton?.classList.toggle('d-none', enabled);
  signupButton?.classList.toggle('d-none', enabled);
  resetButton?.classList.toggle('d-none', enabled);
}

function isEmailNotConfirmedError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('email not confirmed') || message.includes('email_not_confirmed');
}

function isInvalidLoginCredentialsError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('invalid login credentials') || message.includes('invalid_credentials');
}

function isRateLimitError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('rate limit exceeded') || message.includes('over_email_send_rate_limit');
}

function isAlreadyRegisteredError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('already registered') || message.includes('already exists') || message.includes('user_already_exists');
}

function startButtonCooldown(button, seconds) {
  if (!button) {
    return;
  }

  const originalText = button.dataset.originalText || button.textContent || 'Забравена парола';
  button.dataset.originalText = originalText;

  let remaining = Math.max(1, Number(seconds) || 60);
  button.disabled = true;
  button.textContent = `Изчакайте ${remaining} сек.`;

  const timer = window.setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      window.clearInterval(timer);
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    button.textContent = `Изчакайте ${remaining} сек.`;
  }, 1000);
}

async function resendConfirmationEmail(email) {
  const normalizedEmail = String(email ?? '').trim();
  if (!normalizedEmail) {
    return { ok: false, reason: 'missing-email' };
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo: getEmailRedirectTo()
    }
  });

  if (error) {
    return { ok: false, reason: error.message };
  }

  return { ok: true };
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

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  setMessage(message, 'Влизане...', 'neutral');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (isEmailNotConfirmedError(error)) {
      const resendResult = await resendConfirmationEmail(email);

      if (resendResult.ok) {
        setMessage(
          message,
          'Имейлът още не е потвърден. Изпратихме нов линк за потвърждение — проверете Inbox/Spam и после опитайте вход отново.',
          'error'
        );
        return;
      }

      setMessage(
        message,
        'Имейлът не е потвърден. Потвърждението не се прави от админ панела — отворете линка в пощата си.',
        'error'
      );
      return;
    }

    if (isInvalidLoginCredentialsError(error)) {
      setMessage(
        message,
        'Невалиден вход: няма такъв акаунт или паролата е грешна. Ако току-що сте попълнили формата, използвайте бутона „Регистрация“ (не „Вход“), после потвърдете имейла и влезте със същия имейл/парола.',
        'error'
      );
      return;
    }

    setMessage(message, `Неуспешен вход: ${error.message}`, 'error');
    return;
  }

  setMessage(message, 'Успешен вход.', 'success');
  window.location.href = getUserRedirect(data?.user?.email ?? email);
}

async function handleSignUp(root, form) {
  const message = root.querySelector('#auth-message');
  const formData = new FormData(form);

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  const selectedRole = String(formData.get('role') ?? 'student').trim();
  const schoolCode = String(formData.get('schoolCode') ?? '').trim().toUpperCase();
  const teacherClass = String(formData.get('classId') ?? '').trim();

  if (!email || !password) {
    setMessage(message, 'Попълнете имейл и парола.', 'error');
    return;
  }

  if (isCodeBasedRole(selectedRole)) {
    const codePattern = selectedRole === 'parent' ? /^\d{1,2}RU\d{3,10}$/i : /^\d{1,2}U\d{3,10}$/i;
    if (!schoolCode || !codePattern.test(schoolCode)) {
      if (selectedRole === 'parent') {
        setMessage(message, 'За роля „Родител“ въведете родителски код (пример: 5RU00234).', 'error');
        return;
      }

      setMessage(message, 'За роля „Ученик“ въведете ученически код (пример: 5U00234).', 'error');
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
      emailRedirectTo: getEmailRedirectTo(),
      data: {
        full_name: String(formData.get('fullName') ?? '').trim(),
        role: selectedRole
      }
    }
  });

  if (error) {
    if (isAlreadyRegisteredError(error)) {
      setMessage(message, 'Този имейл вече е регистриран. Използвайте „Вход“ или „Забравена парола“.', 'error');
      return;
    }

    if (isRateLimitError(error)) {
      setMessage(message, 'Твърде много опити за регистрация. Изчакайте 60 секунди и опитайте пак.', 'error');
      return;
    }

    setMessage(message, `Неуспешна регистрация: ${error.message}`, 'error');
    return;
  }

  try {
    if (isCodeBasedRole(selectedRole)) {
      if (!data?.session) {
        const resendResult = await resendConfirmationEmail(email);

        if (resendResult.ok) {
          setMessage(
            message,
            'Регистрацията е приета. Изпратихме имейл за потвърждение (проверете Inbox/Spam), после влезте и активирайте кода отново.',
            'success'
          );
          return;
        }

        setMessage(
          message,
          `Регистрацията е приета, но не успяхме да изпратим имейл за потвърждение: ${resendResult.reason}.`,
          'error'
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

async function handlePasswordResetRequest(root, form) {
  const message = root.querySelector('#auth-message');
  const resetPasswordButton = root.querySelector('#reset-password-btn');
  const formData = new FormData(form);
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!email) {
    setMessage(message, 'Въведете имейл за възстановяване на парола.', 'error');
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getEmailRedirectTo()
  });

  if (error) {
    if (isRateLimitError(error)) {
      startButtonCooldown(resetPasswordButton, 60);
      setMessage(
        message,
        'Изпратени са твърде много заявки за имейл. Изчакайте 60 секунди и опитайте отново.',
        'error'
      );
      return;
    }

    setMessage(message, `Неуспешно изпращане на линк за парола: ${error.message}`, 'error');
    return;
  }

  setMessage(message, 'Изпратихме линк за смяна на парола. Проверете Inbox/Spam.', 'success');
}

async function handleSaveNewPassword(root) {
  const message = root.querySelector('#auth-message');
  const newPasswordInput = root.querySelector('#authNewPassword');
  const confirmPasswordInput = root.querySelector('#authConfirmPassword');

  const newPassword = String(newPasswordInput?.value ?? '');
  const confirmPassword = String(confirmPasswordInput?.value ?? '');

  if (newPassword.length < 6) {
    setMessage(message, 'Новата парола трябва да е поне 6 символа.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    setMessage(message, 'Паролите не съвпадат.', 'error');
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    setMessage(message, `Неуспешна смяна на парола: ${error.message}`, 'error');
    return;
  }

  if (newPasswordInput) {
    newPasswordInput.value = '';
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.value = '';
  }

  window.history.replaceState({}, document.title, '/login/');
  toggleRecoveryMode(root, false);
  setMessage(message, 'Паролата е сменена успешно. Влезте с новата парола.', 'success');
}

export async function init(root) {
  const form = root.querySelector('#auth-form');
  const signupButton = root.querySelector('#signup-btn');
  const resetPasswordButton = root.querySelector('#reset-password-btn');
  const saveNewPasswordButton = root.querySelector('#save-new-password-btn');
  const message = root.querySelector('#auth-message');
  const roleSelect = root.querySelector('#authRole');
  const recoveryMode = isRecoveryMode();

  await loadClasses(root);
  updateRoleDependentFields(root);
  toggleRecoveryMode(root, recoveryMode);

  const { data: sessionData } = await supabase.auth.getSession();
  const currentEmail = sessionData?.session?.user?.email;

  if (currentEmail && !recoveryMode) {
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

  resetPasswordButton?.addEventListener('click', async () => {
    if (!form) {
      return;
    }

    await handlePasswordResetRequest(root, form);
  });

  saveNewPasswordButton?.addEventListener('click', async () => {
    await handleSaveNewPassword(root);
  });
}
