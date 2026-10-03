# Community Indicator Inventory

Community indicators of `lightweight-charts-indicators`: TypeScript ports of community PineScript scripts, built on
[oakscriptjs](https://github.com/deepentropy/oakscriptJS). Each port has the inputs, plots and drawings of its Pine
source. This list is generated from the indicator registry (`indicatorRegistry` in `src/index.ts`).

## Summary

| | Count |
|---|---|
| **Community indicators** | 873 |
| Drawn on the price pane (overlay) | 488 |
| Drawn in their own pane | 385 |
| Compared with TradingView outputs (batches 1-28) | 555 |

| Category | Count |
|---|---|
| Trend | 239 |
| Oscillators | 186 |
| Momentum | 119 |
| Moving Averages | 117 |
| Channels & Bands | 97 |
| Volume | 77 |
| Volatility | 24 |
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
| 32 | Advanced MACD Pro - T3 Themed | `advanced-macd-pro-t3-themed` | Momentum | own | WhiteStone_Ibrahim | batch 27 |
| 33 | AdvancedLines (FiboBands) - PaSKaL | `advancedlines-paskal` | Channels & Bands | price | uPaSKaL | batch 19 |
| 34 | ADX and RSI Combo | `adx-and-rsi-combo` | Oscillators | own | Tracks | batch 10 |
| 35 | ADX by cobra | `adx-cobra` | Trend | own | cobra (community) |  |
| 36 | ADX Di+ Di- [Gu5] | `adx-di-gu5` | Trend | own | Gu5tavo71 |  |
| 37 | ADX Extreme Zones + Divergences | `adx-extreme-zones-divergences` | Trend | own | TradeVizion | batch 13 |
| 38 | ADX Trend Strength Filter + TRAMA | `adx-trend-strength-filter-trama` | Trend | price | DotGain | batch 18 |
| 39 | ADX with Shaded Zone | `adx-with-shaded-zone` | Trend | own | MathThomas | batch 20 |
| 40 | ADX-vALMA (N) | `adx-valma` | Trend | own | Zomzi | batch 6 |
| 41 | Aggregated Scores Oscillator | `aggregated-scores-oscillator` | Oscillators | own | AlphaExtract | batch 8 |
| 42 | Aggressive Pullback Indicator | `aggressive-pullback-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 43 | Aggressive Volume | `aggressive-volume` | Volume | own | oDouglasAlex | batch 26 |
| 44 | AI Adaptive Oscillator | `ai-adaptive-oscillator` | Oscillators | own | PhenLabs | batch 11 |
| 45 | AI Breakout Bands | `ai-breakout-bands` | Channels & Bands | price | Zeiierman | batch 3 |
| 46 | AI Engulfing Candle | `ai-engulfing` | Candlestick Patterns | price |  |  |
| 47 | AI Infinity | `ai-infinity` | Trend | price | jonathanalbrecht_trader | batch 11 |
| 48 | AI Source Switching Moving Average | `ai-source-switching-moving-average` | Moving Averages | price | Zeiierman | batch 1 |
| 49 | AI Trading Assistant v2 | `ai-trading-assistant-v2` | Trend | price | Alchemical_Carpenter | batch 26 |
| 50 | AI Trend Navigator [K-Neighbor] | `ai-trend-navigator` | Trend | price |  |  |
| 51 | AI Volume Signals | `ai-volume-signals` | Volume | price | szymonsobkowiak | batch 9 |
| 52 | AI-Weighted RSI | `ai-weighted-rsi` | Oscillators | own | Zeiierman | batch 3 |
| 53 | AK MACD BB | `macd-bb` | Momentum | own | Algokid |  |
| 54 | AK TREND ID | `ak-trend-id` | Trend | own | Algokid |  |
| 55 | Al Po's Arithmetic Mean | `al-po-s-arithmetic-mean` | Moving Averages | price | sequentialvision | batch 21 |
| 56 | All Candlestick Patterns | `all-candlestick-patterns` | Candlestick Patterns | price |  |  |
| 57 | ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF) | `all-in-one-rsi-system` | Oscillators | own | ethem11 | batch 25 |
| 58 | AllMA Trend Radar | `allma-trend-radar` | Moving Averages | price | trade_lexx | batch 28 |
| 59 | ALMA SD Bands \| RakoQuant | `alma-sd-bands-rakoquant` | Channels & Bands | price | RakoQuant | batch 10 |
| 60 | Alpha Trading Signal _ Up side Down | `alpha-trading-signal-up-side-down` | Trend | price | giaodichdsmart | batch 19 |
| 61 | Alpha-Sutte Model | `alpha-sutte-model` | Trend | price | SegaRKO | batch 10 |
| 62 | AlphaTrend | `alpha-trend` | Trend | price | KivancOzbilgic |  |
| 63 | Anchored Bollinger Band Range | `anchored-bollinger-band-range` | Channels & Bands | price | Steversteves | batch 20 |
| 64 | Anchored VWAP Pro (Final Visibility Enhanced) | `anchored-vwap-pro` | Volume | price | ImmortalEmerson | batch 17 |
| 65 | ANDROMEDA - TrendSync | `andromeda-trendsync` | Trend | price | Pedro_Canto | batch 9 |
| 66 | Anti-Volume Stop Loss | `anti-volume-stop` | Trend | price |  |  |
| 67 | Arnaud Legoux Gaussian Flow \| AlphaNatt | `arnaud-legoux-gaussian-flow-alphanatt` | Moving Averages | price | AlphaNatt | batch 17 |
| 68 | Aroon with RSI Confirmation (92.86%) | `aroon-with-rsi-confirmation` | Trend | price | jaydipali622018 | batch 7 |
| 69 | Asian & London Session High/Low | `asian-london-session-high-low` | Channels & Bands | price | NikolayBorisov | batch 8 |
| 70 | Ask-Weighted Averages | `ask-weighted-averages` | Volume | price | DinoTradez | batch 27 |
| 71 | Asset risk metrics | `asset-risk-metrics` | Momentum | price | Sweettz | batch 21 |
| 72 | Asymmetric Volatility Trend Line | `asymmetric-volatility-trend-line` | Trend | price | QuantAlgo | batch 4 |
| 73 | ATR Based Zigzag w EMA | `atr-based-zigzag-w-ema` | Trend | price | HabibiBudo | batch 4 |
| 74 | ATR HEMA | `atr-hema` | Moving Averages | price | SeerQuant | batch 2 |
| 75 | ATR Period | `nrtr` | Trend | price |  |  |
| 76 | ATR Period | `profit-maximizer` | Moving Averages | price |  |  |
| 77 | ATR Period | `supertrend-ladder` | Trend | price |  |  |
| 78 | ATR Rope | `atr-rope` | Trend | price | SamRecio | batch 2 |
| 79 | ATR Trailing Stops | `atr-trailing-stops` | Trend | price |  |  |
| 80 | ATR Volatility and Trend Analysis | `atr-volatility-and-trend-analysis` | Volatility | price | dchunt-stack | batch 10 |
| 81 | ATR ZLEMA | `atr-zlema` | Trend | price | QuantAlgo | batch 3 |
| 82 | ATR+ Stop Loss Indicator | `atr-plus` | Trend | own | ZenAndTheArtOfTrading |  |
| 83 | ATR-Normalized VWMA Deviation | `atr-normalized-vwma-deviation` | Oscillators | own | exploretranspose | batch 10 |
| 84 | ATR-Scaled Deviation Oscillator | `atr-scaled-deviation-oscillator` | Oscillators | own | C_H_I_P_A | batch 23 |
| 85 | Aura Trend & Candlestick Matrix | `aura-trend-candlestick-matrix` | Trend | price | Pineify | batch 9 |
| 86 | Aura: Adaptive Statistical Smoother | `aura-adaptive-statistical-smoother` | Moving Averages | price | Pineify | batch 15 |
| 87 | Auto AVWAP (Anchored-VWAP) with Breakout Screener | `auto-avwap-with-breakout-screener` | Volume | price | manoharvs | batch 28 |
| 88 | Auto Fibo on Indicators | `auto-fibo-indicators` | Oscillators | own | KivancOzbilgic |  |
| 89 | Auto Fibonacci | `auto-fib` | Channels & Bands | price |  |  |
| 90 | Auto Trendline [DojiEmoji] | `auto-trendline` | Trend | price |  |  |
| 91 | Auto-Support | `auto-support` | Channels & Bands | price |  |  |
| 92 | Automated Z-scoring | `automated-z-scoring` | Oscillators | own | JTCapitalNL | batch 14 |
| 93 | Automatic Support & Resistance | `auto-support-resistance` | Channels & Bands | price |  |  |
| 94 | Average Bullish & Bearish Percentage Change | `average-bullish-bearish-percentage-change` | Momentum | own | fract | batch 23 |
| 95 | Average Sentiment Oscillator | `average-sentiment-oscillator` | Oscillators | own |  |  |
| 96 | Average True Range Trailing Stops Colored | `atr-trailing-colored` | Trend | price |  |  |
| 97 | Awesome Oscillator V2 | `awesome-oscillator-v2` | Oscillators | own |  |  |
| 98 | Awesome_Accelerator_Zone Oscillator | `awesome-accelerator-zone-oscillator` | Oscillators | own | pirooz_trader | batch 18 |
| 99 | B + A + D v0.4 | `b-a-d-v0-4` | Momentum | own | wepritz84 | batch 13 |
| 100 | BACAP PRICE STRUCTURE 21 EMA TREND | `bacap-price-structure-21-ema-trend` | Trend | price | Alex_PrimeTrading | batch 19 |
| 101 | Banker Fund Flow Trend Oscillator | `banker-fund-flow` | Oscillators | own |  |  |
| 102 | BB Breakout Oscillator | `bb-breakout-oscillator` | Oscillators | own | LuxAlgo |  |
| 103 | BB Fibonacci Ratios | `bb-fibonacci-ratios` | Channels & Bands | price |  |  |
| 104 | BB Length | `ideal-bb-ma` | Moving Averages | price |  |  |
| 105 | BB Stochastic RSI Extreme Signal | `bb-stoch-rsi` | Oscillators | price |  |  |
| 106 | Bernoulli Process - Binary Entropy | `bernoulli-process-entropy` | Oscillators | own | kocurekc | batch 1 |
| 107 | BEST Supertrend CCI | `supertrend-cci` | Trend | price | Daveatt |  |
| 108 | Beta-Weighted Moving Average | `weighted-ma-function` | Moving Averages | price |  |  |
| 109 | Better Volume Indicator | `better-volume` | Volume | own | LazyBear |  |
| 110 | Big Snapper Alerts R3.0 | `big-snapper-alerts` | Trend | price |  |  |
| 111 | Biggest Volume | `biggest-volume` | Volume | own | mikhail_marka | batch 22 |
| 112 | Bilateral Filter For Loop | `bilateral-filter-for-loop` | Trend | own | BackQuant | batch 14 |
| 113 | Binary Option Arrows | `binary-option-arrows` | Trend | price |  |  |
| 114 | Bitcoin Kill Zones v2 | `bitcoin-kill-zones` | Trend | price |  |  |
| 115 | Bitcoin Log Growth Curves | `bitcoin-log-curves` | Trend | price | Quantadelic |  |
| 116 | Bitcoin: Mayer Multiple | `bitcoin-mayer-multiple` | Oscillators | own | sito4713 | batch 25 |
| 117 | Bjorgum AutoTrail | `bjorgum-autotrail` | Trend | price | Bjorgum (simplified for auto mode) |  |
| 118 | Bjorgum TSI | `bjorgum-tsi` | Momentum | own |  |  |
| 119 | Blacklab84 Panel | `blacklab84-panel` | Oscillators | own | blacklab84 | batch 21 |
| 120 | Bollinger Adaptive Trend Navigator | `bollinger-adaptive-trend-navigator` | Trend | price | QuantAlgo | batch 16 |
| 121 | Bollinger Awesome Alert R1.1 | `bollinger-awesome-alert` | Trend | price |  |  |
| 122 | Bollinger Heatmap | `bollinger-heatmap` | Channels & Bands | own | Quantitative | batch 25 |
| 123 | Boom Hunter Pro | `boom-hunter-pro` | Momentum | own | veryfid |  |
| 124 | Breakdown or Buyable Dip? Pullback Depth Can Help | `breakdown-or-buyable-dip-pullback-depth-can-help` | Momentum | own | TradeStation | batch 23 |
| 125 | Breakout an Reversal Signal Detector with Colored in Bar Trends | `breakout-an-reversal-signal-detector-with-colored-in-bar-trends` | Channels & Bands | price | AmGlad_Trader | batch 25 |
| 126 | Breakout Indicator | `breakout-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 127 | BTC Logarithmic Regression Quantile Bands \| Astral Vision | `btc-logarithmic-regression-quantile-bands-astral-vision` | Channels & Bands | price | AstralVision | batch 24 |
| 128 | Bull Bear Power Trend | `bull-bear-power-trend` | Momentum | own |  |  |
| 129 | Bullish Engulfing Finder | `bullish-engulfing-finder` | Candlestick Patterns | price |  |  |
| 130 | Bulls or Bears in Control | `bulls-bears-control` | Trend | own |  |  |
| 131 | Bulls v Bears | `bulls-v-bears` | Momentum | own | Mihkel00 | batch 3 |
| 132 | Buy & Sell - Accurate Signals | `buy-sell-accurate-signals` | Trend | price | Cryptokingworld91 (published as "Buy & Sell - Accurate Signals") | batch 7 |
| 133 | Buy & Sell Pressure | `buy-sell-pressure` | Volume | own |  |  |
| 134 | Buy Low Sell High Composite Upgraded V6 | `buy-low-sell-high-composite-upgraded-v6` | Oscillators | own | kristian6ncqq | batch 15 |
| 135 | Buy on Volume | `buy-on-volume` | Moving Averages | price | Mando4_27 | batch 21 |
| 136 | Buy/Sell Hull Crossover Signals (Fast & Slow) | `buy-sell-hull-crossover-signals` | Moving Averages | price | VibeAlgos | batch 11 |
| 137 | Buyers & Sellers / Range | `buyers-sellers-range` | Oscillators | own | fract | batch 11 |
| 138 | Buyers vs Sellers | `buyers-vs-sellers` | Momentum | own | davorloncarpetrovic | batch 19 |
| 139 | Buying & Selling Pressure | `buying-selling-pressure` | Volatility | own | fract | batch 3 |
| 140 | Buying and Selling Volume Pressure S/R | `buying-and-selling-volume-pressure-s-r` | Volume | price | DinoTradez | batch 16 |
| 141 | Buying Selling Volume | `buying-selling-volume` | Volume | own | ceyhun (community) |  |
| 142 | Buying vs Selling Moving Averages (Scalp Meter) | `buying-vs-selling-moving-averages` | Volume | own | codycolton97 | batch 24 |
| 143 | BuySell Volume Bar Chart | `buysell-volume-bar-chart` | Volume | own | roshbiz1408 | batch 21 |
| 144 | BuySell%_ImtiazH_v2 | `buysell-imtiazh-v2` | Volume | own | a272a59956 | batch 22 |
| 145 | Cabal Dev Indicator | `cabal-dev-indicator` | Oscillators | own | SolanaMemeCoins | batch 26 |
| 146 | Candle Breakout Oscillator | `candle-breakout-oscillator` | Oscillators | own | LuxAlgo | batch 2 |
| 147 | Candle Channel | `candle-channel` | Channels & Bands | price | Uncle_the_shooter | batch 23 |
| 148 | Candle Range Theory (CRT) by Lucas | `candle-range-theory-by-lucas` | Trend | price | lucasfff | batch 15 |
| 149 | Candle Range Trading (CRT) | `candle-range-trading` | Trend | price | marcostan93 | batch 1 |
| 150 | Candlestick Reversal | `candlestick-reversal` | Candlestick Patterns | price | LonesomeTheBlue (community) |  |
| 151 | Cardwell RSI by TQ | `cardwell-rsi-by-tq` | Oscillators | own | TradeQUO | batch 24 |
| 152 | Carrier Volatility | `carrier-volatility` | Oscillators | own | et20tradeview | batch 15 |
| 153 | CBC Flip with Volume | `cbc-flip-with-volume` | Trend | price | PtGambler | batch 18 |
| 154 | CCI coded OBV | `cci-obv` | Oscillators | own | LazyBear |  |
| 155 | CCI Length | `cci-stochastic` | Momentum | own |  |  |
| 156 | CCI Pro | `cci-hash-capital` | Oscillators | own | Hash_Capital | batch 24 |
| 157 | CCT Bollinger Band Oscillator | `cct-bbo` | Oscillators | own | LazyBear |  |
| 158 | CDC Action Zone | `cdc-action-zone` | Trend | price |  |  |
| 159 | Center of Gravity Channel | `cog-channel` | Channels & Bands | price |  |  |
| 160 | CHAKRA RISS ENGULFING CANDLESTICK STRATEGY | `chakra-riss-engulfing-candlestick-strategy` | Momentum | price | Tradewith_Riss | batch 18 |
| 161 | Chandelier Exit | `chandelier-exit` | Trend | price |  |  |
| 162 | Chandelier Stop | `chandelier-stop` | Trend | price |  |  |
| 163 | Change-Point Detection (CUSUM) | `change-point-detection` | Trend | price | LuxAlgo | batch 6 |
| 164 | CHN BUY SELL with EMA 200 | `chn-buy-sell-with-ema-200` | Trend | price | CHNTeam | batch 10 |
| 165 | Clustering Volatility (ATR-ADR-ChaikinVol) | `clustering-volatility` | Volatility | own | SDF-Solutions | batch 24 |
| 166 | CM EMA Trend Bars | `cm-ema-trend-bars` | Trend | price | ChrisMoody |  |
| 167 | CM Enhanced Ichimoku Cloud V5 | `cm-enhanced-ichimoku` | Channels & Bands | price | ChrisMoody (community) |  |
| 168 | CM Gann Swing High Low V2 | `cm-gann-swing` | Trend | price | ChrisMoody (community) |  |
| 169 | CM Guppy EMA | `cm-guppy-ema` | Moving Averages | price | ChrisMoody |  |
| 170 | CM Heikin-Ashi | `cm-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 171 | CM Laguerre PPO PercentileRank | `cm-laguerre-ppo` | Oscillators | own | ChrisMoody |  |
| 172 | CM Price Action Bars | `cm-price-action` | Oscillators | price | ChrisMoody |  |
| 173 | CM RSI Plus EMA | `cm-rsi-ema` | Oscillators | own | ChrisMoody |  |
| 174 | CM RSI-2 Strategy Lower | `cm-rsi-2-lower` | Oscillators | own | ChrisMoody |  |
| 175 | CM RSI-2 Strategy Upper | `cm-rsi-2-upper` | Oscillators | price | ChrisMoody |  |
| 176 | CM Sling Shot System | `cm-sling-shot` | Trend | price | ChrisMoody |  |
| 177 | CM Stochastic Highlight Bars | `cm-stoch-highlight` | Oscillators | price | ChrisMoody |  |
| 178 | CM Stochastic POP Method 1 | `stoch-pop-1` | Oscillators | own | ChrisMoody |  |
| 179 | CM Stochastic POP Method 2 | `stoch-pop-2` | Oscillators | own | ChrisMoody |  |
| 180 | CM Time Based Vertical Lines | `cm-time-lines` | Trend | price | ChrisMoody |  |
| 181 | CM Williams Vix Fix V3 | `cm-vix-fix-v3` | Oscillators | own | ChrisMoody |  |
| 182 | CMO For Loop \| QuantLapse | `cmo-for-loop-quantlapse` | Momentum | own | QuantLapse | batch 19 |
| 183 | Colored Volume Bars | `colored-volume` | Volume | own | LazyBear |  |
| 184 | Community MoneyLine | `community-moneyline` | Trend | price | rafstar_kaczmarek | batch 12 |
| 185 | Composite Indicator (CCI + ATR) | `composite-indicator` | Momentum | price | CharLi0t | batch 17 |
| 186 | Consecutive Candles DevisSo | `consecutive-candles-devisso` | Trend | price | engineerofmoney | batch 11 |
| 187 | Consolidation Zones - Live | `consolidation-zones` | Channels & Bands | price | LonesomeTheBlue |  |
| 188 | Conversion Periods | `ichimoku-oscillator` | Momentum | own |  |  |
| 189 | Coral Trend | `coral-trend` | Trend | price | LazyBear |  |
| 190 | Corrected Moving Average | `corrected-moving-average` | Moving Averages | price | everget | batch 3 |
| 191 | COV Bands ~ C H I P A | `cov-bands-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 28 |
| 192 | Crosby Ratio \| QuantumResearch | `crosby-ratio-quantumresearch` | Momentum | own | QuantumResearch | batch 17 |
| 193 | Crossover EMMM | `crossover-emmm` | Trend | price | NunyadzilaTrading | batch 22 |
| 194 | CRT indicator | `crt-indicator` | Trend | price | INTELA | batch 16 |
| 195 | Curved Trend Channels | `curved-trend-channels` | Channels & Bands | price | Zeiierman | batch 7 |
| 196 | Custom Donchian Channels | `donchian-custom` | Channels & Bands | price |  |  |
| 197 | CVD (Cumulative Volume Delta) | `cvd-rupward` | Volume | own | RUpward | batch 19 |
| 198 | Cycle & Flow Indicator - D_Quant | `cycle-flow-indicator-d-quant` | Trend | price | D_QUANT | batch 22 |
| 199 | Cycle Low (RSI + StochRSI) – v5 John.K | `cycle-low-v5-john-k` | Momentum | price | John_Kal | batch 22 |
| 200 | Cycle-Synced Channel Breakout | `cycle-synced-channel-breakout` | Channels & Bands | price | TradeTechanalysis | batch 25 |
| 201 | Dan's Ironclad OB - Simple | `dan-s-ironclad-ob-simple` | Trend | price | hynaxiii | batch 10 |
| 202 | Darvas Box | `darvas-box` | Candlestick Patterns | price |  |  |
| 203 | DECODE Moving Average Toolkit | `decode-moving-average-toolkit` | Moving Averages | price | decodejar | batch 20 |
| 204 | Delta Volume RSI | `delta-volume-rsi` | Volume | own | destrobr0685 | batch 24 |
| 205 | Delta-RSI Oscillator | `delta-rsi-oscillator` | Momentum | own | tbiktag (simplified) |  |
| 206 | DEMA Flow | `dema-flow` | Trend | price | AlphaExtract | batch 7 |
| 207 | Deviation Symmetry Breaker ~ C H I P A | `deviation-symmetry-breaker-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 18 |
| 208 | Directional Indicator Crossovers v1 | `directional-indicator-crossovers-v1` | Trend | own | JopAlgo | batch 7 |
| 209 | Directional Logistic Oscillator | `directional-logistic-oscillator` | Oscillators | own | GainzAlgo | batch 2 |
| 210 | Directional Movement Index + ADX & Key Levels | `dmi-adx-levels` | Trend | own |  |  |
| 211 | Disparity Index | `disparity-index` | Oscillators | own | HPotter | batch 10 |
| 212 | Divergence Indicator | `divergence-indicator` | Momentum | price |  |  |
| 213 | Dominance Signal Apex | `dominance-signal-apex` | Trend | price | chervolino | batch 17 |
| 214 | Donchian Trend Ribbon | `donchian-trend-ribbon` | Trend | own | LonesomeTheBlue |  |
| 215 | Dope DPO | `dope-dpo` | Oscillators | own | Sherlock_MacGyver | batch 14 |
| 216 | Double Median ATR Bands \| MisinkoMaster | `double-median-atr-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 28 |
| 217 | Double RSI | `double-rsi` | Momentum | own | Clokivez | batch 9 |
| 218 | Dual Bayesian For Loop | `dual-bayesian-for-loop` | Momentum | own | QuantAlgo | batch 5 |
| 219 | Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation) | `dual-ema-trend-ribbon` | Moving Averages | price | Aleksin_Aleksandar | batch 3 |
| 220 | Dual MA SD Oscillator | `dual-ma-sd-oscillator` | Oscillators | own | SchizoQuant | batch 9 |
| 221 | Dual RSI Smoother | `dual-rsi-smoother` | Oscillators | own | TheUltimator5 | batch 8 |
| 222 | Dynamic Flow Ribbons | `dynamic-flow-ribbons` | Trend | price | BigBeluga | batch 2 |
| 223 | Dynamic Fractal Flow | `dynamic-fractal-flow` | Oscillators | own | AlphaExtract | batch 21 |
| 224 | Dynamic Score PSAR | `dynamic-score-psar` | Trend | own | QuantAlgo | batch 8 |
| 225 | Dynamic Stop Loss & Take Profit | `dynamic-stop-loss-take-profit` | Volatility | price | criptoblast2 | batch 23 |
| 226 | Dynamic Structure Indicator | `dynamic-structure-indicator` | Trend | price |  |  |
| 227 | Dynamic Support & Resistance | `dynamic-support-resistance` | Moving Averages | price | ZenAndTheArtOfTrading | batch 1 |
| 228 | Dynamic Testing | `dynamic-testing` | Oscillators | price | ProfitNomad | batch 9 |
| 229 | Dynamic Trailing | `dynamic-trailing` | Trend | price | Zeiierman | batch 5 |
| 230 | Dynamic Trend Bands | `dynamic-trend-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 231 | Dynamic Trend Channel (DTC) | `dynamic-trend-channel` | Channels & Bands | price | JohnsonForexTrader | batch 27 |
| 232 | Dynamic Volatility Filter | `dynamic-volatility-filter` | Trend | price | QuantAlgo | batch 4 |
| 233 | Dynamic Volume Clusters with Retest Signals | `dynamic-volume-clusters` | Channels & Bands | price | Zeiierman | batch 2 |
| 234 | Dynamic Volume Profile Oscillator | `dynamic-volume-profile-oscillator` | Volume | own | AlphaNatt | batch 1 |
| 235 | Early MACD Reversal Indicator | `early-macd-reversal-indicator` | Momentum | own | StockSignaler | batch 10 |
| 236 | Easy Entry/Exit Trend Colors | `easy-trend-colors` | Trend | own |  |  |
| 237 | Edward Smart Channel Reversal | `edward-smart-channel-reversal` | Channels & Bands | price | Jos-ProTrader | batch 13 |
| 238 | Efficiency Ratio Trend | `efficiency-ratio-trend` | Trend | price | achirameegasthanne | batch 9 |
| 239 | Ehlers Adaptive RSI | `ehlers-adaptive-rsi` | Oscillators | own | Julien_Exe | batch 14 |
| 240 | Ehlers Adaptive Trend Indicator | `ehlers-adaptive-trend-indicator` | Trend | price | AlphaExtract | batch 18 |
| 241 | Ehlers Instantaneous Trend | `ehlers-instantaneous-trend` | Trend | price |  |  |
| 242 | Ehlers MESA Adaptive Moving Average | `ehlers-mesa-ma` | Moving Averages | price | Ehlers |  |
| 243 | Ehlers Stochastic CG Oscillator | `ehlers-stochastic-cg` | Oscillators | own |  |  |
| 244 | Elliott Wave Oscillator | `elliott-wave-oscillator` | Oscillators | own | Koryu |  |
| 245 | Elliptic Curve SAR | `elliptic-curve-sar` | Trend | price | TEDCORP2 | batch 26 |
| 246 | EMA & MA Crossover | `ema-ma-crossover` | Moving Averages | price |  |  |
| 247 | EMA & MACD Strategy with SL/TP | `ema-macd-strategy-with-sl-tp` | Trend | price | mamachi- | batch 28 |
| 248 | EMA + RSI Autotrade Webhook - Varun | `ema-rsi-autotrade-webhook-varun` | Moving Averages | price | varuns_back | batch 17 |
| 249 | EMA + SuperTrend | `ema-supertrend` | Moving Averages | price | All_in_Traders |  |
| 250 | EMA + VWMA + ATR Smoothed BuySell (merged) - TOM ZENG 202509 | `ema-vwma-atr-smoothed-buysell-tom-zeng-202509` | Trend | price | zengtom | batch 18 |
| 251 | EMA 20/50/100/200 | `ema-multi` | Moving Averages | price |  |  |
| 252 | EMA 9 / 26 Cross | `ema-9-26-cross` | Moving Averages | price | h0s1m001 | batch 27 |
| 253 | EMA Cloud Trend | `ema-cloud-trend` | Moving Averages | price | ZkalishTR | batch 9 |
| 254 | EMA Enveloper | `ema-enveloper` | Moving Averages | price |  |  |
| 255 | EMA Oscillator | `ema-oscillator` | Oscillators | own | AlphaExtract | batch 16 |
| 256 | EMA Ribbon | `ema-ribbon` | Moving Averages | price |  |  |
| 257 | EMA Wave Indicator | `ema-wave` | Moving Averages | own |  |  |
| 258 | EMA/RMA clouds by Alpachino | `ema-rma-clouds-by-alpachino` | Moving Averages | price | Alpachino97 | batch 28 |
| 259 | EMA21 Pullback Buy | `ema21-pullback-buy` | Moving Averages | price | Kennedy08 | batch 23 |
| 260 | Enhanced KLSE Banker Flow Oscillator | `enhanced-klse-banker-flow-oscillator` | Oscillators | own | Dr_Leong_Yee_Rock | batch 15 |
| 261 | Enhanced VFI Buyer/Seller Pressure | `enhanced-vfi-buyer-seller-pressure` | Volume | own | ask2maniish | batch 28 |
| 262 | Enhanced VSA Volume & Candle Colors with MA Selection | `enhanced-vsa-volume-candle-colors-with-ma-selection` | Volume | own | ViZiV | batch 27 |
| 263 | Entropy Bands | `entropy-bands` | Channels & Bands | price | TechnoBlooms | batch 20 |
| 264 | Entry Points | `entry-points` | Oscillators | price |  |  |
| 265 | Entry Signals (Long/Short) | `entry-signals-long-short` | Trend | price | tradegear9 | batch 1 |
| 266 | Envelope RSI | `envelope-rsi` | Oscillators | price | Saleh_Toodarvari |  |
| 267 | Equalhigh JAPANESE TRIPLE RCI | `equalhigh-japanese-triple-rci` | Oscillators | own | Stevesyl | batch 22 |
| 268 | Euclidean Range | `euclidean-range` | Volatility | own | InvestorUnknown | batch 21 |
| 269 | EVWMA Envelope | `evwma-envelope` | Oscillators | price |  |  |
| 270 | Exhaustion Zone | `exhaustion-zone` | Channels & Bands | price | rukich | batch 6 |
| 271 | Faith Indicator | `faith-indicator` | Trend | own |  |  |
| 272 | False Breakout (Expo) | `false-breakout` | Channels & Bands | price | Zeiierman |  |
| 273 | Fast Length | `bjorgum-triple-ema` | Moving Averages | price |  |  |
| 274 | Fast WMA | `fast-wma` | Moving Averages | own | Clokivez | batch 25 |
| 275 | Fibonacci Bollinger Bands | `fibonacci-bollinger-bands` | Channels & Bands | price | Rashad |  |
| 276 | Fibonacci HH LL TRAMA Band | `fibonacci-hh-ll-trama-band` | Channels & Bands | price | FibonacciFlux | batch 16 |
| 277 | Fibonacci Levels | `fibonacci-levels` | Channels & Bands | price |  |  |
| 278 | Fibonacci Moving Averages | `fibonacci-moving-averages` | Moving Averages | price | UkutaLabs | batch 28 |
| 279 | Fibonacci Weighted Moving Average | `fibonacci-weighted-moving-average` | Moving Averages | price | everget | batch 12 |
| 280 | Fibonacci Zone | `fibonacci-zone` | Channels & Bands | price |  |  |
| 281 | Filter Ribbon | `filter-ribbon` | Trend | price | c9indicator | batch 4 |
| 282 | Filter Wave | `filter-wave` | Trend | price | c9indicator | batch 15 |
| 283 | Fisher Volume Transform \| AlphaNatt | `fisher-volume-transform-alphanatt` | Oscillators | own | AlphaNatt | batch 16 |
| 284 | Fixed-Range Volume-Profile Zones | `fixed-range-volume-profile-zones` | Volume | own | RWCS_LTD | batch 13 |
| 285 | Flow Control Oscillator (FCO) | `flow-control-oscillator` | Volume | own | WalrusQuant | batch 19 |
| 286 | FlowShift Oscillator | `flowshift-oscillator` | Oscillators | own | BOSWaves | batch 24 |
| 287 | Follow Line | `follow-line` | Trend | price | Dreadblitz |  |
| 288 | Force Pulse | `force-pulse` | Oscillators | own | Uncle_the_shooter | batch 17 |
| 289 | Forecast Oscillator | `forecast-oscillator` | Oscillators | own | KivancOzbilgic |  |
| 290 | Forex Sessions | `forex-sessions` | Oscillators | own |  |  |
| 291 | Fourier series Model Of The Market | `fourier-series-model-of-the-market` | Oscillators | own | e2e4 | batch 12 |
| 292 | Fractal Exhaustion Band | `fractal-exhaustion-band` | Trend | price | QuantAlgo | batch 2 |
| 293 | Fractal Strength Oscillator | `fractal-strength-oscillator` | Oscillators | own | SurgeQuant | batch 20 |
| 294 | Fractals Trend | `fractals-trend` | Trend | price | BigBeluga | batch 2 |
| 295 | Fractional EMA Kalman Filter | `fractional-ema-kalman-filter` | Moving Averages | price | et20tradeview | batch 4 |
| 296 | FSVZO | `fsvzo` | Volume | own | AlphaExtract | batch 5 |
| 297 | FVG Positioning Average | `fvg-positioning-average` | Trend | price | LuxAlgo |  |
| 298 | FX Sniper T3-CCI | `fx-sniper-t3-cci` | Oscillators | own |  |  |
| 299 | FxShare - CC Reversal | `fxshare-cc-reversal` | Trend | price | FxShareRobots | batch 22 |
| 300 | G-Score \| NAL | `g-score-nal` | Oscillators | own | NordicAlphaLab | batch 13 |
| 301 | Gabriel's Andean Oscillator | `gabriel-s-andean-oscillator` | Trend | own | GabrielAmadeusLau | batch 23 |
| 302 | Gamma + Fibonacci EMA Bands | `gamma-fibonacci-ema-bands` | Moving Averages | price | ky_yule1010 | batch 23 |
| 303 | Gamma Hedging Pressure (Normalized -100 to +100) | `gamma-hedging-pressure` | Momentum | own | uzair2join | batch 20 |
| 304 | Gann High Low | `gann-high-low` | Trend | price | KivancOzbilgic |  |
| 305 | GANN Level (Salil Sir) | `gann-level` | Channels & Bands | price | prabhat76 | batch 12 |
| 306 | Gaussian Filter Trend | `gaussian-filter-trend` | Trend | price | QuantAlgo | batch 2 |
| 307 | Gaussian Ribbon | `gaussian-ribbon` | Moving Averages | price | NantzOS | batch 13 |
| 308 | Gaussian RSI \| NAL | `gaussian-rsi-nal` | Momentum | own | NordicAlphaLab | batch 7 |
| 309 | GMMA Oscillator | `gmma-oscillator` | Trend | own |  |  |
| 310 | Golden & Death Cross with Re-Activation | `golden-death-cross-with-re-activation` | Moving Averages | price | oberlunar_tr | batch 26 |
| 311 | Golden Ratio Trend Persistence | `golden-ratio-trend-persistence` | Trend | price | YetAnotherTA | batch 9 |
| 312 | Gradient Trend Filter | `gradient-trend-filter` | Trend | price | ChartPrime | batch 1 |
| 313 | Granville Entry Guide | `granville-entry-guide` | Moving Averages | price | fightpm | batch 17 |
| 314 | Gravity Well Trend \| Lyro RS | `gravity-well-trend-lyro-rs` | Trend | price | LyroRS | batch 10 |
| 315 | Gridbot Ping Pong | `gridbot-ping-pong` | Channels & Bands | price | xxattaxx | batch 18 |
| 316 | Guppy MMA | `guppy-mma` | Moving Averages | own | AlphaExtract | batch 15 |
| 317 | Guppy Multiple Moving Average | `gmma` | Moving Averages | price | Daryl Guppy |  |
| 318 | Guppy Wave | `guppy-wave` | Moving Averages | price | UkutaLabs | batch 25 |
| 319 | GWAP (Gamma Weighted Average Price) | `gwap` | Moving Averages | price | EdgeTools | batch 18 |
| 320 | H-Infinity Volatility Filter | `h-infinity-volatility-filter` | Trend | price | QuantAlgo | batch 7 |
| 321 | HalfTrend | `half-trend` | Trend | price | everget |  |
| 322 | HaP MACD | `hap-macd` | Momentum | own | agahakanaga | batch 1 |
| 323 | Harmonic Sniper Trigger - PyraTime | `harmonic-sniper-trigger-pyratime` | Oscillators | own | PyraTime | batch 27 |
| 324 | HawkEye Volume | `hawkeye-volume` | Volume | own |  |  |
| 325 | Heatmap Volume | `heatmap-volume` | Volume | own | xdecow |  |
| 326 | Heiken Ashi Ribbon | `heiken-ashi-ribbon` | Trend | price | UkutaLabs | batch 21 |
| 327 | Heikin Ashi RSI Oscillator | `heikin-ashi-rsi-oscillator` | Momentum | own | JayRogers |  |
| 328 | HEMA Trend Levels | `hema-trend-levels` | Trend | price | AlgoAlpha |  |
| 329 | High Volume Arrow Signals (Ajustável) | `high-volume-arrow-signals` | Volume | price | IdeManson | batch 24 |
| 330 | Hilega-Milega-RSI-EMA-WMA indicator designed by NK | `hilega-milega-rsi-ema-wma-indicator-designed-by-nk` | Oscillators | own | kshirsagar_n | batch 14 |
| 331 | Historical Liquidity Proximity Heatmap | `liquidity-proximity-heatmap` | Volume | price | LuxAlgo | batch 3 |
| 332 | HMA Breakdown | `hma-breakdown` | Moving Averages | price | NonLinearRookie | batch 11 |
| 333 | HOTT LOTT | `hott-lott` | Trend | price | KivancOzbilgic |  |
| 334 | HPDR Bands Indicator | `hpdr-bands-indicator` | Channels & Bands | price | afonso_77 | batch 23 |
| 335 | HTC peppermint_07 CCI w signal + s&r RSI | `htc-peppermint-07-cci-w-signal-s-r-rsi` | Oscillators | own | peppermint07 | batch 14 |
| 336 | HTH - WD Gann Square Root Levels | `hth-wd-gann-square-root-levels` | Channels & Bands | price | tamillselvan | batch 27 |
| 337 | Hull Butterfly Oscillator | `hull-butterfly-oscillator` | Momentum | own |  |  |
| 338 | Hull Suite | `hull-suite` | Trend | price |  |  |
| 339 | Hurst-Based Trend Persistence w/Poisson Prediction | `hurst-based-trend-persistence-w-poisson-prediction` | Oscillators | own | garysebastianbrowniii | batch 28 |
| 340 | HyperTrend [LuxAlgo] | `hyper-trend` | Trend | price | LuxAlgo |  |
| 341 | Ichimoku ACE Club | `ichimoku-ace-club` | Trend | price | binhmyco | batch 26 |
| 342 | Ichimoku EMA Bands | `ichimoku-ema-bands` | Channels & Bands | price |  |  |
| 343 | Ichimoku w/Heikin-Ashi | `ichimoku-w-heikin-ashi` | Trend | price | yasujiy | batch 25 |
| 344 | ICT & RTM Price Action Indicator | `ict-rtm-price-action-indicator` | Channels & Bands | price | behradmojtahedi | batch 21 |
| 345 | ICT FVG Buy/Sell Signals | `ict-fvg-buy-sell-signals` | Trend | price | svmstellarvisionmedia | batch 5 |
| 346 | Ideal Entry Point | `ideal-entry-point` | Trend | price |  |  |
| 347 | IFT Stoch RSI CCI | `ift-stoch-rsi-cci` | Momentum | own | KivancOzbilgic |  |
| 348 | IIR One-Pole Price Filter | `iir-one-pole-price-filter` | Moving Averages | price | BackQuant | batch 9 |
| 349 | Impulse MACD | `impulse-macd` | Momentum | own | LazyBear |  |
| 350 | Indicador Millo SMA20-SMA200-AO-RSI M1 | `indicador-millo-sma20-sma200-ao-rsi-m1` | Moving Averages | price | hernangarcia_78 | batch 19 |
| 351 | Infinite EMA with Alpha Control | `infinite-ema-with-alpha-control` | Moving Averages | price | Sesilya | batch 13 |
| 352 | Inside Bars (Multiple / Consecutive) | `inside-bars` | Channels & Bands | price | nilstrades_ | batch 5 |
| 353 | Instantaneous Trendline with Cloud | `instantaneous-trendline-with-cloud` | Trend | price | Sesilya | batch 22 |
| 354 | Institutional Composite Moving Average (ICMA) | `institutional-composite-moving-average` | Moving Averages | price | VolumeVigilante | batch 6 |
| 355 | Institutional MACD (Z-Score Edition) | `institutional-macd` | Momentum | own | VolumeVigilante | batch 4 |
| 356 | Institutional Volume RSI | `institutional-volume-rsi` | Momentum | own | abgthecoder | batch 6 |
| 357 | Interpolated Median Volatility LSMA \| Otto | `interpolated-median-volatility-lsma-otto` | Channels & Bands | price | oquant | batch 12 |
| 358 | Intraday BUY_SELL | `intraday-buy-sell` | Trend | price |  |  |
| 359 | Intraday TS BB | `intraday-ts-bb` | Oscillators | price |  |  |
| 360 | Intraday Volume Swings | `intraday-volume-swings` | Volume | price | rumpypumpydumpy |  |
| 361 | Intraday vs Overnight Change Tracker | `intraday-vs-overnight-change-tracker` | Momentum | own | TheUltimator5 | batch 12 |
| 362 | Intraday vs Overnight OBV | `intraday-vs-overnight-obv` | Volume | own | TheUltimator5 | batch 21 |
| 363 | Inverse Distance Weighted Moving Average | `inverse-distance-weighted-moving-average` | Moving Averages | price | everget | batch 15 |
| 364 | IPO Date Screener | `ipo-date-screener` | Oscillators | own | starshiptrade | batch 14 |
| 365 | Is it Time for a Pullback? Check Bars Since MA Test | `is-it-time-for-a-pullback-check-bars-since-ma-test` | Trend | own | TradeStation | batch 25 |
| 366 | Isolated Peak and Bottom | `isolated-peak-bottom` | Oscillators | price |  |  |
| 367 | IU Mean Reversion System | `iu-mean-reversion-system` | Channels & Bands | price | Shivam_Mandrai | batch 12 |
| 368 | IU Smart Flow System | `iu-smart-flow-system` | Trend | price | Shivam_Mandrai | batch 7 |
| 369 | Jurik Moving Average | `jurik-moving-average` | Moving Averages | price | everget | batch 1 |
| 370 | Kalman Ema Crosses | `kalman-ema-crosses` | Moving Averages | price | JTCapitalNL | batch 16 |
| 371 | Kalman Exponentialy Weighted Moving Average \| MisinkoMaster | `kalman-exponentialy-weighted-moving-average-misinkomaster` | Moving Averages | price | MisinkoMaster | batch 25 |
| 372 | Kalman Flow \| Lyro RS | `kalman-flow-lyro-rs` | Trend | price | LyroRS | batch 5 |
| 373 | Kalman Hull Bands For Loop \| RakoQuant | `kalman-hull-bands-for-loop-rakoquant` | Channels & Bands | price | RakoQuant | batch 17 |
| 374 | Kalman Hull Kijun | `kalman-hull-kijun` | Trend | price | BackQuant | batch 12 |
| 375 | Kalman VWAP Filter | `kalman-vwap-filter` | Moving Averages | price | BackQuant | batch 4 |
| 376 | Kaufman Adaptive Moving Average | `kaufman-adaptive-ma` | Moving Averages | price | everget |  |
| 377 | KD-NewAutoTrade for Future Trading - Heikin Ashi candles | `kd-newautotrade-for-future-trading-heikin-ashi-candles` | Trend | price | krish16887 | batch 22 |
| 378 | KDJ | `kdj` | Oscillators | own | KingThies |  |
| 379 | Keltner-Aroon-EFI Flow | `keltner-aroon-efi-flow` | Trend | price | D_QUANT | batch 20 |
| 380 | Kernel Channel | `kernel-channel` | Channels & Bands | price | BackQuant | batch 6 |
| 381 | KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density | `kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density` | Volatility | own | SensitiveSuit | batch 15 |
| 382 | Keyzone | `keyzone` | Channels & Bands | price | Uttaya | batch 28 |
| 383 | Kinetic Slippage Index (KSI) | `kinetic-slippage-index` | Volume | own | HPotter | batch 7 |
| 384 | L2 Risk Assessment for Trend Strength | `l2-risk-assessment-for-trend-strength` | Trend | own | blackcat1402 | batch 14 |
| 385 | Laguerre Filter | `laguerre-filter` | Moving Averages | price | BackQuant | batch 5 |
| 386 | Laguerre RSI | `laguerre-rsi` | Momentum | own | TheLark |  |
| 387 | Laguerre Ultimate Explorations Multicator | `laguerre-ultimate-explorations-multicator` | Moving Averages | own | ImmortalFreedom | batch 20 |
| 388 | Laguerre-Kalman Adaptive Filter \| AlphaNatt | `laguerre-kalman-adaptive-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 11 |
| 389 | Left Bars | `pivot-hh-hl-lh-ll` | Trend | price |  |  |
| 390 | Leledc Levels | `leledc-levels` | Candlestick Patterns | price |  |  |
| 391 | Length | `gaussian-channel` | Channels & Bands | price |  |  |
| 392 | Length | `redk-vader` | Oscillators | own | RedKTrader |  |
| 393 | Length | `zlma-trend-levels` | Moving Averages | price |  |  |
| 394 | Level2 Signalfilter Liquidity Protection | `level2-signalfilter-liquidity-protection` | Trend | own | djmad | batch 16 |
| 395 | LGMM (flat buffers) - multivariate poly + latent states | `lgmm-multivariate-poly-latent-states` | Channels & Bands | price | vsov | batch 28 |
| 396 | Linear Predictive Filters (TASC 2025.01) | `linear-predictive-filters` | Oscillators | own | PineCodersTASC | batch 2 |
| 397 | Linear Regression Candles | `linear-regression-candles` | Candlestick Patterns | price |  |  |
| 398 | Linear Regression Channel | `linear-regression-channel` | Channels & Bands | price |  |  |
| 399 | Linear Regression Volume \| Lyro RS | `linear-regression-volume-lyro-rs` | Channels & Bands | price | LyroRS | batch 10 |
| 400 | Linear Volume MACD \| Lyro RS | `linear-volume-macd-lyro-rs` | Momentum | own | LyroRS | batch 9 |
| 401 | LineReg Candles with Hma filter | `linereg-candles-with-hma-filter` | Trend | price | MaximusGains | batch 14 |
| 402 | Liquidity Flow Zones (LFZ) | `liquidity-flow-zones` | Trend | price | ReubenMiles | batch 20 |
| 403 | Liquidity Grabs | `liquidity-grabs` | Trend | price | fluxchart |  |
| 404 | Liquidity Indicator | `liquidity-indicator` | Channels & Bands | price | The_Forex_Steward | batch 22 |
| 405 | Liquidity Levels [LuxAlgo] | `liquidity-levels` | Trend | price | LuxAlgo |  |
| 406 | Liquidity Sentiment Profile \| LUPEN | `liquidity-sentiment-profile-lupen` | Volume | own | Horazio | batch 20 |
| 407 | Liquidity Sweeps [LuxAlgo] | `liquidity-sweeps` | Trend | price |  |  |
| 408 | Liquidity Trap & Reversal bot | `liquidity-trap-reversal-bot` | Channels & Bands | price | pointalgo | batch 28 |
| 409 | Loacally Weighted MA (LWMA) Direction Histogram | `loacally-weighted-ma-direction-histogram` | Trend | own | LuxmiAI | batch 9 |
| 410 | Logit RSI | `logit-rsi` | Oscillators | own | AdaptiveRSI | batch 11 |
| 411 | Long Short dom | `long-short-dom` | Trend | own | Robin-Hood-trading | batch 11 |
| 412 | Lorentzian Length Adaptive Moving Average | `lorentzian-length-adaptive-moving-average` | Moving Averages | price | Starcruiser | batch 21 |
| 413 | Lumina Trend Channels | `lumina-trend-channels` | Channels & Bands | price | Pineify | batch 10 |
| 414 | Luminous Mean Reversion Channels | `luminous-mean-reversion-channels` | Channels & Bands | price | Pineify | batch 7 |
| 415 | Lunar Phase (LUNAR) | `lunar-phase` | Oscillators | own | mihakralj | batch 23 |
| 416 | MA Cross with Displacement | `ma-cross-with-displacement` | Moving Averages | price | TehThomas | batch 25 |
| 417 | MA Shaded Fill Crossover | `ma-shaded-fill` | Moving Averages | price |  |  |
| 418 | MA Strategy Emperor | `ma-strategy-emperor` | Trend | price | insiliconot |  |
| 419 | MA Type | `madrid-ma-ribbon` | Moving Averages | price |  |  |
| 420 | MA Zones | `ma-zones` | Moving Averages | price | ZenAndTheArtOfTrading | batch 7 |
| 421 | MACD (Buy & Sell signals) | `macd-irtov` | Momentum | own | irtov | batch 24 |
| 422 | Macd + Adx Pro by @Eternyworld | `macd-adx-pro-by-eternyworld` | Momentum | own | ETERNYWORLD | batch 26 |
| 423 | MACD 4C | `macd-4c` | Momentum | own | vkno422 |  |
| 424 | MACD Crossover | `macd-crossover` | Momentum | own |  |  |
| 425 | MACD DEMA | `macd-dema` | Momentum | own |  |  |
| 426 | MACD Divergence | `macd-divergence` | Momentum | own |  |  |
| 427 | MACD Dynamic Squeeze Pro | `macd-dynamic-squeeze-pro` | Momentum | own | ZynAlgo | batch 24 |
| 428 | MACD Leader | `macd-leader` | Momentum | own | LazyBear |  |
| 429 | MACD Overlay v1 | `macd-overlay-v1` | Momentum | price | JopAlgo | batch 5 |
| 430 | MACD Pro | `macd-pro` | Momentum | own | VEGAlgo | batch 23 |
| 431 | MACD ReLoaded | `macd-reloaded` | Momentum | own | KivancOzbilgic |  |
| 432 | MACD Sniper | `macd-sniper` | Momentum | own | trade_lexx | batch 15 |
| 433 | MACD Support and Resistance [ChartPrime] | `macd-support-resistance` | Momentum | own | ChartPrime |  |
| 434 | MACD VXI | `macd-vxi` | Momentum | own |  |  |
| 435 | MACD With Crossings and Above Below Zero | `macd-with-crossings-and-above-below-zero` | Momentum | own | Kgroomes | batch 18 |
| 436 | MACD x BB x STDEV x RVI | `macd-x-bb-x-stdev-x-rvi` | Oscillators | own | Vaquant | batch 20 |
| 437 | MACD XD | `macd-xd` | Momentum | own | Zen_Formless | batch 8 |
| 438 | MACD-V (Volatility Normalized MACD) | `macd-v` | Momentum | own | KivancOzbilgic | batch 2 |
| 439 | MACD-V with Volatility Normalisation | `macd-v-with-volatility-normalisation` | Momentum | own | DutchCryptoDad | batch 25 |
| 440 | MACD1 Fast | `double-macd` | Momentum | own |  |  |
| 441 | MACDAS | `macdas` | Momentum | own |  |  |
| 442 | Machine Learning: kNN Trend Predictor | `machine-learning-knn-trend-predictor` | Trend | price | tkarolak | batch 11 |
| 443 | Madrid Trend Squeeze | `madrid-trend-squeeze` | Momentum | own |  |  |
| 444 | Mark Minervini Buy Signal | `mark-minervini-buy-signal` | Trend | price | Dr_Leong_Yee_Rock | batch 18 |
| 445 | Market Cipher A | `market-cipher-a` | Oscillators | price |  |  |
| 446 | Market Cipher B | `market-cipher-b` | Oscillators | own |  |  |
| 447 | Market Pressure Oscillator | `market-pressure-oscillator` | Oscillators | own | Uncle_the_shooter | batch 8 |
| 448 | Market Shift Levels | `market-shift-levels` | Trend | price |  |  |
| 449 | Market Structure Trailing Stop | `market-structure-trailing-stop` | Trend | price | LuxAlgo |  |
| 450 | Market Structure Trend | `market-structure-trend` | Trend | price | QuantAlgo | batch 12 |
| 451 | Matrix Series | `matrix-series` | Oscillators | own |  |  |
| 452 | MavilimW | `mavilimw` | Trend | price | KivancOzbilgic |  |
| 453 | Mean Angles | `mean-angles` | Momentum | own | bharatTrader | batch 9 |
| 454 | Measured Pattern Move (Bulkowski) | `measured-pattern-move` | Trend | price | Steversteves | batch 28 |
| 455 | Median Gaussian Trend \| NAL | `median-gaussian-trend-nal` | Trend | price | NordicAlphaLab | batch 15 |
| 456 | Median MACD - Mattes | `median-macd-mattes` | Momentum | own | Mattes00 | batch 8 |
| 457 | MESA Adaptive Ehlers Flow \| AlphaNatt | `mesa-adaptive-ehlers-flow` | Moving Averages | price | AlphaNatt | batch 8 |
| 458 | MESA Phase-Adaptive Band Trend | `mesa-phase-adaptive-band-trend` | Trend | price | SchizoQuant | batch 22 |
| 459 | MFI Nexus Pro | `mfi-nexus-pro` | Volume | own | trade_lexx | batch 10 |
| 460 | MFI/RSI Bollinger Bands | `mfi-rsi-bb` | Oscillators | own |  |  |
| 461 | Mid-term Ribbon | `mid-term-ribbon` | Moving Averages | price | Gartav388637 | batch 25 |
| 462 | ML Adaptive SuperTrend | `ml-adaptive-supertrend` | Trend | price |  |  |
| 463 | ML Momentum Index | `ml-momentum-index` | Momentum | own |  |  |
| 464 | ML Moving Average | `ml-moving-average` | Moving Averages | price |  |  |
| 465 | ML RSI | `ml-rsi` | Momentum | own |  |  |
| 466 | ML: kNN Strategy | `ml-knn-strategy` | Momentum | own |  |  |
| 467 | Modified Heikin-Ashi | `modified-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 468 | Momentum-based ZigZag | `momentum-zigzag` | Trend | price | Peter_O |  |
| 469 | Money Flow Extended | `money-flow-extended` | Volume | own | alexrainman | batch 6 |
| 470 | Moneyball EMA-MACD indicator | `moneyball-ema-macd-indicator` | Momentum | own | VinnieTheFish | batch 6 |
| 471 | Monotonic Trend Consensus | `monotonic-trend-consensus` | Trend | own | QuantAlgo | batch 16 |
| 472 | Moving Average ADX | `ma-adx` | Moving Averages | price |  |  |
| 473 | Moving Average Colored | `ma-colored` | Moving Averages | price |  |  |
| 474 | Moving Average Converging | `ma-converging` | Moving Averages | price | LuxAlgo |  |
| 475 | Moving Average Crossover with Shading Signals | `moving-average-crossover-with-shading-signals` | Moving Averages | price | Decam9 | batch 12 |
| 476 | Moving Average Deviation Rate | `ma-deviation-rate` | Moving Averages | own |  |  |
| 477 | Moving Average Shift | `ma-shift` | Moving Averages | price |  |  |
| 478 | Moving Averages With Continuous Periods | `moving-averages-with-continuous-periods` | Moving Averages | price | The_Peaceful_Lizard | batch 15 |
| 479 | Moving VWAP-KAMA Cloud | `moving-vwap-kama-cloud` | Moving Averages | price | SovereignCharts | batch 12 |
| 480 | MPO4 Lines – Modal Engine | `mpo4-lines-modal-engine` | Oscillators | own | Uncle_the_shooter | batch 15 |
| 481 | mr.crypto731 | `mr-crypto731` | Momentum | own | Ali_Smith | batch 20 |
| 482 | MSL Squeeze Pulse | `msl-squeeze-pulse` | Volatility | own | MarketStructureLab | batch 16 |
| 483 | Multi-Band Trend Line | `multi-band-trend-line` | Trend | price | Mr_Rakun | batch 4 |
| 484 | Multi-Oscillator Adaptive Kernel \| AlphaAlgos | `multi-oscillator-adaptive-kernel-alphaalgos` | Oscillators | own | AlphaNatt | batch 4 |
| 485 | Multiple Divergences | `multiple-divergences` | Momentum | price | PeterO |  |
| 486 | Multiple Exponential Fibnonacci Moving Averages | `multiple-exponential-fibnonacci-moving-averages` | Moving Averages | price | LensOfChartist | batch 13 |
| 487 | Multiple Moving Averages | `multiple-ma` | Moving Averages | price |  |  |
| 488 | Multiple RSI | `multiple-rsi` | Oscillators | own | PrasadJoshi12 | batch 19 |
| 489 | MurreysOscillator | `murreys-math-osc` | Oscillators | own |  |  |
| 490 | My auto dual avwap with Auto swing low/pivot low finder | `my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder` | Volume | price | doqkhanh | batch 22 |
| 491 | Nadaraya-Watson Trend | `nadaraya-watson-trend` | Trend | price | QuantAlgo | batch 1 |
| 492 | Neighboring Price Bands | `neighboring-price-bands` | Channels & Bands | price | LuxAlgo | batch 21 |
| 493 | NLMS Volatility Trail | `nlms-volatility-trail` | Trend | price | BackQuant | batch 4 |
| 494 | Normalized QQE | `normalized-qqe` | Oscillators | own |  |  |
| 495 | Nova Statistical Filtering Oscillator | `nova-statistical-filtering-oscillator` | Oscillators | own | Pineify | batch 27 |
| 496 | NY ORB + Fakeout Detector | `ny-orb-fakeout-detector` | Channels & Bands | price | STEFANGAS | batch 27 |
| 497 | OA - SMES | `oa-smes` | Oscillators | own | onurag | batch 4 |
| 498 | OBV & AD Oscillators with Dual Smoothing Options | `obv-ad-oscillators-with-dual-smoothing-options` | Volume | own | hollowwick (indicator title "OBV, AD, VPT & CDV | batch 27 |
| 499 | OBV + Custom MA Strategy | `obv-custom-ma-strategy` | Volume | own | Rafiki-is-Trading | batch 14 |
| 500 | OBV MACD | `obv-macd` | Volume | own |  |  |
| 501 | OBV Oscillator | `obv-oscillator` | Volume | own |  |  |
| 502 | Open Close Cross | `open-close-cross` | Momentum | own | JustUncleL |  |
| 503 | Optimized Trend Tracker | `optimized-trend-tracker` | Trend | price | KivancOzbilgic |  |
| 504 | Order Blocks with Signals | `order-blocks-signals` | Trend | price | ClayeWeight |  |
| 505 | Oscillator Matrix | `oscillator-matrix` | Oscillators | own | AlphaExtract | batch 6 |
| 506 | Parabolic Stoch SAR Visualizer | `parabolic-stoch-sar-visualizer` | Oscillators | own | BOSWaves | batch 24 |
| 507 | Parallel Pivot Lines | `parallel-pivot-lines` | Channels & Bands | price | LuxAlgo |  |
| 508 | Peak Reversal v2 | `peak-reversal-v2` | Channels & Bands | price | Zettt | batch 11 |
| 509 | Peak Reversal v3 | `peak-reversal-v3` | Channels & Bands | price | Zettt | batch 21 |
| 510 | Percent Off All-time High (% Off High) | `percent-off-all-time-high` | Oscillators | own | xHmmmmm | batch 19 |
| 511 | Percentile Rank Oscillator (Price + VWMA) | `percentile-rank-oscillator` | Oscillators | own | exploretranspose | batch 26 |
| 512 | Percentile-Based BB% Trend - Mattes | `percentile-based-bb-trend-mattes` | Oscillators | own | Mattes00 | batch 7 |
| 513 | Perfect RSI | `perfect-rsi` | Oscillators | own | HabibiBudo | batch 26 |
| 514 | Philakone 55 EMA Swing Trading | `philakone-ema-swing` | Moving Averages | price |  |  |
| 515 | Pipstocrat Market Participant Analysis | `pipstocrat-market-participant-analysis` | Momentum | own | Delast2 | batch 23 |
| 516 | Pivot Based Trailing Maxima & Minima | `pivot-trailing-maxmin` | Channels & Bands | price | LuxAlgo |  |
| 517 | Pivot Breakout High&Low Signals | `pivot-breakout-high-low-signals` | Trend | price | Jos-ProTrader | batch 3 |
| 518 | Pivot Market Structure | `pivot-market-structure` | Trend | price | Daniel_Ge | batch 11 |
| 519 | Pivot Oscillator | `pivot-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 520 | Pivot Point SuperTrend | `pivot-point-supertrend` | Trend | price | LonesomeTheBlue |  |
| 521 | Pivot Trend | `pivot-trend` | Trend | price | ChartPrime | batch 1 |
| 522 | POC Volume Bar (Highest Volume in Range) | `poc-volume-bar` | Volume | own | greatbrownball | batch 28 |
| 523 | PolyFilter | `polyfilter` | Moving Averages | price | BackQuant | batch 8 |
| 524 | Polynomial Regression Moving Average (PRMA) | `polynomial-regression-moving-average` | Moving Averages | price | ZakAlgoTrade | batch 24 |
| 525 | Polyphase MACD (PMACD) | `polyphase-macd` | Momentum | own | The_Peaceful_Lizard | batch 19 |
| 526 | PPO Alerts | `ppo-alerts` | Momentum | own |  |  |
| 527 | PPO Divergence | `ppo-divergence` | Momentum | own | Pekipek |  |
| 528 | Predictive Channels | `predictive-channels` | Channels & Bands | price | LuxAlgo |  |
| 529 | Premier RSI Oscillator | `premier-rsi` | Momentum | own |  |  |
| 530 | Premier Stochastic Oscillator | `premier-stochastic` | Oscillators | own |  |  |
| 531 | PREMIUM TRADE ZONES | `premium-trade-zones` | Oscillators | own | ENTRYLAB | batch 27 |
| 532 | Price & Volume Profile (Expo) | `price-volume-profile` | Volume | price | Zeiierman (community) |  |
| 533 | Price Action Bands \| Trend & Volatility | `price-action-bands-trend-volatility` | Channels & Bands | price | RadixAlgo | batch 15 |
| 534 | Price Action Breakout Trend | `price-action-breakout-trend` | Trend | price | QuantAlgo | batch 5 |
| 535 | Price Action Signals Filtered +EMA | `price-action-signals-filtered-ema` | Trend | price | Aleksin_Aleksandar | batch 11 |
| 536 | Price Action Trading System | `price-action-system` | Oscillators | price |  |  |
| 537 | Price Advance & Decline Range Analysis | `price-advance-decline-range-analysis` | Volatility | own | RicardoSantos | batch 16 |
| 538 | Price Change Sentiment Index | `price-change-sentiment-index` | Oscillators | own | TradeVizion | batch 23 |
| 539 | Price Divergence Detector | `price-divergence-detector` | Momentum | price | JustUncleL |  |
| 540 | Price Linear Sequence Counter | `price-linear-sequence-counter` | Momentum | own | RicardoSantos | batch 14 |
| 541 | Price Momentum Oscillator | `price-momentum-oscillator` | Momentum | own |  |  |
| 542 | Price/Volume Value Histogram | `price-volume-value-histogram` | Volume | own | dman103 | batch 2 |
| 543 | Prism Moving Average Trend | `prism-moving-average-trend` | Trend | price | MisinkoMaster | batch 19 |
| 544 | Projected Crossover Trend | `projected-crossover-trend` | Trend | price | SchizoQuant | batch 4 |
| 545 | Prometheus Topological Persistent Entropy | `prometheus-topological-persistent-entropy` | Volatility | own | ScorsoneEnterprises | batch 23 |
| 546 | Pullback Scalp Trade V2 | `pullback-scalp-trade-v2` | Trend | price | Sinyalbak_App | batch 12 |
| 547 | Pulse Range | `pulse-range` | Trend | price | MarketStructureLab | batch 13 |
| 548 | Pulse RSI \| Lyro RS | `pulse-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 10 |
| 549 | PulseWave + Divergence | `pulsewave-divergence` | Oscillators | own | Uncle_the_shooter | batch 7 |
| 550 | Pure Coca | `pure-coca` | Oscillators | own | La_Von | batch 7 |
| 551 | Q Impulse Entry | `q-impulse-entry` | Trend | price | Quantora | batch 17 |
| 552 | Q KAMA Clarity Trend | `q-kama-clarity-trend` | Trend | price | Quantora | batch 7 |
| 553 | QQE Cross | `qqe-cross` | Trend | price | JustUncleL |  |
| 554 | QQE MOD | `qqe-mod` | Momentum | own |  |  |
| 555 | QQE Signals | `qqe-signals` | Oscillators | price | colinmck |  |
| 556 | Quant VWAP System 3.8 | `quant-vwap-system-3-8` | Oscillators | own | CustomQuantLabs (published as "Quant VWAP System 3.8") | batch 8 |
| 557 | Quantile Regression Bands | `quantile-regression-bands` | Channels & Bands | price | BackQuant | batch 17 |
| 558 | Quantitative Qualitative Estimation | `qqe` | Oscillators | own | Glaz |  |
| 559 | Quantum Trend Signal | `quantum-trend-signal` | Trend | price | ReubenMiles | batch 9 |
| 560 | QuantumTrend SwiftEdge | `quantumtrend-swiftedge` | Trend | price | SwiftEdge | batch 5 |
| 561 | Quartile For Loop | `quartile-for-loop` | Trend | own | SeerQuant | batch 6 |
| 562 | Radius Trend [ChartPrime] | `radius-trend` | Trend | price | ChartPrime |  |
| 563 | Range Channel by Atilla Yurtseven | `range-channel-by-atilla-yurtseven` | Channels & Bands | own | AtillaYurtseven | batch 17 |
| 564 | Range Detector | `range-detector` | Trend | price | LuxAlgo |  |
| 565 | Range Identifier | `range-identifier` | Channels & Bands | price |  |  |
| 566 | Range Oscillator | `range-oscillator` | Oscillators | own | Zeiierman | batch 1 |
| 567 | Range Tightening Indicator (RTI) | `range-tightening-indicator` | Volatility | own | Ollie_AllCaps | batch 2 |
| 568 | Rapid Exponential Moving Average | `rapid-exponential-moving-average` | Moving Averages | price | ImmortalFreedom | batch 28 |
| 569 | RCI 3 Lines | `rci-3lines` | Oscillators | own |  |  |
| 570 | ReadyFor401ks Just Tell Me When! | `readyfor401ks-just-tell-me-when` | Trend | price | ReadyFor401k | batch 20 |
| 571 | Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure | `big-trades-bubbles` | Volume | price | samet_lezki | batch 5 |
| 572 | Realtime Volume Bars | `realtime-volume-bars` | Volume | own | the_MarketWhisperer |  |
| 573 | RedK EVEREX | `redk-everex` | Momentum | own | RedKTrader |  |
| 574 | RedK Magic Ribbon | `redk-magic-ribbon` | Moving Averages | price | RedKTrader | batch 2 |
| 575 | RedK Momentum Bars | `redk-momentum-bars` | Momentum | own | RedKTrader |  |
| 576 | RedK RSS_WMA | `redk-rss-wma` | Moving Averages | price | RedKTrader |  |
| 577 | RedK Trader Pressure Index | `redk-tpx` | Momentum | own | RedKTrader |  |
| 578 | RedK Vol_Weighted RSI: Extending the power of the classic RSI | `redk-vol-weighted-rsi` | Momentum | own | RedKTrader | batch 5 |
| 579 | Reflex & Trendflex | `reflex-trendflex` | Oscillators | own | e2e4 | batch 6 |
| 580 | Regression Channel Oscillator | `regression-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 27 |
| 581 | Relative ATR Volatility Indicator | `relative-atr-volatility-indicator` | Volatility | own | ZenAndTheArtOfTrading | batch 20 |
| 582 | Relative Strength Heatmap | `relative-strength-heatmap` | Momentum | own | BackQuant | batch 22 |
| 583 | Relative Valuation Oscillator | `relative-valuation-oscillator` | Oscillators | own | QuantAlgo | batch 14 |
| 584 | Relative Volume Indicator (RVOL) | `relative-volume-indicator` | Volume | own | AlgoCollective | batch 13 |
| 585 | Renko Boxes | `renko-boxes` | Trend | price | LuxAlgo | batch 4 |
| 586 | Renko Chart | `renko-chart` | Trend | price | LonesomeTheBlue |  |
| 587 | Renko Mod | `renko-mod` | Trend | price | RicardoSantos | batch 13 |
| 588 | Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI) | `renko-sniper-pro` | Trend | price | zachsprad | batch 24 |
| 589 | Res/Sup With Concavity & Increasing / Decreasing Trend Analysis | `res-sup-with-concavity-increasing-decreasing-trend-analysis` | Trend | price | Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis") | batch 28 |
| 590 | Retail vs Banker Net Positions – Symmetry Break | `retail-vs-banker-net-positions-symmetry-break` | Volume | own | JasonHyde | batch 17 |
| 591 | Reversal Candle Setup | `reversal-candle-setup` | Candlestick Patterns | price |  |  |
| 592 | Reversal Correlation Pressure | `reversal-correlation-pressure` | Oscillators | own | OmegaTools | batch 27 |
| 593 | Reversal Scalper 2.0- Adib Noorani | `reversal-scalper-2-0-adib-noorani` | Oscillators | own | AdibNoorani | batch 28 |
| 594 | Rhokeo-VW-RSI Histogram for Cumulative Delta by Zeiirman | `rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman` | Oscillators | own | nabil007 | batch 24 |
| 595 | Ripster EMA Clouds | `ripster-ema-clouds` | Trend | price | ripster47 |  |
| 596 | RMA ATR Bands | `rma-atr-bands` | Channels & Bands | price | SchizoQuant | batch 3 |
| 597 | RMI Length | `rmi-trend-sniper` | Momentum | price | TZack88 |  |
| 598 | Robby DSS Bressert Colored Dots | `robby-dss-bressert-colored-dots` | Oscillators | own | huatzhi | batch 21 |
| 599 | ROC-Weighted MA Oscillator | `roc-weighted-ma-oscillator` | Oscillators | own | SeerQuant | batch 2 |
| 600 | Rolling Liquidity Clusters Channel | `rolling-liquidity-clusters-channel` | Channels & Bands | price | LuxAlgo | batch 12 |
| 601 | Rolling Sharpe Ratio Oscillator \| Astral Vision | `rolling-sharpe-ratio-oscillator-astral-vision` | Oscillators | own | AstralVision | batch 13 |
| 602 | Rolling Trendline | `rolling-trendline` | Trend | price | LuxAlgo | batch 5 |
| 603 | Ross Cameron-Inspired Day Trading Strategy | `ross-cameron-inspired-day-trading-strategy` | Momentum | price | manaziir | batch 25 |
| 604 | RRR EMA Ignition BUY & SELL (Sideways-Proof) | `rrr-ema-ignition-buy-sell` | Trend | price | RAGSTER123 | batch 21 |
| 605 | RS Rating (1-99) | `rs-rating` | Momentum | own | kulturdesken | batch 16 |
| 606 | rs_MACD | `rs-macd` | Momentum | price | RicardoSantos | batch 17 |
| 607 | RSI + ADX + ATR Combo | `rsi-adx-atr-combo` | Oscillators | own | shawasutosh | batch 26 |
| 608 | RSI + BB + Dispersion | `rsi-bb-dispersion` | Oscillators | own |  |  |
| 609 | RSI + Fibonacci HH LL Support Resistance | `rsi-fibonacci-hh-ll-support-resistance` | Channels & Bands | price | FibonacciFlux | batch 12 |
| 610 | RSI + MACD (RSI Divergence) V3.2 | `rsi-macd-v3-2` | Oscillators | own | MKhoa | batch 24 |
| 611 | RSI + STOCH RSI - Marx_Capital | `rsi-stoch-rsi-marx-capital` | Oscillators | own | Marx_Capital | batch 12 |
| 612 | RSI Bands | `rsi-bands` | Channels & Bands | price |  |  |
| 613 | RSI Bars - OnlyFlow | `rsi-bars-onlyflow` | Momentum | price | ofderk | batch 10 |
| 614 | RSI BB StdDev Signal | `rsi-bb-stddev-signal` | Oscillators | own | trade_lexx (Pine title "RSI Signal [trade_lexx]") | batch 8 |
| 615 | RSI Candles | `rsi-candles` | Momentum | own | Glaz |  |
| 616 | RSI Confirm Trend with Williams (W%R) | `rsi-confirm-trend-with-williams` | Momentum | own | javageek | batch 11 |
| 617 | RSI Divergence | `rsi-divergence` | Oscillators | own |  |  |
| 618 | RSI Games 1.2 | `rsi-games-1-2` | Oscillators | own | petejfjohnson | batch 22 |
| 619 | RSI HistoAlert | `rsi-histoalert` | Oscillators | own |  |  |
| 620 | RSI Length | `most-rsi` | Momentum | own |  |  |
| 621 | RSI Length | `parabolic-rsi` | Momentum | own |  |  |
| 622 | RSI Length | `pmax-rsi-t3` | Momentum | own |  |  |
| 623 | RSI Length | `rsi-cyclic-smoothed` | Momentum | own |  |  |
| 624 | RSI Modified | `rsi-modified` | Oscillators | own | Santos_Trader_PT | batch 5 |
| 625 | RSI Momentum Divergence | `rsi-momentum-divergence` | Oscillators | own | ChartPrime |  |
| 626 | RSI Multi Levels kiawosch 7-14-42 Consolidation | `rsi-multi-levels` | Oscillators | own | TFlab | batch 5 |
| 627 | RSI Multicolor editable | `rsi-multicolor-editable` | Oscillators | own | Guillaume46 | batch 8 |
| 628 | RSI Snabbel | `rsi-snabbel` | Oscillators | own |  |  |
| 629 | RSI Supply/Demand | `rsi-supply-demand` | Trend | price | shtcoinr / Lij_MC |  |
| 630 | RSI Swing Signal | `rsi-swing-signal` | Oscillators | own |  |  |
| 631 | RSI Tops and Bottoms | `rsi-tops-bottoms` | Momentum | own | LonesomeTheBlue |  |
| 632 | RSI Trend Bias | `rsi-trend-bias` | Oscillators | own | Botnet101 | batch 24 |
| 633 | RSI Trend Navigator | `rsi-trend-navigator` | Trend | price | QuantAlgo | batch 10 |
| 634 | RSI Zone Step Lines | `rsi-zone-step-lines` | Channels & Bands | price | Devjames | batch 11 |
| 635 | RSI+EMA+MZONES with Divergences | `rsi-ema-mzones-with-divergences` | Oscillators | own | lordoflolz | batch 22 |
| 636 | RSI+Stoch Band Oscillator | `rsi-stoch-band-oscillator` | Oscillators | own | nasu_is_gaji | batch 26 |
| 637 | RSI-50 Step Line | `rsi-50-step-line` | Trend | price | Devjames | batch 5 |
| 638 | RSI-EMA-Crossing with Donchian-Stop-Loss | `rsi-ema-crossing-with-donchian-stop-loss` | Channels & Bands | price | Kahael | batch 28 |
| 639 | RSI: alternative derivation | `rsi-alternative-derivation` | Oscillators | own | AdaptiveRSI | batch 25 |
| 640 | SAR + EMA + MACD Signals | `sar-ema-macd` | Oscillators | price |  |  |
| 641 | Savitzky Flow Bands | `savitzky-flow-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 642 | Savitzky-Golay Hampel Filter \| AlphaNatt | `savitzky-golay-hampel-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 15 |
| 643 | Scalping Line | `scalping-line` | Oscillators | own | KivancOzbilgic |  |
| 644 | Scalping Tool with Dynamic Take Profit & Stop Loss | `scalping-tool-dynamic-tp-sl` | Trend | price | TruFREND | batch 3 |
| 645 | ScalpMap - EMA Pivot Targets | `scalpmap-ema-pivot-targets` | Trend | price | blockybears | batch 12 |
| 646 | SCE GANN Predictions | `sce-gann-predictions` | Trend | price | ScorsoneEnterprises | batch 22 |
| 647 | Schaff Trend Cycle | `schaff-trend-cycle` | Oscillators | own | LazyBear |  |
| 648 | SCOTTGO Advanced MACD | `scottgo-advanced-macd` | Momentum | own | SCOTTGO (indicator title "MACD: Clean Visuals (Fixed Arrows)") | batch 27 |
| 649 | Sell & Buy Rates | `sell-buy-rates` | Volume | own | LonesomeTheBlue |  |
| 650 | Sequential Pattern Strength | `sequential-pattern-strength` | Momentum | own | QuantAlgo | batch 9 |
| 651 | Setup 9.1 (Larry Williams) + EMA 50 | `setup-9-1-ema-50` | Moving Averages | price | oDouglasAlex | batch 7 |
| 652 | SExI - Super Exhaustion Indicator | `sexi-super-exhaustion-indicator` | Oscillators | own | Da_Prof | batch 14 |
| 653 | Sharp Modified Moving Average | `sharp-modified-moving-average` | Moving Averages | price | everget | batch 18 |
| 654 | Sharpe Ratio Indicator (180) | `sharpe-ratio-indicator` | Volatility | own | tim_amblard | batch 3 |
| 655 | Shock Percentile Moving Average \| NAL | `shock-percentile-moving-average-nal` | Moving Averages | price | NordicAlphaLab | batch 22 |
| 656 | Sigmoid RSI \| NAL | `sigmoid-rsi-nal` | Oscillators | own | NordicAlphaLab | batch 11 |
| 657 | Signal Moving Average | `signal-ma` | Moving Averages | price | LuxAlgo |  |
| 658 | Simple Moving Averages | `simple-moving-averages` | Moving Averages | price |  |  |
| 659 | Simplified Percentile Clustering | `simplified-percentile-clustering` | Oscillators | own | InvestorUnknown | batch 4 |
| 660 | Sine Weighted Moving Average | `sine-weighted-moving-average` | Moving Averages | price | everget | batch 13 |
| 661 | SL - 4 EMAs, 2 SMAs & Crossover Signals | `sl-4-emas-2-smas-crossover-signals` | Moving Averages | price | MVP202020205 | batch 27 |
| 662 | Slow Heiken Ashi | `slow-heiken-ashi` | Candlestick Patterns | price |  |  |
| 663 | SMA Angle Alerts | `sma-angle-alerts` | Moving Averages | price | readysetfire | batch 21 |
| 664 | SMA Squeeze Oscillator | `sma-squeeze-oscillator` | Momentum | own | Uncle_the_shooter | batch 23 |
| 665 | Smart Money Flow Signals | `smart-money-flow-signals` | Volume | own | QuantAlgo | batch 2 |
| 666 | Smart Trend | `smart-trend` | Trend | price | Zofesu | batch 21 |
| 667 | SMC Statistical Liquidity Walls | `smc-statistical-liquidity-walls` | Channels & Bands | price | PhenLabs | batch 25 |
| 668 | SMIIOL | `smiiol` | Momentum | own | iilter | batch 25 |
| 669 | Smooth RSI | `smooth-rsi` | Momentum | own | MarktQuant | batch 8 |
| 670 | Smoothed Heiken Ashi | `smoothed-heiken-ashi` | Trend | price | jackvmk |  |
| 671 | Smoothed Low-Pass Butterworth Filtered Median | `butterworth-filtered-median` | Moving Averages | price | AlphaNatt | batch 8 |
| 672 | Smoothed Source Weighted EMA | `smoothed-source-weighted-ema` | Moving Averages | price | Clokivez | batch 13 |
| 673 | Source | `ott-bands` | Channels & Bands | price | KivancOzbilgic |  |
| 674 | Source | `otto` | Oscillators | own | KivancOzbilgic |  |
| 675 | Source | `range-filter-dw` | Trend | price |  |  |
| 676 | Source-Aligned Oscillators (for Divergences) | `source-aligned-oscillators` | Oscillators | own | QuantNomad | batch 18 |
| 677 | SP - MACD with Divergence | `sp-macd-with-divergence` | Momentum | own | ca_sidnayak | batch 24 |
| 678 | Spira Alligator | `spira-alligator` | Trend | price | Markedsignaler | batch 26 |
| 679 | Squeeze Channel | `squeeze-channel` | Channels & Bands | price | B3AR_Trades | batch 16 |
| 680 | Squeeze Momentum | `squeeze-momentum` | Momentum | own | LazyBear |  |
| 681 | Squeeze Momentum V2 | `squeeze-momentum-v2` | Oscillators | own |  |  |
| 682 | SSL Channel | `ssl-channel` | Trend | price |  |  |
| 683 | SSL Hybrid Scalper | `ssl-hybrid-scalper` | Moving Averages | price | nabeel8369 | batch 11 |
| 684 | ST0P | `st0p` | Oscillators | price |  |  |
| 685 | Standardized MACD HA | `standardized-macd-ha` | Momentum | own | EliCobra |  |
| 686 | Start | `lucid-sar` | Trend | price |  |  |
| 687 | Statistical Price Deviation Index (MAD/VWMA) | `statistical-price-deviation-index` | Oscillators | own | exploretranspose | batch 16 |
| 688 | STH Unrealized Profit/Loss Ratio (STH-NUPL) | `sth-unrealized-profit-loss-ratio` | Oscillators | own | DeVrizii | batch 15 |
| 689 | Stoch VX3 | `stoch-vx3` | Oscillators | own |  |  |
| 690 | Stochastic Heat Map | `stochastic-heat-map` | Momentum | own | Violent |  |
| 691 | Stochastic Momentum Index | `stochastic-momentum-index` | Oscillators | own |  |  |
| 692 | Stochastic Momentum Index UCS | `smi-ucs` | Oscillators | own |  |  |
| 693 | Stochastic OTT | `stochastic-ott` | Oscillators | own | KivancOzbilgic |  |
| 694 | Stop/Take Bounds | `stop-take-bounds` | Volatility | price | Y_Goldman | batch 27 |
| 695 | Super Guppy | `super-guppy` | Trend | price | JustUncleL |  |
| 696 | Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET) | `super-sma-5-8-13-ema-20-200-regime-filter` | Moving Averages | price | afdzjr69 | batch 19 |
| 697 | Super Smoothed MACD | `super-smoothed-macd` | Momentum | own |  |  |
| 698 | Super SuperTrend | `super-supertrend` | Trend | price |  |  |
| 699 | SuperBands | `superbands` | Trend | price | The_Peaceful_Lizard | batch 7 |
| 700 | SuperSmoother MA Oscillator | `supersmoother-ma-oscillator` | Oscillators | own | BOSWaves | batch 1 |
| 701 | SuperTrend AI Clustering | `supertrend-ai-clustering` | Trend | price |  |  |
| 702 | SuperTrend Channels | `supertrend-channels` | Channels & Bands | price |  |  |
| 703 | Support and Resistance Levels with Breaks | `sr-levels-breaks` | Channels & Bands | price |  |  |
| 704 | Support Resistance Channels | `support-resistance-channels` | Trend | price | LonesomeTheBlue |  |
| 705 | Suppot and resistance & BUY SELL SIGNALS | `suppot-and-resistance-buy-sell-signals` | Channels & Bands | price | doganayy2 | batch 20 |
| 706 | Sweep2Trade Pro | `sweep2trade-pro` | Trend | price | chervolino | batch 8 |
| 707 | Swing Highs/Lows & Candle Patterns | `swing-highs-lows-patterns` | Candlestick Patterns | price | LuxAlgo (Pine v5) |  |
| 708 | Swing Points | `swing-points` | Trend | price | CrossTradeTeam | batch 14 |
| 709 | Swing Support and Resistance | `swing-support-and-resistance` | Trend | price | VSB-2024 | batch 25 |
| 710 | Swing Trade Signals | `swing-trade-signals` | Oscillators | price | nicks1008 |  |
| 711 | T3 Length | `t3-psar` | Moving Averages | price |  |  |
| 712 | TA (Miles) Adaptive Trend | `ta-adaptive-trend` | Trend | price | TradingApologist | batch 27 |
| 713 | TASC 2025.02 Autocorrelation Indicator | `tasc-2025-02-autocorrelation` | Oscillators | own | PineCodersTASC | batch 6 |
| 714 | TASC 2025.06 Cybernetic Oscillator | `tasc-2025-06-cybernetic-oscillator` | Oscillators | own | PineCodersTASC | batch 5 |
| 715 | TASC 2025.09 The Continuation Index | `tasc-2025-09-the-continuation-index` | Trend | own | PineCodersTASC | batch 14 |
| 716 | TASC 2026.01 The Reversion Index | `tasc-2026-01-the-reversion-index` | Oscillators | own | PineCodersTASC | batch 26 |
| 717 | TASC 2026.04 A Synthetic Oscillator | `tasc-2026-04-a-synthetic-oscillator` | Oscillators | own | PineCodersTASC | batch 7 |
| 718 | TASC 2026.05 The AutoTune Filter | `tasc-2026-05-the-autotune-filter` | Oscillators | own | PineCodersTASC | batch 8 |
| 719 | TASC 2026.09 Adaptive SuperSmoother | `tasc-2026-09-adaptive-supersmoother` | Moving Averages | own | PineCodersTASC | batch 15 |
| 720 | TDI - Traders Dynamic Index | `tdi-rsi` | Momentum | own |  |  |
| 721 | Tenkan Cloud Signals | `tenkan-cloud-signals` | Trend | price | CodaPro | batch 11 |
| 722 | Terminal Velocity Stop \| Lyro RS | `terminal-velocity-stop-lyro-rs` | Trend | price | LyroRS | batch 13 |
| 723 | TFO + ADX with Histogram & Signal | `tfo-adx-with-histogram-signal` | Oscillators | own | WalrusQuant | batch 26 |
| 724 | The Mean Goose v1 | `the-mean-goose-v1` | Channels & Bands | price | FattyGuinness | batch 15 |
| 725 | Theil-Sen Line Filter | `theil-sen-line-filter` | Moving Averages | price | BackQuant | batch 18 |
| 726 | Three Moving Averages | `three-moving-averages` | Moving Averages | price |  |  |
| 727 | Tillson T3 | `tillson-t3` | Trend | price | KivancOzbilgic (fr3762) |  |
| 728 | TMO (True Momentum Oscillator) | `tmo` | Momentum | own | Coulisnosaj | batch 15 |
| 729 | Tom DeMark MACD | `td-macd` | Momentum | own |  |  |
| 730 | TonyUX EMA Scalper | `tonyux-ema-scalper` | Oscillators | price |  |  |
| 731 | Top & Bottom Candle | `top-bottom-candle` | Candlestick Patterns | own |  |  |
| 732 | Tops/Bottoms | `tops-bottoms` | Oscillators | price |  |  |
| 733 | TR High/Low meter | `tr-high-low-meter` | Momentum | own | dman103 | batch 10 |
| 734 | Trader XO Macro Trend Scanner | `trader-xo` | Oscillators | price |  |  |
| 735 | Traders Dynamic Index | `tdi-hlc-trix` | Oscillators | own |  |  |
| 736 | Trading Activity Index | `trading-activity-index` | Volume | own | Zeiierman | batch 2 |
| 737 | Trading Gaul | `trading-gaul` | Trend | price | investment20223 | batch 26 |
| 738 | Transient Zones v1.1 | `transient-zones` | Channels & Bands | price | Jurij (community) |  |
| 739 | Tremor Tracker | `tremor-tracker` | Volatility | own | TheUltimator5 | batch 19 |
| 740 | Trend Direction Zone | `trend-direction-zone` | Trend | price | MarketStructureLab | batch 16 |
| 741 | Trend Double Pullbackv1.0 | `trend-double-pullback-v1-0` | Trend | price | puduxbt | batch 26 |
| 742 | Trend Filter (2-pole) | `trend-filter` | Trend | price | BigBeluga | batch 1 |
| 743 | Trend Flow Oscillator (CMF + MFI) + ADX | `trend-flow-oscillator-adx` | Oscillators | own | WalrusQuant | batch 19 |
| 744 | Trend Following Moving Averages | `trend-following-ma` | Moving Averages | price | LonesomeTheBlue |  |
| 745 | Trend Impulse Channels | `trend-impulse-channels` | Trend | price | Zeiierman |  |
| 746 | Trend Line Auto | `trend-line-auto` | Trend | price | HarryBot |  |
| 747 | Trend Lines v2 | `trend-lines-v2` | Trend | price | LonesomeTheBlue (Pine v4) |  |
| 748 | Trend Magic | `trend-magic` | Trend | price |  |  |
| 749 | Trend Predictor Ribbon Clone - Fixed roj karo moj karo | `trend-predictor-ribbon` | Trend | price | ronitjain18 | batch 6 |
| 750 | Trend Regularity Adaptive MA | `trama` | Moving Averages | price | LuxAlgo |  |
| 751 | Trend State Signals | `trend-state-signals` | Trend | price | MarketStructureLab | batch 4 |
| 752 | Trend Trader Strategy | `trend-trader` | Trend | price |  |  |
| 753 | Trend Trigger Factor | `trend-trigger-factor` | Oscillators | own |  |  |
| 754 | Trend Volatility Index (TVI) | `trend-volatility-index` | Volatility | own | chikaharu | batch 3 |
| 755 | Trend with ADX/EMA - Buy & Sell Signals | `trend-with-adx-ema-buy-sell-signals` | Trend | price | RMPM | batch 28 |
| 756 | TrendCylinder (Expo) | `trendcylinder` | Trend | price | Zeiierman | batch 4 |
| 757 | Trendlines with Breaks [LuxAlgo] | `trendlines-with-breaks` | Trend | price | LuxAlgo |  |
| 758 | TrendMasterPro_Fekonomi | `trendmasterpro-fekonomi` | Trend | price | fekonomi | batch 20 |
| 759 | TrendWave Bands | `trendwave-bands` | Channels & Bands | price | BigBeluga | batch 1 |
| 760 | Triangular MA Bands | `tma-bands` | Channels & Bands | price |  |  |
| 761 | Triangular Momentum Oscillator | `triangular-momentum-osc` | Oscillators | own |  |  |
| 762 | Trimmed Mean ATR Bands | `trimmed-mean-atr-bands` | Channels & Bands | price | CryptoNejc | batch 17 |
| 763 | Triple Gaussian Smoothed Ribbon | `triple-gaussian-smoothed-ribbon` | Trend | price | BOSWaves | batch 16 |
| 764 | Triple MA For Loop | `triple-ma-for-loop` | Trend | own | SeerQuant | batch 7 |
| 765 | Triple MA Forecast | `triple-ma-forecast` | Moving Averages | price | yatrader2 (community) |  |
| 766 | Triple RSI \| MisinkoMaster | `triple-rsi-misinkomaster` | Momentum | own | MisinkoMaster | batch 19 |
| 767 | True Range eXpansion | `true-range-expansion` | Volatility | price | Sherlock_MacGyver | batch 22 |
| 768 | TTM Squeeze Pro | `ttm-squeeze-pro` | Oscillators | own | John Carter |  |
| 769 | Turtle Trade Channels | `turtle-trade-channels` | Channels & Bands | price | Richard Dennis / William Eckhardt |  |
| 770 | Tweezers & Kangaroo Tail | `tweezers-kangaroo-tail` | Candlestick Patterns | price | LonesomeTheBlue |  |
| 771 | Twin Range Filter | `twin-range-filter` | Trend | price | colinmck |  |
| 772 | Ultimate Buy & Sell | `ultimate-buy-sell` | Trend | price |  |  |
| 773 | Ultimate RSI [LuxAlgo] | `ultimate-rsi` | Momentum | own | LuxAlgo |  |
| 774 | Ultra Smart Trail | `ultra-smart-trail` | Trend | price | Rathack | batch 18 |
| 775 | Universal Large Orders Proxy fabio valentini Chat gpt Recreation | `universal-large-orders-proxy-fabio-valentini-chat-gpt-recreation` | Volume | price | boss11233 | batch 18 |
| 776 | Uptrick: Dynamic Z-Score Deviation | `uptrick-dynamic-z-score-deviation` | Trend | price | Uptrick | batch 6 |
| 777 | Uptrick: Liquid Reversal Bands | `liquid-reversal-bands` | Channels & Bands | price | Uptrick | batch 3 |
| 778 | Uptrick: MultiMA_Volume | `uptrick-multima-volume` | Moving Averages | price | Uptrick | batch 16 |
| 779 | Uptrick: RSI MA Buying/Selling signals | `uptrick-rsi-ma-buying-selling-signals` | Momentum | own | Uptrick | batch 12 |
| 780 | Uptrick: Trend Analysis | `uptrick-trend-analysis` | Momentum | own | Uptrick | batch 14 |
| 781 | Uptrick: Volatility Reversion Bands | `uptrick-volatility-reversion-bands` | Channels & Bands | price | Uptrick | batch 4 |
| 782 | Uptrick: Zero Lag HMA Trend Suite | `zero-lag-hma-trend-suite` | Moving Averages | price | Uptrick | batch 3 |
| 783 | User Defined Range Selector and Color Changing EMA Line | `user-defined-range-selector-and-color-changing-ema-line` | Moving Averages | price | Crypto_Moses | batch 23 |
| 784 | UT Bot | `ut-bot` | Trend | price |  |  |
| 785 | Variable Moving Average | `variable-ma` | Moving Averages | price | LazyBear |  |
| 786 | VARIS Zones | `varis-zones` | Channels & Bands | price | IAmTheLiquidity2 | batch 17 |
| 787 | VCO Fusion | `vco-fusion` | Oscillators | own | Uncle_the_shooter | batch 20 |
| 788 | Vdub FX Sniper | `vdub-sniper` | Oscillators | price | Vdubus |  |
| 789 | vdubus BinaryPro | `vdubus-binarypro` | Oscillators | price |  |  |
| 790 | VEGA (Velocity of Efficient Gain Adaptation) | `vega` | Momentum | own | B3AR_Trades | batch 20 |
| 791 | Vervoort HA LT Candlestick Oscillator | `vervoort-ha-oscillator` | Oscillators | own |  |  |
| 792 | Visualisation tendances | `visualisation-tendances` | Trend | price | Benjamin69 | batch 17 |
| 793 | Volatility & Big Market Moves | `volatility-big-market-moves` | Volatility | own | nilstrades_ | batch 24 |
| 794 | Volatility Adaptive Filtered Trend | `volatility-adaptive-filtered-trend` | Trend | price | SchizoQuant | batch 6 |
| 795 | Volatility Bands | `volatility-bands` | Channels & Bands | price | pmk07 | batch 23 |
| 796 | Volatility Channel Oscillator | `volatility-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 797 | Volatility Halo \| NAL | `volatility-halo-nal` | Volatility | price | NordicAlphaLab | batch 6 |
| 798 | Volatility Quality | `volatility-quality` | Volatility | own | AlphaExtract | batch 18 |
| 799 | Volatility-Driven VWAP Structure | `volatility-driven-vwap-structure` | Channels & Bands | price | Zeiierman | batch 3 |
| 800 | Volatility-Gated Trend Oscillator | `volatility-gated-trend-oscillator` | Oscillators | own | QuantAlgo | batch 9 |
| 801 | VOLD Ratio Histogram | `vold-ratio-histogram` | Volume | own | Th16rry | batch 23 |
| 802 | Volumatic S/R Levels | `volumatic-sr-levels` | Trend | price | BigBeluga |  |
| 803 | Volume + RSI & MA Differential | `volume-rsi-ma-differential` | Volume | own | ozzy_livin | batch 7 |
| 804 | Volume Accumulation Percentage | `volume-accumulation-pct` | Volume | own |  |  |
| 805 | Volume and Volatility Ratio Indicator-WODI | `volume-and-volatility-ratio-indicator-wodi` | Volume | own | W0DI | batch 16 |
| 806 | Volume Bands | `volume-bands` | Channels & Bands | price | MisinkoMaster | batch 6 |
| 807 | Volume Bar Breakout | `volume-bar-breakout` | Volume | price | tradeswithashish |  |
| 808 | Volume bar range | `volume-bar-range` | Volume | price | pandorid | batch 25 |
| 809 | Volume Bars Color | `volume-bars-color` | Volume | own | Evgenyc111 | batch 20 |
| 810 | Volume Buy/Sell Split | `volume-buy-sell-split` | Volume | own | LHAMA-Trading | batch 26 |
| 811 | Volume Candle Highlighter | `volume-candle-highlighter` | Volume | price | Dougie_dee | batch 5 |
| 812 | Volume Colored Bars | `volume-colored-bars` | Volume | own |  |  |
| 813 | Volume Comparison with Buyer/Seller Pressure | `volume-comparison-with-buyer-seller-pressure` | Volume | own | ask2maniish | batch 26 |
| 814 | Volume Divergence | `volume-divergence` | Volume | own | baymucuk |  |
| 815 | Volume Flow Indicator | `volume-flow-indicator` | Volume | own |  |  |
| 816 | Volume Flow v3 | `volume-flow-v3` | Volume | own | DepthHouse / oh92 (community) |  |
| 817 | Volume Footprint | `volume-footprint` | Volume | price | LuxAlgo |  |
| 818 | Volume LinReg Trend | `volume-linreg-trend` | Volume | own | LonesomeTheBlue |  |
| 819 | Volume Positive Negative (VPN) | `volume-positive-negative` | Volume | own | LevelUpTools | batch 2 |
| 820 | Volume Price Confirmation Indicator | `vpci` | Volume | own |  |  |
| 821 | Volume Profile Heatmap | `volume-profile-heatmap` | Volume | price | KeyAlgos | batch 13 |
| 822 | Volume SuperTrend AI | `volume-supertrend-ai` | Trend | price |  |  |
| 823 | Volume Surge Detector | `volume-surge-detector` | Volume | own | SpeculationLab | batch 19 |
| 824 | Volume Weighted MACD V2 | `vw-macd-v2` | Momentum | own |  |  |
| 825 | Volume Weighted Median Price (VWMP) | `volume-weighted-median-price` | Moving Averages | price | vsov | batch 14 |
| 826 | Volume Weighted Trend | `volume-weighted-trend` | Trend | price | QuantAlgo | batch 1 |
| 827 | Volume-Gated Trend Ribbon | `volume-gated-trend-ribbon` | Trend | price | QuantAlgo | batch 3 |
| 828 | Volume-Weighted MA Crossover | `volume-weighted-ma-crossover` | Moving Averages | price | AlphaNatt | batch 9 |
| 829 | Volume-Weighted Price Z-Score | `volume-weighted-price-z-score` | Oscillators | own | QuantAlgo | batch 6 |
| 830 | Volumetric Compressed MA | `volumetric-compressed-ma` | Moving Averages | price | serkany88 | batch 14 |
| 831 | Volumetric Entropy Index | `volumetric-entropy-index` | Volume | own | Sherlock_MacGyver | batch 27 |
| 832 | VolVol | `volvol` | Volume | price | kunalgolani | batch 26 |
| 833 | Vortex Pro with Moving average | `vortex-pro-with-moving-average` | Oscillators | own | pointalgo | batch 25 |
| 834 | Voss Predictive Filter | `voss-predictive-filter` | Oscillators | own | e2e4 | batch 8 |
| 835 | VPSA-VTD | `vpsa-vtd` | Volume | own | CatTheTrader | batch 11 |
| 836 | VuManChu Swing Free | `vumanchu-swing` | Trend | price |  |  |
| 837 | VWAP & Dual MA Ribbon Tracker Pro | `vwap-dual-ma-ribbon-tracker-pro` | Trend | own | Simon20cent | batch 19 |
| 838 | VWAP Deviation Oscillator | `vwap-deviation-oscillator` | Oscillators | own | BackQuant | batch 9 |
| 839 | VWAP/MVWAP/EMA Crossover | `vwap-mvwap-ema-crossover` | Trend | price | DerrickLaFlame |  |
| 840 | VWMA/SMA Delta Volatility (Statistical Anomaly Detector) | `vwma-sma-delta-volatility` | Volatility | own | tkarolak | batch 14 |
| 841 | VWMACD & SZO | `vwmacd-szo` | Momentum | own |  |  |
| 842 | VWMACD-MFI-OBV Composite | `vwmacd-mfi-obv-composite` | Volume | own | munair | batch 27 |
| 843 | Waddah Attar Explosion | `waddah-attar-explosion` | Momentum | own | LazyBear/ShayanKM |  |
| 844 | WAE Sniper Scalp XAUUSD M1 Tuned | `wae-sniper-scalp-xauusd-m1-tuned` | Momentum | own | khonthailoei19071983 | batch 19 |
| 845 | WaveFunction MACD | `wavefunction-macd` | Momentum | own | TechnoBlooms | batch 27 |
| 846 | Wavelet Transform Trend | `wavelet-transform-trend` | Trend | price | QuantAlgo | batch 12 |
| 847 | Wavelet-Trend ML Integration | `wavelet-trend-ml-integration` | Oscillators | own | AlphaExtract | batch 1 |
| 848 | WaveTrend | `wavetrend` | Oscillators | own | LazyBear |  |
| 849 | WaveTrend Oscillator | `wavetrend-oscillator` | Momentum | own | LazyBear |  |
| 850 | Weierstrass Function (Fractal Cycles) | `weierstrass-function` | Oscillators | own | fract | batch 17 |
| 851 | Weighted percentile nearest rank | `weighted-percentile-nearest-rank` | Moving Averages | price | gorx1 | batch 10 |
| 852 | Weighted Regression Bands | `weighted-regression-bands` | Channels & Bands | price | Zeiierman | batch 5 |
| 853 | Weis Wave Volume | `weis-wave-volume` | Volume | own |  |  |
| 854 | Whale Activity Impact Oscillator | `whale-activity-impact-oscillator` | Volume | own | mdeacey | batch 18 |
| 855 | Whale Volume Absorption & Aggression @MaxMaserati 3.0 | `whale-volume-absorption-aggression-maxmaserati-3-0` | Volume | own | MaxMaserati | batch 22 |
| 856 | WICK.ED Fractals | `wicked-fractals` | Oscillators | price | Mit Nayi (community) |  |
| 857 | Williams Alligator + Fractals | `williams-combo` | Trend | price | vlkvr (Pine v3) |  |
| 858 | Williams BBDiv Signal | `williams-bbdiv-signal` | Oscillators | own | trade_lexx | batch 20 |
| 859 | Williams Vix Fix | `williams-vix-fix` | Volatility | own | ChrisMoody |  |
| 860 | x5-smooth-ema | `x5-smooth-ema` | Moving Averages | price | traderninezero | batch 19 |
| 861 | XAUUSD Buy/Sell Alerts with SL & TP | `xauusd-buy-sell-alerts-with-sl-tp` | Moving Averages | price | alexandrossolomou1 | batch 8 |
| 862 | XAUUSD Family Scalping (5min) | `xauusd-family-scalping` | Oscillators | price | cupra_inc | batch 8 |
| 863 | Z-Score | `z-score` | Oscillators | own | joecalledher | batch 21 |
| 864 | Z-Score Oscillator | `z-score-oscillator` | Oscillators | own | B3AR_Trades | batch 12 |
| 865 | Z-Score STDEMA Bands | `z-score-stdema-bands` | Oscillators | own | TiagoTF | batch 24 |
| 866 | Zero Lag EMA | `zero-lag-ema` | Moving Averages | price |  |  |
| 867 | Zero Lag LSMA (ZLSMA) | `zlsma` | Moving Averages | price | veryfid |  |
| 868 | Zero Lag MACD | `zero-lag-macd` | Momentum | own | AC (based on Glaz) |  |
| 869 | Zero Lag Signals For Loop | `zero-lag-signals-for-loop` | Trend | price | QuantAlgo | batch 1 |
| 870 | Zero-Lag GARCH Bands \| NAL | `zero-lag-garch-bands-nal` | Volatility | price | NordicAlphaLab | batch 12 |
| 871 | ZigZag with Fibonacci Levels | `zigzag-fibonacci` | Trend | price | LonesomeTheBlue |  |
| 872 | ZVOL - Z-Score Volume Heatmap | `zvol-z-score-volume-heatmap` | Volume | own | TheLeadingIndicator | batch 28 |
| 873 | 🌊 ALMA Bands | `alma-bands` | Moving Averages | price | B3AR_Trades | batch 26 |
