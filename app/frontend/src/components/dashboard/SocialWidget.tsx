import { Show, For, Match, Switch } from 'solid-js';
import type { WidgetConfig, SocialWidgetData } from '../../../../shared/types/dashboard';

interface Props {
	config: WidgetConfig;
	data: SocialWidgetData | null;
	loading: boolean;
}

export default function SocialWidget(props: Props) {
	const getPlatformIcon = (platform: string) => {
		switch (platform.toLowerCase()) {
			case 'reddit':
				return '🤖';
			case 'hackernews':
				return '📰';
			case 'github':
				return '💻';
			case 'twitter':
				return '🐦';
			default:
				return '💬';
		}
	};

	const formatScore = (score: number) => {
		if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
		return score.toString();
	};

	return (
		<div class="h-full flex flex-col">
			<Show when={props.loading}>
				<div class="flex items-center justify-center h-full">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			</Show>

			<Show when={!props.loading && props.data && props.data.posts.length > 0}>
				<Switch>
					<Match when={props.config.type === 'list' || props.config.type === 'chart'}>
						<div class="space-y-2 h-full overflow-auto">
							<For each={props.data!.posts.slice(0, props.config.limit || 10)}>
								{(post) => (
									<a
										href={post.url}
										target="_blank"
										rel="noopener noreferrer"
										class="block p-3 bg-gray-800/30 rounded hover:bg-gray-800/50 transition-colors"
									>
										<div class="flex items-start gap-2">
											<div class="text-xl">{getPlatformIcon(post.platform)}</div>
											<div class="flex-1 min-w-0">
												<h4 class="font-semibold text-sm mb-1 line-clamp-2">{post.title}</h4>
												<div class="flex items-center gap-2 text-xs text-gray-400">
													<span>{post.platform}</span>
													<span>•</span>
													<span class="text-blue-400">{formatScore(post.score)} points</span>
													<Show when={post.metadata}>
														<span>•</span>
														<span>{post.metadata}</span>
													</Show>
												</div>
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
										<th class="text-left p-2 text-gray-400 font-medium">Platform</th>
										<th class="text-right p-2 text-gray-400 font-medium">Score</th>
									</tr>
								</thead>
								<tbody>
									<For each={props.data!.posts.slice(0, props.config.limit || 10)}>
										{(post) => (
											<tr class="border-b border-gray-800/50">
												<td class="p-2">
													<a
														href={post.url}
														target="_blank"
														rel="noopener noreferrer"
														class="hover:text-blue-400 line-clamp-1"
													>
														{post.title}
													</a>
												</td>
												<td class="p-2">
													<div class="flex items-center gap-1">
														<span>{getPlatformIcon(post.platform)}</span>
														<span class="text-gray-400">{post.platform}</span>
													</div>
												</td>
												<td class="p-2 text-right text-blue-400 font-semibold">
													{formatScore(post.score)}
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
							<div class="text-lg text-gray-300">Trending Posts</div>
						</div>
					</Match>
				</Switch>
			</Show>

			<Show when={!props.loading && (!props.data || props.data.posts.length === 0)}>
				<div class="flex items-center justify-center h-full text-gray-500">
					No social media posts available
				</div>
			</Show>
		</div>
	);
}
