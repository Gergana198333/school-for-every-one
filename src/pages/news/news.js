import { supabase } from '../../supabaseClient';

function renderNewsCard(item) {
	return `
		<div class="col-md-6">
			<article class="bg-white p-4 rounded-3 shadow-sm h-100">
				<h2 class="h5">${item.title ?? 'Без заглавие'}</h2>
				<p class="mb-0">${item.content ?? ''}</p>
			</article>
		</div>
	`;
}

export async function init(root) {
	const grid = root.querySelector('#news-grid');
	if (!grid) {
		return;
	}

	const { data, error } = await supabase
		.from('news_posts')
		.select('id, title, content, published_at')
		.order('published_at', { ascending: false })
		.limit(12);

	if (error || !Array.isArray(data) || data.length === 0) {
		if (error) {
			console.warn('News fallback:', error.message);
		}
		return;
	}

	grid.innerHTML = data.map(renderNewsCard).join('');
}
