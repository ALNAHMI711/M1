# Community Indicator Inventory

Community indicators of `lightweight-charts-indicators`: TypeScript ports of community PineScript scripts, built on
[oakscriptjs](https://github.com/deepentropy/oakscriptJS). Each port has the inputs, plots and drawings of its Pine
source. This list is generated from the indicator registry (`indicatorRegistry` in `src/index.ts`).

## Summary

| | Count |
|---|---|
| **Community indicators** | 793 |
| Drawn on the price pane (overlay) | 446 |
| Drawn in their own pane | 347 |
| Compared with TradingView outputs (batches 1-24) | 475 |

| Category | Count |
|---|---|
| Trend | 225 |
| Oscillators | 168 |
| Momentum | 112 |
| Moving Averages | 104 |
| Channels & Bands | 84 |
| Volume | 63 |
| Volatility | 23 |
| Candlestick Patterns | 14 |

## Columns

- **Id**: the registry id (`indicatorRegistry.find((e) => e.id === id)`).
- **Pane**: `price` for an overlay indicator, `own` for an indicator in its own pane (some plots, backgrounds or
  candles of an `own` indicator can still be drawn on the price pane, as Pine `force_overlay`).
- **Author**: the author of the Pine source, from the port header (empty when the header does not name one).
- **Check**: the batch in which the port was compared with TradingView outputs (BITSTAMP:BTCUSD 1D and NASDAQ:AAPL 1D,
  full histories, default inputs and input variants: plots, colours, fills, markers, bar / background colours and
  candles). Empty for the earlier ports.

## Indicators

| # | Indicator | Id | Category | Pane | Author | Check |
|---|---|---|---|---|---|---|
| 1 | + Average Candle Bodies Range | `average-candle-bodies-range` | Volatility | own | ClassicScott | batch 13 |
| 2 | 12/26 EMA Inflection Zones by Korax | `12-26-ema-inflection-zones-by-korax` | Moving Averages | price | Korax | batch 16 |
| 3 | 1m Trend Continuation Signals - SSL + BB Filter | `1m-trend-continuation-signals-ssl-bb-filter` | Trend | price | rhariganesh | batch 13 |
| 4 | 3 Confirmation Bear | `3-confirmation-bear` | Trend | price | AirianM | batch 16 |
| 5 | 3 Confirmation Bull | `3-confirmation-bull` | Trend | price | AirianM | batch 21 |
| 6 | 3-in-1 Custom Moving Average Indicator | `3-in-1-custom-moving-average-indicator` | Moving Averages | price | Mr-Fish | batch 22 |
| 7 | 5-Minute Buy/Sell Signal | `5-minute-buy-sell-signal` | Trend | price | Waqas_Khalid | batch 14 |
| 8 | 72s: Adaptive Hull Moving Average+ | `adaptive-hull-ma` | Moving Averages | price | io72signals |  |
| 9 | [RS] Support and Resistance V0 | `rs-support-resistance` | Channels & Bands | price | RicardoSantos (community) |  |
| 10 | Absolute Strength Index | `absolute-strength-index` | Oscillators | own | Zeiierman | batch 3 |
| 11 | Acceleration Bands HTF | `acceleration-bands-htf` | Channels & Bands | price | ZoharCho | batch 18 |
| 12 | Accumulation/Distribution Money Flow v1.0 | `ad-money-flow` | Volume | own | kypexin | batch 8 |
| 13 | Accurate Swing Trading | `accurate-swing-trading` | Trend | price |  |  |
| 14 | Adaptive ALMA 2.0 | `adaptive-alma-2-0` | Moving Averages | price | Zomzi | batch 9 |
| 15 | Adaptive Convergence Divergence | `adaptive-convergence-divergence` | Momentum | own | singhxgurjit | batch 21 |
| 16 | Adaptive Ehlers Filtered Percentile | `adaptive-ehlers-filtered-percentile` | Channels & Bands | price | SchizoQuant | batch 4 |
| 17 | Adaptive Entropy Trend | `adaptive-entropy-trend` | Trend | price | QuantAlgo | batch 6 |
| 18 | Adaptive Friction Filter (AFF) | `adaptive-friction-filter` | Trend | price | QuantAlgo | batch 10 |
| 19 | Adaptive Gaussian AFR | `adaptive-gaussian-afr` | Trend | price | Mattes00 | batch 6 |
| 20 | Adaptive Heikin Ashi | `adaptive-heikin-ashi` | Trend | price | chervolino | batch 13 |
| 21 | Adaptive Kinetic Ribbon | `adaptive-kinetic-ribbon` | Trend | price | QuantAlgo | batch 9 |
| 22 | Adaptive MACD | `adaptive-macd` | Momentum | own |  |  |
| 23 | Adaptive ML Trailing Stop | `adaptive-ml-trailing-stop` | Trend | price | BOSWaves | batch 5 |
| 24 | Adaptive Nadaraya-Watson (Non Repainting) | `adaptive-nadaraya-watson` | Channels & Bands | price | Metrify | batch 10 |
| 25 | Adaptive Pivot Zones | `adaptive-pivot-zones` | Channels & Bands | price | Uncle_the_shooter | batch 17 |
| 26 | Adaptive Rolling Z-Score Channel | `adaptive-rolling-z-score-channel` | Channels & Bands | price | B3AR_Trades | batch 18 |
| 27 | Adaptive RSI \| Lyro RS | `adaptive-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 13 |
| 28 | Adaptive Trend Channel | `adaptive-trend-channel` | Channels & Bands | price | MarketStructureLab | batch 4 |
| 29 | Adaptive Trend Flow [QuantAlgo] | `adaptive-trend-flow` | Trend | price | QuantAlgo |  |
| 30 | Adaptive Volatility-Scaled Oscillator | `adaptive-volatility-scaled-oscillator` | Volatility | own | Zeiierman | batch 4 |
| 31 | Adjusted RSI | `adjusted-rsi` | Oscillators | own | JTCapitalNL | batch 11 |
| 32 | AdvancedLines (FiboBands) - PaSKaL | `advancedlines-paskal` | Channels & Bands | price | uPaSKaL | batch 19 |
| 33 | ADX and RSI Combo | `adx-and-rsi-combo` | Oscillators | own | Tracks | batch 10 |
| 34 | ADX by cobra | `adx-cobra` | Trend | own | cobra (community) |  |
| 35 | ADX Di+ Di- [Gu5] | `adx-di-gu5` | Trend | own | Gu5tavo71 |  |
| 36 | ADX Extreme Zones + Divergences | `adx-extreme-zones-divergences` | Trend | own | TradeVizion | batch 13 |
| 37 | ADX Trend Strength Filter + TRAMA | `adx-trend-strength-filter-trama` | Trend | price | DotGain | batch 18 |
| 38 | ADX with Shaded Zone | `adx-with-shaded-zone` | Trend | own | MathThomas | batch 20 |
| 39 | ADX-vALMA (N) | `adx-valma` | Trend | own | Zomzi | batch 6 |
| 40 | Aggregated Scores Oscillator | `aggregated-scores-oscillator` | Oscillators | own | AlphaExtract | batch 8 |
| 41 | Aggressive Pullback Indicator | `aggressive-pullback-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 42 | AI Adaptive Oscillator | `ai-adaptive-oscillator` | Oscillators | own | PhenLabs | batch 11 |
| 43 | AI Breakout Bands | `ai-breakout-bands` | Channels & Bands | price | Zeiierman | batch 3 |
| 44 | AI Engulfing Candle | `ai-engulfing` | Candlestick Patterns | price |  |  |
| 45 | AI Infinity | `ai-infinity` | Trend | price | jonathanalbrecht_trader | batch 11 |
| 46 | AI Source Switching Moving Average | `ai-source-switching-moving-average` | Moving Averages | price | Zeiierman | batch 1 |
| 47 | AI Trend Navigator [K-Neighbor] | `ai-trend-navigator` | Trend | price |  |  |
| 48 | AI Volume Signals | `ai-volume-signals` | Volume | price | szymonsobkowiak | batch 9 |
| 49 | AI-Weighted RSI | `ai-weighted-rsi` | Oscillators | own | Zeiierman | batch 3 |
| 50 | AK MACD BB | `macd-bb` | Momentum | own | Algokid |  |
| 51 | AK TREND ID | `ak-trend-id` | Trend | own | Algokid |  |
| 52 | Al Po's Arithmetic Mean | `al-po-s-arithmetic-mean` | Moving Averages | price | sequentialvision | batch 21 |
| 53 | All Candlestick Patterns | `all-candlestick-patterns` | Candlestick Patterns | price |  |  |
| 54 | ALMA SD Bands \| RakoQuant | `alma-sd-bands-rakoquant` | Channels & Bands | price | RakoQuant | batch 10 |
| 55 | Alpha Trading Signal _ Up side Down | `alpha-trading-signal-up-side-down` | Trend | price | giaodichdsmart | batch 19 |
| 56 | Alpha-Sutte Model | `alpha-sutte-model` | Trend | price | SegaRKO | batch 10 |
| 57 | AlphaTrend | `alpha-trend` | Trend | price | KivancOzbilgic |  |
| 58 | Anchored Bollinger Band Range | `anchored-bollinger-band-range` | Channels & Bands | price | Steversteves | batch 20 |
| 59 | Anchored VWAP Pro (Final Visibility Enhanced) | `anchored-vwap-pro` | Volume | price | ImmortalEmerson | batch 17 |
| 60 | ANDROMEDA - TrendSync | `andromeda-trendsync` | Trend | price | Pedro_Canto | batch 9 |
| 61 | Anti-Volume Stop Loss | `anti-volume-stop` | Trend | price |  |  |
| 62 | Arnaud Legoux Gaussian Flow \| AlphaNatt | `arnaud-legoux-gaussian-flow-alphanatt` | Moving Averages | price | AlphaNatt | batch 17 |
| 63 | Aroon with RSI Confirmation (92.86%) | `aroon-with-rsi-confirmation` | Trend | price | jaydipali622018 | batch 7 |
| 64 | Asian & London Session High/Low | `asian-london-session-high-low` | Channels & Bands | price | NikolayBorisov | batch 8 |
| 65 | Asset risk metrics | `asset-risk-metrics` | Momentum | price | Sweettz | batch 21 |
| 66 | Asymmetric Volatility Trend Line | `asymmetric-volatility-trend-line` | Trend | price | QuantAlgo | batch 4 |
| 67 | ATR Based Zigzag w EMA | `atr-based-zigzag-w-ema` | Trend | price | HabibiBudo | batch 4 |
| 68 | ATR HEMA | `atr-hema` | Moving Averages | price | SeerQuant | batch 2 |
| 69 | ATR Period | `nrtr` | Trend | price |  |  |
| 70 | ATR Period | `profit-maximizer` | Moving Averages | price |  |  |
| 71 | ATR Period | `supertrend-ladder` | Trend | price |  |  |
| 72 | ATR Rope | `atr-rope` | Trend | price | SamRecio | batch 2 |
| 73 | ATR Trailing Stops | `atr-trailing-stops` | Trend | price |  |  |
| 74 | ATR Volatility and Trend Analysis | `atr-volatility-and-trend-analysis` | Volatility | price | dchunt-stack | batch 10 |
| 75 | ATR ZLEMA | `atr-zlema` | Trend | price | QuantAlgo | batch 3 |
| 76 | ATR+ Stop Loss Indicator | `atr-plus` | Trend | own | ZenAndTheArtOfTrading |  |
| 77 | ATR-Normalized VWMA Deviation | `atr-normalized-vwma-deviation` | Oscillators | own | exploretranspose | batch 10 |
| 78 | ATR-Scaled Deviation Oscillator | `atr-scaled-deviation-oscillator` | Oscillators | own | C_H_I_P_A | batch 23 |
| 79 | Aura Trend & Candlestick Matrix | `aura-trend-candlestick-matrix` | Trend | price | Pineify | batch 9 |
| 80 | Aura: Adaptive Statistical Smoother | `aura-adaptive-statistical-smoother` | Moving Averages | price | Pineify | batch 15 |
| 81 | Auto Fibo on Indicators | `auto-fibo-indicators` | Oscillators | own | KivancOzbilgic |  |
| 82 | Auto Fibonacci | `auto-fib` | Channels & Bands | price |  |  |
| 83 | Auto Trendline [DojiEmoji] | `auto-trendline` | Trend | price |  |  |
| 84 | Auto-Support | `auto-support` | Channels & Bands | price |  |  |
| 85 | Automated Z-scoring | `automated-z-scoring` | Oscillators | own | JTCapitalNL | batch 14 |
| 86 | Automatic Support & Resistance | `auto-support-resistance` | Channels & Bands | price |  |  |
| 87 | Average Bullish & Bearish Percentage Change | `average-bullish-bearish-percentage-change` | Momentum | own | fract | batch 23 |
| 88 | Average Sentiment Oscillator | `average-sentiment-oscillator` | Oscillators | own |  |  |
| 89 | Average True Range Trailing Stops Colored | `atr-trailing-colored` | Trend | price |  |  |
| 90 | Awesome Oscillator V2 | `awesome-oscillator-v2` | Oscillators | own |  |  |
| 91 | Awesome_Accelerator_Zone Oscillator | `awesome-accelerator-zone-oscillator` | Oscillators | own | pirooz_trader | batch 18 |
| 92 | B + A + D v0.4 | `b-a-d-v0-4` | Momentum | own | wepritz84 | batch 13 |
| 93 | BACAP PRICE STRUCTURE 21 EMA TREND | `bacap-price-structure-21-ema-trend` | Trend | price | Alex_PrimeTrading | batch 19 |
| 94 | Banker Fund Flow Trend Oscillator | `banker-fund-flow` | Oscillators | own |  |  |
| 95 | BB Breakout Oscillator | `bb-breakout-oscillator` | Oscillators | own | LuxAlgo |  |
| 96 | BB Fibonacci Ratios | `bb-fibonacci-ratios` | Channels & Bands | price |  |  |
| 97 | BB Length | `ideal-bb-ma` | Moving Averages | price |  |  |
| 98 | BB Stochastic RSI Extreme Signal | `bb-stoch-rsi` | Oscillators | price |  |  |
| 99 | Bernoulli Process - Binary Entropy | `bernoulli-process-entropy` | Oscillators | own | kocurekc | batch 1 |
| 100 | BEST Supertrend CCI | `supertrend-cci` | Trend | price | Daveatt |  |
| 101 | Beta-Weighted Moving Average | `weighted-ma-function` | Moving Averages | price |  |  |
| 102 | Better Volume Indicator | `better-volume` | Volume | own | LazyBear |  |
| 103 | Big Snapper Alerts R3.0 | `big-snapper-alerts` | Trend | price |  |  |
| 104 | Biggest Volume | `biggest-volume` | Volume | own | mikhail_marka | batch 22 |
| 105 | Bilateral Filter For Loop | `bilateral-filter-for-loop` | Trend | own | BackQuant | batch 14 |
| 106 | Binary Option Arrows | `binary-option-arrows` | Trend | price |  |  |
| 107 | Bitcoin Kill Zones v2 | `bitcoin-kill-zones` | Trend | price |  |  |
| 108 | Bitcoin Log Growth Curves | `bitcoin-log-curves` | Trend | price | Quantadelic |  |
| 109 | Bjorgum AutoTrail | `bjorgum-autotrail` | Trend | price | Bjorgum (simplified for auto mode) |  |
| 110 | Bjorgum TSI | `bjorgum-tsi` | Momentum | own |  |  |
| 111 | Blacklab84 Panel | `blacklab84-panel` | Oscillators | own | blacklab84 | batch 21 |
| 112 | Bollinger Adaptive Trend Navigator | `bollinger-adaptive-trend-navigator` | Trend | price | QuantAlgo | batch 16 |
| 113 | Bollinger Awesome Alert R1.1 | `bollinger-awesome-alert` | Trend | price |  |  |
| 114 | Boom Hunter Pro | `boom-hunter-pro` | Momentum | own | veryfid |  |
| 115 | Breakdown or Buyable Dip? Pullback Depth Can Help | `breakdown-or-buyable-dip-pullback-depth-can-help` | Momentum | own | TradeStation | batch 23 |
| 116 | Breakout Indicator | `breakout-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 117 | BTC Logarithmic Regression Quantile Bands \| Astral Vision | `btc-logarithmic-regression-quantile-bands-astral-vision` | Channels & Bands | price | AstralVision | batch 24 |
| 118 | Bull Bear Power Trend | `bull-bear-power-trend` | Momentum | own |  |  |
| 119 | Bullish Engulfing Finder | `bullish-engulfing-finder` | Candlestick Patterns | price |  |  |
| 120 | Bulls or Bears in Control | `bulls-bears-control` | Trend | own |  |  |
| 121 | Bulls v Bears | `bulls-v-bears` | Momentum | own | Mihkel00 | batch 3 |
| 122 | Buy & Sell - Accurate Signals | `buy-sell-accurate-signals` | Trend | price | Cryptokingworld91 (published as "Buy & Sell - Accurate Signals") | batch 7 |
| 123 | Buy & Sell Pressure | `buy-sell-pressure` | Volume | own |  |  |
| 124 | Buy Low Sell High Composite Upgraded V6 | `buy-low-sell-high-composite-upgraded-v6` | Oscillators | own | kristian6ncqq | batch 15 |
| 125 | Buy on Volume | `buy-on-volume` | Moving Averages | price | Mando4_27 | batch 21 |
| 126 | Buy/Sell Hull Crossover Signals (Fast & Slow) | `buy-sell-hull-crossover-signals` | Moving Averages | price | VibeAlgos | batch 11 |
| 127 | Buyers & Sellers / Range | `buyers-sellers-range` | Oscillators | own | fract | batch 11 |
| 128 | Buyers vs Sellers | `buyers-vs-sellers` | Momentum | own | davorloncarpetrovic | batch 19 |
| 129 | Buying & Selling Pressure | `buying-selling-pressure` | Volatility | own | fract | batch 3 |
| 130 | Buying and Selling Volume Pressure S/R | `buying-and-selling-volume-pressure-s-r` | Volume | price | DinoTradez | batch 16 |
| 131 | Buying Selling Volume | `buying-selling-volume` | Volume | own | ceyhun (community) |  |
| 132 | Buying vs Selling Moving Averages (Scalp Meter) | `buying-vs-selling-moving-averages` | Volume | own | codycolton97 | batch 24 |
| 133 | BuySell Volume Bar Chart | `buysell-volume-bar-chart` | Volume | own | roshbiz1408 | batch 21 |
| 134 | BuySell%_ImtiazH_v2 | `buysell-imtiazh-v2` | Volume | own | a272a59956 | batch 22 |
| 135 | Candle Breakout Oscillator | `candle-breakout-oscillator` | Oscillators | own | LuxAlgo | batch 2 |
| 136 | Candle Channel | `candle-channel` | Channels & Bands | price | Uncle_the_shooter | batch 23 |
| 137 | Candle Range Theory (CRT) by Lucas | `candle-range-theory-by-lucas` | Trend | price | lucasfff | batch 15 |
| 138 | Candle Range Trading (CRT) | `candle-range-trading` | Trend | price | marcostan93 | batch 1 |
| 139 | Candlestick Reversal | `candlestick-reversal` | Candlestick Patterns | price | LonesomeTheBlue (community) |  |
| 140 | Cardwell RSI by TQ | `cardwell-rsi-by-tq` | Oscillators | own | TradeQUO | batch 24 |
| 141 | Carrier Volatility | `carrier-volatility` | Oscillators | own | et20tradeview | batch 15 |
| 142 | CBC Flip with Volume | `cbc-flip-with-volume` | Trend | price | PtGambler | batch 18 |
| 143 | CCI coded OBV | `cci-obv` | Oscillators | own | LazyBear |  |
| 144 | CCI Length | `cci-stochastic` | Momentum | own |  |  |
| 145 | CCI Pro | `cci-hash-capital` | Oscillators | own | Hash_Capital | batch 24 |
| 146 | CCT Bollinger Band Oscillator | `cct-bbo` | Oscillators | own | LazyBear |  |
| 147 | CDC Action Zone | `cdc-action-zone` | Trend | price |  |  |
| 148 | Center of Gravity Channel | `cog-channel` | Channels & Bands | price |  |  |
| 149 | CHAKRA RISS ENGULFING CANDLESTICK STRATEGY | `chakra-riss-engulfing-candlestick-strategy` | Momentum | price | Tradewith_Riss | batch 18 |
| 150 | Chandelier Exit | `chandelier-exit` | Trend | price |  |  |
| 151 | Chandelier Stop | `chandelier-stop` | Trend | price |  |  |
| 152 | Change-Point Detection (CUSUM) | `change-point-detection` | Trend | price | LuxAlgo | batch 6 |
| 153 | CHN BUY SELL with EMA 200 | `chn-buy-sell-with-ema-200` | Trend | price | CHNTeam | batch 10 |
| 154 | Clustering Volatility (ATR-ADR-ChaikinVol) | `clustering-volatility` | Volatility | own | SDF-Solutions | batch 24 |
| 155 | CM EMA Trend Bars | `cm-ema-trend-bars` | Trend | price | ChrisMoody |  |
| 156 | CM Enhanced Ichimoku Cloud V5 | `cm-enhanced-ichimoku` | Channels & Bands | price | ChrisMoody (community) |  |
| 157 | CM Gann Swing High Low V2 | `cm-gann-swing` | Trend | price | ChrisMoody (community) |  |
| 158 | CM Guppy EMA | `cm-guppy-ema` | Moving Averages | price | ChrisMoody |  |
| 159 | CM Heikin-Ashi | `cm-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 160 | CM Laguerre PPO PercentileRank | `cm-laguerre-ppo` | Oscillators | own | ChrisMoody |  |
| 161 | CM Price Action Bars | `cm-price-action` | Oscillators | price | ChrisMoody |  |
| 162 | CM RSI Plus EMA | `cm-rsi-ema` | Oscillators | own | ChrisMoody |  |
| 163 | CM RSI-2 Strategy Lower | `cm-rsi-2-lower` | Oscillators | own | ChrisMoody |  |
| 164 | CM RSI-2 Strategy Upper | `cm-rsi-2-upper` | Oscillators | price | ChrisMoody |  |
| 165 | CM Sling Shot System | `cm-sling-shot` | Trend | price | ChrisMoody |  |
| 166 | CM Stochastic Highlight Bars | `cm-stoch-highlight` | Oscillators | price | ChrisMoody |  |
| 167 | CM Stochastic POP Method 1 | `stoch-pop-1` | Oscillators | own | ChrisMoody |  |
| 168 | CM Stochastic POP Method 2 | `stoch-pop-2` | Oscillators | own | ChrisMoody |  |
| 169 | CM Time Based Vertical Lines | `cm-time-lines` | Trend | price | ChrisMoody |  |
| 170 | CM Williams Vix Fix V3 | `cm-vix-fix-v3` | Oscillators | own | ChrisMoody |  |
| 171 | CMO For Loop \| QuantLapse | `cmo-for-loop-quantlapse` | Momentum | own | QuantLapse | batch 19 |
| 172 | Colored Volume Bars | `colored-volume` | Volume | own | LazyBear |  |
| 173 | Community MoneyLine | `community-moneyline` | Trend | price | rafstar_kaczmarek | batch 12 |
| 174 | Composite Indicator (CCI + ATR) | `composite-indicator` | Momentum | price | CharLi0t | batch 17 |
| 175 | Consecutive Candles DevisSo | `consecutive-candles-devisso` | Trend | price | engineerofmoney | batch 11 |
| 176 | Consolidation Zones - Live | `consolidation-zones` | Channels & Bands | price | LonesomeTheBlue |  |
| 177 | Conversion Periods | `ichimoku-oscillator` | Momentum | own |  |  |
| 178 | Coral Trend | `coral-trend` | Trend | price | LazyBear |  |
| 179 | Corrected Moving Average | `corrected-moving-average` | Moving Averages | price | everget | batch 3 |
| 180 | Crosby Ratio \| QuantumResearch | `crosby-ratio-quantumresearch` | Momentum | own | QuantumResearch | batch 17 |
| 181 | Crossover EMMM | `crossover-emmm` | Trend | price | NunyadzilaTrading | batch 22 |
| 182 | CRT indicator | `crt-indicator` | Trend | price | INTELA | batch 16 |
| 183 | Curved Trend Channels | `curved-trend-channels` | Channels & Bands | price | Zeiierman | batch 7 |
| 184 | Custom Donchian Channels | `donchian-custom` | Channels & Bands | price |  |  |
| 185 | CVD (Cumulative Volume Delta) | `cvd-rupward` | Volume | own | RUpward | batch 19 |
| 186 | Cycle & Flow Indicator - D_Quant | `cycle-flow-indicator-d-quant` | Trend | price | D_QUANT | batch 22 |
| 187 | Cycle Low (RSI + StochRSI) – v5 John.K | `cycle-low-v5-john-k` | Momentum | price | John_Kal | batch 22 |
| 188 | Dan's Ironclad OB - Simple | `dan-s-ironclad-ob-simple` | Trend | price | hynaxiii | batch 10 |
| 189 | Darvas Box | `darvas-box` | Candlestick Patterns | price |  |  |
| 190 | DECODE Moving Average Toolkit | `decode-moving-average-toolkit` | Moving Averages | price | decodejar | batch 20 |
| 191 | Delta Volume RSI | `delta-volume-rsi` | Volume | own | destrobr0685 | batch 24 |
| 192 | Delta-RSI Oscillator | `delta-rsi-oscillator` | Momentum | own | tbiktag (simplified) |  |
| 193 | DEMA Flow | `dema-flow` | Trend | price | AlphaExtract | batch 7 |
| 194 | Deviation Symmetry Breaker ~ C H I P A | `deviation-symmetry-breaker-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 18 |
| 195 | Directional Indicator Crossovers v1 | `directional-indicator-crossovers-v1` | Trend | own | JopAlgo | batch 7 |
| 196 | Directional Logistic Oscillator | `directional-logistic-oscillator` | Oscillators | own | GainzAlgo | batch 2 |
| 197 | Directional Movement Index + ADX & Key Levels | `dmi-adx-levels` | Trend | own |  |  |
| 198 | Disparity Index | `disparity-index` | Oscillators | own | HPotter | batch 10 |
| 199 | Divergence Indicator | `divergence-indicator` | Momentum | price |  |  |
| 200 | Dominance Signal Apex | `dominance-signal-apex` | Trend | price | chervolino | batch 17 |
| 201 | Donchian Trend Ribbon | `donchian-trend-ribbon` | Trend | own | LonesomeTheBlue |  |
| 202 | Dope DPO | `dope-dpo` | Oscillators | own | Sherlock_MacGyver | batch 14 |
| 203 | Double RSI | `double-rsi` | Momentum | own | Clokivez | batch 9 |
| 204 | Dual Bayesian For Loop | `dual-bayesian-for-loop` | Momentum | own | QuantAlgo | batch 5 |
| 205 | Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation) | `dual-ema-trend-ribbon` | Moving Averages | price | Aleksin_Aleksandar | batch 3 |
| 206 | Dual MA SD Oscillator | `dual-ma-sd-oscillator` | Oscillators | own | SchizoQuant | batch 9 |
| 207 | Dual RSI Smoother | `dual-rsi-smoother` | Oscillators | own | TheUltimator5 | batch 8 |
| 208 | Dynamic Flow Ribbons | `dynamic-flow-ribbons` | Trend | price | BigBeluga | batch 2 |
| 209 | Dynamic Fractal Flow | `dynamic-fractal-flow` | Oscillators | own | AlphaExtract | batch 21 |
| 210 | Dynamic Score PSAR | `dynamic-score-psar` | Trend | own | QuantAlgo | batch 8 |
| 211 | Dynamic Stop Loss & Take Profit | `dynamic-stop-loss-take-profit` | Volatility | price | criptoblast2 | batch 23 |
| 212 | Dynamic Structure Indicator | `dynamic-structure-indicator` | Trend | price |  |  |
| 213 | Dynamic Support & Resistance | `dynamic-support-resistance` | Moving Averages | price | ZenAndTheArtOfTrading | batch 1 |
| 214 | Dynamic Testing | `dynamic-testing` | Oscillators | price | ProfitNomad | batch 9 |
| 215 | Dynamic Trailing | `dynamic-trailing` | Trend | price | Zeiierman | batch 5 |
| 216 | Dynamic Trend Bands | `dynamic-trend-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 217 | Dynamic Volatility Filter | `dynamic-volatility-filter` | Trend | price | QuantAlgo | batch 4 |
| 218 | Dynamic Volume Clusters with Retest Signals | `dynamic-volume-clusters` | Channels & Bands | price | Zeiierman | batch 2 |
| 219 | Dynamic Volume Profile Oscillator | `dynamic-volume-profile-oscillator` | Volume | own | AlphaNatt | batch 1 |
| 220 | Early MACD Reversal Indicator | `early-macd-reversal-indicator` | Momentum | own | StockSignaler | batch 10 |
| 221 | Easy Entry/Exit Trend Colors | `easy-trend-colors` | Trend | own |  |  |
| 222 | Edward Smart Channel Reversal | `edward-smart-channel-reversal` | Channels & Bands | price | Jos-ProTrader | batch 13 |
| 223 | Efficiency Ratio Trend | `efficiency-ratio-trend` | Trend | price | achirameegasthanne | batch 9 |
| 224 | Ehlers Adaptive RSI | `ehlers-adaptive-rsi` | Oscillators | own | Julien_Exe | batch 14 |
| 225 | Ehlers Adaptive Trend Indicator | `ehlers-adaptive-trend-indicator` | Trend | price | AlphaExtract | batch 18 |
| 226 | Ehlers Instantaneous Trend | `ehlers-instantaneous-trend` | Trend | price |  |  |
| 227 | Ehlers MESA Adaptive Moving Average | `ehlers-mesa-ma` | Moving Averages | price | Ehlers |  |
| 228 | Ehlers Stochastic CG Oscillator | `ehlers-stochastic-cg` | Oscillators | own |  |  |
| 229 | Elliott Wave Oscillator | `elliott-wave-oscillator` | Oscillators | own | Koryu |  |
| 230 | EMA & MA Crossover | `ema-ma-crossover` | Moving Averages | price |  |  |
| 231 | EMA + RSI Autotrade Webhook - Varun | `ema-rsi-autotrade-webhook-varun` | Moving Averages | price | varuns_back | batch 17 |
| 232 | EMA + SuperTrend | `ema-supertrend` | Moving Averages | price | All_in_Traders |  |
| 233 | EMA + VWMA + ATR Smoothed BuySell (merged) - TOM ZENG 202509 | `ema-vwma-atr-smoothed-buysell-tom-zeng-202509` | Trend | price | zengtom | batch 18 |
| 234 | EMA 20/50/100/200 | `ema-multi` | Moving Averages | price |  |  |
| 235 | EMA Cloud Trend | `ema-cloud-trend` | Moving Averages | price | ZkalishTR | batch 9 |
| 236 | EMA Enveloper | `ema-enveloper` | Moving Averages | price |  |  |
| 237 | EMA Oscillator | `ema-oscillator` | Oscillators | own | AlphaExtract | batch 16 |
| 238 | EMA Ribbon | `ema-ribbon` | Moving Averages | price |  |  |
| 239 | EMA Wave Indicator | `ema-wave` | Moving Averages | own |  |  |
| 240 | EMA21 Pullback Buy | `ema21-pullback-buy` | Moving Averages | price | Kennedy08 | batch 23 |
| 241 | Enhanced KLSE Banker Flow Oscillator | `enhanced-klse-banker-flow-oscillator` | Oscillators | own | Dr_Leong_Yee_Rock | batch 15 |
| 242 | Entropy Bands | `entropy-bands` | Channels & Bands | price | TechnoBlooms | batch 20 |
| 243 | Entry Points | `entry-points` | Oscillators | price |  |  |
| 244 | Entry Signals (Long/Short) | `entry-signals-long-short` | Trend | price | tradegear9 | batch 1 |
| 245 | Envelope RSI | `envelope-rsi` | Oscillators | price | Saleh_Toodarvari |  |
| 246 | Equalhigh JAPANESE TRIPLE RCI | `equalhigh-japanese-triple-rci` | Oscillators | own | Stevesyl | batch 22 |
| 247 | Euclidean Range | `euclidean-range` | Volatility | own | InvestorUnknown | batch 21 |
| 248 | EVWMA Envelope | `evwma-envelope` | Oscillators | price |  |  |
| 249 | Exhaustion Zone | `exhaustion-zone` | Channels & Bands | price | rukich | batch 6 |
| 250 | Faith Indicator | `faith-indicator` | Trend | own |  |  |
| 251 | False Breakout (Expo) | `false-breakout` | Channels & Bands | price | Zeiierman |  |
| 252 | Fast Length | `bjorgum-triple-ema` | Moving Averages | price |  |  |
| 253 | Fibonacci Bollinger Bands | `fibonacci-bollinger-bands` | Channels & Bands | price | Rashad |  |
| 254 | Fibonacci HH LL TRAMA Band | `fibonacci-hh-ll-trama-band` | Channels & Bands | price | FibonacciFlux | batch 16 |
| 255 | Fibonacci Levels | `fibonacci-levels` | Channels & Bands | price |  |  |
| 256 | Fibonacci Weighted Moving Average | `fibonacci-weighted-moving-average` | Moving Averages | price | everget | batch 12 |
| 257 | Fibonacci Zone | `fibonacci-zone` | Channels & Bands | price |  |  |
| 258 | Filter Ribbon | `filter-ribbon` | Trend | price | c9indicator | batch 4 |
| 259 | Filter Wave | `filter-wave` | Trend | price | c9indicator | batch 15 |
| 260 | Fisher Volume Transform \| AlphaNatt | `fisher-volume-transform-alphanatt` | Oscillators | own | AlphaNatt | batch 16 |
| 261 | Fixed-Range Volume-Profile Zones | `fixed-range-volume-profile-zones` | Volume | own | RWCS_LTD | batch 13 |
| 262 | Flow Control Oscillator (FCO) | `flow-control-oscillator` | Volume | own | WalrusQuant | batch 19 |
| 263 | FlowShift Oscillator | `flowshift-oscillator` | Oscillators | own | BOSWaves | batch 24 |
| 264 | Follow Line | `follow-line` | Trend | price | Dreadblitz |  |
| 265 | Force Pulse | `force-pulse` | Oscillators | own | Uncle_the_shooter | batch 17 |
| 266 | Forecast Oscillator | `forecast-oscillator` | Oscillators | own | KivancOzbilgic |  |
| 267 | Forex Sessions | `forex-sessions` | Oscillators | own |  |  |
| 268 | Fourier series Model Of The Market | `fourier-series-model-of-the-market` | Oscillators | own | e2e4 | batch 12 |
| 269 | Fractal Exhaustion Band | `fractal-exhaustion-band` | Trend | price | QuantAlgo | batch 2 |
| 270 | Fractal Strength Oscillator | `fractal-strength-oscillator` | Oscillators | own | SurgeQuant | batch 20 |
| 271 | Fractals Trend | `fractals-trend` | Trend | price | BigBeluga | batch 2 |
| 272 | Fractional EMA Kalman Filter | `fractional-ema-kalman-filter` | Moving Averages | price | et20tradeview | batch 4 |
| 273 | FSVZO | `fsvzo` | Volume | own | AlphaExtract | batch 5 |
| 274 | FVG Positioning Average | `fvg-positioning-average` | Trend | price | LuxAlgo |  |
| 275 | FX Sniper T3-CCI | `fx-sniper-t3-cci` | Oscillators | own |  |  |
| 276 | FxShare - CC Reversal | `fxshare-cc-reversal` | Trend | price | FxShareRobots | batch 22 |
| 277 | G-Score \| NAL | `g-score-nal` | Oscillators | own | NordicAlphaLab | batch 13 |
| 278 | Gabriel's Andean Oscillator | `gabriel-s-andean-oscillator` | Trend | own | GabrielAmadeusLau | batch 23 |
| 279 | Gamma + Fibonacci EMA Bands | `gamma-fibonacci-ema-bands` | Moving Averages | price | ky_yule1010 | batch 23 |
| 280 | Gamma Hedging Pressure (Normalized -100 to +100) | `gamma-hedging-pressure` | Momentum | own | uzair2join | batch 20 |
| 281 | Gann High Low | `gann-high-low` | Trend | price | KivancOzbilgic |  |
| 282 | GANN Level (Salil Sir) | `gann-level` | Channels & Bands | price | prabhat76 | batch 12 |
| 283 | Gaussian Filter Trend | `gaussian-filter-trend` | Trend | price | QuantAlgo | batch 2 |
| 284 | Gaussian Ribbon | `gaussian-ribbon` | Moving Averages | price | NantzOS | batch 13 |
| 285 | Gaussian RSI \| NAL | `gaussian-rsi-nal` | Momentum | own | NordicAlphaLab | batch 7 |
| 286 | GMMA Oscillator | `gmma-oscillator` | Trend | own |  |  |
| 287 | Golden Ratio Trend Persistence | `golden-ratio-trend-persistence` | Trend | price | YetAnotherTA | batch 9 |
| 288 | Gradient Trend Filter | `gradient-trend-filter` | Trend | price | ChartPrime | batch 1 |
| 289 | Granville Entry Guide | `granville-entry-guide` | Moving Averages | price | fightpm | batch 17 |
| 290 | Gravity Well Trend \| Lyro RS | `gravity-well-trend-lyro-rs` | Trend | price | LyroRS | batch 10 |
| 291 | Gridbot Ping Pong | `gridbot-ping-pong` | Channels & Bands | price | xxattaxx | batch 18 |
| 292 | Guppy MMA | `guppy-mma` | Moving Averages | own | AlphaExtract | batch 15 |
| 293 | Guppy Multiple Moving Average | `gmma` | Moving Averages | price | Daryl Guppy |  |
| 294 | GWAP (Gamma Weighted Average Price) | `gwap` | Moving Averages | price | EdgeTools | batch 18 |
| 295 | H-Infinity Volatility Filter | `h-infinity-volatility-filter` | Trend | price | QuantAlgo | batch 7 |
| 296 | HalfTrend | `half-trend` | Trend | price | everget |  |
| 297 | HaP MACD | `hap-macd` | Momentum | own | agahakanaga | batch 1 |
| 298 | HawkEye Volume | `hawkeye-volume` | Volume | own |  |  |
| 299 | Heatmap Volume | `heatmap-volume` | Volume | own | xdecow |  |
| 300 | Heiken Ashi Ribbon | `heiken-ashi-ribbon` | Trend | price | UkutaLabs | batch 21 |
| 301 | Heikin Ashi RSI Oscillator | `heikin-ashi-rsi-oscillator` | Momentum | own | JayRogers |  |
| 302 | HEMA Trend Levels | `hema-trend-levels` | Trend | price | AlgoAlpha |  |
| 303 | High Volume Arrow Signals (Ajustável) | `high-volume-arrow-signals` | Volume | price | IdeManson | batch 24 |
| 304 | Hilega-Milega-RSI-EMA-WMA indicator designed by NK | `hilega-milega-rsi-ema-wma-indicator-designed-by-nk` | Oscillators | own | kshirsagar_n | batch 14 |
| 305 | Historical Liquidity Proximity Heatmap | `liquidity-proximity-heatmap` | Volume | price | LuxAlgo | batch 3 |
| 306 | HMA Breakdown | `hma-breakdown` | Moving Averages | price | NonLinearRookie | batch 11 |
| 307 | HOTT LOTT | `hott-lott` | Trend | price | KivancOzbilgic |  |
| 308 | HPDR Bands Indicator | `hpdr-bands-indicator` | Channels & Bands | price | afonso_77 | batch 23 |
| 309 | HTC peppermint_07 CCI w signal + s&r RSI | `htc-peppermint-07-cci-w-signal-s-r-rsi` | Oscillators | own | peppermint07 | batch 14 |
| 310 | Hull Butterfly Oscillator | `hull-butterfly-oscillator` | Momentum | own |  |  |
| 311 | Hull Suite | `hull-suite` | Trend | price |  |  |
| 312 | HyperTrend [LuxAlgo] | `hyper-trend` | Trend | price | LuxAlgo |  |
| 313 | Ichimoku EMA Bands | `ichimoku-ema-bands` | Channels & Bands | price |  |  |
| 314 | ICT & RTM Price Action Indicator | `ict-rtm-price-action-indicator` | Channels & Bands | price | behradmojtahedi | batch 21 |
| 315 | ICT FVG Buy/Sell Signals | `ict-fvg-buy-sell-signals` | Trend | price | svmstellarvisionmedia | batch 5 |
| 316 | Ideal Entry Point | `ideal-entry-point` | Trend | price |  |  |
| 317 | IFT Stoch RSI CCI | `ift-stoch-rsi-cci` | Momentum | own | KivancOzbilgic |  |
| 318 | IIR One-Pole Price Filter | `iir-one-pole-price-filter` | Moving Averages | price | BackQuant | batch 9 |
| 319 | Impulse MACD | `impulse-macd` | Momentum | own | LazyBear |  |
| 320 | Indicador Millo SMA20-SMA200-AO-RSI M1 | `indicador-millo-sma20-sma200-ao-rsi-m1` | Moving Averages | price | hernangarcia_78 | batch 19 |
| 321 | Infinite EMA with Alpha Control | `infinite-ema-with-alpha-control` | Moving Averages | price | Sesilya | batch 13 |
| 322 | Inside Bars (Multiple / Consecutive) | `inside-bars` | Channels & Bands | price | nilstrades_ | batch 5 |
| 323 | Instantaneous Trendline with Cloud | `instantaneous-trendline-with-cloud` | Trend | price | Sesilya | batch 22 |
| 324 | Institutional Composite Moving Average (ICMA) | `institutional-composite-moving-average` | Moving Averages | price | VolumeVigilante | batch 6 |
| 325 | Institutional MACD (Z-Score Edition) | `institutional-macd` | Momentum | own | VolumeVigilante | batch 4 |
| 326 | Institutional Volume RSI | `institutional-volume-rsi` | Momentum | own | abgthecoder | batch 6 |
| 327 | Interpolated Median Volatility LSMA \| Otto | `interpolated-median-volatility-lsma-otto` | Channels & Bands | price | oquant | batch 12 |
| 328 | Intraday BUY_SELL | `intraday-buy-sell` | Trend | price |  |  |
| 329 | Intraday TS BB | `intraday-ts-bb` | Oscillators | price |  |  |
| 330 | Intraday Volume Swings | `intraday-volume-swings` | Volume | price | rumpypumpydumpy |  |
| 331 | Intraday vs Overnight Change Tracker | `intraday-vs-overnight-change-tracker` | Momentum | own | TheUltimator5 | batch 12 |
| 332 | Intraday vs Overnight OBV | `intraday-vs-overnight-obv` | Volume | own | TheUltimator5 | batch 21 |
| 333 | Inverse Distance Weighted Moving Average | `inverse-distance-weighted-moving-average` | Moving Averages | price | everget | batch 15 |
| 334 | IPO Date Screener | `ipo-date-screener` | Oscillators | own | starshiptrade | batch 14 |
| 335 | Isolated Peak and Bottom | `isolated-peak-bottom` | Oscillators | price |  |  |
| 336 | IU Mean Reversion System | `iu-mean-reversion-system` | Channels & Bands | price | Shivam_Mandrai | batch 12 |
| 337 | IU Smart Flow System | `iu-smart-flow-system` | Trend | price | Shivam_Mandrai | batch 7 |
| 338 | Jurik Moving Average | `jurik-moving-average` | Moving Averages | price | everget | batch 1 |
| 339 | Kalman Ema Crosses | `kalman-ema-crosses` | Moving Averages | price | JTCapitalNL | batch 16 |
| 340 | Kalman Flow \| Lyro RS | `kalman-flow-lyro-rs` | Trend | price | LyroRS | batch 5 |
| 341 | Kalman Hull Bands For Loop \| RakoQuant | `kalman-hull-bands-for-loop-rakoquant` | Channels & Bands | price | RakoQuant | batch 17 |
| 342 | Kalman Hull Kijun | `kalman-hull-kijun` | Trend | price | BackQuant | batch 12 |
| 343 | Kalman VWAP Filter | `kalman-vwap-filter` | Moving Averages | price | BackQuant | batch 4 |
| 344 | Kaufman Adaptive Moving Average | `kaufman-adaptive-ma` | Moving Averages | price | everget |  |
| 345 | KD-NewAutoTrade for Future Trading - Heikin Ashi candles | `kd-newautotrade-for-future-trading-heikin-ashi-candles` | Trend | price | krish16887 | batch 22 |
| 346 | KDJ | `kdj` | Oscillators | own | KingThies |  |
| 347 | Keltner-Aroon-EFI Flow | `keltner-aroon-efi-flow` | Trend | price | D_QUANT | batch 20 |
| 348 | Kernel Channel | `kernel-channel` | Channels & Bands | price | BackQuant | batch 6 |
| 349 | KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density | `kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density` | Volatility | own | SensitiveSuit | batch 15 |
| 350 | Kinetic Slippage Index (KSI) | `kinetic-slippage-index` | Volume | own | HPotter | batch 7 |
| 351 | L2 Risk Assessment for Trend Strength | `l2-risk-assessment-for-trend-strength` | Trend | own | blackcat1402 | batch 14 |
| 352 | Laguerre Filter | `laguerre-filter` | Moving Averages | price | BackQuant | batch 5 |
| 353 | Laguerre RSI | `laguerre-rsi` | Momentum | own | TheLark |  |
| 354 | Laguerre Ultimate Explorations Multicator | `laguerre-ultimate-explorations-multicator` | Moving Averages | own | ImmortalFreedom | batch 20 |
| 355 | Laguerre-Kalman Adaptive Filter \| AlphaNatt | `laguerre-kalman-adaptive-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 11 |
| 356 | Left Bars | `pivot-hh-hl-lh-ll` | Trend | price |  |  |
| 357 | Leledc Levels | `leledc-levels` | Candlestick Patterns | price |  |  |
| 358 | Length | `gaussian-channel` | Channels & Bands | price |  |  |
| 359 | Length | `redk-vader` | Oscillators | own | RedKTrader |  |
| 360 | Length | `zlma-trend-levels` | Moving Averages | price |  |  |
| 361 | Level2 Signalfilter Liquidity Protection | `level2-signalfilter-liquidity-protection` | Trend | own | djmad | batch 16 |
| 362 | Linear Predictive Filters (TASC 2025.01) | `linear-predictive-filters` | Oscillators | own | PineCodersTASC | batch 2 |
| 363 | Linear Regression Candles | `linear-regression-candles` | Candlestick Patterns | price |  |  |
| 364 | Linear Regression Channel | `linear-regression-channel` | Channels & Bands | price |  |  |
| 365 | Linear Regression Volume \| Lyro RS | `linear-regression-volume-lyro-rs` | Channels & Bands | price | LyroRS | batch 10 |
| 366 | Linear Volume MACD \| Lyro RS | `linear-volume-macd-lyro-rs` | Momentum | own | LyroRS | batch 9 |
| 367 | LineReg Candles with Hma filter | `linereg-candles-with-hma-filter` | Trend | price | MaximusGains | batch 14 |
| 368 | Liquidity Flow Zones (LFZ) | `liquidity-flow-zones` | Trend | price | ReubenMiles | batch 20 |
| 369 | Liquidity Grabs | `liquidity-grabs` | Trend | price | fluxchart |  |
| 370 | Liquidity Indicator | `liquidity-indicator` | Channels & Bands | price | The_Forex_Steward | batch 22 |
| 371 | Liquidity Levels [LuxAlgo] | `liquidity-levels` | Trend | price | LuxAlgo |  |
| 372 | Liquidity Sentiment Profile \| LUPEN | `liquidity-sentiment-profile-lupen` | Volume | own | Horazio | batch 20 |
| 373 | Liquidity Sweeps [LuxAlgo] | `liquidity-sweeps` | Trend | price |  |  |
| 374 | Loacally Weighted MA (LWMA) Direction Histogram | `loacally-weighted-ma-direction-histogram` | Trend | own | LuxmiAI | batch 9 |
| 375 | Logit RSI | `logit-rsi` | Oscillators | own | AdaptiveRSI | batch 11 |
| 376 | Long Short dom | `long-short-dom` | Trend | own | Robin-Hood-trading | batch 11 |
| 377 | Lorentzian Length Adaptive Moving Average | `lorentzian-length-adaptive-moving-average` | Moving Averages | price | Starcruiser | batch 21 |
| 378 | Lumina Trend Channels | `lumina-trend-channels` | Channels & Bands | price | Pineify | batch 10 |
| 379 | Luminous Mean Reversion Channels | `luminous-mean-reversion-channels` | Channels & Bands | price | Pineify | batch 7 |
| 380 | Lunar Phase (LUNAR) | `lunar-phase` | Oscillators | own | mihakralj | batch 23 |
| 381 | MA Shaded Fill Crossover | `ma-shaded-fill` | Moving Averages | price |  |  |
| 382 | MA Strategy Emperor | `ma-strategy-emperor` | Trend | price | insiliconot |  |
| 383 | MA Type | `madrid-ma-ribbon` | Moving Averages | price |  |  |
| 384 | MA Zones | `ma-zones` | Moving Averages | price | ZenAndTheArtOfTrading | batch 7 |
| 385 | MACD (Buy & Sell signals) | `macd-irtov` | Momentum | own | irtov | batch 24 |
| 386 | MACD 4C | `macd-4c` | Momentum | own | vkno422 |  |
| 387 | MACD Crossover | `macd-crossover` | Momentum | own |  |  |
| 388 | MACD DEMA | `macd-dema` | Momentum | own |  |  |
| 389 | MACD Divergence | `macd-divergence` | Momentum | own |  |  |
| 390 | MACD Dynamic Squeeze Pro | `macd-dynamic-squeeze-pro` | Momentum | own | ZynAlgo | batch 24 |
| 391 | MACD Leader | `macd-leader` | Momentum | own | LazyBear |  |
| 392 | MACD Overlay v1 | `macd-overlay-v1` | Momentum | price | JopAlgo | batch 5 |
| 393 | MACD Pro | `macd-pro` | Momentum | own | VEGAlgo | batch 23 |
| 394 | MACD ReLoaded | `macd-reloaded` | Momentum | own | KivancOzbilgic |  |
| 395 | MACD Sniper | `macd-sniper` | Momentum | own | trade_lexx | batch 15 |
| 396 | MACD Support and Resistance [ChartPrime] | `macd-support-resistance` | Momentum | own | ChartPrime |  |
| 397 | MACD VXI | `macd-vxi` | Momentum | own |  |  |
| 398 | MACD With Crossings and Above Below Zero | `macd-with-crossings-and-above-below-zero` | Momentum | own | Kgroomes | batch 18 |
| 399 | MACD x BB x STDEV x RVI | `macd-x-bb-x-stdev-x-rvi` | Oscillators | own | Vaquant | batch 20 |
| 400 | MACD XD | `macd-xd` | Momentum | own | Zen_Formless | batch 8 |
| 401 | MACD-V (Volatility Normalized MACD) | `macd-v` | Momentum | own | KivancOzbilgic | batch 2 |
| 402 | MACD1 Fast | `double-macd` | Momentum | own |  |  |
| 403 | MACDAS | `macdas` | Momentum | own |  |  |
| 404 | Machine Learning: kNN Trend Predictor | `machine-learning-knn-trend-predictor` | Trend | price | tkarolak | batch 11 |
| 405 | Madrid Trend Squeeze | `madrid-trend-squeeze` | Momentum | own |  |  |
| 406 | Mark Minervini Buy Signal | `mark-minervini-buy-signal` | Trend | price | Dr_Leong_Yee_Rock | batch 18 |
| 407 | Market Cipher A | `market-cipher-a` | Oscillators | price |  |  |
| 408 | Market Cipher B | `market-cipher-b` | Oscillators | own |  |  |
| 409 | Market Pressure Oscillator | `market-pressure-oscillator` | Oscillators | own | Uncle_the_shooter | batch 8 |
| 410 | Market Shift Levels | `market-shift-levels` | Trend | price |  |  |
| 411 | Market Structure Trailing Stop | `market-structure-trailing-stop` | Trend | price | LuxAlgo |  |
| 412 | Market Structure Trend | `market-structure-trend` | Trend | price | QuantAlgo | batch 12 |
| 413 | Matrix Series | `matrix-series` | Oscillators | own |  |  |
| 414 | MavilimW | `mavilimw` | Trend | price | KivancOzbilgic |  |
| 415 | Mean Angles | `mean-angles` | Momentum | own | bharatTrader | batch 9 |
| 416 | Median Gaussian Trend \| NAL | `median-gaussian-trend-nal` | Trend | price | NordicAlphaLab | batch 15 |
| 417 | Median MACD - Mattes | `median-macd-mattes` | Momentum | own | Mattes00 | batch 8 |
| 418 | MESA Adaptive Ehlers Flow \| AlphaNatt | `mesa-adaptive-ehlers-flow` | Moving Averages | price | AlphaNatt | batch 8 |
| 419 | MESA Phase-Adaptive Band Trend | `mesa-phase-adaptive-band-trend` | Trend | price | SchizoQuant | batch 22 |
| 420 | MFI Nexus Pro | `mfi-nexus-pro` | Volume | own | trade_lexx | batch 10 |
| 421 | MFI/RSI Bollinger Bands | `mfi-rsi-bb` | Oscillators | own |  |  |
| 422 | ML Adaptive SuperTrend | `ml-adaptive-supertrend` | Trend | price |  |  |
| 423 | ML Momentum Index | `ml-momentum-index` | Momentum | own |  |  |
| 424 | ML Moving Average | `ml-moving-average` | Moving Averages | price |  |  |
| 425 | ML RSI | `ml-rsi` | Momentum | own |  |  |
| 426 | ML: kNN Strategy | `ml-knn-strategy` | Momentum | own |  |  |
| 427 | Modified Heikin-Ashi | `modified-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 428 | Momentum-based ZigZag | `momentum-zigzag` | Trend | price | Peter_O |  |
| 429 | Money Flow Extended | `money-flow-extended` | Volume | own | alexrainman | batch 6 |
| 430 | Moneyball EMA-MACD indicator | `moneyball-ema-macd-indicator` | Momentum | own | VinnieTheFish | batch 6 |
| 431 | Monotonic Trend Consensus | `monotonic-trend-consensus` | Trend | own | QuantAlgo | batch 16 |
| 432 | Moving Average ADX | `ma-adx` | Moving Averages | price |  |  |
| 433 | Moving Average Colored | `ma-colored` | Moving Averages | price |  |  |
| 434 | Moving Average Converging | `ma-converging` | Moving Averages | price | LuxAlgo |  |
| 435 | Moving Average Crossover with Shading Signals | `moving-average-crossover-with-shading-signals` | Moving Averages | price | Decam9 | batch 12 |
| 436 | Moving Average Deviation Rate | `ma-deviation-rate` | Moving Averages | own |  |  |
| 437 | Moving Average Shift | `ma-shift` | Moving Averages | price |  |  |
| 438 | Moving Averages With Continuous Periods | `moving-averages-with-continuous-periods` | Moving Averages | price | The_Peaceful_Lizard | batch 15 |
| 439 | Moving VWAP-KAMA Cloud | `moving-vwap-kama-cloud` | Moving Averages | price | SovereignCharts | batch 12 |
| 440 | MPO4 Lines – Modal Engine | `mpo4-lines-modal-engine` | Oscillators | own | Uncle_the_shooter | batch 15 |
| 441 | mr.crypto731 | `mr-crypto731` | Momentum | own | Ali_Smith | batch 20 |
| 442 | MSL Squeeze Pulse | `msl-squeeze-pulse` | Volatility | own | MarketStructureLab | batch 16 |
| 443 | Multi-Band Trend Line | `multi-band-trend-line` | Trend | price | Mr_Rakun | batch 4 |
| 444 | Multi-Oscillator Adaptive Kernel \| AlphaAlgos | `multi-oscillator-adaptive-kernel-alphaalgos` | Oscillators | own | AlphaNatt | batch 4 |
| 445 | Multiple Divergences | `multiple-divergences` | Momentum | price | PeterO |  |
| 446 | Multiple Exponential Fibnonacci Moving Averages | `multiple-exponential-fibnonacci-moving-averages` | Moving Averages | price | LensOfChartist | batch 13 |
| 447 | Multiple Moving Averages | `multiple-ma` | Moving Averages | price |  |  |
| 448 | Multiple RSI | `multiple-rsi` | Oscillators | own | PrasadJoshi12 | batch 19 |
| 449 | MurreysOscillator | `murreys-math-osc` | Oscillators | own |  |  |
| 450 | My auto dual avwap with Auto swing low/pivot low finder | `my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder` | Volume | price | doqkhanh | batch 22 |
| 451 | Nadaraya-Watson Trend | `nadaraya-watson-trend` | Trend | price | QuantAlgo | batch 1 |
| 452 | Neighboring Price Bands | `neighboring-price-bands` | Channels & Bands | price | LuxAlgo | batch 21 |
| 453 | NLMS Volatility Trail | `nlms-volatility-trail` | Trend | price | BackQuant | batch 4 |
| 454 | Normalized QQE | `normalized-qqe` | Oscillators | own |  |  |
| 455 | OA - SMES | `oa-smes` | Oscillators | own | onurag | batch 4 |
| 456 | OBV + Custom MA Strategy | `obv-custom-ma-strategy` | Volume | own | Rafiki-is-Trading | batch 14 |
| 457 | OBV MACD | `obv-macd` | Volume | own |  |  |
| 458 | OBV Oscillator | `obv-oscillator` | Volume | own |  |  |
| 459 | Open Close Cross | `open-close-cross` | Momentum | own | JustUncleL |  |
| 460 | Optimized Trend Tracker | `optimized-trend-tracker` | Trend | price | KivancOzbilgic |  |
| 461 | Order Blocks with Signals | `order-blocks-signals` | Trend | price | ClayeWeight |  |
| 462 | Oscillator Matrix | `oscillator-matrix` | Oscillators | own | AlphaExtract | batch 6 |
| 463 | Parabolic Stoch SAR Visualizer | `parabolic-stoch-sar-visualizer` | Oscillators | own | BOSWaves | batch 24 |
| 464 | Parallel Pivot Lines | `parallel-pivot-lines` | Channels & Bands | price | LuxAlgo |  |
| 465 | Peak Reversal v2 | `peak-reversal-v2` | Channels & Bands | price | Zettt | batch 11 |
| 466 | Peak Reversal v3 | `peak-reversal-v3` | Channels & Bands | price | Zettt | batch 21 |
| 467 | Percent Off All-time High (% Off High) | `percent-off-all-time-high` | Oscillators | own | xHmmmmm | batch 19 |
| 468 | Percentile-Based BB% Trend - Mattes | `percentile-based-bb-trend-mattes` | Oscillators | own | Mattes00 | batch 7 |
| 469 | Philakone 55 EMA Swing Trading | `philakone-ema-swing` | Moving Averages | price |  |  |
| 470 | Pipstocrat Market Participant Analysis | `pipstocrat-market-participant-analysis` | Momentum | own | Delast2 | batch 23 |
| 471 | Pivot Based Trailing Maxima & Minima | `pivot-trailing-maxmin` | Channels & Bands | price | LuxAlgo |  |
| 472 | Pivot Breakout High&Low Signals | `pivot-breakout-high-low-signals` | Trend | price | Jos-ProTrader | batch 3 |
| 473 | Pivot Market Structure | `pivot-market-structure` | Trend | price | Daniel_Ge | batch 11 |
| 474 | Pivot Oscillator | `pivot-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 475 | Pivot Point SuperTrend | `pivot-point-supertrend` | Trend | price | LonesomeTheBlue |  |
| 476 | Pivot Trend | `pivot-trend` | Trend | price | ChartPrime | batch 1 |
| 477 | PolyFilter | `polyfilter` | Moving Averages | price | BackQuant | batch 8 |
| 478 | Polynomial Regression Moving Average (PRMA) | `polynomial-regression-moving-average` | Moving Averages | price | ZakAlgoTrade | batch 24 |
| 479 | Polyphase MACD (PMACD) | `polyphase-macd` | Momentum | own | The_Peaceful_Lizard | batch 19 |
| 480 | PPO Alerts | `ppo-alerts` | Momentum | own |  |  |
| 481 | PPO Divergence | `ppo-divergence` | Momentum | own | Pekipek |  |
| 482 | Predictive Channels | `predictive-channels` | Channels & Bands | price | LuxAlgo |  |
| 483 | Premier RSI Oscillator | `premier-rsi` | Momentum | own |  |  |
| 484 | Premier Stochastic Oscillator | `premier-stochastic` | Oscillators | own |  |  |
| 485 | Price & Volume Profile (Expo) | `price-volume-profile` | Volume | price | Zeiierman (community) |  |
| 486 | Price Action Bands \| Trend & Volatility | `price-action-bands-trend-volatility` | Channels & Bands | price | RadixAlgo | batch 15 |
| 487 | Price Action Breakout Trend | `price-action-breakout-trend` | Trend | price | QuantAlgo | batch 5 |
| 488 | Price Action Signals Filtered +EMA | `price-action-signals-filtered-ema` | Trend | price | Aleksin_Aleksandar | batch 11 |
| 489 | Price Action Trading System | `price-action-system` | Oscillators | price |  |  |
| 490 | Price Advance & Decline Range Analysis | `price-advance-decline-range-analysis` | Volatility | own | RicardoSantos | batch 16 |
| 491 | Price Change Sentiment Index | `price-change-sentiment-index` | Oscillators | own | TradeVizion | batch 23 |
| 492 | Price Divergence Detector | `price-divergence-detector` | Momentum | price | JustUncleL |  |
| 493 | Price Linear Sequence Counter | `price-linear-sequence-counter` | Momentum | own | RicardoSantos | batch 14 |
| 494 | Price Momentum Oscillator | `price-momentum-oscillator` | Momentum | own |  |  |
| 495 | Price/Volume Value Histogram | `price-volume-value-histogram` | Volume | own | dman103 | batch 2 |
| 496 | Prism Moving Average Trend | `prism-moving-average-trend` | Trend | price | MisinkoMaster | batch 19 |
| 497 | Projected Crossover Trend | `projected-crossover-trend` | Trend | price | SchizoQuant | batch 4 |
| 498 | Prometheus Topological Persistent Entropy | `prometheus-topological-persistent-entropy` | Volatility | own | ScorsoneEnterprises | batch 23 |
| 499 | Pullback Scalp Trade V2 | `pullback-scalp-trade-v2` | Trend | price | Sinyalbak_App | batch 12 |
| 500 | Pulse Range | `pulse-range` | Trend | price | MarketStructureLab | batch 13 |
| 501 | Pulse RSI \| Lyro RS | `pulse-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 10 |
| 502 | PulseWave + Divergence | `pulsewave-divergence` | Oscillators | own | Uncle_the_shooter | batch 7 |
| 503 | Pure Coca | `pure-coca` | Oscillators | own | La_Von | batch 7 |
| 504 | Q Impulse Entry | `q-impulse-entry` | Trend | price | Quantora | batch 17 |
| 505 | Q KAMA Clarity Trend | `q-kama-clarity-trend` | Trend | price | Quantora | batch 7 |
| 506 | QQE Cross | `qqe-cross` | Trend | price | JustUncleL |  |
| 507 | QQE MOD | `qqe-mod` | Momentum | own |  |  |
| 508 | QQE Signals | `qqe-signals` | Oscillators | price | colinmck |  |
| 509 | Quant VWAP System 3.8 | `quant-vwap-system-3-8` | Oscillators | own | CustomQuantLabs (published as "Quant VWAP System 3.8") | batch 8 |
| 510 | Quantile Regression Bands | `quantile-regression-bands` | Channels & Bands | price | BackQuant | batch 17 |
| 511 | Quantitative Qualitative Estimation | `qqe` | Oscillators | own | Glaz |  |
| 512 | Quantum Trend Signal | `quantum-trend-signal` | Trend | price | ReubenMiles | batch 9 |
| 513 | QuantumTrend SwiftEdge | `quantumtrend-swiftedge` | Trend | price | SwiftEdge | batch 5 |
| 514 | Quartile For Loop | `quartile-for-loop` | Trend | own | SeerQuant | batch 6 |
| 515 | Radius Trend [ChartPrime] | `radius-trend` | Trend | price | ChartPrime |  |
| 516 | Range Channel by Atilla Yurtseven | `range-channel-by-atilla-yurtseven` | Channels & Bands | own | AtillaYurtseven | batch 17 |
| 517 | Range Detector | `range-detector` | Trend | price | LuxAlgo |  |
| 518 | Range Identifier | `range-identifier` | Channels & Bands | price |  |  |
| 519 | Range Oscillator | `range-oscillator` | Oscillators | own | Zeiierman | batch 1 |
| 520 | Range Tightening Indicator (RTI) | `range-tightening-indicator` | Volatility | own | Ollie_AllCaps | batch 2 |
| 521 | RCI 3 Lines | `rci-3lines` | Oscillators | own |  |  |
| 522 | ReadyFor401ks Just Tell Me When! | `readyfor401ks-just-tell-me-when` | Trend | price | ReadyFor401k | batch 20 |
| 523 | Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure | `big-trades-bubbles` | Volume | price | samet_lezki | batch 5 |
| 524 | Realtime Volume Bars | `realtime-volume-bars` | Volume | own | the_MarketWhisperer |  |
| 525 | RedK EVEREX | `redk-everex` | Momentum | own | RedKTrader |  |
| 526 | RedK Magic Ribbon | `redk-magic-ribbon` | Moving Averages | price | RedKTrader | batch 2 |
| 527 | RedK Momentum Bars | `redk-momentum-bars` | Momentum | own | RedKTrader |  |
| 528 | RedK RSS_WMA | `redk-rss-wma` | Moving Averages | price | RedKTrader |  |
| 529 | RedK Trader Pressure Index | `redk-tpx` | Momentum | own | RedKTrader |  |
| 530 | RedK Vol_Weighted RSI: Extending the power of the classic RSI | `redk-vol-weighted-rsi` | Momentum | own | RedKTrader | batch 5 |
| 531 | Reflex & Trendflex | `reflex-trendflex` | Oscillators | own | e2e4 | batch 6 |
| 532 | Relative ATR Volatility Indicator | `relative-atr-volatility-indicator` | Volatility | own | ZenAndTheArtOfTrading | batch 20 |
| 533 | Relative Strength Heatmap | `relative-strength-heatmap` | Momentum | own | BackQuant | batch 22 |
| 534 | Relative Valuation Oscillator | `relative-valuation-oscillator` | Oscillators | own | QuantAlgo | batch 14 |
| 535 | Relative Volume Indicator (RVOL) | `relative-volume-indicator` | Volume | own | AlgoCollective | batch 13 |
| 536 | Renko Boxes | `renko-boxes` | Trend | price | LuxAlgo | batch 4 |
| 537 | Renko Chart | `renko-chart` | Trend | price | LonesomeTheBlue |  |
| 538 | Renko Mod | `renko-mod` | Trend | price | RicardoSantos | batch 13 |
| 539 | Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI) | `renko-sniper-pro` | Trend | price | zachsprad | batch 24 |
| 540 | Retail vs Banker Net Positions – Symmetry Break | `retail-vs-banker-net-positions-symmetry-break` | Volume | own | JasonHyde | batch 17 |
| 541 | Reversal Candle Setup | `reversal-candle-setup` | Candlestick Patterns | price |  |  |
| 542 | Rhokeo-VW-RSI Histogram for Cumulative Delta by Zeiirman | `rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman` | Oscillators | own | nabil007 | batch 24 |
| 543 | Ripster EMA Clouds | `ripster-ema-clouds` | Trend | price | ripster47 |  |
| 544 | RMA ATR Bands | `rma-atr-bands` | Channels & Bands | price | SchizoQuant | batch 3 |
| 545 | RMI Length | `rmi-trend-sniper` | Momentum | price | TZack88 |  |
| 546 | Robby DSS Bressert Colored Dots | `robby-dss-bressert-colored-dots` | Oscillators | own | huatzhi | batch 21 |
| 547 | ROC-Weighted MA Oscillator | `roc-weighted-ma-oscillator` | Oscillators | own | SeerQuant | batch 2 |
| 548 | Rolling Liquidity Clusters Channel | `rolling-liquidity-clusters-channel` | Channels & Bands | price | LuxAlgo | batch 12 |
| 549 | Rolling Sharpe Ratio Oscillator \| Astral Vision | `rolling-sharpe-ratio-oscillator-astral-vision` | Oscillators | own | AstralVision | batch 13 |
| 550 | Rolling Trendline | `rolling-trendline` | Trend | price | LuxAlgo | batch 5 |
| 551 | RRR EMA Ignition BUY & SELL (Sideways-Proof) | `rrr-ema-ignition-buy-sell` | Trend | price | RAGSTER123 | batch 21 |
| 552 | RS Rating (1-99) | `rs-rating` | Momentum | own | kulturdesken | batch 16 |
| 553 | rs_MACD | `rs-macd` | Momentum | price | RicardoSantos | batch 17 |
| 554 | RSI + BB + Dispersion | `rsi-bb-dispersion` | Oscillators | own |  |  |
| 555 | RSI + Fibonacci HH LL Support Resistance | `rsi-fibonacci-hh-ll-support-resistance` | Channels & Bands | price | FibonacciFlux | batch 12 |
| 556 | RSI + MACD (RSI Divergence) V3.2 | `rsi-macd-v3-2` | Oscillators | own | MKhoa | batch 24 |
| 557 | RSI + STOCH RSI - Marx_Capital | `rsi-stoch-rsi-marx-capital` | Oscillators | own | Marx_Capital | batch 12 |
| 558 | RSI Bands | `rsi-bands` | Channels & Bands | price |  |  |
| 559 | RSI Bars - OnlyFlow | `rsi-bars-onlyflow` | Momentum | price | ofderk | batch 10 |
| 560 | RSI BB StdDev Signal | `rsi-bb-stddev-signal` | Oscillators | own | trade_lexx (Pine title "RSI Signal [trade_lexx]") | batch 8 |
| 561 | RSI Candles | `rsi-candles` | Momentum | own | Glaz |  |
| 562 | RSI Confirm Trend with Williams (W%R) | `rsi-confirm-trend-with-williams` | Momentum | own | javageek | batch 11 |
| 563 | RSI Divergence | `rsi-divergence` | Oscillators | own |  |  |
| 564 | RSI Games 1.2 | `rsi-games-1-2` | Oscillators | own | petejfjohnson | batch 22 |
| 565 | RSI HistoAlert | `rsi-histoalert` | Oscillators | own |  |  |
| 566 | RSI Length | `most-rsi` | Momentum | own |  |  |
| 567 | RSI Length | `parabolic-rsi` | Momentum | own |  |  |
| 568 | RSI Length | `pmax-rsi-t3` | Momentum | own |  |  |
| 569 | RSI Length | `rsi-cyclic-smoothed` | Momentum | own |  |  |
| 570 | RSI Modified | `rsi-modified` | Oscillators | own | Santos_Trader_PT | batch 5 |
| 571 | RSI Momentum Divergence | `rsi-momentum-divergence` | Oscillators | own | ChartPrime |  |
| 572 | RSI Multi Levels kiawosch 7-14-42 Consolidation | `rsi-multi-levels` | Oscillators | own | TFlab | batch 5 |
| 573 | RSI Multicolor editable | `rsi-multicolor-editable` | Oscillators | own | Guillaume46 | batch 8 |
| 574 | RSI Snabbel | `rsi-snabbel` | Oscillators | own |  |  |
| 575 | RSI Supply/Demand | `rsi-supply-demand` | Trend | price | shtcoinr / Lij_MC |  |
| 576 | RSI Swing Signal | `rsi-swing-signal` | Oscillators | own |  |  |
| 577 | RSI Tops and Bottoms | `rsi-tops-bottoms` | Momentum | own | LonesomeTheBlue |  |
| 578 | RSI Trend Bias | `rsi-trend-bias` | Oscillators | own | Botnet101 | batch 24 |
| 579 | RSI Trend Navigator | `rsi-trend-navigator` | Trend | price | QuantAlgo | batch 10 |
| 580 | RSI Zone Step Lines | `rsi-zone-step-lines` | Channels & Bands | price | Devjames | batch 11 |
| 581 | RSI+EMA+MZONES with Divergences | `rsi-ema-mzones-with-divergences` | Oscillators | own | lordoflolz | batch 22 |
| 582 | RSI-50 Step Line | `rsi-50-step-line` | Trend | price | Devjames | batch 5 |
| 583 | SAR + EMA + MACD Signals | `sar-ema-macd` | Oscillators | price |  |  |
| 584 | Savitzky Flow Bands | `savitzky-flow-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 585 | Savitzky-Golay Hampel Filter \| AlphaNatt | `savitzky-golay-hampel-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 15 |
| 586 | Scalping Line | `scalping-line` | Oscillators | own | KivancOzbilgic |  |
| 587 | Scalping Tool with Dynamic Take Profit & Stop Loss | `scalping-tool-dynamic-tp-sl` | Trend | price | TruFREND | batch 3 |
| 588 | ScalpMap - EMA Pivot Targets | `scalpmap-ema-pivot-targets` | Trend | price | blockybears | batch 12 |
| 589 | SCE GANN Predictions | `sce-gann-predictions` | Trend | price | ScorsoneEnterprises | batch 22 |
| 590 | Schaff Trend Cycle | `schaff-trend-cycle` | Oscillators | own | LazyBear |  |
| 591 | Sell & Buy Rates | `sell-buy-rates` | Volume | own | LonesomeTheBlue |  |
| 592 | Sequential Pattern Strength | `sequential-pattern-strength` | Momentum | own | QuantAlgo | batch 9 |
| 593 | Setup 9.1 (Larry Williams) + EMA 50 | `setup-9-1-ema-50` | Moving Averages | price | oDouglasAlex | batch 7 |
| 594 | SExI - Super Exhaustion Indicator | `sexi-super-exhaustion-indicator` | Oscillators | own | Da_Prof | batch 14 |
| 595 | Sharp Modified Moving Average | `sharp-modified-moving-average` | Moving Averages | price | everget | batch 18 |
| 596 | Sharpe Ratio Indicator (180) | `sharpe-ratio-indicator` | Volatility | own | tim_amblard | batch 3 |
| 597 | Shock Percentile Moving Average \| NAL | `shock-percentile-moving-average-nal` | Moving Averages | price | NordicAlphaLab | batch 22 |
| 598 | Sigmoid RSI \| NAL | `sigmoid-rsi-nal` | Oscillators | own | NordicAlphaLab | batch 11 |
| 599 | Signal Moving Average | `signal-ma` | Moving Averages | price | LuxAlgo |  |
| 600 | Simple Moving Averages | `simple-moving-averages` | Moving Averages | price |  |  |
| 601 | Simplified Percentile Clustering | `simplified-percentile-clustering` | Oscillators | own | InvestorUnknown | batch 4 |
| 602 | Sine Weighted Moving Average | `sine-weighted-moving-average` | Moving Averages | price | everget | batch 13 |
| 603 | Slow Heiken Ashi | `slow-heiken-ashi` | Candlestick Patterns | price |  |  |
| 604 | SMA Angle Alerts | `sma-angle-alerts` | Moving Averages | price | readysetfire | batch 21 |
| 605 | SMA Squeeze Oscillator | `sma-squeeze-oscillator` | Momentum | own | Uncle_the_shooter | batch 23 |
| 606 | Smart Money Flow Signals | `smart-money-flow-signals` | Volume | own | QuantAlgo | batch 2 |
| 607 | Smart Trend | `smart-trend` | Trend | price | Zofesu | batch 21 |
| 608 | Smooth RSI | `smooth-rsi` | Momentum | own | MarktQuant | batch 8 |
| 609 | Smoothed Heiken Ashi | `smoothed-heiken-ashi` | Trend | price | jackvmk |  |
| 610 | Smoothed Low-Pass Butterworth Filtered Median | `butterworth-filtered-median` | Moving Averages | price | AlphaNatt | batch 8 |
| 611 | Smoothed Source Weighted EMA | `smoothed-source-weighted-ema` | Moving Averages | price | Clokivez | batch 13 |
| 612 | Source | `ott-bands` | Channels & Bands | price | KivancOzbilgic |  |
| 613 | Source | `otto` | Oscillators | own | KivancOzbilgic |  |
| 614 | Source | `range-filter-dw` | Trend | price |  |  |
| 615 | Source-Aligned Oscillators (for Divergences) | `source-aligned-oscillators` | Oscillators | own | QuantNomad | batch 18 |
| 616 | SP - MACD with Divergence | `sp-macd-with-divergence` | Momentum | own | ca_sidnayak | batch 24 |
| 617 | Squeeze Channel | `squeeze-channel` | Channels & Bands | price | B3AR_Trades | batch 16 |
| 618 | Squeeze Momentum | `squeeze-momentum` | Momentum | own | LazyBear |  |
| 619 | Squeeze Momentum V2 | `squeeze-momentum-v2` | Oscillators | own |  |  |
| 620 | SSL Channel | `ssl-channel` | Trend | price |  |  |
| 621 | SSL Hybrid Scalper | `ssl-hybrid-scalper` | Moving Averages | price | nabeel8369 | batch 11 |
| 622 | ST0P | `st0p` | Oscillators | price |  |  |
| 623 | Standardized MACD HA | `standardized-macd-ha` | Momentum | own | EliCobra |  |
| 624 | Start | `lucid-sar` | Trend | price |  |  |
| 625 | Statistical Price Deviation Index (MAD/VWMA) | `statistical-price-deviation-index` | Oscillators | own | exploretranspose | batch 16 |
| 626 | STH Unrealized Profit/Loss Ratio (STH-NUPL) | `sth-unrealized-profit-loss-ratio` | Oscillators | own | DeVrizii | batch 15 |
| 627 | Stoch VX3 | `stoch-vx3` | Oscillators | own |  |  |
| 628 | Stochastic Heat Map | `stochastic-heat-map` | Momentum | own | Violent |  |
| 629 | Stochastic Momentum Index | `stochastic-momentum-index` | Oscillators | own |  |  |
| 630 | Stochastic Momentum Index UCS | `smi-ucs` | Oscillators | own |  |  |
| 631 | Stochastic OTT | `stochastic-ott` | Oscillators | own | KivancOzbilgic |  |
| 632 | Super Guppy | `super-guppy` | Trend | price | JustUncleL |  |
| 633 | Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET) | `super-sma-5-8-13-ema-20-200-regime-filter` | Moving Averages | price | afdzjr69 | batch 19 |
| 634 | Super Smoothed MACD | `super-smoothed-macd` | Momentum | own |  |  |
| 635 | Super SuperTrend | `super-supertrend` | Trend | price |  |  |
| 636 | SuperBands | `superbands` | Trend | price | The_Peaceful_Lizard | batch 7 |
| 637 | SuperSmoother MA Oscillator | `supersmoother-ma-oscillator` | Oscillators | own | BOSWaves | batch 1 |
| 638 | SuperTrend AI Clustering | `supertrend-ai-clustering` | Trend | price |  |  |
| 639 | SuperTrend Channels | `supertrend-channels` | Channels & Bands | price |  |  |
| 640 | Support and Resistance Levels with Breaks | `sr-levels-breaks` | Channels & Bands | price |  |  |
| 641 | Support Resistance Channels | `support-resistance-channels` | Trend | price | LonesomeTheBlue |  |
| 642 | Suppot and resistance & BUY SELL SIGNALS | `suppot-and-resistance-buy-sell-signals` | Channels & Bands | price | doganayy2 | batch 20 |
| 643 | Sweep2Trade Pro | `sweep2trade-pro` | Trend | price | chervolino | batch 8 |
| 644 | Swing Highs/Lows & Candle Patterns | `swing-highs-lows-patterns` | Candlestick Patterns | price | LuxAlgo (Pine v5) |  |
| 645 | Swing Points | `swing-points` | Trend | price | CrossTradeTeam | batch 14 |
| 646 | Swing Trade Signals | `swing-trade-signals` | Oscillators | price | nicks1008 |  |
| 647 | T3 Length | `t3-psar` | Moving Averages | price |  |  |
| 648 | TASC 2025.02 Autocorrelation Indicator | `tasc-2025-02-autocorrelation` | Oscillators | own | PineCodersTASC | batch 6 |
| 649 | TASC 2025.06 Cybernetic Oscillator | `tasc-2025-06-cybernetic-oscillator` | Oscillators | own | PineCodersTASC | batch 5 |
| 650 | TASC 2025.09 The Continuation Index | `tasc-2025-09-the-continuation-index` | Trend | own | PineCodersTASC | batch 14 |
| 651 | TASC 2026.04 A Synthetic Oscillator | `tasc-2026-04-a-synthetic-oscillator` | Oscillators | own | PineCodersTASC | batch 7 |
| 652 | TASC 2026.05 The AutoTune Filter | `tasc-2026-05-the-autotune-filter` | Oscillators | own | PineCodersTASC | batch 8 |
| 653 | TASC 2026.09 Adaptive SuperSmoother | `tasc-2026-09-adaptive-supersmoother` | Moving Averages | own | PineCodersTASC | batch 15 |
| 654 | TDI - Traders Dynamic Index | `tdi-rsi` | Momentum | own |  |  |
| 655 | Tenkan Cloud Signals | `tenkan-cloud-signals` | Trend | price | CodaPro | batch 11 |
| 656 | Terminal Velocity Stop \| Lyro RS | `terminal-velocity-stop-lyro-rs` | Trend | price | LyroRS | batch 13 |
| 657 | The Mean Goose v1 | `the-mean-goose-v1` | Channels & Bands | price | FattyGuinness | batch 15 |
| 658 | Theil-Sen Line Filter | `theil-sen-line-filter` | Moving Averages | price | BackQuant | batch 18 |
| 659 | Three Moving Averages | `three-moving-averages` | Moving Averages | price |  |  |
| 660 | Tillson T3 | `tillson-t3` | Trend | price | KivancOzbilgic (fr3762) |  |
| 661 | TMO (True Momentum Oscillator) | `tmo` | Momentum | own | Coulisnosaj | batch 15 |
| 662 | Tom DeMark MACD | `td-macd` | Momentum | own |  |  |
| 663 | TonyUX EMA Scalper | `tonyux-ema-scalper` | Oscillators | price |  |  |
| 664 | Top & Bottom Candle | `top-bottom-candle` | Candlestick Patterns | own |  |  |
| 665 | Tops/Bottoms | `tops-bottoms` | Oscillators | price |  |  |
| 666 | TR High/Low meter | `tr-high-low-meter` | Momentum | own | dman103 | batch 10 |
| 667 | Trader XO Macro Trend Scanner | `trader-xo` | Oscillators | price |  |  |
| 668 | Traders Dynamic Index | `tdi-hlc-trix` | Oscillators | own |  |  |
| 669 | Trading Activity Index | `trading-activity-index` | Volume | own | Zeiierman | batch 2 |
| 670 | Transient Zones v1.1 | `transient-zones` | Channels & Bands | price | Jurij (community) |  |
| 671 | Tremor Tracker | `tremor-tracker` | Volatility | own | TheUltimator5 | batch 19 |
| 672 | Trend Direction Zone | `trend-direction-zone` | Trend | price | MarketStructureLab | batch 16 |
| 673 | Trend Filter (2-pole) | `trend-filter` | Trend | price | BigBeluga | batch 1 |
| 674 | Trend Flow Oscillator (CMF + MFI) + ADX | `trend-flow-oscillator-adx` | Oscillators | own | WalrusQuant | batch 19 |
| 675 | Trend Following Moving Averages | `trend-following-ma` | Moving Averages | price | LonesomeTheBlue |  |
| 676 | Trend Impulse Channels | `trend-impulse-channels` | Trend | price | Zeiierman |  |
| 677 | Trend Line Auto | `trend-line-auto` | Trend | price | HarryBot |  |
| 678 | Trend Lines v2 | `trend-lines-v2` | Trend | price | LonesomeTheBlue (Pine v4) |  |
| 679 | Trend Magic | `trend-magic` | Trend | price |  |  |
| 680 | Trend Predictor Ribbon Clone - Fixed roj karo moj karo | `trend-predictor-ribbon` | Trend | price | ronitjain18 | batch 6 |
| 681 | Trend Regularity Adaptive MA | `trama` | Moving Averages | price | LuxAlgo |  |
| 682 | Trend State Signals | `trend-state-signals` | Trend | price | MarketStructureLab | batch 4 |
| 683 | Trend Trader Strategy | `trend-trader` | Trend | price |  |  |
| 684 | Trend Trigger Factor | `trend-trigger-factor` | Oscillators | own |  |  |
| 685 | Trend Volatility Index (TVI) | `trend-volatility-index` | Volatility | own | chikaharu | batch 3 |
| 686 | TrendCylinder (Expo) | `trendcylinder` | Trend | price | Zeiierman | batch 4 |
| 687 | Trendlines with Breaks [LuxAlgo] | `trendlines-with-breaks` | Trend | price | LuxAlgo |  |
| 688 | TrendMasterPro_Fekonomi | `trendmasterpro-fekonomi` | Trend | price | fekonomi | batch 20 |
| 689 | TrendWave Bands | `trendwave-bands` | Channels & Bands | price | BigBeluga | batch 1 |
| 690 | Triangular MA Bands | `tma-bands` | Channels & Bands | price |  |  |
| 691 | Triangular Momentum Oscillator | `triangular-momentum-osc` | Oscillators | own |  |  |
| 692 | Trimmed Mean ATR Bands | `trimmed-mean-atr-bands` | Channels & Bands | price | CryptoNejc | batch 17 |
| 693 | Triple Gaussian Smoothed Ribbon | `triple-gaussian-smoothed-ribbon` | Trend | price | BOSWaves | batch 16 |
| 694 | Triple MA For Loop | `triple-ma-for-loop` | Trend | own | SeerQuant | batch 7 |
| 695 | Triple MA Forecast | `triple-ma-forecast` | Moving Averages | price | yatrader2 (community) |  |
| 696 | Triple RSI \| MisinkoMaster | `triple-rsi-misinkomaster` | Momentum | own | MisinkoMaster | batch 19 |
| 697 | True Range eXpansion | `true-range-expansion` | Volatility | price | Sherlock_MacGyver | batch 22 |
| 698 | TTM Squeeze Pro | `ttm-squeeze-pro` | Oscillators | own | John Carter |  |
| 699 | Turtle Trade Channels | `turtle-trade-channels` | Channels & Bands | price | Richard Dennis / William Eckhardt |  |
| 700 | Tweezers & Kangaroo Tail | `tweezers-kangaroo-tail` | Candlestick Patterns | price | LonesomeTheBlue |  |
| 701 | Twin Range Filter | `twin-range-filter` | Trend | price | colinmck |  |
| 702 | Ultimate Buy & Sell | `ultimate-buy-sell` | Trend | price |  |  |
| 703 | Ultimate RSI [LuxAlgo] | `ultimate-rsi` | Momentum | own | LuxAlgo |  |
| 704 | Ultra Smart Trail | `ultra-smart-trail` | Trend | price | Rathack | batch 18 |
| 705 | Universal Large Orders Proxy fabio valentini Chat gpt Recreation | `universal-large-orders-proxy-fabio-valentini-chat-gpt-recreation` | Volume | price | boss11233 | batch 18 |
| 706 | Uptrick: Dynamic Z-Score Deviation | `uptrick-dynamic-z-score-deviation` | Trend | price | Uptrick | batch 6 |
| 707 | Uptrick: Liquid Reversal Bands | `liquid-reversal-bands` | Channels & Bands | price | Uptrick | batch 3 |
| 708 | Uptrick: MultiMA_Volume | `uptrick-multima-volume` | Moving Averages | price | Uptrick | batch 16 |
| 709 | Uptrick: RSI MA Buying/Selling signals | `uptrick-rsi-ma-buying-selling-signals` | Momentum | own | Uptrick | batch 12 |
| 710 | Uptrick: Trend Analysis | `uptrick-trend-analysis` | Momentum | own | Uptrick | batch 14 |
| 711 | Uptrick: Volatility Reversion Bands | `uptrick-volatility-reversion-bands` | Channels & Bands | price | Uptrick | batch 4 |
| 712 | Uptrick: Zero Lag HMA Trend Suite | `zero-lag-hma-trend-suite` | Moving Averages | price | Uptrick | batch 3 |
| 713 | User Defined Range Selector and Color Changing EMA Line | `user-defined-range-selector-and-color-changing-ema-line` | Moving Averages | price | Crypto_Moses | batch 23 |
| 714 | UT Bot | `ut-bot` | Trend | price |  |  |
| 715 | Variable Moving Average | `variable-ma` | Moving Averages | price | LazyBear |  |
| 716 | VARIS Zones | `varis-zones` | Channels & Bands | price | IAmTheLiquidity2 | batch 17 |
| 717 | VCO Fusion | `vco-fusion` | Oscillators | own | Uncle_the_shooter | batch 20 |
| 718 | Vdub FX Sniper | `vdub-sniper` | Oscillators | price | Vdubus |  |
| 719 | vdubus BinaryPro | `vdubus-binarypro` | Oscillators | price |  |  |
| 720 | VEGA (Velocity of Efficient Gain Adaptation) | `vega` | Momentum | own | B3AR_Trades | batch 20 |
| 721 | Vervoort HA LT Candlestick Oscillator | `vervoort-ha-oscillator` | Oscillators | own |  |  |
| 722 | Visualisation tendances | `visualisation-tendances` | Trend | price | Benjamin69 | batch 17 |
| 723 | Volatility & Big Market Moves | `volatility-big-market-moves` | Volatility | own | nilstrades_ | batch 24 |
| 724 | Volatility Adaptive Filtered Trend | `volatility-adaptive-filtered-trend` | Trend | price | SchizoQuant | batch 6 |
| 725 | Volatility Bands | `volatility-bands` | Channels & Bands | price | pmk07 | batch 23 |
| 726 | Volatility Channel Oscillator | `volatility-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 727 | Volatility Halo \| NAL | `volatility-halo-nal` | Volatility | price | NordicAlphaLab | batch 6 |
| 728 | Volatility Quality | `volatility-quality` | Volatility | own | AlphaExtract | batch 18 |
| 729 | Volatility-Driven VWAP Structure | `volatility-driven-vwap-structure` | Channels & Bands | price | Zeiierman | batch 3 |
| 730 | Volatility-Gated Trend Oscillator | `volatility-gated-trend-oscillator` | Oscillators | own | QuantAlgo | batch 9 |
| 731 | VOLD Ratio Histogram | `vold-ratio-histogram` | Volume | own | Th16rry | batch 23 |
| 732 | Volumatic S/R Levels | `volumatic-sr-levels` | Trend | price | BigBeluga |  |
| 733 | Volume + RSI & MA Differential | `volume-rsi-ma-differential` | Volume | own | ozzy_livin | batch 7 |
| 734 | Volume Accumulation Percentage | `volume-accumulation-pct` | Volume | own |  |  |
| 735 | Volume and Volatility Ratio Indicator-WODI | `volume-and-volatility-ratio-indicator-wodi` | Volume | own | W0DI | batch 16 |
| 736 | Volume Bands | `volume-bands` | Channels & Bands | price | MisinkoMaster | batch 6 |
| 737 | Volume Bar Breakout | `volume-bar-breakout` | Volume | price | tradeswithashish |  |
| 738 | Volume Bars Color | `volume-bars-color` | Volume | own | Evgenyc111 | batch 20 |
| 739 | Volume Candle Highlighter | `volume-candle-highlighter` | Volume | price | Dougie_dee | batch 5 |
| 740 | Volume Colored Bars | `volume-colored-bars` | Volume | own |  |  |
| 741 | Volume Divergence | `volume-divergence` | Volume | own | baymucuk |  |
| 742 | Volume Flow Indicator | `volume-flow-indicator` | Volume | own |  |  |
| 743 | Volume Flow v3 | `volume-flow-v3` | Volume | own | DepthHouse / oh92 (community) |  |
| 744 | Volume Footprint | `volume-footprint` | Volume | price | LuxAlgo |  |
| 745 | Volume LinReg Trend | `volume-linreg-trend` | Volume | own | LonesomeTheBlue |  |
| 746 | Volume Positive Negative (VPN) | `volume-positive-negative` | Volume | own | LevelUpTools | batch 2 |
| 747 | Volume Price Confirmation Indicator | `vpci` | Volume | own |  |  |
| 748 | Volume Profile Heatmap | `volume-profile-heatmap` | Volume | price | KeyAlgos | batch 13 |
| 749 | Volume SuperTrend AI | `volume-supertrend-ai` | Trend | price |  |  |
| 750 | Volume Surge Detector | `volume-surge-detector` | Volume | own | SpeculationLab | batch 19 |
| 751 | Volume Weighted MACD V2 | `vw-macd-v2` | Momentum | own |  |  |
| 752 | Volume Weighted Median Price (VWMP) | `volume-weighted-median-price` | Moving Averages | price | vsov | batch 14 |
| 753 | Volume Weighted Trend | `volume-weighted-trend` | Trend | price | QuantAlgo | batch 1 |
| 754 | Volume-Gated Trend Ribbon | `volume-gated-trend-ribbon` | Trend | price | QuantAlgo | batch 3 |
| 755 | Volume-Weighted MA Crossover | `volume-weighted-ma-crossover` | Moving Averages | price | AlphaNatt | batch 9 |
| 756 | Volume-Weighted Price Z-Score | `volume-weighted-price-z-score` | Oscillators | own | QuantAlgo | batch 6 |
| 757 | Volumetric Compressed MA | `volumetric-compressed-ma` | Moving Averages | price | serkany88 | batch 14 |
| 758 | Voss Predictive Filter | `voss-predictive-filter` | Oscillators | own | e2e4 | batch 8 |
| 759 | VPSA-VTD | `vpsa-vtd` | Volume | own | CatTheTrader | batch 11 |
| 760 | VuManChu Swing Free | `vumanchu-swing` | Trend | price |  |  |
| 761 | VWAP & Dual MA Ribbon Tracker Pro | `vwap-dual-ma-ribbon-tracker-pro` | Trend | own | Simon20cent | batch 19 |
| 762 | VWAP Deviation Oscillator | `vwap-deviation-oscillator` | Oscillators | own | BackQuant | batch 9 |
| 763 | VWAP/MVWAP/EMA Crossover | `vwap-mvwap-ema-crossover` | Trend | price | DerrickLaFlame |  |
| 764 | VWMA/SMA Delta Volatility (Statistical Anomaly Detector) | `vwma-sma-delta-volatility` | Volatility | own | tkarolak | batch 14 |
| 765 | VWMACD & SZO | `vwmacd-szo` | Momentum | own |  |  |
| 766 | Waddah Attar Explosion | `waddah-attar-explosion` | Momentum | own | LazyBear/ShayanKM |  |
| 767 | WAE Sniper Scalp XAUUSD M1 Tuned | `wae-sniper-scalp-xauusd-m1-tuned` | Momentum | own | khonthailoei19071983 | batch 19 |
| 768 | Wavelet Transform Trend | `wavelet-transform-trend` | Trend | price | QuantAlgo | batch 12 |
| 769 | Wavelet-Trend ML Integration | `wavelet-trend-ml-integration` | Oscillators | own | AlphaExtract | batch 1 |
| 770 | WaveTrend | `wavetrend` | Oscillators | own | LazyBear |  |
| 771 | WaveTrend Oscillator | `wavetrend-oscillator` | Momentum | own | LazyBear |  |
| 772 | Weierstrass Function (Fractal Cycles) | `weierstrass-function` | Oscillators | own | fract | batch 17 |
| 773 | Weighted percentile nearest rank | `weighted-percentile-nearest-rank` | Moving Averages | price | gorx1 | batch 10 |
| 774 | Weighted Regression Bands | `weighted-regression-bands` | Channels & Bands | price | Zeiierman | batch 5 |
| 775 | Weis Wave Volume | `weis-wave-volume` | Volume | own |  |  |
| 776 | Whale Activity Impact Oscillator | `whale-activity-impact-oscillator` | Volume | own | mdeacey | batch 18 |
| 777 | Whale Volume Absorption & Aggression @MaxMaserati 3.0 | `whale-volume-absorption-aggression-maxmaserati-3-0` | Volume | own | MaxMaserati | batch 22 |
| 778 | WICK.ED Fractals | `wicked-fractals` | Oscillators | price | Mit Nayi (community) |  |
| 779 | Williams Alligator + Fractals | `williams-combo` | Trend | price | vlkvr (Pine v3) |  |
| 780 | Williams BBDiv Signal | `williams-bbdiv-signal` | Oscillators | own | trade_lexx | batch 20 |
| 781 | Williams Vix Fix | `williams-vix-fix` | Volatility | own | ChrisMoody |  |
| 782 | x5-smooth-ema | `x5-smooth-ema` | Moving Averages | price | traderninezero | batch 19 |
| 783 | XAUUSD Buy/Sell Alerts with SL & TP | `xauusd-buy-sell-alerts-with-sl-tp` | Moving Averages | price | alexandrossolomou1 | batch 8 |
| 784 | XAUUSD Family Scalping (5min) | `xauusd-family-scalping` | Oscillators | price | cupra_inc | batch 8 |
| 785 | Z-Score | `z-score` | Oscillators | own | joecalledher | batch 21 |
| 786 | Z-Score Oscillator | `z-score-oscillator` | Oscillators | own | B3AR_Trades | batch 12 |
| 787 | Z-Score STDEMA Bands | `z-score-stdema-bands` | Oscillators | own | TiagoTF | batch 24 |
| 788 | Zero Lag EMA | `zero-lag-ema` | Moving Averages | price |  |  |
| 789 | Zero Lag LSMA (ZLSMA) | `zlsma` | Moving Averages | price | veryfid |  |
| 790 | Zero Lag MACD | `zero-lag-macd` | Momentum | own | AC (based on Glaz) |  |
| 791 | Zero Lag Signals For Loop | `zero-lag-signals-for-loop` | Trend | price | QuantAlgo | batch 1 |
| 792 | Zero-Lag GARCH Bands \| NAL | `zero-lag-garch-bands-nal` | Volatility | price | NordicAlphaLab | batch 12 |
| 793 | ZigZag with Fibonacci Levels | `zigzag-fibonacci` | Trend | price | LonesomeTheBlue |  |
