import { supabase } from '../../supabaseClient';

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

function formatDate(value) {
	if (!value) {
		return '-';
	}

	return new Date(value).toLocaleString('bg-BG');
}

function renderClassCard(item) {
	const className = item.className ?? getRelationName(item.classes) ?? item.name ?? '';
	const grade = normalizeGrade(className || item.grade ?? item.class_grade ?? item.class ?? item.level);
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

	return `
		<li class="list-group-item">
			<div class="fw-semibold">${studentName}</div>
			<div class="small text-body-secondary">Урок: ${lessonTitle}</div>
			<div class="small text-body-secondary">Файл: ${fileName}</div>
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

	const { data: sessionData } = await supabase.auth.getSession();
	const session = sessionData?.session ?? null;

	if (!session) {
		setClassRoomNote(root, 'Влезте в профила си, за да видите стаята за вашия клас.');
		showClassRoomContent(root, false);
		return;
	}

	const { data: profile, error: profileError } = await supabase
		.from('user_profiles')
		.select('user_id, role, class_id, full_name')
		.eq('user_id', session.user.id)
		.single();

	if (profileError || !profile) {
		setClassRoomNote(root, 'Профилът ви не е свързан с клас. Моля, завършете регистрацията.');
		showClassRoomContent(root, false);
		return;
	}

	if (!['student', 'teacher', 'parent'].includes(profile.role)) {
		setClassRoomNote(root, 'Посетителите могат да разглеждат сайта, но нямат достъп до класните стаи.');
		showClassRoomContent(root, false);
		return;
	}

	if (!profile.class_id) {
		setClassRoomNote(root, 'Профилът няма зададен клас. Моля, задайте class_id в user_profiles.');
		showClassRoomContent(root, false);
		return;
	}

	let classId = profile.class_id;
	let linkedStudentIds = [];

	if (profile.role === 'parent') {
		const { data: linkedStudents, error: linkedError } = await supabase
			.from('parent_students')
			.select('student_id, students(class_id, full_name)')
			.eq('parent_user_id', session.user.id)
			.order('id', { ascending: true });

		if (linkedError || !Array.isArray(linkedStudents) || linkedStudents.length === 0) {
			setClassRoomNote(root, 'Родителският профил още не е свързан с ученик.');
			showClassRoomContent(root, false);
			return;
		}

		linkedStudentIds = linkedStudents.map((item) => item.student_id).filter(Boolean);
		classId = linkedStudents[0]?.students?.class_id ?? classId;

		const studentNames = linkedStudents
			.map((item) => item.students?.full_name)
			.filter(Boolean)
			.join(', ');

		setClassRoomNote(root, `Виждате активността на ученик: ${studentNames || 'свързан ученик'}.`);
	} else {
		setClassRoomNote(root, `Виждате данни за вашия клас (${classId}).`);
	}

	showClassRoomContent(root, true);
	await loadClassRoomData(root, classId, { studentIds: linkedStudentIds });

	messageForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const text = String(messageInput?.value ?? '').trim();
		if (!text) {
			return;
		}

		const { error } = await supabase.from('class_room_messages').insert([
			{
				class_id: classId,
				user_id: session.user.id,
				message: text
			}
		]);

		if (error) {
			console.error('Message insert error:', error.message);
			return;
		}

		messageInput.value = '';
		await loadClassRoomData(root, classId, { studentIds: linkedStudentIds });
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
	await loadClassesFromSupabase(root);
	await initClassRoom(root);

	const filterSelect = root.querySelector('#grade-filter');
	if (!filterSelect) {
		return;
	}

	applyGradeFilter(root, filterSelect.value);

	filterSelect.addEventListener('change', (event) => {
		const selectedGrade = event.target.value;
		applyGradeFilter(root, selectedGrade);
	});
}
