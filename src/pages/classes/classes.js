import { supabase } from '../../supabaseClient';

const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
	.split(',')
	.map((email) => email.trim().toLowerCase())
	.filter(Boolean);

function isAdminEmail(email) {
	return ADMIN_EMAILS.includes(String(email ?? '').trim().toLowerCase());
}

function normalizeGrade(value) {
	if (value === null || value === undefined) {
		return '';
	}

	const asString = String(value).trim();
	const match = asString.match(/\d+/);
	return match ? match[0] : asString;
}

function getRelationName(relation) {
	if (!relation) {
		return '';
	}

	if (Array.isArray(relation)) {
		return relation[0]?.name ?? '';
	}

	return relation.name ?? '';
}

function setClassRoomNote(root, text) {
	const note = root.querySelector('#class-room-note');
	if (note) {
		note.textContent = text;
	}
}

function showClassRoomContent(root, visible) {
	const content = root.querySelector('#class-room-content');
	content?.classList.toggle('d-none', !visible);
}

function showClassRoomAuthCta(root, visible) {
	const cta = root.querySelector('#class-room-auth-cta');
	cta?.classList.toggle('d-none', !visible);
}

function showAdminClassSelector(root, visible) {
	const wrap = root.querySelector('#class-room-admin-wrap');
	wrap?.classList.toggle('d-none', !visible);
}

function setClassRoomControlsEnabled(root, enabled) {
	const forms = [root.querySelector('#homework-submit-form'), root.querySelector('#class-room-message-form')];

	for (const form of forms) {
		if (!form) {
			continue;
		}

		const controls = form.querySelectorAll('input, textarea, select, button');
		controls.forEach((control) => {
			control.disabled = !enabled;
		});
	}
}

function renderGuestClassRoomPreview(root) {
	const lessonsList = root.querySelector('#class-room-lessons');
	const submissionsList = root.querySelector('#class-room-submissions');
	const messagesBox = root.querySelector('#class-room-messages');

	if (lessonsList) {
		lessonsList.innerHTML = '<li class="list-group-item text-body-secondary">Влезте, за да виждате задачите за класа.</li>';
	}

	if (submissionsList) {
		submissionsList.innerHTML = '<li class="list-group-item text-body-secondary">Влезте, за да качвате PNG, Word или PDF домашни.</li>';
	}

	if (messagesBox) {
		messagesBox.innerHTML = '<div class="text-body-secondary">Бележки до класа: достъпно за ученици, родители, учители и админ след вход.</div>';
	}
}

async function populateAdminClassSelector(root, selectedClassId) {
	const select = root.querySelector('#class-room-admin-class');
	if (!select) {
		return { firstClassId: null };
	}

	const { data, error } = await supabase.from('classes').select('id, name').order('name', { ascending: true });
	if (error || !Array.isArray(data) || data.length === 0) {
		select.innerHTML = '<option value="">Няма налични класове</option>';
		return { firstClassId: null };
	}

	select.innerHTML = data
		.map((item) => `<option value="${item.id}">${item.name ?? `Клас ${item.id}`}</option>`)
		.join('');

	const normalizedSelected = Number(selectedClassId);
	if (Number.isFinite(normalizedSelected) && normalizedSelected > 0) {
		select.value = String(normalizedSelected);
	}

	if (!select.value) {
		select.value = String(data[0].id);
	}

	const selected = Number(select.value);
	return { firstClassId: Number.isFinite(selected) && selected > 0 ? selected : null };
}

function formatDate(value) {
	if (!value) {
		return '-';
	}

	return new Date(value).toLocaleString('bg-BG');
}

function renderClassCard(item) {
	const className = item.className ?? getRelationName(item.classes) ?? item.name ?? '';
	const grade = normalizeGrade(className || item.grade || item.class_grade || item.class || item.level);
	const heading = className || (grade ? `${grade} клас` : 'Клас');
	const subject = item.subject ?? getRelationName(item.subjects) ?? item.subject_name ?? 'Няма данни';
	const nextLesson = item.next_lesson ?? item.title ?? item.lesson ?? item.nextLesson ?? 'Няма данни';
	const teacher = item.teacher ?? item.teacher_name ?? item.instructor ?? 'Няма данни';

	return `
		<div class="col-md-6 col-lg-4 class-item" data-grade="${grade}">
			<article class="class-card h-100 p-4 bg-white shadow-sm">
				<h2 class="h5 mb-3">${heading}</h2>
				<p class="mb-2"><strong>Предмет:</strong> ${subject}</p>
				<p class="mb-2"><strong>Следващ урок:</strong> ${nextLesson}</p>
				<p class="mb-0"><strong>Учител:</strong> ${teacher}</p>
			</article>
		</div>
	`;
}

