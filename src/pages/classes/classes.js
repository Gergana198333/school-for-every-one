function applyGradeFilter(root, grade) {
	const cards = root.querySelectorAll('.class-item');

	cards.forEach((card) => {
		const cardGrade = card.dataset.grade;
		const shouldShow = grade === 'all' || cardGrade === grade;
		card.classList.toggle('d-none', !shouldShow);
	});
}

export function init(root) {
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
