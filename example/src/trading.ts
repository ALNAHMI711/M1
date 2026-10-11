import '../trading.css';
import {
  CandlestickSeries, ColorType, CrosshairMode, createChart,
  type ISeriesApi, type Time,
} from 'lightweight-charts';
import type { Bar, IndicatorResult } from 'oakscriptjs';
import { IndicatorRenderer, type RenderableIndicator } from '../../src/render';
import type { IndicatorRegistryEntry } from '../../src/index';
import { attachControlPanel } from './control';

type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
const SECONDS: Record<Interval, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };
const WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT'];
const state = { symbol: 'BTCUSDT', interval: '1m' as Interval, bars: [] as Bar[], demo: false, activeIndicator: null as IndicatorRegistryEntry | null };
let registry: IndicatorRegistryEntry[] = [];
let requestGeneration = 0;
let socketGeneration = 0;
let requestController: AbortController | null = null;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let retry = 0;

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const chartEl = byId('chart');
const symbolInput = byId<HTMLInputElement>('symbol');
const indicatorSelect = byId<HTMLSelectElement>('indicator-select');
const indicatorSearch = byId<HTMLInputElement>('indicator-search');
const chart = createChart(chartEl, {
  layout: { background: { type: ColorType.Solid, color: '#0d1219' }, textColor: '#aeb8c7' },
  grid: { vertLines: { color: '#18212c' }, horzLines: { color: '#18212c' } },
  crosshair: { mode: CrosshairMode.Normal }, timeScale: { timeVisible: true },
  autoSize: true,
});
const candles: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
  upColor: '#218962', downColor: '#cf5353', borderVisible: false,
  wickUpColor: '#218962', wickDownColor: '#cf5353',
});
const renderer = new IndicatorRenderer(chart, { paneIndex: 1, mainSeries: candles, extendTimeScale: true });

function setStatus(kind: 'ok' | 'error' | 'loading', text: string) {
  const holder = document.querySelector('.market-status')!;
  holder.classList.toggle('ok', kind === 'ok');
  holder.classList.toggle('error', kind === 'error');
  byId('connection-status').textContent = text;
}

function normalizeBars(raw: unknown): Bar[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('invalid_market_data');
  const bars = raw.map(k => {
    if (!Array.isArray(k) || k.length < 6) throw new Error('invalid_market_candle');
    const values = k.slice(0, 6).map(Number);
    if (values.some(v => !Number.isFinite(v)) || values.slice(1, 5).some(v => v <= 0)) throw new Error('invalid_market_number');
    return { time: values[0] / 1000, open: values[1], high: values[2], low: values[3], close: values[4], volume: values[5] };
  });
  if (bars.some((bar, index) => index > 0 && bar.time <= bars[index - 1].time)) throw new Error('invalid_market_order');
  return bars;
}

