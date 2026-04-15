import { Show, For, Match, Switch } from 'solid-js';
import type { WidgetConfig, NewsWidgetData } from '../../../../shared/types/dashboard';

interface Props {
	config: WidgetConfig;
	data: NewsWidgetData | null;
	loading: boolean;
}

export default function NewsWidget(props: Props) {
	const getSentimentColor = (sentiment: string) => {
		switch (sentiment.toLowerCase()) {
			case 'positive':
				return 'text-green-400';
			case 'negative':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	};

	const getSentimentIcon = (sentiment: string) => {
		switch (sentiment.toLowerCase()) {
			case 'positive':
				return '😊';
			case 'negative':
				return '😟';
			default:
				return '😐';
		}
	};

	return (
		<div class="h-full flex flex-col">
			<Show when={props.loading}>
				<div class="flex items-center justify-center h-full">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			</Show>

			<Show when={!props.loading && props.data && props.data.articles.length > 0}>
				<Switch>
					<Match when={props.config.type === 'list' || props.config.type === 'chart'}>
						<div class="space-y-2 h-full overflow-auto">
							<For each={props.data!.articles.slice(0, props.config.limit || 10)}>
								{(article) => (
									<a
										href={article.link}
										target="_blank"
										rel="noopener noreferrer"
										class="block p-3 bg-gray-800/30 rounded hover:bg-gray-800/50 transition-colors"
									>
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<h4 class="font-semibold text-sm mb-1 line-clamp-2">
													{article.title}
												</h4>
												<div class="flex items-center gap-2 text-xs text-gray-400">
													<span>{article.source}</span>
													<span>•</span>
													<span>{article.category}</span>
													<span>•</span>
													<span>{new Date(article.pubDate).toLocaleDateString('tr-TR')}</span>
												</div>
											</div>
											<div
												class={`text-xs ${getSentimentColor(article.sentiment)} flex items-center gap-1`}
											>
												<span>{getSentimentIcon(article.sentiment)}</span>
											</div>
										</div>
									</a>
								)}
							</For>
						</div>
					</Match>

					<Match when={props.config.type === 'table'}>
						<div class="overflow-auto h-full">
							<table class="w-full text-sm">
								<thead class="sticky top-0 bg-gray-900">
									<tr class="border-b border-gray-800">
										<th class="text-left p-2 text-gray-400 font-medium">Title</th>
										<th class="text-left p-2 text-gray-400 font-medium">Source</th>
										<th class="text-left p-2 text-gray-400 font-medium">Category</th>
										<th class="text-center p-2 text-gray-400 font-medium">Sentiment</th>
									</tr>
								</thead>
								<tbody>
									<For each={props.data!.articles.slice(0, props.config.limit || 10)}>
										{(article) => (
											<tr class="border-b border-gray-800/50">
												<td class="p-2">
													<a
														href={article.link}
														target="_blank"
														rel="noopener noreferrer"
														class="hover:text-blue-400 line-clamp-1"
													>
														{article.title}
													</a>
												</td>
												<td class="p-2 text-gray-400">{article.source}</td>
												<td class="p-2 text-gray-400">{article.category}</td>
												<td class={`p-2 text-center ${getSentimentColor(article.sentiment)}`}>
													{getSentimentIcon(article.sentiment)}
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</Match>

					<Match when={props.config.type === 'stat'}>
						<div class="flex flex-col items-center justify-center h-full">
							<div class="text-5xl font-bold text-blue-400 mb-2">
								{props.data!.totalCount}
							</div>
							<div class="text-lg text-gray-300">Total Articles</div>
						</div>
					</Match>
				</Switch>
			</Show>

			<Show when={!props.loading && (!props.data || props.data.articles.length === 0)}>
				<div class="flex items-center justify-center h-full text-gray-500">
					No news articles available
				</div>
			</Show>
		</div>
	);
}