function renderClassLessonItem(item) {
	const teacher = item.teacher_name ?? item.teacher ?? 'Няма данни';
	const publishedAt = formatDate(item.published_at);

	return `
		<li class="list-group-item">
			<div class="fw-semibold">${item.title ?? 'Без заглавие'}</div>
			<div class="small text-body-secondary">${item.description ?? 'Няма описание'}</div>
			<div class="small text-body-secondary mt-1">Учител: ${teacher} • ${publishedAt}</div>
		</li>
	`;
}

function renderSubmissionItem(item) {
	const studentName = item.students?.full_name ?? 'Няма данни';
	const lessonTitle = item.lessons?.title ?? 'Няма данни';
	const fileName = item.file_name ?? 'Няма файл';
	const filePath = item.file_path ?? '';
	const hasFile = Boolean(filePath);

	return `
		<li class="list-group-item">
			<div class="fw-semibold">${studentName}</div>
			<div class="small text-body-secondary">Урок: ${lessonTitle}</div>
			<div class="small text-body-secondary">Файл: ${fileName}</div>
			${
				hasFile
					? `<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-action="download-submission" data-file-path="${filePath}" data-file-name="${fileName}">Изтегли файл</button>`
					: ''
			}
		</li>
	`;
}

function renderMessageItem(item) {
	const name = item.user_profiles?.full_name ?? 'Потребител';
	const role = item.user_profiles?.role ?? 'user';
	const sentAt = formatDate(item.created_at);

	return `
		<div class="class-room-message-item">
			<div class="class-room-meta">${name} (${role}) • ${sentAt}</div>
			<div>${item.message ?? ''}</div>
		</div>
	`;
}

function setHomeworkSubmitMessage(root, text, variant = 'neutral') {
	const message = root.querySelector('#homework-submit-message');
	if (!message) {
		return;
	}

	message.textContent = text;
	message.classList.remove('text-success', 'text-danger', 'text-body-secondary');

	if (variant === 'success') {
		message.classList.add('text-success');
		return;
	}

	if (variant === 'error') {
		message.classList.add('text-danger');
		return;
	}

	message.classList.add('text-body-secondary');
}

