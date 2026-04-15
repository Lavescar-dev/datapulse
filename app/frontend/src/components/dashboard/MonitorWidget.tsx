import { Show, For, Match, Switch } from 'solid-js';
import type { WidgetConfig, MonitorWidgetData } from '../../../../shared/types/dashboard';

interface Props {
	config: WidgetConfig;
	data: MonitorWidgetData | null;
	loading: boolean;
}

export default function MonitorWidget(props: Props) {
	const getStatusColor = (status: string) => {
		switch (status) {
			case 'up':
				return 'text-green-400';
			case 'down':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'up':
				return '✓';
			case 'down':
				return '✗';
			default:
				return '?';
		}
	};

	return (
		<div class="h-full flex flex-col">
			<Show when={props.loading}>
				<div class="flex items-center justify-center h-full">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			</Show>

			<Show when={!props.loading && props.data}>
				<Switch>
					<Match when={props.config.type === 'list' || props.config.type === 'chart'}>
						<div class="space-y-2 h-full overflow-auto">
							<For each={props.data!.endpoints.slice(0, props.config.limit || 10)}>
								{(endpoint) => (
									<div class="p-3 bg-gray-800/30 rounded">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<h4 class="font-semibold text-sm mb-1">{endpoint.name}</h4>
												<div class="text-xs text-gray-500 truncate">{endpoint.url}</div>
											</div>
											<div
												class={`text-lg font-bold ${getStatusColor(endpoint.status)}`}
											>
												{getStatusIcon(endpoint.status)}
											</div>
										</div>
										<Show when={endpoint.uptime24h !== undefined}>
											<div class="mt-2 flex items-center justify-between text-xs">
												<span class="text-gray-400">Uptime (24h)</span>
												<span class="font-semibold text-blue-400">
													{endpoint.uptime24h?.toFixed(2)}%
												</span>
											</div>
										</Show>
										<Show when={endpoint.responseTime !== undefined}>
											<div class="mt-1 flex items-center justify-between text-xs">
												<span class="text-gray-400">Response Time</span>
												<span class="font-semibold text-purple-400">
													{endpoint.responseTime}ms
												</span>
											</div>
										</Show>
									</div>
								)}
							</For>
						</div>
					</Match>

					<Match when={props.config.type === 'table'}>
						<div class="overflow-auto h-full">
							<table class="w-full text-sm">
								<thead class="sticky top-0 bg-gray-900">
									<tr class="border-b border-gray-800">
										<th class="text-left p-2 text-gray-400 font-medium">Endpoint</th>
										<th class="text-center p-2 text-gray-400 font-medium">Status</th>
										<th class="text-right p-2 text-gray-400 font-medium">Uptime</th>
										<th class="text-right p-2 text-gray-400 font-medium">Response</th>
									</tr>
								</thead>
								<tbody>
									<For each={props.data!.endpoints.slice(0, props.config.limit || 10)}>
										{(endpoint) => (
											<tr class="border-b border-gray-800/50">
												<td class="p-2">
													<div class="font-semibold">{endpoint.name}</div>
													<div class="text-xs text-gray-500 truncate max-w-[200px]">
														{endpoint.url}
													</div>
												</td>
												<td class={`p-2 text-center ${getStatusColor(endpoint.status)}`}>
													<span class="text-lg">{getStatusIcon(endpoint.status)}</span>
												</td>
												<td class="p-2 text-right text-blue-400">
													{endpoint.uptime24h?.toFixed(2)}%
												</td>
												<td class="p-2 text-right text-purple-400">
													{endpoint.responseTime}ms
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</Match>

					<Match when={props.config.type === 'stat'}>
						<div class="flex flex-col justify-center h-full space-y-4">
							<div>
								<div class="text-xs text-gray-400 mb-1">Total Endpoints</div>
								<div class="text-3xl font-bold text-blue-400">
									{props.data!.summary.total}
								</div>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<div>
									<div class="text-xs text-gray-400 mb-1">Up</div>
									<div class="text-xl font-semibold text-green-400">
										{props.data!.summary.up}
									</div>
								</div>
								<div>
									<div class="text-xs text-gray-400 mb-1">Down</div>
									<div class="text-xl font-semibold text-red-400">
										{props.data!.summary.down}
									</div>
								</div>
								<div>
									<div class="text-xs text-gray-400 mb-1">Unknown</div>
									<div class="text-xl font-semibold text-gray-400">
										{props.data!.summary.unknown}
									</div>
								</div>
							</div>
						</div>
					</Match>
				</Switch>
			</Show>

			<Show when={!props.loading && !props.data}>
				<div class="flex items-center justify-center h-full text-gray-500">
					No monitoring data available
				</div>
			</Show>
		</div>
	);
}
