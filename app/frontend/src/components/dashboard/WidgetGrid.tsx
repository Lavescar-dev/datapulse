import { For, Match, Show, Switch } from 'solid-js';
import type { WidgetConfig } from '../../../../shared/types/dashboard';
import CryptoWidget from './CryptoWidget';
import NewsWidget from './NewsWidget';
import SocialWidget from './SocialWidget';
import PriceWidget from './PriceWidget';
import MonitorWidget from './MonitorWidget';

interface Props {
	widgets: WidgetConfig[];
	widgetData: Map<string, unknown>;
	loadingWidgets: Set<string>;
	isAdmin: boolean;
	onRemoveWidget?: (widgetId: string) => void;
}

const spanClass = (value: number) => {
	if (value >= 12) return 'span-12';
	if (value >= 8) return 'span-8';
	if (value >= 6) return 'span-6';
	if (value >= 4) return 'span-4';
	return 'span-3';
};

export default function WidgetGrid(props: Props) {
	return (
		<div class="dp-builder-widget-grid">
			<For each={props.widgets}>
				{(widget) => (
					<div class={`dp-builder-widget ${spanClass(widget.w)}`} style={{ 'min-height': `${Math.max(widget.h, 1) * 120}px` }} data-cat={widget.source}>
						<div class="dp-builder-widget-head">
							<span>{widget.title}</span>
							<Show when={props.isAdmin}>
								<button type="button" class="dp-builder-kill-button" onClick={() => props.onRemoveWidget?.(widget.id)}>
									[X]
								</button>
							</Show>
						</div>

						<div class="dp-builder-widget-body">
							<Switch>
								<Match when={widget.source === 'crypto'}>
									<CryptoWidget
										config={widget}
										data={props.widgetData.get(widget.id) || null}
										loading={props.loadingWidgets.has(widget.id)}
									/>
								</Match>
								<Match when={widget.source === 'news'}>
									<NewsWidget
										config={widget}
										data={props.widgetData.get(widget.id) || null}
										loading={props.loadingWidgets.has(widget.id)}
									/>
								</Match>
								<Match when={widget.source === 'social'}>
									<SocialWidget
										config={widget}
										data={props.widgetData.get(widget.id) || null}
										loading={props.loadingWidgets.has(widget.id)}
									/>
								</Match>
								<Match when={widget.source === 'price'}>
									<PriceWidget
										config={widget}
										data={props.widgetData.get(widget.id) || null}
										loading={props.loadingWidgets.has(widget.id)}
									/>
								</Match>
								<Match when={widget.source === 'monitor'}>
									<MonitorWidget
										config={widget}
										data={props.widgetData.get(widget.id) || null}
										loading={props.loadingWidgets.has(widget.id)}
									/>
								</Match>
								<Match when={widget.source === 'seo'}>
									<WidgetPlaceholder
										title="CORE WEB VITALS"
										rows={[
											['LCP', '1.2s', 'is-success'],
											['FID', '42ms', 'is-success'],
											['CLS', '0.25', 'is-danger'],
										]}
									/>
								</Match>
								<Match when={widget.source === 'scraper'}>
									<WidgetPlaceholder
										title="SCRAPER PIPELINE"
										rows={[
											['Queue', '12 jobs', 'is-accent'],
											['Success', '98%', 'is-success'],
											['Latency', '284ms', 'is-muted'],
										]}
									/>
								</Match>
								<Match when={true}>
									<div class="dp-builder-widget-placeholder">Widget type not supported: {widget.source}</div>
								</Match>
							</Switch>
						</div>
					</div>
				)}
			</For>
		</div>
	);
}

function WidgetPlaceholder(props: { title: string; rows: Array<[string, string, string]> }) {
	return (
		<div class="dp-builder-widget-placeholder">
			<div class="dp-builder-widget-placeholder-chart">{props.title}</div>
			<div class="dp-builder-widget-placeholder-rows">
				<For each={props.rows}>
					{([label, value, tone]) => (
						<div class="dp-builder-widget-placeholder-row">
							<span>{label}</span>
							<strong class={tone}>{value}</strong>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}