function sanitizeFileName(fileName) {
	return String(fileName ?? '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function resolveStudentIdForSubmission(sessionUserId, profile, linkedStudentIds) {
	if (profile.role === 'parent') {
		return linkedStudentIds[0] ?? null;
	}

	if (profile.role !== 'student') {
		return null;
	}

	try {
		const { data, error } = await supabase
			.from('enrollment_codes')
			.select('student_id')
			.eq('claimed_by_user_id', sessionUserId)
			.eq('role', 'student')
			.not('student_id', 'is', null)
			.order('used_at', { ascending: false })
			.limit(1);

		if (!error && Array.isArray(data) && data[0]?.student_id) {
			return data[0].student_id;
		}
	} catch (error) {
		console.warn('Student lookup via enrollment code failed:', error?.message ?? error);
	}

	const { data: studentsData, error: studentsError } = await supabase
		.from('students')
		.select('id')
		.eq('class_id', profile.class_id)
		.eq('full_name', String(profile.full_name ?? '').trim())
		.limit(1);

	if (studentsError || !Array.isArray(studentsData) || !studentsData[0]?.id) {
		if (studentsError) {
			console.warn('Student lookup by full_name failed:', studentsError.message);
		}
		return null;
	}

	return studentsData[0].id;
}

async function resolveStudentEnrollmentContext(sessionUserId) {
	try {
		const { data, error } = await supabase
			.from('enrollment_codes')
			.select('role, student_id, students(class_id, full_name)')
			.eq('claimed_by_user_id', sessionUserId)
			.eq('role', 'student')
			.not('student_id', 'is', null)
			.order('used_at', { ascending: false })
			.limit(1);

		if (error || !Array.isArray(data) || data.length === 0) {
			if (error) {
				console.warn('Enrollment context lookup failed:', error.message);
			}
			return null;
		}

		const row = data[0];
		return {
			studentId: row.student_id ?? null,
			classId: row.students?.class_id ?? null,
			fullName: row.students?.full_name ?? null
		};
	} catch (error) {
		console.warn('Enrollment context exception:', error?.message ?? error);
		return null;
	}
}

async function populateHomeworkLessonOptions(root, classId) {
	const select = root.querySelector('#homework-lesson-select');
	if (!select) {
		return;
	}

	const { data, error } = await supabase
		.from('lessons')
		.select('id, title')
		.eq('class_id', classId)
		.order('published_at', { ascending: false })
		.limit(100);

	if (error) {
		console.warn('Homework lessons options load failed:', error.message);
		select.innerHTML = '<option value="">Няма достъпни уроци</option>';
		return;
	}

	const lessons = Array.isArray(data) ? data : [];
	if (lessons.length === 0) {
		select.innerHTML = '<option value="">Няма достъпни уроци</option>';
		return;
	}

	select.innerHTML = ['<option value="">Изберете урок</option>', ...lessons.map((item) => `<option value="${item.id}">${item.title ?? 'Без заглавие'}</option>`)].join('');
}

async function setupHomeworkSubmission(root, context) {
	const wrap = root.querySelector('#homework-submit-wrap');
	const form = root.querySelector('#homework-submit-form');
	const lessonSelect = root.querySelector('#homework-lesson-select');
	const fileInput = root.querySelector('#homework-file-input');
	const notesInput = root.querySelector('#homework-notes-input');

	if (!wrap || !form || !lessonSelect || !fileInput || !notesInput) {
		return;
	}

	const { session, profile, classId, linkedStudentIds } = context;

	if (!['student', 'parent'].includes(profile.role)) {
		wrap.classList.add('d-none');
		return;
	}

	await populateHomeworkLessonOptions(root, classId);

	const studentId = await resolveStudentIdForSubmission(session.user.id, profile, linkedStudentIds);
	if (!studentId) {
		setHomeworkSubmitMessage(root, 'Не е открит свързан ученик за подаване на домашно.', 'error');
		form.querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled');
		return;
	}

	setHomeworkSubmitMessage(root, 'Може да подадете домашна работа за избрания урок.');

	form.addEventListener('submit', async (event) => {
		event.preventDefault();

		const lessonId = Number(lessonSelect.value);
		const notes = String(notesInput.value ?? '').trim();
		const file = fileInput.files?.[0] ?? null;

		if (!Number.isFinite(lessonId) || lessonId <= 0) {
			setHomeworkSubmitMessage(root, 'Изберете урок преди подаване.', 'error');
			return;
		}

		if (!file) {
			setHomeworkSubmitMessage(root, 'Прикачете файл с домашната работа.', 'error');
			return;
		}

		const allowedExtensions = ['png', 'pdf', 'doc', 'docx'];
		const fileExtension = String(file.name ?? '').split('.').pop()?.toLowerCase() ?? '';
		if (!allowedExtensions.includes(fileExtension)) {
			setHomeworkSubmitMessage(root, 'Позволени формати: PNG, PDF, DOC, DOCX.', 'error');
			return;
		}

		setHomeworkSubmitMessage(root, 'Качване на домашната работа...');

		const bucketName = String(import.meta.env.VITE_SUPABASE_HOMEWORK_BUCKET ?? 'homework').trim() || 'homework';
		const safeName = sanitizeFileName(file.name);
		const filePath = `submissions/${classId}/${studentId}/${Date.now()}-${safeName}`;

		const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, {
			upsert: false
		});

		if (uploadError) {
			console.warn('Homework upload error:', uploadError.message);
			setHomeworkSubmitMessage(root, 'Неуспешно качване на файла. Проверете настройката на Storage bucket.', 'error');
			return;
		}

		const { error: insertError } = await supabase.from('submissions').insert([
			{
				student_id: studentId,
				lesson_id: lessonId,
				notes: notes || null,
				file_name: file.name,
				file_path: filePath,
				submitted_at: new Date().toISOString()
			}
		]);

		if (insertError) {
			console.warn('Homework insert error:', insertError.message);
			setHomeworkSubmitMessage(root, 'Файлът е качен, но записът за домашното не беше създаден.', 'error');
			return;
		}

		form.reset();
		setHomeworkSubmitMessage(root, 'Домашната работа е подадена успешно.', 'success');
		await loadClassRoomData(root, classId, { studentIds: linkedStudentIds });
	});
}