function updateHeader() {
  const last = state.bars.at(-1), prev = state.bars.at(-2);
  if (!last) return;
  const delta = prev ? (last.close - prev.close) / prev.close * 100 : 0;
  byId('last-price').textContent = last.close.toLocaleString('en-US', { maximumFractionDigits: last.close >= 1 ? 4 : 8 });
  byId('price-change').textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`;
  byId('price-change').classList.toggle('negative', delta < 0);
  byId('candle-info').textContent = `${state.demo ? 'DEMO' : state.symbol} · ${state.interval} · ${state.bars.length} شمعة`;
}

function renderIndicator() {
  renderer.clear();
  if (!state.activeIndicator || !state.bars.length) return;
  try {
    const inputs = { ...state.activeIndicator.defaultInputs };
    const result: IndicatorResult = state.activeIndicator.calculate(state.bars, inputs);
    renderer.render(state.activeIndicator as RenderableIndicator, result, state.bars, { inputs });
    byId('indicator-status').textContent = state.activeIndicator.name;
  } catch {
    byId('indicator-status').textContent = 'تعذر حساب هذا المؤشر على البيانات الحالية؛ اختر مؤشرًا آخر.';
  }
}

function renderChart() {
  candles.setData(state.bars.map(b => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close })));
  chart.timeScale().fitContent();
  renderIndicator();
  updateHeader();
}

function stopStream() {
  ++socketGeneration;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  socket?.close();
  socket = null;
}

async function loadMarket() {
  const symbol = symbolInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(symbol)) return setStatus('error', 'رمز السوق غير صالح');
  state.symbol = symbol;
  state.demo = false;
  byId('data-source').textContent = 'مصدر البيانات: Binance Spot public market data';
  stopStream();
  requestController?.abort();
  requestController = new AbortController();
  const generation = ++requestGeneration;
  const interval = state.interval;
  // Never display candles from the previous symbol while relabeling the chart.
  state.bars = [];
  renderer.clear();
  candles.setData([]);
  byId('last-price').textContent = '—';
  byId('price-change').textContent = '—';
  byId('candle-info').textContent = `${symbol} · ${interval}`;
  setStatus('loading', 'تحميل بيانات السوق...');
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=500`, {
      headers: { accept: 'application/json' }, signal: requestController.signal,
    });
    if (!response.ok) throw new Error('market_request_failed');
    const bars = normalizeBars(await response.json());
    if (generation !== requestGeneration) return;
    state.bars = bars;
    renderChart();
    retry = 0;
    setStatus('ok', 'بيانات السوق متصلة');
    connectStream();
  } catch {
    if (generation === requestGeneration && !requestController.signal.aborted) {
      setStatus('error', 'تعذر الوصول إلى Binance؛ أعد التحميل أو اختر البيانات التجريبية.');
    }
  }
}

