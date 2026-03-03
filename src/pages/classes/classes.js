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