async function openSubmissionFile(filePath) {
	const normalizedPath = String(filePath ?? '').trim();
	if (!normalizedPath) {
		return;
	}

	if (/^https?:\/\//i.test(normalizedPath)) {
		window.open(normalizedPath, '_blank', 'noopener,noreferrer');
		return;
	}

	const bucketName = String(import.meta.env.VITE_SUPABASE_HOMEWORK_BUCKET ?? 'homework').trim() || 'homework';
	const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(normalizedPath, 60);

	if (error || !data?.signedUrl) {
		console.warn('Submission file URL error:', error?.message ?? 'No signed URL');
		return;
	}

	window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

function setupMessageComposer(messageForm, messageInput) {
	if (!messageForm || !messageInput || messageInput.dataset.composerBound === 'true') {
		return;
	}

	messageInput.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' || event.shiftKey) {
			return;
		}

		event.preventDefault();
		messageForm.requestSubmit();
	});

	messageInput.dataset.composerBound = 'true';
}

function setGeographyNote(root, text) {
	const note = root.querySelector('#geography-lessons-note');
	if (note) {
		note.textContent = text;
	}
}

function renderGeographyLessonItem(item) {
	const className = getRelationName(item.classes) || 'Неизвестен клас';
	const publishedAt = formatDate(item.published_at);
	const title = item.title ?? 'Урок по География';
	const hasFile = Boolean(item.material_url);

	return `
		<li class="list-group-item">
			<div class="fw-semibold">${title}</div>
			<div class="small text-body-secondary mb-2">${className} • ${publishedAt}</div>
			${
				hasFile
					? `<a class="geography-lesson-link" href="${item.material_url}" target="_blank" rel="noopener noreferrer">Отвори урок</a>`
					: '<span class="small text-body-secondary">Няма качен файл към урока.</span>'
			}
		</li>
	`;
}

function getManualGeographyLessons(selectedGrade) {
	const lessons = [
		{
			id: 'manual-geography-5-1',
			title: 'Урок 1: България (PDF)',
			published_at: new Date().toISOString(),
			classes: { name: '5 клас' },
			material_url: '/urok-1-bulgaria-geografia.pdf'
		},
		{
			id: 'manual-geography-5-2',
			title: 'Географско положение',
			published_at: new Date().toISOString(),
			classes: { name: '5 клас' },
			material_url: '/geografsko-polozhenie.png'
		}
	];

	if (selectedGrade === 'all') {
		return lessons;
	}

	return lessons.filter((item) => normalizeGrade(getRelationName(item.classes)) === selectedGrade);
}

