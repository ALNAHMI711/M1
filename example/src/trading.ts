import '../trading.css';
import {
  CandlestickSeries, ColorType, CrosshairMode, createChart,
  type IChartApi, type ISeriesApi, type Time,
} from 'lightweight-charts';
import type { Bar, IndicatorResult } from 'oakscriptjs';
import { IndicatorRenderer, type RenderableIndicator } from '../../src/render';
import { indicatorRegistry, type IndicatorRegistryEntry } from '../../src/index';

type Interval = '1m'|'5m'|'15m'|'1h'|'4h'|'1d';
const WATCHLIST = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT'];
const state = { symbol:'BTCUSDT', interval:'1m' as Interval, bars:[] as Bar[], activeIndicator:null as IndicatorRegistryEntry|null };

const chartEl=document.getElementById('chart')!;
const chart:IChartApi=createChart(chartEl,{layout:{background:{type:ColorType.Solid,color:'#0d1219'},textColor:'#aeb8c7'},grid:{vertLines:{color:'#18212c'},horzLines:{color:'#18212c'}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderColor:'#25303d'},timeScale:{borderColor:'#25303d',timeVisible:true,secondsVisible:false},handleScale:true,handleScroll:true});
const candles:ISeriesApi<'Candlestick'>=chart.addSeries(CandlestickSeries,{upColor:'#27b985',downColor:'#e05252',borderVisible:false,wickUpColor:'#27b985',wickDownColor:'#e05252'});
const renderer=new IndicatorRenderer(chart,{paneIndex:1,mainSeries:candles,extendTimeScale:true});

const statusEl=document.getElementById('connection-status')!,priceEl=document.getElementById('last-price')!,changeEl=document.getElementById('price-change')!,candleInfoEl=document.getElementById('candle-info')!;
const symbolInput=document.getElementById('symbol') as HTMLInputElement;
const indicatorSelect=document.getElementById('indicator-select') as HTMLSelectElement;
const indicatorSearch=document.getElementById('indicator-search') as HTMLInputElement;

function setStatus(kind:'ok'|'error'|'loading',text:string){const holder=document.querySelector('.market-status')!;holder.classList.toggle('ok',kind==='ok');holder.classList.toggle('error',kind==='error');statusEl.textContent=text}
function normalizeBars(raw:unknown[][]):Bar[]{return raw.map(k=>({time:Number(k[0])/1000,open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),volume:Number(k[5])}))}
function formatPrice(v:number){if(v>=1000)return v.toLocaleString('en-US',{maximumFractionDigits:2});if(v>=1)return v.toLocaleString('en-US',{maximumFractionDigits:4});return v.toLocaleString('en-US',{maximumFractionDigits:8})}
function updateHeader(){const last=state.bars.at(-1),prev=state.bars.at(-2);if(!last)return;const delta=prev?((last.close-prev.close)/prev.close)*100:0;priceEl.textContent=formatPrice(last.close);changeEl.textContent=(delta>=0?'+':'')+delta.toFixed(2)+'%';changeEl.style.color=delta>=0?'#27b985':'#e05252';candleInfoEl.textContent=state.symbol+' · '+state.interval+' · '+state.bars.length+' شمعة';}
function renderActiveIndicator(){renderer.clear();const indicator=state.activeIndicator;if(!indicator||!state.bars.length)return;try{const inputs={...indicator.defaultInputs};const result:IndicatorResult=indicator.calculate(state.bars,inputs);renderer.render(indicator as RenderableIndicator,result,state.bars,{inputs})}catch(error){console.error('Indicator error:',error)}}
function renderChart(){candles.setData(state.bars.map(b=>({time:b.time as Time,open:b.open,high:b.high,low:b.low,close:b.close})));chart.timeScale().fitContent();renderActiveIndicator();updateHeader()}

async function loadMarket(){setStatus('loading','تحميل بيانات السوق...');try{const url='https://api.binance.com/api/v3/klines?symbol='+encodeURIComponent(state.symbol)+'&interval='+state.interval+'&limit=500';const response=await fetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw new Error('HTTP '+response.status);const raw=await response.json() as unknown[][];state.bars=normalizeBars(raw);renderChart();setStatus('ok','بيانات السوق متصلة');connectStream()}catch(error){console.error(error);setStatus('error','تعذر الوصول إلى بيانات Binance')}}
let socket:WebSocket|null=null;let socketGeneration=0;
function connectStream(){socket?.close();const generation=++socketGeneration;const stream=state.symbol.toLowerCase()+'@kline_'+state.interval;socket=new WebSocket('wss://stream.binance.com:9443/ws/'+stream);socket.onopen=()=>{if(generation===socketGeneration)setStatus('ok','السوق مباشر')};socket.onmessage=event=>{if(generation!==socketGeneration)return;const message=JSON.parse(event.data);const k=message.k;if(!k)return;const bar:Bar={time:Number(k.t)/1000,open:Number(k.o),high:Number(k.h),low:Number(k.l),close:Number(k.c),volume:Number(k.v)};const last=state.bars.at(-1);if(last&&last.time===bar.time)state.bars[state.bars.length-1]=bar;else state.bars.push(bar);candles.update({time:bar.time as Time,open:bar.open,high:bar.high,low:bar.low,close:bar.close});updateHeader();if(k.x)renderActiveIndicator()};socket.onerror=()=>{if(generation===socketGeneration)setStatus('error','انقطع بث السوق')};socket.onclose=()=>{if(generation===socketGeneration)setStatus('error','اتصال السوق مغلق')}}
function populateIndicators(query=''){const q=query.trim().toLowerCase();const items=indicatorRegistry.filter(item=>!q||item.name.toLowerCase().includes(q)||item.id.toLowerCase().includes(q)).slice(0,250);indicatorSelect.replaceChildren(...items.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;return option}))}
function selectIndicator(id:string|null){if(!id){state.activeIndicator=null;renderer.clear();return}state.activeIndicator=indicatorRegistry.find(item=>item.id===id)??null;renderActiveIndicator()}
function buildWatchlist(){const holder=document.getElementById('watchlist')!;holder.replaceChildren(...WATCHLIST.map(symbol=>{const button=document.createElement('button');button.className='ghost watch';button.dataset.symbol=symbol;button.textContent=symbol;button.addEventListener('click',()=>{state.symbol=symbol;symbolInput.value=state.symbol;loadMarket()});return button}))}
document.querySelectorAll<HTMLButtonElement>('#timeframes button').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#timeframes .active')?.classList.remove('active');button.classList.add('active');state.interval=button.dataset.interval as Interval;loadMarket()}));
document.getElementById('load-market')!.addEventListener('click',()=>{state.symbol=symbolInput.value.trim().toUpperCase();if(!/^[A-Z0-9._-]{3,20}$/.test(state.symbol)){setStatus('error','رمز السوق غير صالح');return}loadMarket()});
symbolInput.addEventListener('keydown',event=>{if(event.key==='Enter')document.getElementById('load-market')!.click()});
indicatorSearch.addEventListener('input',()=>populateIndicators(indicatorSearch.value));
indicatorSelect.addEventListener('change',()=>selectIndicator(indicatorSelect.value));
document.getElementById('clear-indicator')!.addEventListener('click',()=>{indicatorSelect.selectedIndex=-1;selectIndicator(null)});
window.addEventListener('resize',()=>{const rect=chartEl.getBoundingClientRect();chart.resize(rect.width,rect.height)});
buildWatchlist();populateIndicators();loadMarket();