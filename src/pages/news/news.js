import { supabase } from '../../supabaseClient';

const featuredCinemaNews = {
	id: 'featured-cinema-news',
	title: 'Кино прожекция',
	content: 'Заповядайте на училищната кино прожекция в петък от 18:00 ч. в актовата зала.',
	event_time: 'Петък, 18:00 ч.',
	image_url: '/moviebg.jpg'
};

function formatCapitalized(value) {
	if (!value) {
		return '';
	}

	return value.charAt(0).toUpperCase() + value.slice(1);
}

function getNewsEventTime(item) {
	if (item?.event_time) {
		return String(item.event_time).trim();
	}

	const content = String(item?.content ?? '');
	if (!content) {
		return '';
	}

	const timeMatch = content.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/i);
	if (!timeMatch) {
		return '';
	}

	const dayMatch = content.match(/\b(понеделник|вторник|сряда|четвъртък|петък|събота|неделя)\b/i);
	const dateMatch = content.match(/\b([0-3]?\d)\s*(януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември)\b/i);

	const parts = [];
	if (dayMatch?.[1]) {
		parts.push(formatCapitalized(dayMatch[1].toLowerCase()));
	}

	if (dateMatch?.[1] && dateMatch?.[2]) {
		parts.push(`${dateMatch[1]} ${dateMatch[2].toLowerCase()}`);
	}

	parts.push(`${timeMatch[0]} ч.`);

	return parts.join(', ');
}

function renderNewsCard(item) {
	const eventTime = getNewsEventTime(item);

	return `
		<div class="col-md-6">
			<article class="bg-white p-4 rounded-3 shadow-sm h-100">
				${item.image_url ? `<img src="${item.image_url}" alt="Плакат за ${item.title ?? 'събитие'}" class="img-fluid rounded mb-3" />` : ''}
				<h2 class="h5">${item.title ?? 'Без заглавие'}</h2>
				${eventTime ? `<p class="small text-body-secondary mb-2">${eventTime}</p>` : ''}
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
		.select('id, title, content, image_url, published_at')
		.order('published_at', { ascending: false })
		.limit(12);

	if (error || !Array.isArray(data) || data.length === 0) {
		if (error) {
			console.warn('News fallback:', error.message);
		}
		grid.innerHTML = renderNewsCard(featuredCinemaNews);
		return;
	}

	const hasCinemaNews = data.some((item) => String(item.title ?? '').trim().toLowerCase() === 'кино прожекция');
	const itemsToRender = hasCinemaNews ? data : [featuredCinemaNews, ...data];

	grid.innerHTML = itemsToRender.map(renderNewsCard).join('');
}