async function loadGeographyLessons(root, selectedGrade = 'all') {
	const list = root.querySelector('#geography-lessons-list');
	const onlyWithFileCheckbox = root.querySelector('#geography-only-with-file');
	if (!list) {
		return;
	}

	const onlyWithFile = Boolean(onlyWithFileCheckbox?.checked);

	const manualLessons = getManualGeographyLessons(selectedGrade);
	const initialVisible = onlyWithFile ? manualLessons.filter((item) => Boolean(item.material_url)) : manualLessons;

	if (initialVisible.length > 0) {
		list.innerHTML = initialVisible.map(renderGeographyLessonItem).join('');
		setGeographyNote(root, `Намерени уроци по География: ${initialVisible.length}.`);
	} else {
		list.innerHTML = '<li class="list-group-item text-body-secondary">Няма уроци по География с прикачен файл за избрания клас.</li>';
	}
	let itemsWithLinks = [];

	try {
		const { data: lessonsData, error: lessonsError } = await supabase
			.from('lessons')
			.select('id, title, published_at, classes(name), subjects(name)')
			.order('published_at', { ascending: false })
			.limit(100);

		if (lessonsError) {
			console.warn('Geography lessons query failed:', lessonsError.message);
		}

		const safeLessonsData = Array.isArray(lessonsData) ? lessonsData : [];

		const geographyLessons = safeLessonsData
			.filter((item) => String(getRelationName(item.subjects)).toLowerCase().includes('географ'))
			.filter((item) => {
				if (selectedGrade === 'all') {
					return true;
				}

				const classGrade = normalizeGrade(getRelationName(item.classes));
				return classGrade === selectedGrade;
			});

		const lessonIds = geographyLessons.map((item) => item.id);
		let materialsData = [];

		if (lessonIds.length > 0) {
			const { data } = await supabase
				.from('lesson_materials')
				.select('lesson_id, file_url, file_path')
				.in('lesson_id', lessonIds)
				.order('id', { ascending: false });

			materialsData = Array.isArray(data) ? data : [];
		}

		const materialByLessonId = new Map();
		for (const row of materialsData ?? []) {
			if (!materialByLessonId.has(row.lesson_id)) {
				materialByLessonId.set(row.lesson_id, row.file_url || row.file_path || null);
			}
		}

		itemsWithLinks = geographyLessons.map((item) => ({
			...item,
			material_url: materialByLessonId.get(item.id) || null
		}));
	} catch (error) {
		console.warn('Geography lessons load failed:', error?.message ?? error);
	}

	const manualIds = new Set(manualLessons.map((item) => item.id));
	const mergedLessons = [...manualLessons, ...itemsWithLinks.filter((item) => !manualIds.has(item.id))];

	const visibleItems = onlyWithFile ? mergedLessons.filter((item) => Boolean(item.material_url)) : mergedLessons;

	if (visibleItems.length === 0) {
		list.innerHTML = '<li class="list-group-item text-body-secondary">Няма уроци по География с прикачен файл за избрания клас.</li>';
		setGeographyNote(root, 'Филтърът „Само уроци с файл“ е включен.');
		return;
	}

	list.innerHTML = visibleItems.map(renderGeographyLessonItem).join('');
	setGeographyNote(root, `Намерени уроци по География: ${visibleItems.length}.`);
}

async function loadLessonsWithRelations() {
	const { data, error } = await supabase
		.from('lessons')
		.select('id, title, lesson, next_lesson, teacher, teacher_name, classes(id, name), subjects(id, name)')
		.order('id', { ascending: true });

	if (error) {
		return { data: null, error };
	}

	if (!Array.isArray(data) || data.length === 0) {
		return { data: [], error: null };
	}

	return { data, error: null };
}

async function loadClassesFallback() {
	const { data, error } = await supabase
		.from('classes')
		.select('id, name, grade')
		.order('id', { ascending: true });

	if (error || !Array.isArray(data) || data.length === 0) {
		return [];
	}

	return data.map((item) => ({
		className: item.name,
		grade: item.grade,
		subject: 'Няма данни',
		next_lesson: 'Няма данни',
		teacher: 'Няма данни'
	}));
}

async function loadClassesFromSupabase(root) {
	const grid = root.querySelector('#classes-grid');
	if (!grid) {
		return;
	}

	const { data: lessonsData, error } = await loadLessonsWithRelations();

	if (error) {
		console.warn('Supabase lessons query failed:', error.message);
	}

	if (Array.isArray(lessonsData) && lessonsData.length > 0) {
		grid.innerHTML = lessonsData.map(renderClassCard).join('');
		return;
	}

	const fallbackData = await loadClassesFallback();

	if (fallbackData.length === 0) {
		if (error) {
			console.warn('Supabase classes fallback failed:', error.message);
		}
		return;
	}

	grid.innerHTML = fallbackData.map(renderClassCard).join('');
}