function connectStream() {
  if (state.demo) return;
  const generation = ++socketGeneration;
  const stream = `${state.symbol.toLowerCase()}@kline_${state.interval}`;
  socket = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
  socket.onopen = () => {
    if (generation === socketGeneration) { retry = 0; setStatus('ok', 'السوق مباشر'); }
  };
  socket.onmessage = event => {
    if (generation !== socketGeneration) return;
    try {
      const k = JSON.parse(event.data).k;
      if (!k) return;
      const [bar] = normalizeBars([[k.t, k.o, k.h, k.l, k.c, k.v]]);
      const last = state.bars.at(-1);
      if (last && bar.time < last.time) return;
      if (last && last.time === bar.time) state.bars[state.bars.length - 1] = bar;
      else state.bars.push(bar);
      if (state.bars.length > 500) {
        state.bars = state.bars.slice(-500);
        renderChart();
      } else candles.update({ time: bar.time as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
      updateHeader();
      if (k.x) renderIndicator();
    } catch {
      setStatus('error', 'وردت بيانات غير صالحة؛ لم تُضف إلى الرسم.');
    }
  };
  socket.onerror = () => { if (generation === socketGeneration) setStatus('error', 'انقطع بث السوق؛ جارٍ إعادة الاتصال.'); };
  socket.onclose = () => {
    if (generation !== socketGeneration || state.demo) return;
    setStatus('error', 'البث متوقف؛ البيانات المعروضة ليست محدثة. جارٍ إعادة الاتصال.');
    // Reload the REST snapshot before reconnecting, so missed candles are recovered.
    reconnectTimer = setTimeout(() => { void loadMarket(); }, Math.min(30000, 1000 * 2 ** Math.min(retry++, 5)));
  };
}

function loadDemo() {
  requestController?.abort();
  ++requestGeneration;
  stopStream();
  state.demo = true;
  const step = SECONDS[state.interval];
  const start = Math.floor(Date.now() / 1000 / step) * step - 180 * step;
  state.bars = Array.from({ length: 180 }, (_, i) => {
    const open = 100 + i * 0.12 + Math.sin(i / 6) * 4;
    const close = open + Math.sin(i * 1.7) * 1.5;
    return { time: start + i * step, open, close, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, volume: 100 + i * 3 };
  });
  byId('data-source').textContent = 'بيانات مولدة للتجربة فقط، وليست أسعار سوق أو نتائج تداول.';
  setStatus('loading', 'وضع تجريبي: بيانات مصطنعة، لا اتصال بالسوق ولا تنفيذ.');
  renderChart();
}

function populateIndicators(query = '') {
  const q = query.trim().toLowerCase();
  const matches = registry.filter(item => !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
  const items = matches.slice(0, 250);
  indicatorSelect.replaceChildren(...items.map(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    return option;
  }));
  indicatorSelect.selectedIndex = -1;
  byId('indicator-status').textContent = `${matches.length} مؤشر مطابق؛ عرض أول ${items.length}.`;
  if (!items.length) {
    const option = document.createElement('option');
    option.textContent = 'لا توجد نتائج؛ جرّب اسمًا آخر.';
    option.disabled = true;
    indicatorSelect.append(option);
  }
}

byId('load-indicators').addEventListener('click', async () => {
  const button = byId<HTMLButtonElement>('load-indicators');
  button.disabled = true;
  byId('indicator-status').textContent = 'تحميل مكتبة المؤشرات...';
  try {
    registry = (await import('../../src/index')).indicatorRegistry;
    indicatorSelect.disabled = indicatorSearch.disabled = false;
    button.hidden = true;
    populateIndicators();
  } catch {
    button.disabled = false;
    byId('indicator-status').textContent = 'تعذر تحميل المكتبة؛ أعد المحاولة.';
  }
});
indicatorSearch.addEventListener('input', () => populateIndicators(indicatorSearch.value));
indicatorSelect.addEventListener('change', () => {
  state.activeIndicator = registry.find(item => item.id === indicatorSelect.value) ?? null;
  renderIndicator();
});
byId('clear-indicator').addEventListener('click', () => {
  indicatorSelect.selectedIndex = -1;
  state.activeIndicator = null;
  renderer.clear();
});
byId('watchlist').replaceChildren(...WATCHLIST.map(symbol => {
  const button = document.createElement('button');
  button.className = 'ghost watch';
  button.dataset.testid = `button-watch-${symbol}`;
  button.textContent = symbol;
  button.addEventListener('click', () => { symbolInput.value = symbol; void loadMarket(); });
  return button;
}));
document.querySelectorAll<HTMLButtonElement>('#timeframes button').forEach(button => {
  button.dataset.testid = `button-timeframe-${button.dataset.interval}`;
  button.addEventListener('click', () => {
    document.querySelector('#timeframes .active')?.classList.remove('active');
    button.classList.add('active');
    state.interval = button.dataset.interval as Interval;
    if (state.demo) loadDemo(); else void loadMarket();
  });
});
byId('load-market').addEventListener('click', () => void loadMarket());
byId('demo-market').addEventListener('click', loadDemo);
symbolInput.addEventListener('keydown', event => { if (event.key === 'Enter') void loadMarket(); });
byId('export-bars').addEventListener('click', () => {
  if (!state.bars.length) return setStatus('error', 'لا توجد شموع للتصدير؛ حمّل السوق أو البيانات التجريبية.');
  const csv = 'time,open,high,low,close,volume\n' + state.bars.map(b => [b.time, b.open, b.high, b.low, b.close, b.volume].join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${state.demo ? 'DEMO-synthetic' : state.symbol}-${state.interval}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

let dark = matchMedia('(prefers-color-scheme: dark)').matches;
function applyTheme() {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const css = getComputedStyle(document.documentElement);
  chart.applyOptions({
    layout: { background: { type: ColorType.Solid, color: css.getPropertyValue('--surface').trim() }, textColor: css.getPropertyValue('--text').trim() },
    grid: { vertLines: { color: css.getPropertyValue('--border').trim() }, horzLines: { color: css.getPropertyValue('--border').trim() } },
  });
  byId('theme-toggle').setAttribute('aria-label', dark ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن');
}
byId('theme-toggle').addEventListener('click', () => { dark = !dark; applyTheme(); });
window.addEventListener('beforeunload', () => { requestController?.abort(); stopStream(); chart.remove(); });
document.querySelectorAll<HTMLElement>('button,input,select,textarea').forEach(el => {
  if (!el.dataset.testid && el.id) el.dataset.testid = `${el.tagName.toLowerCase()}-${el.id}`;
});
applyTheme();
attachControlPanel();
void loadMarket();
