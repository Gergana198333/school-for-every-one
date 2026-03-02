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

async function submitToSupabase(form) {
  const formData = new FormData(form);
  const file = formData.get('homeworkFile');
  const hasHomeworkFile = file instanceof File && file.name;

  let uploadedFilePath = null;
  let uploadedFileUrl = null;

  if (hasHomeworkFile) {
    const normalizedName = file.name.replace(/\s+/g, '-').toLowerCase();
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${normalizedName}`;
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

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    submitButton?.setAttribute('disabled', 'disabled');
    setMessage(message, 'Изпращане...', 'neutral');

    const { error } = await submitToSupabase(form);

    submitButton?.removeAttribute('disabled');

    if (error) {
      console.error('Contact form submit failed:', error.message);
      setMessage(message, 'Възникна грешка при изпращане. Опитайте отново.', 'error');
      return;
    }

    setMessage(message, 'Формата е изпратена успешно.', 'success');
    form.reset();
  });
}