async function loadClassRoomData(root, classId, options = {}) {
	const lessonsList = root.querySelector('#class-room-lessons');
	const submissionsList = root.querySelector('#class-room-submissions');
	const messagesBox = root.querySelector('#class-room-messages');
	const studentIds = Array.isArray(options.studentIds) ? options.studentIds.filter(Boolean) : [];

	if (!lessonsList || !submissionsList || !messagesBox) {
		return;
	}

	const submissionsQuery = supabase
		.from('submissions')
		.select('id, file_name, submitted_at, students!inner(full_name), lessons!inner(title, class_id)')
		.order('submitted_at', { ascending: false })
		.limit(20);

	if (studentIds.length > 0) {
		submissionsQuery.in('student_id', studentIds);
	} else {
		submissionsQuery.eq('lessons.class_id', classId);
	}

	const [lessonsResult, submissionsResult, messagesResult] = await Promise.all([
		supabase
			.from('lessons')
			.select('id, title, description, teacher_name, published_at')
			.eq('class_id', classId)
			.order('published_at', { ascending: false }),
		submissionsQuery,
		supabase
			.from('class_room_messages')
			.select('id, message, created_at, user_profiles(full_name, role)')
			.eq('class_id', classId)
			.order('created_at', { ascending: false })
			.limit(50)
	]);

	if (lessonsResult.error) {
		console.warn('Class room lessons error:', lessonsResult.error.message);
	}

	if (submissionsResult.error) {
		console.warn('Class room submissions error:', submissionsResult.error.message);
	}

	if (messagesResult.error) {
		console.warn('Class room messages error:', messagesResult.error.message);
	}

	const lessonsData = Array.isArray(lessonsResult.data) ? lessonsResult.data : [];
	const submissionsData = Array.isArray(submissionsResult.data) ? submissionsResult.data : [];
	const messagesData = Array.isArray(messagesResult.data) ? messagesResult.data : [];

	lessonsList.innerHTML = lessonsData.length
		? lessonsData.map(renderClassLessonItem).join('')
		: '<li class="list-group-item">Няма качени задачи за този клас.</li>';

	submissionsList.innerHTML = submissionsData.length
		? submissionsData.map(renderSubmissionItem).join('')
		: '<li class="list-group-item">Няма предадени домашни за този клас.</li>';

	messagesBox.innerHTML = messagesData.length
		? messagesData.map(renderMessageItem).join('')
		: '<div class="text-body-secondary">Все още няма съобщения.</div>';
}

async function initClassRoom(root) {
	const messageForm = root.querySelector('#class-room-message-form');
	const messageInput = root.querySelector('#class-room-message-input');
	const submissionsList = root.querySelector('#class-room-submissions');

	const { data: sessionData } = await supabase.auth.getSession();
	const session = sessionData?.session ?? null;
	const normalizedSessionEmail = String(session?.user?.email ?? '').trim().toLowerCase();

	if (!session) {
		setClassRoomNote(root, 'Влезте в профила си, за да видите стаята за вашия клас.');
		showClassRoomContent(root, true);
		showClassRoomAuthCta(root, true);
		showAdminClassSelector(root, false);
		renderGuestClassRoomPreview(root);
		setClassRoomControlsEnabled(root, false);
		setHomeworkSubmitMessage(root, 'Влезте в профила си, за да качвате PNG, Word или PDF.', 'neutral');
		return;
	}

	const { data: profileData, error: profileError } = await supabase
		.from('user_profiles')
		.select('user_id, role, class_id, full_name')
		.eq('user_id', session.user.id)
		.single();

	let profile = profileData;
	if ((!profile || profileError) && isAdminEmail(normalizedSessionEmail)) {
		profile = {
			user_id: session.user.id,
			role: 'admin',
			class_id: null,
			full_name: session.user.user_metadata?.full_name ?? session.user.email ?? 'Админ'
		};
	}

	if (!profile || profileError) {
		const enrollmentContext = await resolveStudentEnrollmentContext(session.user.id);
		if (enrollmentContext?.studentId) {
			profile = {
				user_id: session.user.id,
				role: 'student',
				class_id: enrollmentContext.classId,
				full_name: enrollmentContext.fullName ?? session.user.user_metadata?.full_name ?? session.user.email ?? 'Ученик'
			};
		}
	}

	if (profileError || !profile) {
		setClassRoomNote(root, 'Профилът ви не е свързан с клас. Моля, завършете регистрацията.');
		showClassRoomContent(root, true);
		showClassRoomAuthCta(root, true);
		showAdminClassSelector(root, false);
		renderGuestClassRoomPreview(root);
		setClassRoomControlsEnabled(root, false);
		setHomeworkSubmitMessage(root, 'Влезте в профила си, за да качвате PNG, Word или PDF.', 'neutral');
		return;
	}

	if (!['student', 'teacher', 'parent', 'admin'].includes(profile.role)) {
		setClassRoomNote(root, 'Посетителите могат да разглеждат сайта, но нямат достъп до класните стаи.');
		showClassRoomContent(root, true);
		showClassRoomAuthCta(root, true);
		showAdminClassSelector(root, false);
		renderGuestClassRoomPreview(root);
		setClassRoomControlsEnabled(root, false);
		setHomeworkSubmitMessage(root, 'Влезте в профила си, за да качвате PNG, Word или PDF.', 'neutral');
		return;
	}

	if (!profile.class_id && profile.role === 'student') {
		const enrollmentContext = await resolveStudentEnrollmentContext(session.user.id);
		if (enrollmentContext?.classId) {
			profile.class_id = enrollmentContext.classId;
			if (!profile.full_name && enrollmentContext.fullName) {
				profile.full_name = enrollmentContext.fullName;
			}
		}
	}

	if (!profile.class_id && profile.role !== 'admin' && profile.role !== 'parent') {
		setClassRoomNote(root, 'Профилът няма зададен клас. Моля, задайте class_id в user_profiles.');
		showClassRoomContent(root, true);
		showClassRoomAuthCta(root, true);
		showAdminClassSelector(root, false);
		renderGuestClassRoomPreview(root);
		setClassRoomControlsEnabled(root, false);
		setHomeworkSubmitMessage(root, 'Влезте в профила си, за да качвате PNG, Word или PDF.', 'neutral');
		return;
	}

	let classId = profile.class_id;
	let linkedStudentIds = [];

	if (profile.role === 'admin' && !classId) {
		const { data: classesData, error: classesError } = await supabase
			.from('classes')
			.select('id, name')
			.order('id', { ascending: true })
			.limit(1);

		if (!classesError && Array.isArray(classesData) && classesData[0]?.id) {
			classId = classesData[0].id;
		}
	}

	if (!classId) {
		setClassRoomNote(root, 'Няма налични класове за зареждане на класна стая.');
		showClassRoomContent(root, true);
		showClassRoomAuthCta(root, true);
		showAdminClassSelector(root, false);
		renderGuestClassRoomPreview(root);
		setClassRoomControlsEnabled(root, false);
		setHomeworkSubmitMessage(root, 'Влезте в профила си, за да качвате PNG, Word или PDF.', 'neutral');
		return;
	}

	if (profile.role === 'parent') {
		const { data: linkedStudents, error: linkedError } = await supabase
			.from('parent_students')
			.select('student_id, students(class_id, full_name)')
			.eq('parent_user_id', session.user.id)
			.order('id', { ascending: true });

		if (linkedError || !Array.isArray(linkedStudents) || linkedStudents.length === 0) {
			setClassRoomNote(root, 'Родителският профил още не е свързан с ученик.');
			showClassRoomContent(root, true);
			showClassRoomAuthCta(root, true);
			showAdminClassSelector(root, false);
			renderGuestClassRoomPreview(root);
			setClassRoomControlsEnabled(root, false);
			setHomeworkSubmitMessage(root, 'Свържете родителския профил с ученик, за да качвате домашни.', 'error');
			return;
		}

		linkedStudentIds = linkedStudents.map((item) => item.student_id).filter(Boolean);
		classId = linkedStudents[0]?.students?.class_id ?? classId;

		const studentNames = linkedStudents
			.map((item) => item.students?.full_name)
			.filter(Boolean)
			.join(', ');

		setClassRoomNote(root, `Виждате активността на ученик: ${studentNames || 'свързан ученик'}.`);
	} else if (profile.role === 'admin') {
		setClassRoomNote(root, `Админ режим: виждате стаята на клас (${classId}) и можете да пишете.`);
	} else {
		setClassRoomNote(root, `Виждате данни за вашия клас (${classId}).`);
	}

	showClassRoomContent(root, true);
	showClassRoomAuthCta(root, false);
	showAdminClassSelector(root, profile.role === 'admin');
	setClassRoomControlsEnabled(root, true);

	let activeClassId = classId;
	if (profile.role === 'admin') {
		const { firstClassId } = await populateAdminClassSelector(root, classId);
		if (!activeClassId) {
			activeClassId = firstClassId;
		}
	}

	if (!activeClassId) {
		setClassRoomNote(root, 'Няма налични класове за зареждане на класна стая.');
		showClassRoomContent(root, true);
		showClassRoomAuthCta(root, true);
		showAdminClassSelector(root, false);
		renderGuestClassRoomPreview(root);
		setClassRoomControlsEnabled(root, false);
		setHomeworkSubmitMessage(root, 'Влезте в профила си, за да качвате PNG, Word или PDF.', 'neutral');
		return;
	}

	const canSendClassMessages = profile.role === 'student' || profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'parent';
	messageForm?.classList.toggle('d-none', !canSendClassMessages);
	if (!canSendClassMessages) {
		messageInput && (messageInput.value = '');
	} else {
		setupMessageComposer(messageForm, messageInput);
	}

	if (submissionsList && submissionsList.dataset.downloadBound !== 'true') {
		submissionsList.addEventListener('click', async (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const button = target.closest('[data-action="download-submission"]');
			if (!(button instanceof HTMLButtonElement)) {
				return;
			}

			const filePath = button.dataset.filePath;
			if (!filePath) {
				return;
			}

			button.disabled = true;
			const originalText = button.textContent;
			button.textContent = 'Отваряне...';

			try {
				await openSubmissionFile(filePath);
			} finally {
				button.disabled = false;
				button.textContent = originalText;
			}
		});

		submissionsList.dataset.downloadBound = 'true';
	}

	await setupHomeworkSubmission(root, {
		session,
		profile,
		classId: activeClassId,
		linkedStudentIds
	});
	await loadClassRoomData(root, activeClassId, { studentIds: linkedStudentIds });

	const adminClassSelect = root.querySelector('#class-room-admin-class');
	if (profile.role === 'admin' && adminClassSelect && adminClassSelect.dataset.bound !== 'true') {
		adminClassSelect.addEventListener('change', async (event) => {
			const selectedId = Number(event.target.value);
			if (!Number.isFinite(selectedId) || selectedId <= 0) {
				return;
			}

			activeClassId = selectedId;
			setClassRoomNote(root, `Админ режим: виждате стаята на клас (${activeClassId}) и можете да пишете.`);
			await loadClassRoomData(root, activeClassId, { studentIds: [] });
		});

		adminClassSelect.dataset.bound = 'true';
	}

	if (!canSendClassMessages) {
		return;
	}

	messageForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const text = String(messageInput?.value ?? '').trim();
		if (!text) {
			return;
		}

		const { error } = await supabase.from('class_room_messages').insert([
			{
				class_id: activeClassId,
				user_id: session.user.id,
				message: text
			}
		]);

		if (error) {
			console.error('Message insert error:', error.message);
			return;
		}

		messageInput.value = '';
		await loadClassRoomData(root, activeClassId, { studentIds: linkedStudentIds });
	});
}

function applyGradeFilter(root, grade) {
	const cards = root.querySelectorAll('.class-item');

	cards.forEach((card) => {
		const cardGrade = card.dataset.grade;
		const shouldShow = grade === 'all' || cardGrade === grade;
		card.classList.toggle('d-none', !shouldShow);
	});
}

export async function init(root) {
	const filterSelect = root.querySelector('#grade-filter');
	const onlyWithFileCheckbox = root.querySelector('#geography-only-with-file');
	const classRoomSection = root.querySelector('#class-room-section');
	if (!filterSelect) {
		await loadGeographyLessons(root, 'all');

		if (classRoomSection) {
			try {
				await initClassRoom(root);
			} catch (error) {
				console.warn('Class room init failed:', error?.message ?? error);
			}
		}
		return;
	}

	await loadGeographyLessons(root, filterSelect.value);

	if (classRoomSection) {
		try {
			await initClassRoom(root);
		} catch (error) {
			console.warn('Class room init failed:', error?.message ?? error);
		}
	}

	filterSelect.addEventListener('change', (event) => {
		const selectedGrade = event.target.value;
		loadGeographyLessons(root, selectedGrade);
	});

	onlyWithFileCheckbox?.addEventListener('change', () => {
		loadGeographyLessons(root, filterSelect.value);
	});
}
