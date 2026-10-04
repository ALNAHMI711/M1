# Community Indicator Inventory

Community indicators of `lightweight-charts-indicators`: TypeScript ports of community PineScript scripts, built on
[oakscriptjs](https://github.com/deepentropy/oakscriptJS). Each port has the inputs, plots and drawings of its Pine
source. This list is generated from the indicator registry (`indicatorRegistry` in `src/index.ts`).

## Summary

| | Count |
|---|---|
| **Community indicators** | 1051 |
| Drawn on the price pane (overlay) | 571 |
| Drawn in their own pane | 480 |
| Compared with TradingView outputs (batches 1-37) | 733 |

| Category | Count |
|---|---|
| Trend | 280 |
| Oscillators | 229 |
| Moving Averages | 140 |
| Momentum | 136 |
| Channels & Bands | 117 |
| Volume | 102 |
| Volatility | 32 |
| Candlestick Patterns | 15 |

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
| 3 | 15-Minute Squeeze Scalper (Traffic Light Edition) | `15-minute-squeeze-scalper` | Volatility | own | Universal_Scalper_Pro | batch 36 |
| 4 | 1m Trend Continuation Signals - SSL + BB Filter | `1m-trend-continuation-signals-ssl-bb-filter` | Trend | price | rhariganesh | batch 13 |
| 5 | 3 Confirmation Bear | `3-confirmation-bear` | Trend | price | AirianM | batch 16 |
| 6 | 3 Confirmation Bull | `3-confirmation-bull` | Trend | price | AirianM | batch 21 |
| 7 | 3 Lines RCI + Psy Signal + RSI Background | `3-lines-rci-psy-signal-rsi-background` | Oscillators | own | masato19810122 | batch 36 |
| 8 | 3-in-1 Custom Moving Average Indicator | `3-in-1-custom-moving-average-indicator` | Moving Averages | price | Mr-Fish | batch 22 |
| 9 | 5-Minute Buy/Sell Signal | `5-minute-buy-sell-signal` | Trend | price | Waqas_Khalid | batch 14 |
| 10 | 72s: Adaptive Hull Moving Average+ | `adaptive-hull-ma` | Moving Averages | price | io72signals |  |
| 11 | [RS] Support and Resistance V0 | `rs-support-resistance` | Channels & Bands | price | RicardoSantos (community) |  |
| 12 | Abdullah | `abdullah` | Trend | price | royalsherry888 | batch 35 |
| 13 | Absolute Strength Index | `absolute-strength-index` | Oscillators | own | Zeiierman | batch 3 |
| 14 | Acceleration Bands HTF | `acceleration-bands-htf` | Channels & Bands | price | ZoharCho | batch 18 |
| 15 | Accumulation/Distribution Money Flow v1.0 | `ad-money-flow` | Volume | own | kypexin | batch 8 |
| 16 | Accurate Swing Trading | `accurate-swing-trading` | Trend | price |  |  |
| 17 | Adaptive ALMA 2.0 | `adaptive-alma-2-0` | Moving Averages | price | Zomzi | batch 9 |
| 18 | Adaptive Average Sentiment Oscilator | `adaptive-average-sentiment-oscilator` | Oscillators | own | Zomzi | batch 32 |
| 19 | Adaptive Convergence Divergence | `adaptive-convergence-divergence` | Momentum | own | singhxgurjit | batch 21 |
| 20 | Adaptive Ehlers Filtered Percentile | `adaptive-ehlers-filtered-percentile` | Channels & Bands | price | SchizoQuant | batch 4 |
| 21 | Adaptive Entropy Trend | `adaptive-entropy-trend` | Trend | price | QuantAlgo | batch 6 |
| 22 | Adaptive Friction Filter (AFF) | `adaptive-friction-filter` | Trend | price | QuantAlgo | batch 10 |
| 23 | Adaptive Gaussian AFR | `adaptive-gaussian-afr` | Trend | price | Mattes00 | batch 6 |
| 24 | Adaptive Heikin Ashi | `adaptive-heikin-ashi` | Trend | price | chervolino | batch 13 |
| 25 | Adaptive Kinetic Ribbon | `adaptive-kinetic-ribbon` | Trend | price | QuantAlgo | batch 9 |
| 26 | Adaptive MACD | `adaptive-macd` | Momentum | own |  |  |
| 27 | Adaptive ML Trailing Stop | `adaptive-ml-trailing-stop` | Trend | price | BOSWaves | batch 5 |
| 28 | Adaptive Nadaraya-Watson (Non Repainting) | `adaptive-nadaraya-watson` | Channels & Bands | price | Metrify | batch 10 |
| 29 | Adaptive Pivot Zones | `adaptive-pivot-zones` | Channels & Bands | price | Uncle_the_shooter | batch 17 |
| 30 | Adaptive Rolling Z-Score Channel | `adaptive-rolling-z-score-channel` | Channels & Bands | price | B3AR_Trades | batch 18 |
| 31 | Adaptive RSI \| Lyro RS | `adaptive-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 13 |
| 32 | Adaptive Trend Channel | `adaptive-trend-channel` | Channels & Bands | price | MarketStructureLab | batch 4 |
| 33 | Adaptive Trend Flow [QuantAlgo] | `adaptive-trend-flow` | Trend | price | QuantAlgo |  |
| 34 | Adaptive Volatility-Scaled Oscillator | `adaptive-volatility-scaled-oscillator` | Volatility | own | Zeiierman | batch 4 |
| 35 | Adjusted RSI | `adjusted-rsi` | Oscillators | own | JTCapitalNL | batch 11 |
| 36 | ADR Contraction Tightness | `adr-contraction-tightness` | Volatility | own | etfbreakouts | batch 33 |
| 37 | Advanced Dual Hull Cross Suite v6 - Precision Signals | `advanced-dual-hull-cross-suite-v6-precision-signals` | Moving Averages | price | NitMan279 | batch 36 |
| 38 | Advanced MACD Pro - T3 Themed | `advanced-macd-pro-t3-themed` | Momentum | own | WhiteStone_Ibrahim | batch 27 |
| 39 | AdvancedLines (FiboBands) - PaSKaL | `advancedlines-paskal` | Channels & Bands | price | uPaSKaL | batch 19 |
| 40 | ADX and RSI Combo | `adx-and-rsi-combo` | Oscillators | own | Tracks | batch 10 |
| 41 | ADX by cobra | `adx-cobra` | Trend | own | cobra (community) |  |
| 42 | ADX Di+ Di- [Gu5] | `adx-di-gu5` | Trend | own | Gu5tavo71 |  |
| 43 | ADX Extreme Zones + Divergences | `adx-extreme-zones-divergences` | Trend | own | TradeVizion | batch 13 |
| 44 | ADX Trend Strength Filter + TRAMA | `adx-trend-strength-filter-trama` | Trend | price | DotGain | batch 18 |
| 45 | ADX Trend Visualizer with Dual Thresholds | `adx-trend-visualizer-with-dual-thresholds` | Trend | own | crankyprofits | batch 32 |
| 46 | ADX with Shaded Zone | `adx-with-shaded-zone` | Trend | own | MathThomas | batch 20 |
| 47 | ADX-vALMA (N) | `adx-valma` | Trend | own | Zomzi | batch 6 |
| 48 | Aegis Prime Flow | `aegis-prime-flow` | Oscillators | own | wjdtks255 | batch 34 |
| 49 | Aggregated Scores Oscillator | `aggregated-scores-oscillator` | Oscillators | own | AlphaExtract | batch 8 |
| 50 | Aggressive Pullback Indicator | `aggressive-pullback-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 51 | Aggressive Volume | `aggressive-volume` | Volume | own | oDouglasAlex | batch 26 |
| 52 | AI Adaptive Oscillator | `ai-adaptive-oscillator` | Oscillators | own | PhenLabs | batch 11 |
| 53 | AI Breakout Bands | `ai-breakout-bands` | Channels & Bands | price | Zeiierman | batch 3 |
| 54 | AI Engulfing Candle | `ai-engulfing` | Candlestick Patterns | price |  |  |
| 55 | AI Infinity | `ai-infinity` | Trend | price | jonathanalbrecht_trader | batch 11 |
| 56 | AI Source Switching Moving Average | `ai-source-switching-moving-average` | Moving Averages | price | Zeiierman | batch 1 |
| 57 | AI Trading Assistant v2 | `ai-trading-assistant-v2` | Trend | price | Alchemical_Carpenter | batch 26 |
| 58 | AI Trend Navigator [K-Neighbor] | `ai-trend-navigator` | Trend | price |  |  |
| 59 | AI Volume Signals | `ai-volume-signals` | Volume | price | szymonsobkowiak | batch 9 |
| 60 | AI-Weighted RSI | `ai-weighted-rsi` | Oscillators | own | Zeiierman | batch 3 |
| 61 | AK MACD BB | `macd-bb` | Momentum | own | Algokid |  |
| 62 | AK TREND ID | `ak-trend-id` | Trend | own | Algokid |  |
| 63 | Al Po's Arithmetic Mean | `al-po-s-arithmetic-mean` | Moving Averages | price | sequentialvision | batch 21 |
| 64 | All Candlestick Patterns | `all-candlestick-patterns` | Candlestick Patterns | price |  |  |
| 65 | All-In-One MA Stack Scalper | `all-in-one-ma-stack-scalper` | Moving Averages | price | jonesdaniel2112 | batch 33 |
| 66 | ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF) | `all-in-one-rsi-system` | Oscillators | own | ethem11 | batch 25 |
| 67 | AllMA Trend Radar | `allma-trend-radar` | Moving Averages | price | trade_lexx | batch 28 |
| 68 | ALMA SD Bands \| RakoQuant | `alma-sd-bands-rakoquant` | Channels & Bands | price | RakoQuant | batch 10 |
| 69 | Alpha Trading Signal _ Up side Down | `alpha-trading-signal-up-side-down` | Trend | price | giaodichdsmart | batch 19 |
| 70 | Alpha-Sutte Model | `alpha-sutte-model` | Trend | price | SegaRKO | batch 10 |
| 71 | AlphaTrend | `alpha-trend` | Trend | price | KivancOzbilgic |  |
| 72 | Anchored Bollinger Band Range | `anchored-bollinger-band-range` | Channels & Bands | price | Steversteves | batch 20 |
| 73 | Anchored VWAP Pro (Final Visibility Enhanced) | `anchored-vwap-pro` | Volume | price | ImmortalEmerson | batch 17 |
| 74 | Anchored VWAP with Buy/Sell Signals | `anchored-vwap-with-buy-sell-signals` | Volume | price | kmootoo89 | batch 29 |
| 75 | ANDROMEDA - TrendSync | `andromeda-trendsync` | Trend | price | Pedro_Canto | batch 9 |
| 76 | Anti-Volume Stop Loss | `anti-volume-stop` | Trend | price |  |  |
| 77 | Apex Volatility Squeeze & Breakout | `apex-volatility-squeeze-breakout` | Volatility | price | Pineify | batch 33 |
| 78 | Arnaud Legoux Gaussian Flow \| AlphaNatt | `arnaud-legoux-gaussian-flow-alphanatt` | Moving Averages | price | AlphaNatt | batch 17 |
| 79 | Aroon with RSI Confirmation (92.86%) | `aroon-with-rsi-confirmation` | Trend | price | jaydipali622018 | batch 7 |
| 80 | ASDQWE123 2.0 | `asdqwe123-2-0` | Trend | price | luvuoov | batch 34 |
| 81 | Asian & London Session High/Low | `asian-london-session-high-low` | Channels & Bands | price | NikolayBorisov | batch 8 |
| 82 | Ask-Weighted Averages | `ask-weighted-averages` | Volume | price | DinoTradez | batch 27 |
| 83 | Asset risk metrics | `asset-risk-metrics` | Momentum | price | Sweettz | batch 21 |
| 84 | Asymmetric Volatility Trend Line | `asymmetric-volatility-trend-line` | Trend | price | QuantAlgo | batch 4 |
| 85 | ATR Based Zigzag w EMA | `atr-based-zigzag-w-ema` | Trend | price | HabibiBudo | batch 4 |
| 86 | ATR HEMA | `atr-hema` | Moving Averages | price | SeerQuant | batch 2 |
| 87 | ATR Period | `nrtr` | Trend | price |  |  |
| 88 | ATR Period | `profit-maximizer` | Moving Averages | price |  |  |
| 89 | ATR Period | `supertrend-ladder` | Trend | price |  |  |
| 90 | ATR Rope | `atr-rope` | Trend | price | SamRecio | batch 2 |
| 91 | ATR Trailing Stop with ATR Targets | `atr-trailing-stop-with-atr-targets` | Trend | price | TRDRZone | batch 33 |
| 92 | ATR Trailing Stops | `atr-trailing-stops` | Trend | price |  |  |
| 93 | ATR Trend Color | `atr-trend-color` | Trend | price | Aleksin_Aleksandar | batch 31 |
| 94 | ATR Volatility and Trend Analysis | `atr-volatility-and-trend-analysis` | Volatility | price | dchunt-stack | batch 10 |
| 95 | ATR ZLEMA | `atr-zlema` | Trend | price | QuantAlgo | batch 3 |
| 96 | ATR+ Stop Loss Indicator | `atr-plus` | Trend | own | ZenAndTheArtOfTrading |  |
| 97 | ATR-Normalized VWMA Deviation | `atr-normalized-vwma-deviation` | Oscillators | own | exploretranspose | batch 10 |
| 98 | ATR-Scaled Deviation Oscillator | `atr-scaled-deviation-oscillator` | Oscillators | own | C_H_I_P_A | batch 23 |
| 99 | ATR20 SMA x3.5 Trailing Line | `atr20-sma-x3-5-trailing-line` | Volatility | price | hibinomasakazu1991 | batch 30 |
| 100 | Aura Sentiment & Risk Flow | `aura-sentiment-risk-flow` | Oscillators | own | Pineify | batch 34 |
| 101 | Aura Trend & Candlestick Matrix | `aura-trend-candlestick-matrix` | Trend | price | Pineify | batch 9 |
| 102 | Aura Vortex Oscillator | `aura-vortex-oscillator` | Oscillators | own | Pineify | batch 32 |
| 103 | Aura: Adaptive Statistical Smoother | `aura-adaptive-statistical-smoother` | Moving Averages | price | Pineify | batch 15 |
| 104 | Auto AVWAP (Anchored-VWAP) with Breakout Screener | `auto-avwap-with-breakout-screener` | Volume | price | manoharvs | batch 28 |
| 105 | Auto Fibo on Indicators | `auto-fibo-indicators` | Oscillators | own | KivancOzbilgic |  |
| 106 | Auto Fibonacci | `auto-fib` | Channels & Bands | price |  |  |
| 107 | Auto Trendline [DojiEmoji] | `auto-trendline` | Trend | price |  |  |
| 108 | Auto-Support | `auto-support` | Channels & Bands | price |  |  |
| 109 | Automated Z-scoring | `automated-z-scoring` | Oscillators | own | JTCapitalNL | batch 14 |
| 110 | Automatic Support & Resistance | `auto-support-resistance` | Channels & Bands | price |  |  |
| 111 | Average Bullish & Bearish Percentage Change | `average-bullish-bearish-percentage-change` | Momentum | own | fract | batch 23 |
| 112 | Average Sentiment Oscillator | `average-sentiment-oscillator` | Oscillators | own |  |  |
| 113 | Average True Range Trailing Stops Colored | `atr-trailing-colored` | Trend | price |  |  |
| 114 | Awesome Oscillator V2 | `awesome-oscillator-v2` | Oscillators | own |  |  |
| 115 | Awesome_Accelerator_Zone Oscillator | `awesome-accelerator-zone-oscillator` | Oscillators | own | pirooz_trader | batch 18 |
| 116 | B + A + D v0.4 | `b-a-d-v0-4` | Momentum | own | wepritz84 | batch 13 |
| 117 | BACAP PRICE STRUCTURE 21 EMA TREND | `bacap-price-structure-21-ema-trend` | Trend | price | Alex_PrimeTrading | batch 19 |
| 118 | Banker Fund Flow Trend Oscillator | `banker-fund-flow` | Oscillators | own |  |  |
| 119 | BB Breakout Oscillator | `bb-breakout-oscillator` | Oscillators | own | LuxAlgo |  |
| 120 | BB Fibonacci Ratios | `bb-fibonacci-ratios` | Channels & Bands | price |  |  |
| 121 | BB Length | `ideal-bb-ma` | Moving Averages | price |  |  |
| 122 | BB Stochastic RSI Extreme Signal | `bb-stoch-rsi` | Oscillators | price |  |  |
| 123 | Beep Boop | `beep-boop` | Momentum | own | OBSIDE | batch 33 |
| 124 | Bernoulli Process - Binary Entropy | `bernoulli-process-entropy` | Oscillators | own | kocurekc | batch 1 |
| 125 | BEST Supertrend CCI | `supertrend-cci` | Trend | price | Daveatt |  |
| 126 | Beta-Weighted Moving Average | `weighted-ma-function` | Moving Averages | price |  |  |
| 127 | Better Volume Indicator | `better-volume` | Volume | own | LazyBear |  |
| 128 | Big Snapper Alerts R3.0 | `big-snapper-alerts` | Trend | price |  |  |
| 129 | Biggest Volume | `biggest-volume` | Volume | own | mikhail_marka | batch 22 |
| 130 | Bilateral Filter For Loop | `bilateral-filter-for-loop` | Trend | own | BackQuant | batch 14 |
| 131 | Binary Option Arrows | `binary-option-arrows` | Trend | price |  |  |
| 132 | Bitcoin 2Y-SMA Bands\| Astral Vision | `bitcoin-2y-sma-bands-astral-vision` | Channels & Bands | own | AstralVision | batch 34 |
| 133 | Bitcoin Bull/Bear Market Support/Resistance Bands | `bitcoin-bull-bear-market-support-resistance-bands` | Moving Averages | price | JoeSTM | batch 30 |
| 134 | Bitcoin Kill Zones v2 | `bitcoin-kill-zones` | Trend | price |  |  |
| 135 | Bitcoin Log Growth Curves | `bitcoin-log-curves` | Trend | price | Quantadelic |  |
| 136 | Bitcoin: Mayer Multiple | `bitcoin-mayer-multiple` | Oscillators | own | sito4713 | batch 25 |
| 137 | Bitcoin: Pi Cycle Top & Bottom Indicator Z Score | `bitcoin-pi-cycle-top-bottom-indicator-z-score` | Oscillators | own | Commandoum | batch 37 |
| 138 | Bjorgum AutoTrail | `bjorgum-autotrail` | Trend | price | Bjorgum (simplified for auto mode) |  |
| 139 | Bjorgum TSI | `bjorgum-tsi` | Momentum | own |  |  |
| 140 | Blacklab84 Panel | `blacklab84-panel` | Oscillators | own | blacklab84 | batch 21 |
| 141 | BNF 25/50 MA Pullback Screener (Uptrend-Below / Downtrend-Above) | `bnf-25-50-ma-pullback-screener` | Trend | price | jackson_g_sheehan | batch 35 |
| 142 | Bollinger Adaptive Trend Navigator | `bollinger-adaptive-trend-navigator` | Trend | price | QuantAlgo | batch 16 |
| 143 | Bollinger Awesome Alert R1.1 | `bollinger-awesome-alert` | Trend | price |  |  |
| 144 | Bollinger Free Bars | `bollinger-free-bars` | Channels & Bands | price | pkuliyi | batch 36 |
| 145 | Bollinger Heatmap | `bollinger-heatmap` | Channels & Bands | own | Quantitative | batch 25 |
| 146 | Boom Hunter Pro | `boom-hunter-pro` | Momentum | own | veryfid |  |
| 147 | Breakdown or Buyable Dip? Pullback Depth Can Help | `breakdown-or-buyable-dip-pullback-depth-can-help` | Momentum | own | TradeStation | batch 23 |
| 148 | Breakout an Reversal Signal Detector with Colored in Bar Trends | `breakout-an-reversal-signal-detector-with-colored-in-bar-trends` | Channels & Bands | price | AmGlad_Trader | batch 25 |
| 149 | Breakout Indicator | `breakout-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 150 | BTC Logarithmic Regression Quantile Bands \| Astral Vision | `btc-logarithmic-regression-quantile-bands-astral-vision` | Channels & Bands | price | AstralVision | batch 24 |
| 151 | Bull Bear Power Trend | `bull-bear-power-trend` | Momentum | own |  |  |
| 152 | Bullish Engulfing Finder | `bullish-engulfing-finder` | Candlestick Patterns | price |  |  |
| 153 | Bullish Volume Anomaly | `bullish-volume-anomaly` | Volume | price | UnknownUnicorn13336802 | batch 31 |
| 154 | Bulls or Bears in Control | `bulls-bears-control` | Trend | own |  |  |
| 155 | Bulls v Bears | `bulls-v-bears` | Momentum | own | Mihkel00 | batch 3 |
| 156 | Buy & Sell - Accurate Signals | `buy-sell-accurate-signals` | Trend | price | Cryptokingworld91 (published as "Buy & Sell - Accurate Signals") | batch 7 |
| 157 | Buy & Sell Pressure | `buy-sell-pressure` | Volume | own |  |  |
| 158 | Buy Low Sell High Composite Upgraded V6 | `buy-low-sell-high-composite-upgraded-v6` | Oscillators | own | kristian6ncqq | batch 15 |
| 159 | Buy on Volume | `buy-on-volume` | Moving Averages | price | Mando4_27 | batch 21 |
| 160 | Buy/Sell Hull Crossover Signals (Fast & Slow) | `buy-sell-hull-crossover-signals` | Moving Averages | price | VibeAlgos | batch 11 |
| 161 | Buyers & Sellers / Range | `buyers-sellers-range` | Oscillators | own | fract | batch 11 |
| 162 | Buyers vs Sellers | `buyers-vs-sellers` | Momentum | own | davorloncarpetrovic | batch 19 |
| 163 | Buying & Selling Pressure | `buying-selling-pressure` | Volatility | own | fract | batch 3 |
| 164 | Buying and Selling Volume Pressure S/R | `buying-and-selling-volume-pressure-s-r` | Volume | price | DinoTradez | batch 16 |
| 165 | Buying Selling Volume | `buying-selling-volume` | Volume | own | ceyhun (community) |  |
| 166 | Buying vs Selling Moving Averages (Scalp Meter) | `buying-vs-selling-moving-averages` | Volume | own | codycolton97 | batch 24 |
| 167 | BuySell Volume Bar Chart | `buysell-volume-bar-chart` | Volume | own | roshbiz1408 | batch 21 |
| 168 | BuySell%_ImtiazH_v2 | `buysell-imtiazh-v2` | Volume | own | a272a59956 | batch 22 |
| 169 | Cabal Dev Indicator | `cabal-dev-indicator` | Oscillators | own | SolanaMemeCoins | batch 26 |
| 170 | Candle Breakout Oscillator | `candle-breakout-oscillator` | Oscillators | own | LuxAlgo | batch 2 |
| 171 | Candle BUY SELL + Support Resistance | `candle-buy-sell-support-resistance` | Channels & Bands | price | JohnsonForexTrader | batch 32 |
| 172 | Candle Channel | `candle-channel` | Channels & Bands | price | Uncle_the_shooter | batch 23 |
| 173 | Candle Count RSI | `candle-count-rsi` | Oscillators | own | Sherlock_MacGyver | batch 35 |
| 174 | Candle Range Theory (CRT) by Lucas | `candle-range-theory-by-lucas` | Trend | price | lucasfff | batch 15 |
| 175 | Candle Range Trading (CRT) | `candle-range-trading` | Trend | price | marcostan93 | batch 1 |
| 176 | Candle Spread Oscillator (CS0) | `candle-spread-oscillator` | Oscillators | own | RWCS_LTD | batch 36 |
| 177 | Candlestick Reversal | `candlestick-reversal` | Candlestick Patterns | price | LonesomeTheBlue (community) |  |
| 178 | Cardwell RSI by TQ | `cardwell-rsi-by-tq` | Oscillators | own | TradeQUO | batch 24 |
| 179 | Carrier Volatility | `carrier-volatility` | Oscillators | own | et20tradeview | batch 15 |
| 180 | CBC Flip with Volume | `cbc-flip-with-volume` | Trend | price | PtGambler | batch 18 |
| 181 | CCI coded OBV | `cci-obv` | Oscillators | own | LazyBear |  |
| 182 | CCI Length | `cci-stochastic` | Momentum | own |  |  |
| 183 | CCI Pro | `cci-hash-capital` | Oscillators | own | Hash_Capital | batch 24 |
| 184 | CCT Bollinger Band Oscillator | `cct-bbo` | Oscillators | own | LazyBear |  |
| 185 | CDC Action Zone | `cdc-action-zone` | Trend | price |  |  |
| 186 | Center of Gravity Channel | `cog-channel` | Channels & Bands | price |  |  |
| 187 | CHAKRA RISS ENGULFING CANDLESTICK STRATEGY | `chakra-riss-engulfing-candlestick-strategy` | Momentum | price | Tradewith_Riss | batch 18 |
| 188 | Chandelier Exit | `chandelier-exit` | Trend | price |  |  |
| 189 | Chandelier Stop | `chandelier-stop` | Trend | price |  |  |
| 190 | Change-Point Detection (CUSUM) | `change-point-detection` | Trend | price | LuxAlgo | batch 6 |
| 191 | CHN BUY SELL with EMA 200 | `chn-buy-sell-with-ema-200` | Trend | price | CHNTeam | batch 10 |
| 192 | Clean Volume Bars (Green/Red + Above Avg Highlight) | `clean-volume-bars` | Volume | own | melospoker80 | batch 37 |
| 193 | Climax Volume Reversal Radar | `climax-volume-reversal-radar` | Volume | own | Ty_yanse | batch 31 |
| 194 | Clustering Volatility (ATR-ADR-ChaikinVol) | `clustering-volatility` | Volatility | own | SDF-Solutions | batch 24 |
| 195 | CM EMA Trend Bars | `cm-ema-trend-bars` | Trend | price | ChrisMoody |  |
| 196 | CM Enhanced Ichimoku Cloud V5 | `cm-enhanced-ichimoku` | Channels & Bands | price | ChrisMoody (community) |  |
| 197 | CM Gann Swing High Low V2 | `cm-gann-swing` | Trend | price | ChrisMoody (community) |  |
| 198 | CM Guppy EMA | `cm-guppy-ema` | Moving Averages | price | ChrisMoody |  |
| 199 | CM Heikin-Ashi | `cm-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 200 | CM Laguerre PPO PercentileRank | `cm-laguerre-ppo` | Oscillators | own | ChrisMoody |  |
| 201 | CM Price Action Bars | `cm-price-action` | Oscillators | price | ChrisMoody |  |
| 202 | CM RSI Plus EMA | `cm-rsi-ema` | Oscillators | own | ChrisMoody |  |
| 203 | CM RSI-2 Strategy Lower | `cm-rsi-2-lower` | Oscillators | own | ChrisMoody |  |
| 204 | CM RSI-2 Strategy Upper | `cm-rsi-2-upper` | Oscillators | price | ChrisMoody |  |
| 205 | CM Sling Shot System | `cm-sling-shot` | Trend | price | ChrisMoody |  |
| 206 | CM Stochastic Highlight Bars | `cm-stoch-highlight` | Oscillators | price | ChrisMoody |  |
| 207 | CM Stochastic POP Method 1 | `stoch-pop-1` | Oscillators | own | ChrisMoody |  |
| 208 | CM Stochastic POP Method 2 | `stoch-pop-2` | Oscillators | own | ChrisMoody |  |
| 209 | CM Time Based Vertical Lines | `cm-time-lines` | Trend | price | ChrisMoody |  |
| 210 | CM Williams Vix Fix V3 | `cm-vix-fix-v3` | Oscillators | own | ChrisMoody |  |
| 211 | CMO For Loop \| QuantLapse | `cmo-for-loop-quantlapse` | Momentum | own | QuantLapse | batch 19 |
| 212 | Colored Volume Bars | `colored-volume` | Volume | own | LazyBear |  |
| 213 | Combo Oscillator - MACD + Stoch + RSI + EMA | `combo-oscillator-macd-stoch-rsi-ema` | Oscillators | own | Gauder84 | batch 34 |
| 214 | Community MoneyLine | `community-moneyline` | Trend | price | rafstar_kaczmarek | batch 12 |
| 215 | Composite Indicator (CCI + ATR) | `composite-indicator` | Momentum | price | CharLi0t | batch 17 |
| 216 | Consecutive Candles DevisSo | `consecutive-candles-devisso` | Trend | price | engineerofmoney | batch 11 |
| 217 | Consolidation Zones - Live | `consolidation-zones` | Channels & Bands | price | LonesomeTheBlue |  |
| 218 | Conversion Periods | `ichimoku-oscillator` | Momentum | own |  |  |
| 219 | Coral Trend | `coral-trend` | Trend | price | LazyBear |  |
| 220 | Corrected Moving Average | `corrected-moving-average` | Moving Averages | price | everget | batch 3 |
| 221 | COV Bands ~ C H I P A | `cov-bands-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 28 |
| 222 | Crosby Ratio \| QuantumResearch | `crosby-ratio-quantumresearch` | Momentum | own | QuantumResearch | batch 17 |
| 223 | Crossover EMMM | `crossover-emmm` | Trend | price | NunyadzilaTrading | batch 22 |
| 224 | CRT indicator | `crt-indicator` | Trend | price | INTELA | batch 16 |
| 225 | Curved Trend Channels | `curved-trend-channels` | Channels & Bands | price | Zeiierman | batch 7 |
| 226 | Custom Donchian Channels | `donchian-custom` | Channels & Bands | price |  |  |
| 227 | CVD (Cumulative Volume Delta) | `cvd-rupward` | Volume | own | RUpward | batch 19 |
| 228 | CVD Polarity Indicator (With Rolling Smoothed) | `cvd-polarity-indicator` | Volume | own | Cruiser | batch 35 |
| 229 | Cycle & Flow Indicator - D_Quant | `cycle-flow-indicator-d-quant` | Trend | price | D_QUANT | batch 22 |
| 230 | Cycle Low (RSI + StochRSI) – v5 John.K | `cycle-low-v5-john-k` | Momentum | price | John_Kal | batch 22 |
| 231 | Cycle-Synced Channel Breakout | `cycle-synced-channel-breakout` | Channels & Bands | price | TradeTechanalysis | batch 25 |
| 232 | Dan's Ironclad OB - Simple | `dan-s-ironclad-ob-simple` | Trend | price | hynaxiii | batch 10 |
| 233 | Darvas Box | `darvas-box` | Candlestick Patterns | price |  |  |
| 234 | DECODE Moving Average Toolkit | `decode-moving-average-toolkit` | Moving Averages | price | decodejar | batch 20 |
| 235 | Delta Volume RSI | `delta-volume-rsi` | Volume | own | destrobr0685 | batch 24 |
| 236 | Delta-RSI Oscillator | `delta-rsi-oscillator` | Momentum | own | tbiktag (simplified) |  |
| 237 | DEMA Flow | `dema-flow` | Trend | price | AlphaExtract | batch 7 |
| 238 | Demand Index (James Sibbet) | `demand-index` | Volume | own | conair | batch 37 |
| 239 | Deviation Symmetry Breaker ~ C H I P A | `deviation-symmetry-breaker-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 18 |
| 240 | Directional Indicator Crossovers v1 | `directional-indicator-crossovers-v1` | Trend | own | JopAlgo | batch 7 |
| 241 | Directional Logistic Oscillator | `directional-logistic-oscillator` | Oscillators | own | GainzAlgo | batch 2 |
| 242 | Directional Movement Index + ADX & Key Levels | `dmi-adx-levels` | Trend | own |  |  |
| 243 | Disparity Index | `disparity-index` | Oscillators | own | HPotter | batch 10 |
| 244 | Divergence Indicator | `divergence-indicator` | Momentum | price |  |  |
| 245 | DMI Delta by 0xjcf | `dmi-delta-by-0xjcf` | Trend | own | J_O_S_E_ | batch 34 |
| 246 | DMI Histogram Indicator | `dmi-histogram-indicator` | Trend | own | Chart0bserver | batch 32 |
| 247 | DN MACD | `dn-macd` | Momentum | own | lihulu123 | batch 32 |
| 248 | Dominance Signal Apex | `dominance-signal-apex` | Trend | price | chervolino | batch 17 |
| 249 | Donchian Trend Ribbon | `donchian-trend-ribbon` | Trend | own | LonesomeTheBlue |  |
| 250 | Dope DPO | `dope-dpo` | Oscillators | own | Sherlock_MacGyver | batch 14 |
| 251 | Double Median ATR Bands \| MisinkoMaster | `double-median-atr-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 28 |
| 252 | Double Median SD Bands \| MisinkoMaster | `double-median-sd-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 30 |
| 253 | Double RSI | `double-rsi` | Momentum | own | Clokivez | batch 9 |
| 254 | Dual Bayesian For Loop | `dual-bayesian-for-loop` | Momentum | own | QuantAlgo | batch 5 |
| 255 | Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation) | `dual-ema-trend-ribbon` | Moving Averages | price | Aleksin_Aleksandar | batch 3 |
| 256 | Dual MA SD Oscillator | `dual-ma-sd-oscillator` | Oscillators | own | SchizoQuant | batch 9 |
| 257 | Dual RSI Smoother | `dual-rsi-smoother` | Oscillators | own | TheUltimator5 | batch 8 |
| 258 | Dynamic Flow Ribbons | `dynamic-flow-ribbons` | Trend | price | BigBeluga | batch 2 |
| 259 | Dynamic Fractal Flow | `dynamic-fractal-flow` | Oscillators | own | AlphaExtract | batch 21 |
| 260 | Dynamic Score PSAR | `dynamic-score-psar` | Trend | own | QuantAlgo | batch 8 |
| 261 | Dynamic Stop Loss & Take Profit | `dynamic-stop-loss-take-profit` | Volatility | price | criptoblast2 | batch 23 |
| 262 | Dynamic Structure Indicator | `dynamic-structure-indicator` | Trend | price |  |  |
| 263 | Dynamic Support & Resistance | `dynamic-support-resistance` | Moving Averages | price | ZenAndTheArtOfTrading | batch 1 |
| 264 | Dynamic Testing | `dynamic-testing` | Oscillators | price | ProfitNomad | batch 9 |
| 265 | Dynamic Trailing | `dynamic-trailing` | Trend | price | Zeiierman | batch 5 |
| 266 | Dynamic Trend Bands | `dynamic-trend-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 267 | Dynamic Trend Channel (DTC) | `dynamic-trend-channel` | Channels & Bands | price | JohnsonForexTrader | batch 27 |
| 268 | Dynamic Volatility Filter | `dynamic-volatility-filter` | Trend | price | QuantAlgo | batch 4 |
| 269 | Dynamic Volume Clusters with Retest Signals | `dynamic-volume-clusters` | Channels & Bands | price | Zeiierman | batch 2 |
| 270 | Dynamic Volume Profile Oscillator | `dynamic-volume-profile-oscillator` | Volume | own | AlphaNatt | batch 1 |
| 271 | Dynamic VWAP: Fair Value & Divergence Suite | `dynamic-vwap-fair-value-divergence-suite` | Channels & Bands | price | RWCS_LTD | batch 30 |
| 272 | E9 Bollinger Range | `e9-bollinger-range` | Channels & Bands | price | E9XBT | batch 34 |
| 273 | Early MACD Reversal Indicator | `early-macd-reversal-indicator` | Momentum | own | StockSignaler | batch 10 |
| 274 | Early Pivot Alert (price-quantum reversal) • v1a (arrows only) | `early-pivot-alert-v1a` | Trend | price | dirkbiebaut | batch 35 |
| 275 | Easy Entry/Exit Trend Colors | `easy-trend-colors` | Trend | own |  |  |
| 276 | Edward Smart Channel Reversal | `edward-smart-channel-reversal` | Channels & Bands | price | Jos-ProTrader | batch 13 |
| 277 | Effective Volume Z-Score | `effective-volume-z-score` | Volume | own | eugencovaci | batch 35 |
| 278 | Efficiency Ratio Trend | `efficiency-ratio-trend` | Trend | price | achirameegasthanne | batch 9 |
| 279 | Ehlers Adaptive RSI | `ehlers-adaptive-rsi` | Oscillators | own | Julien_Exe | batch 14 |
| 280 | Ehlers Adaptive Trend Indicator | `ehlers-adaptive-trend-indicator` | Trend | price | AlphaExtract | batch 18 |
| 281 | Ehlers Instantaneous Trend | `ehlers-instantaneous-trend` | Trend | price |  |  |
| 282 | Ehlers Maclaurin Ultimate Smoother | `ehlers-maclaurin-ultimate-smoother` | Moving Averages | own | Mupsje | batch 33 |
| 283 | Ehlers MESA Adaptive Moving Average | `ehlers-mesa-ma` | Moving Averages | price | Ehlers |  |
| 284 | Ehlers Reverse EMA | `ehlers-reverse-ema` | Oscillators | own | AlgoCollective | batch 36 |
| 285 | Ehlers Stochastic CG Oscillator | `ehlers-stochastic-cg` | Oscillators | own |  |  |
| 286 | Elite Oscillator Pro | `elite-oscillator-pro` | Oscillators | own | Alpha_Wizard | batch 34 |
| 287 | Elliott Wave Oscillator | `elliott-wave-oscillator` | Oscillators | own | Koryu |  |
| 288 | Elliptic Curve SAR | `elliptic-curve-sar` | Trend | price | TEDCORP2 | batch 26 |
| 289 | EMA & MA Crossover | `ema-ma-crossover` | Moving Averages | price |  |  |
| 290 | EMA & MACD Strategy with SL/TP | `ema-macd-strategy-with-sl-tp` | Trend | price | mamachi- | batch 28 |
| 291 | EMA + RSI Autotrade Webhook - Varun | `ema-rsi-autotrade-webhook-varun` | Moving Averages | price | varuns_back | batch 17 |
| 292 | EMA + SuperTrend | `ema-supertrend` | Moving Averages | price | All_in_Traders |  |
| 293 | EMA + VWMA + ATR Smoothed BuySell (merged) - TOM ZENG 202509 | `ema-vwma-atr-smoothed-buysell-tom-zeng-202509` | Trend | price | zengtom | batch 18 |
| 294 | EMA 20/50/100/200 | `ema-multi` | Moving Averages | price |  |  |
| 295 | EMA 9 / 26 Cross | `ema-9-26-cross` | Moving Averages | price | h0s1m001 | batch 27 |
| 296 | EMA Cloud Trend | `ema-cloud-trend` | Moving Averages | price | ZkalishTR | batch 9 |
| 297 | EMA Cross Signals | `ema-cross-signals` | Moving Averages | price | Jos-ProTrader | batch 29 |
| 298 | EMA Enveloper | `ema-enveloper` | Moving Averages | price |  |  |
| 299 | EMA Oscillator | `ema-oscillator` | Oscillators | own | AlphaExtract | batch 16 |
| 300 | EMA Ribbon | `ema-ribbon` | Moving Averages | price |  |  |
| 301 | EMA Wave Indicator | `ema-wave` | Moving Averages | own |  |  |
| 302 | EMA/RMA clouds by Alpachino | `ema-rma-clouds-by-alpachino` | Moving Averages | price | Alpachino97 | batch 28 |
| 303 | EMA21 Pullback Buy | `ema21-pullback-buy` | Moving Averages | price | Kennedy08 | batch 23 |
| 304 | Emergent Rays - NovaTheMachine | `emergent-rays-novathemachine` | Moving Averages | price | NovaTheMachine | batch 32 |
| 305 | Enhanced KLSE Banker Flow Oscillator | `enhanced-klse-banker-flow-oscillator` | Oscillators | own | Dr_Leong_Yee_Rock | batch 15 |
| 306 | Enhanced VFI Buyer/Seller Pressure | `enhanced-vfi-buyer-seller-pressure` | Volume | own | ask2maniish | batch 28 |
| 307 | Enhanced VSA Volume & Candle Colors with MA Selection | `enhanced-vsa-volume-candle-colors-with-ma-selection` | Volume | own | ViZiV | batch 27 |
| 308 | Entropy Bands | `entropy-bands` | Channels & Bands | price | TechnoBlooms | batch 20 |
| 309 | Entry / TP / SL Alert Bands (Simple & Stable) | `entry-tp-sl-alert-bands` | Channels & Bands | price | drlicht1 | batch 34 |
| 310 | Entry Points | `entry-points` | Oscillators | price |  |  |
| 311 | Entry Signals (Long/Short) | `entry-signals-long-short` | Trend | price | tradegear9 | batch 1 |
| 312 | Envelope RSI | `envelope-rsi` | Oscillators | price | Saleh_Toodarvari |  |
| 313 | Equalhigh JAPANESE TRIPLE RCI | `equalhigh-japanese-triple-rci` | Oscillators | own | Stevesyl | batch 22 |
| 314 | ERD: Effort-Result Diagnostic | `erd-effort-result-diagnostic` | Channels & Bands | price | DarwinDarma | batch 32 |
| 315 | Euclidean Range | `euclidean-range` | Volatility | own | InvestorUnknown | batch 21 |
| 316 | EURUSD Swing High/Low Projection | `eurusd-swing-high-low-projection` | Channels & Bands | price | tiprolin | batch 37 |
| 317 | Evil MACD Trading System (Pine Script v6) | `evil-macd-trading-system` | Momentum | price | daves723 | batch 37 |
| 318 | EVWMA Envelope | `evwma-envelope` | Oscillators | price |  |  |
| 319 | Exhaustion Zone | `exhaustion-zone` | Channels & Bands | price | rukich | batch 6 |
| 320 | Faith Indicator | `faith-indicator` | Trend | own |  |  |
| 321 | False Breakout (Expo) | `false-breakout` | Channels & Bands | price | Zeiierman |  |
| 322 | Faraz Perfect Structure Scalper + Long Short (Indicator Alerts) | `faraz-perfect-structure-scalper-long-short` | Trend | price | fsaleem03 | batch 29 |
| 323 | Fast Length | `bjorgum-triple-ema` | Moving Averages | price |  |  |
| 324 | Fast WMA | `fast-wma` | Moving Averages | own | Clokivez | batch 25 |
| 325 | Fibonacci Bollinger Bands | `fibonacci-bollinger-bands` | Channels & Bands | price | Rashad |  |
| 326 | Fibonacci HH LL TRAMA Band | `fibonacci-hh-ll-trama-band` | Channels & Bands | price | FibonacciFlux | batch 16 |
| 327 | Fibonacci Levels | `fibonacci-levels` | Channels & Bands | price |  |  |
| 328 | Fibonacci Moving Averages | `fibonacci-moving-averages` | Moving Averages | price | UkutaLabs | batch 28 |
| 329 | Fibonacci Weighted Moving Average | `fibonacci-weighted-moving-average` | Moving Averages | price | everget | batch 12 |
| 330 | Fibonacci Zone | `fibonacci-zone` | Channels & Bands | price |  |  |
| 331 | FibSync - DynamicFibSupport | `fibsync-dynamicfibsupport` | Channels & Bands | price | mr_uponly | batch 34 |
| 332 | Filter Ribbon | `filter-ribbon` | Trend | price | c9indicator | batch 4 |
| 333 | Filter Wave | `filter-wave` | Trend | price | c9indicator | batch 15 |
| 334 | Fisher MPz | `fisher-mpz` | Oscillators | own | B3AR_Trades | batch 30 |
| 335 | Fisher Volume Transform \| AlphaNatt | `fisher-volume-transform-alphanatt` | Oscillators | own | AlphaNatt | batch 16 |
| 336 | Fixed-Range Volume-Profile Zones | `fixed-range-volume-profile-zones` | Volume | own | RWCS_LTD | batch 13 |
| 337 | Flow Control Oscillator (FCO) | `flow-control-oscillator` | Volume | own | WalrusQuant | batch 19 |
| 338 | FlowShift Oscillator | `flowshift-oscillator` | Oscillators | own | BOSWaves | batch 24 |
| 339 | Follow Line | `follow-line` | Trend | price | Dreadblitz |  |
| 340 | For-Loop Vote Trailing Stop \| MiesOnCharts | `for-loop-vote-trailing-stop-miesoncharts` | Trend | price | MiesOnCharts | batch 31 |
| 341 | Force Pulse | `force-pulse` | Oscillators | own | Uncle_the_shooter | batch 17 |
| 342 | Forecast Oscillator | `forecast-oscillator` | Oscillators | own | KivancOzbilgic |  |
| 343 | Forex Sessions | `forex-sessions` | Oscillators | own |  |  |
| 344 | Fourier series Model Of The Market | `fourier-series-model-of-the-market` | Oscillators | own | e2e4 | batch 12 |
| 345 | Fractal Exhaustion Band | `fractal-exhaustion-band` | Trend | price | QuantAlgo | batch 2 |
| 346 | Fractal Strength Oscillator | `fractal-strength-oscillator` | Oscillators | own | SurgeQuant | batch 20 |
| 347 | Fractals Trend | `fractals-trend` | Trend | price | BigBeluga | batch 2 |
| 348 | Fractional EMA Kalman Filter | `fractional-ema-kalman-filter` | Moving Averages | price | et20tradeview | batch 4 |
| 349 | FSVZO | `fsvzo` | Volume | own | AlphaExtract | batch 5 |
| 350 | Function Savitzky Golay Filter with 7 Vectors V0 | `function-savitzky-golay-filter-with-7-vectors-v0` | Moving Averages | price | RicardoSantos | batch 33 |
| 351 | FVG Breakout/Breakdown | `fvg-breakout-breakdown` | Trend | price | ICT_Concept_Trading | batch 33 |
| 352 | FVG Positioning Average | `fvg-positioning-average` | Trend | price | LuxAlgo |  |
| 353 | FX Sniper T3-CCI | `fx-sniper-t3-cci` | Oscillators | own |  |  |
| 354 | FxShare - CC Reversal | `fxshare-cc-reversal` | Trend | price | FxShareRobots | batch 22 |
| 355 | G-Score \| NAL | `g-score-nal` | Oscillators | own | NordicAlphaLab | batch 13 |
| 356 | Gabriel's Andean Oscillator | `gabriel-s-andean-oscillator` | Trend | own | GabrielAmadeusLau | batch 23 |
| 357 | Gamma + Fibonacci EMA Bands | `gamma-fibonacci-ema-bands` | Moving Averages | price | ky_yule1010 | batch 23 |
| 358 | Gamma Hedging Pressure (Normalized -100 to +100) | `gamma-hedging-pressure` | Momentum | own | uzair2join | batch 20 |
| 359 | Gann High Low | `gann-high-low` | Trend | price | KivancOzbilgic |  |
| 360 | GANN Level (Salil Sir) | `gann-level` | Channels & Bands | price | prabhat76 | batch 12 |
| 361 | Gaussian Acceleration Array | `gaussian-acceleration-array` | Momentum | own | NantzOS | batch 36 |
| 362 | Gaussian Filter Trend | `gaussian-filter-trend` | Trend | price | QuantAlgo | batch 2 |
| 363 | Gaussian Ribbon | `gaussian-ribbon` | Moving Averages | price | NantzOS | batch 13 |
| 364 | Gaussian RSI \| NAL | `gaussian-rsi-nal` | Momentum | own | NordicAlphaLab | batch 7 |
| 365 | GBR Micro Kernel Trend | `gbr-micro-kernel-trend` | Moving Averages | price | THEGBR | batch 36 |
| 366 | Gho$t EMA Cloud | `gho-t-ema-cloud` | Moving Averages | price | Ghostmlt | batch 29 |
| 367 | Gideons Gold - ADX Watchman | `gideons-gold-adx-watchman` | Trend | own | gideonsgold | batch 34 |
| 368 | GMMA Oscillator | `gmma-oscillator` | Trend | own |  |  |
| 369 | Gold Trend Signal Indicator | `gold-trend-signal-indicator` | Trend | price | CsmillrSirrry | batch 33 |
| 370 | Golden & Death Cross with Re-Activation | `golden-death-cross-with-re-activation` | Moving Averages | price | oberlunar_tr | batch 26 |
| 371 | Golden Ratio Trend Persistence | `golden-ratio-trend-persistence` | Trend | price | YetAnotherTA | batch 9 |
| 372 | Golden/Death Cross Highlighter | `golden-death-cross-highlighter` | Moving Averages | price | dripvesting | batch 36 |
| 373 | Gorgo's Hybrid Oscillator STrategy | `gorgo-s-hybrid-oscillator-strategy` | Oscillators | own | Gorgomannaro | batch 32 |
| 374 | Gradient Trend Filter | `gradient-trend-filter` | Trend | price | ChartPrime | batch 1 |
| 375 | Granville Entry Guide | `granville-entry-guide` | Moving Averages | price | fightpm | batch 17 |
| 376 | Gravity Well Trend \| Lyro RS | `gravity-well-trend-lyro-rs` | Trend | price | LyroRS | batch 10 |
| 377 | Gridbot Ping Pong | `gridbot-ping-pong` | Channels & Bands | price | xxattaxx | batch 18 |
| 378 | Guppy MMA | `guppy-mma` | Moving Averages | own | AlphaExtract | batch 15 |
| 379 | Guppy Multiple Moving Average | `gmma` | Moving Averages | price | Daryl Guppy |  |
| 380 | Guppy Oscillator-REvans993 | `guppy-oscillator-revans993` | Oscillators | own | REvans993 | batch 36 |
| 381 | Guppy Wave | `guppy-wave` | Moving Averages | price | UkutaLabs | batch 25 |
| 382 | GWAP (Gamma Weighted Average Price) | `gwap` | Moving Averages | price | EdgeTools | batch 18 |
| 383 | H-Infinity Volatility Filter | `h-infinity-volatility-filter` | Trend | price | QuantAlgo | batch 7 |
| 384 | HalfTrend | `half-trend` | Trend | price | everget |  |
| 385 | HaP MACD | `hap-macd` | Momentum | own | agahakanaga | batch 1 |
| 386 | Harmonic Periodicity Matrix | `harmonic-periodicity-matrix` | Oscillators | own | Pineify | batch 29 |
| 387 | Harmonic Sniper Trigger - PyraTime | `harmonic-sniper-trigger-pyratime` | Oscillators | own | PyraTime | batch 27 |
| 388 | HARSI+CBC | `harsi-cbc` | Oscillators | own | mehmetbezgincan | batch 34 |
| 389 | HawkEye Volume | `hawkeye-volume` | Volume | own |  |  |
| 390 | Heatmap Volume | `heatmap-volume` | Volume | own | xdecow |  |
| 391 | Heiken Ashi Ribbon | `heiken-ashi-ribbon` | Trend | price | UkutaLabs | batch 21 |
| 392 | Heikin Ashi RSI Oscillator | `heikin-ashi-rsi-oscillator` | Momentum | own | JayRogers |  |
| 393 | Heikin Line - TB365 | `heikin-line-tb365` | Moving Averages | price | tradebot_365 | batch 32 |
| 394 | HEMA Trend Levels | `hema-trend-levels` | Trend | price | AlgoAlpha |  |
| 395 | Henderson Weighted Moving Average | `henderson-weighted-moving-average` | Moving Averages | price | everget | batch 30 |
| 396 | High For Loop \| MisinkoMaster | `high-for-loop-misinkomaster` | Trend | own | MisinkoMaster | batch 37 |
| 397 | High Volume Arrow Signals (Ajustável) | `high-volume-arrow-signals` | Volume | price | IdeManson | batch 24 |
| 398 | High-Low of X Bar | `high-low-of-x-bar` | Volatility | own | sam-austin | batch 29 |
| 399 | Hilega-Milega-RSI-EMA-WMA indicator designed by NK | `hilega-milega-rsi-ema-wma-indicator-designed-by-nk` | Oscillators | own | kshirsagar_n | batch 14 |
| 400 | Historical Liquidity Proximity Heatmap | `liquidity-proximity-heatmap` | Volume | price | LuxAlgo | batch 3 |
| 401 | HMA Breakdown | `hma-breakdown` | Moving Averages | price | NonLinearRookie | batch 11 |
| 402 | HOTT LOTT | `hott-lott` | Trend | price | KivancOzbilgic |  |
| 403 | HPDR Bands Indicator | `hpdr-bands-indicator` | Channels & Bands | price | afonso_77 | batch 23 |
| 404 | HTC peppermint_07 CCI w signal + s&r RSI | `htc-peppermint-07-cci-w-signal-s-r-rsi` | Oscillators | own | peppermint07 | batch 14 |
| 405 | HTH - WD Gann Square Root Levels | `hth-wd-gann-square-root-levels` | Channels & Bands | price | tamillselvan | batch 27 |
| 406 | Hull Butterfly Oscillator | `hull-butterfly-oscillator` | Momentum | own |  |  |
| 407 | Hull Suite | `hull-suite` | Trend | price |  |  |
| 408 | Hunters Reversal v2.3 | `hunters-reversal-v2-3` | Trend | price | d_jaeger | batch 33 |
| 409 | Hurst-Based Trend Persistence w/Poisson Prediction | `hurst-based-trend-persistence-w-poisson-prediction` | Oscillators | own | garysebastianbrowniii | batch 28 |
| 410 | HyperTrend [LuxAlgo] | `hyper-trend` | Trend | price | LuxAlgo |  |
| 411 | Ichimoku ACE Club | `ichimoku-ace-club` | Trend | price | binhmyco | batch 26 |
| 412 | Ichimoku EMA Bands | `ichimoku-ema-bands` | Channels & Bands | price |  |  |
| 413 | Ichimoku Kinko Hyo | `ichimoku-kinko-hyo` | Trend | price | insideandup | batch 32 |
| 414 | Ichimoku Score Indicator | `ichimoku-score-indicator` | Trend | own | tanayroy | batch 29 |
| 415 | Ichimoku w/Heikin-Ashi | `ichimoku-w-heikin-ashi` | Trend | price | yasujiy | batch 25 |
| 416 | ICT & RTM Price Action Indicator | `ict-rtm-price-action-indicator` | Channels & Bands | price | behradmojtahedi | batch 21 |
| 417 | ICT FVG Buy/Sell Signals | `ict-fvg-buy-sell-signals` | Trend | price | svmstellarvisionmedia | batch 5 |
| 418 | Ideal Entry Point | `ideal-entry-point` | Trend | price |  |  |
| 419 | IFT Stoch RSI CCI | `ift-stoch-rsi-cci` | Momentum | own | KivancOzbilgic |  |
| 420 | IIR One-Pole Price Filter | `iir-one-pole-price-filter` | Moving Averages | price | BackQuant | batch 9 |
| 421 | Impulse MACD | `impulse-macd` | Momentum | own | LazyBear |  |
| 422 | Indicador Millo SMA20-SMA200-AO-RSI M1 | `indicador-millo-sma20-sma200-ao-rsi-m1` | Moving Averages | price | hernangarcia_78 | batch 19 |
| 423 | Infinite EMA with Alpha Control | `infinite-ema-with-alpha-control` | Moving Averages | price | Sesilya | batch 13 |
| 424 | Inside Bars (Multiple / Consecutive) | `inside-bars` | Channels & Bands | price | nilstrades_ | batch 5 |
| 425 | Instantaneous Trendline with Cloud | `instantaneous-trendline-with-cloud` | Trend | price | Sesilya | batch 22 |
| 426 | Institutional Composite Moving Average (ICMA) | `institutional-composite-moving-average` | Moving Averages | price | VolumeVigilante | batch 6 |
| 427 | Institutional MACD (Z-Score Edition) | `institutional-macd` | Momentum | own | VolumeVigilante | batch 4 |
| 428 | Institutional Volume RSI | `institutional-volume-rsi` | Momentum | own | abgthecoder | batch 6 |
| 429 | Interpolated Median Volatility LSMA \| Otto | `interpolated-median-volatility-lsma-otto` | Channels & Bands | price | oquant | batch 12 |
| 430 | Intraday BUY_SELL | `intraday-buy-sell` | Trend | price |  |  |
| 431 | Intraday TS BB | `intraday-ts-bb` | Oscillators | price |  |  |
| 432 | Intraday Volume Swings | `intraday-volume-swings` | Volume | price | rumpypumpydumpy |  |
| 433 | Intraday vs Overnight Change Tracker | `intraday-vs-overnight-change-tracker` | Momentum | own | TheUltimator5 | batch 12 |
| 434 | Intraday vs Overnight OBV | `intraday-vs-overnight-obv` | Volume | own | TheUltimator5 | batch 21 |
| 435 | Inverse Distance Weighted Moving Average | `inverse-distance-weighted-moving-average` | Moving Averages | price | everget | batch 15 |
| 436 | IPO Date Screener | `ipo-date-screener` | Oscillators | own | starshiptrade | batch 14 |
| 437 | Is it Time for a Pullback? Check Bars Since MA Test | `is-it-time-for-a-pullback-check-bars-since-ma-test` | Trend | own | TradeStation | batch 25 |
| 438 | Isolated Peak and Bottom | `isolated-peak-bottom` | Oscillators | price |  |  |
| 439 | IU Mean Reversion System | `iu-mean-reversion-system` | Channels & Bands | price | Shivam_Mandrai | batch 12 |
| 440 | IU Smart Flow System | `iu-smart-flow-system` | Trend | price | Shivam_Mandrai | batch 7 |
| 441 | IV Rank (tasty-style) - VIXFix / HV Proxy | `iv-rank-vixfix-hv-proxy` | Volatility | own | steveoptionstrade2025 | batch 30 |
| 442 | JOPA Channel (Dual-Volumed) v1 | `jopa-channel-v1` | Channels & Bands | price | JopAlgo | batch 30 |
| 443 | Jurik Moving Average | `jurik-moving-average` | Moving Averages | price | everget | batch 1 |
| 444 | Kalman Ema Crosses | `kalman-ema-crosses` | Moving Averages | price | JTCapitalNL | batch 16 |
| 445 | Kalman Exponentialy Weighted Moving Average \| MisinkoMaster | `kalman-exponentialy-weighted-moving-average-misinkomaster` | Moving Averages | price | MisinkoMaster | batch 25 |
| 446 | Kalman Filter Trend Breakers | `kalman-filter-trend-breakers` | Trend | price | kypexin | batch 29 |
| 447 | Kalman Flow \| Lyro RS | `kalman-flow-lyro-rs` | Trend | price | LyroRS | batch 5 |
| 448 | Kalman Hull Bands For Loop \| RakoQuant | `kalman-hull-bands-for-loop-rakoquant` | Channels & Bands | price | RakoQuant | batch 17 |
| 449 | Kalman Hull Kijun | `kalman-hull-kijun` | Trend | price | BackQuant | batch 12 |
| 450 | Kalman VWAP Filter | `kalman-vwap-filter` | Moving Averages | price | BackQuant | batch 4 |
| 451 | Kaufman Adaptive Moving Average | `kaufman-adaptive-ma` | Moving Averages | price | everget |  |
| 452 | Kaufman Trend Strength Signal | `kaufman-trend-strength-signal` | Trend | price | PakunFX | batch 34 |
| 453 | KD-NewAutoTrade for Future Trading - Heikin Ashi candles | `kd-newautotrade-for-future-trading-heikin-ashi-candles` | Trend | price | krish16887 | batch 22 |
| 454 | KDJ | `kdj` | Oscillators | own | KingThies |  |
| 455 | Keltner-Aroon-EFI Flow | `keltner-aroon-efi-flow` | Trend | price | D_QUANT | batch 20 |
| 456 | Kernel Channel | `kernel-channel` | Channels & Bands | price | BackQuant | batch 6 |
| 457 | KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density | `kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density` | Volatility | own | SensitiveSuit | batch 15 |
| 458 | Key_TDI | `key-tdi` | Oscillators | own | Fibonacci_Code | batch 31 |
| 459 | Keyzone | `keyzone` | Channels & Bands | price | Uttaya | batch 28 |
| 460 | Kijun-Sen with Buy / Sell Labels & Alerts - Ichimoku simplified | `kijun-sen-with-buy-sell-labels-alerts-ichimoku-simplified` | Trend | price | TaureaYinYang | batch 36 |
| 461 | Kinetic Slippage Index (KSI) | `kinetic-slippage-index` | Volume | own | HPotter | batch 7 |
| 462 | Kiss Of Death | `kiss-of-death` | Trend | price | thanos300693 | batch 37 |
| 463 | L2 Risk Assessment for Trend Strength | `l2-risk-assessment-for-trend-strength` | Trend | own | blackcat1402 | batch 14 |
| 464 | Ladder StDev | `ladder-stdev` | Volatility | own | jason5480 | batch 30 |
| 465 | Laguerre Filter | `laguerre-filter` | Moving Averages | price | BackQuant | batch 5 |
| 466 | Laguerre RSI | `laguerre-rsi` | Momentum | own | TheLark |  |
| 467 | Laguerre Ultimate Explorations Multicator | `laguerre-ultimate-explorations-multicator` | Moving Averages | own | ImmortalFreedom | batch 20 |
| 468 | Laguerre-Kalman Adaptive Filter \| AlphaNatt | `laguerre-kalman-adaptive-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 11 |
| 469 | Left Bars | `pivot-hh-hl-lh-ll` | Trend | price |  |  |
| 470 | Leledc Levels | `leledc-levels` | Candlestick Patterns | price |  |  |
| 471 | Length | `gaussian-channel` | Channels & Bands | price |  |  |
| 472 | Length | `redk-vader` | Oscillators | own | RedKTrader |  |
| 473 | Length | `zlma-trend-levels` | Moving Averages | price |  |  |
| 474 | Level2 Signalfilter Liquidity Protection | `level2-signalfilter-liquidity-protection` | Trend | own | djmad | batch 16 |
| 475 | Leveraged Liquidation Zones | `leveraged-liquidation-zones` | Channels & Bands | price | Fussion_Trader | batch 35 |
| 476 | LGMM (flat buffers) - multivariate poly + latent states | `lgmm-multivariate-poly-latent-states` | Channels & Bands | price | vsov | batch 28 |
| 477 | Linear Predictive Filters (TASC 2025.01) | `linear-predictive-filters` | Oscillators | own | PineCodersTASC | batch 2 |
| 478 | Linear Regression Candles | `linear-regression-candles` | Candlestick Patterns | price |  |  |
| 479 | Linear Regression Channel | `linear-regression-channel` | Channels & Bands | price |  |  |
| 480 | Linear Regression Volume \| Lyro RS | `linear-regression-volume-lyro-rs` | Channels & Bands | price | LyroRS | batch 10 |
| 481 | Linear Volume MACD \| Lyro RS | `linear-volume-macd-lyro-rs` | Momentum | own | LyroRS | batch 9 |
| 482 | LineReg Candles with Hma filter | `linereg-candles-with-hma-filter` | Trend | price | MaximusGains | batch 14 |
| 483 | Liquidity Flow Zones (LFZ) | `liquidity-flow-zones` | Trend | price | ReubenMiles | batch 20 |
| 484 | Liquidity Grabs | `liquidity-grabs` | Trend | price | fluxchart |  |
| 485 | Liquidity Indicator | `liquidity-indicator` | Channels & Bands | price | The_Forex_Steward | batch 22 |
| 486 | Liquidity Levels [LuxAlgo] | `liquidity-levels` | Trend | price | LuxAlgo |  |
| 487 | Liquidity Sentiment Profile \| LUPEN | `liquidity-sentiment-profile-lupen` | Volume | own | Horazio | batch 20 |
| 488 | Liquidity Sweeps [LuxAlgo] | `liquidity-sweeps` | Trend | price |  |  |
| 489 | Liquidity Trap & Reversal bot | `liquidity-trap-reversal-bot` | Channels & Bands | price | pointalgo | batch 28 |
| 490 | Loacally Weighted MA (LWMA) Direction Histogram | `loacally-weighted-ma-direction-histogram` | Trend | own | LuxmiAI | batch 9 |
| 491 | Logit RSI | `logit-rsi` | Oscillators | own | AdaptiveRSI | batch 11 |
| 492 | Long Short dom | `long-short-dom` | Trend | own | Robin-Hood-trading | batch 11 |
| 493 | Lorentzian Length Adaptive Moving Average | `lorentzian-length-adaptive-moving-average` | Moving Averages | price | Starcruiser | batch 21 |
| 494 | Lumina Trend Channels | `lumina-trend-channels` | Channels & Bands | price | Pineify | batch 10 |
| 495 | Luminous Mean Reversion Channels | `luminous-mean-reversion-channels` | Channels & Bands | price | Pineify | batch 7 |
| 496 | Lunar Phase (LUNAR) | `lunar-phase` | Oscillators | own | mihakralj | batch 23 |
| 497 | MA Cross with Displacement | `ma-cross-with-displacement` | Moving Averages | price | TehThomas | batch 25 |
| 498 | MA Ribbon 5EMA \| 20EMA \| 50SMA \| 200EMA | `ma-ribbon-5ema-20ema-50sma-200ema` | Moving Averages | price | vamsinelluri7 | batch 29 |
| 499 | MA Shaded Fill Crossover | `ma-shaded-fill` | Moving Averages | price |  |  |
| 500 | MA Strategy Emperor | `ma-strategy-emperor` | Trend | price | insiliconot |  |
| 501 | MA Type | `madrid-ma-ribbon` | Moving Averages | price |  |  |
| 502 | MA Zones | `ma-zones` | Moving Averages | price | ZenAndTheArtOfTrading | batch 7 |
| 503 | MACD (Buy & Sell signals) | `macd-irtov` | Momentum | own | irtov | batch 24 |
| 504 | Macd + Adx Pro by @Eternyworld | `macd-adx-pro-by-eternyworld` | Momentum | own | ETERNYWORLD | batch 26 |
| 505 | MACD 4C | `macd-4c` | Momentum | own | vkno422 |  |
| 506 | MACD Crossover | `macd-crossover` | Momentum | own |  |  |
| 507 | MACD DEMA | `macd-dema` | Momentum | own |  |  |
| 508 | MACD Divergence | `macd-divergence` | Momentum | own |  |  |
| 509 | MACD Dynamic Squeeze Pro | `macd-dynamic-squeeze-pro` | Momentum | own | ZynAlgo | batch 24 |
| 510 | MACD Leader | `macd-leader` | Momentum | own | LazyBear |  |
| 511 | MACD Liquidity Tracker System | `macd-liquidity-tracker-system` | Momentum | own | PROFABIGHI_CAPITAL | batch 29 |
| 512 | MACD Overlay v1 | `macd-overlay-v1` | Momentum | price | JopAlgo | batch 5 |
| 513 | MACD Pro | `macd-pro` | Momentum | own | VEGAlgo | batch 23 |
| 514 | MACD Pseudo Super Smoother | `macd-pseudo-super-smoother` | Oscillators | own | The_Peaceful_Lizard | batch 37 |
| 515 | MACD ReLoaded | `macd-reloaded` | Momentum | own | KivancOzbilgic |  |
| 516 | MACD Sniper | `macd-sniper` | Momentum | own | trade_lexx | batch 15 |
| 517 | MACD Support and Resistance [ChartPrime] | `macd-support-resistance` | Momentum | own | ChartPrime |  |
| 518 | MACD VXI | `macd-vxi` | Momentum | own |  |  |
| 519 | MACD With Crossings and Above Below Zero | `macd-with-crossings-and-above-below-zero` | Momentum | own | Kgroomes | batch 18 |
| 520 | MACD x BB x STDEV x RVI | `macd-x-bb-x-stdev-x-rvi` | Oscillators | own | Vaquant | batch 20 |
| 521 | MACD XD | `macd-xd` | Momentum | own | Zen_Formless | batch 8 |
| 522 | MACD-V (Volatility Normalized MACD) | `macd-v` | Momentum | own | KivancOzbilgic | batch 2 |
| 523 | MACD-V with Volatility Normalisation | `macd-v-with-volatility-normalisation` | Momentum | own | DutchCryptoDad | batch 25 |
| 524 | MACD1 Fast | `double-macd` | Momentum | own |  |  |
| 525 | MACDAS | `macdas` | Momentum | own |  |  |
| 526 | Machine Learning: kNN Trend Predictor | `machine-learning-knn-trend-predictor` | Trend | price | tkarolak | batch 11 |
| 527 | MAD Trend Detector ~ C H I P A | `mad-trend-detector-c-h-i-p-a` | Trend | own | C_H_I_P_A | batch 36 |
| 528 | Madrid Trend Squeeze | `madrid-trend-squeeze` | Momentum | own |  |  |
| 529 | MADZ - Moving Average Deviation Z-Score | `madz-moving-average-deviation-z-score` | Oscillators | own | MiesOnCharts | batch 32 |
| 530 | Magnet Force + RSI Filter V6 | `magnet-force-rsi-filter-v6` | Channels & Bands | price | mehmetbezgincan | batch 31 |
| 531 | MAMA - FAMA (Ehlers) | `mama-fama` | Moving Averages | price | KatherinaNote | batch 31 |
| 532 | Mark Minervini Buy Signal | `mark-minervini-buy-signal` | Trend | price | Dr_Leong_Yee_Rock | batch 18 |
| 533 | Market Cipher A | `market-cipher-a` | Oscillators | price |  |  |
| 534 | Market Cipher B | `market-cipher-b` | Oscillators | own |  |  |
| 535 | Market Participation Ratio-MPR | `market-participation-ratio-mpr` | Volume | own | TechnoBlooms | batch 37 |
| 536 | Market Pressure Oscillator | `market-pressure-oscillator` | Oscillators | own | Uncle_the_shooter | batch 8 |
| 537 | Market Pulse Pro | `market-pulse-pro` | Oscillators | own | Canhoto-Medium | batch 32 |
| 538 | Market Shift Levels | `market-shift-levels` | Trend | price |  |  |
| 539 | Market Structure Trailing Stop | `market-structure-trailing-stop` | Trend | price | LuxAlgo |  |
| 540 | Market Structure Trend | `market-structure-trend` | Trend | price | QuantAlgo | batch 12 |
| 541 | Martell MNQ Quantum Scalper Pro | `martell-mnq-quantum-scalper-pro` | Trend | price | JMartell | batch 31 |
| 542 | Matrix Series | `matrix-series` | Oscillators | own |  |  |
| 543 | MavilimW | `mavilimw` | Trend | price | KivancOzbilgic |  |
| 544 | Mean Angles | `mean-angles` | Momentum | own | bharatTrader | batch 9 |
| 545 | Measured Pattern Move (Bulkowski) | `measured-pattern-move` | Trend | price | Steversteves | batch 28 |
| 546 | MechArt Moving Average and % Above V1.1 | `mechart-moving-average-and-above-v1-1` | Moving Averages | price | MechArt_ | batch 29 |
| 547 | Median ATR SD Oscillator | `median-atr-sd-oscillator` | Volatility | own | Unknownhodler | batch 37 |
| 548 | Median Gaussian Trend \| NAL | `median-gaussian-trend-nal` | Trend | price | NordicAlphaLab | batch 15 |
| 549 | Median MACD - Mattes | `median-macd-mattes` | Momentum | own | Mattes00 | batch 8 |
| 550 | Median Volume Weighted Deviation | `median-volume-weighted-deviation` | Volume | price | Burggg | batch 30 |
| 551 | MESA Adaptive Ehlers Flow \| AlphaNatt | `mesa-adaptive-ehlers-flow` | Moving Averages | price | AlphaNatt | batch 8 |
| 552 | MESA Phase-Adaptive Band Trend | `mesa-phase-adaptive-band-trend` | Trend | price | SchizoQuant | batch 22 |
| 553 | MFI + RSI + EMA Dynamic Signals | `mfi-rsi-ema-dynamic-signals` | Momentum | price | Raisontgh | batch 37 |
| 554 | MFI Nexus Pro | `mfi-nexus-pro` | Volume | own | trade_lexx | batch 10 |
| 555 | MFI/RSI Bollinger Bands | `mfi-rsi-bb` | Oscillators | own |  |  |
| 556 | Mid-term Ribbon | `mid-term-ribbon` | Moving Averages | price | Gartav388637 | batch 25 |
| 557 | ML Adaptive SuperTrend | `ml-adaptive-supertrend` | Trend | price |  |  |
| 558 | ML Deep Regression Pro | `ml-deep-regression-pro` | Trend | price | TechnoBlooms | batch 29 |
| 559 | ML Momentum Index | `ml-momentum-index` | Momentum | own |  |  |
| 560 | ML Moving Average | `ml-moving-average` | Moving Averages | price |  |  |
| 561 | ML RSI | `ml-rsi` | Momentum | own |  |  |
| 562 | ML: kNN Strategy | `ml-knn-strategy` | Momentum | own |  |  |
| 563 | Modified Heikin-Ashi | `modified-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 564 | Momentum-based ZigZag | `momentum-zigzag` | Trend | price | Peter_O |  |
| 565 | Money Flow Extended | `money-flow-extended` | Volume | own | alexrainman | batch 6 |
| 566 | Money Flow Pulse | `money-flow-pulse` | Volume | own | TheLeadingIndicator | batch 35 |
| 567 | Moneyball EMA-MACD indicator | `moneyball-ema-macd-indicator` | Momentum | own | VinnieTheFish | batch 6 |
| 568 | Monotonic Trend Consensus | `monotonic-trend-consensus` | Trend | own | QuantAlgo | batch 16 |
| 569 | Moving Average ADX | `ma-adx` | Moving Averages | price |  |  |
| 570 | Moving Average Colored | `ma-colored` | Moving Averages | price |  |  |
| 571 | Moving Average Converging | `ma-converging` | Moving Averages | price | LuxAlgo |  |
| 572 | Moving Average Crossover with Shading Signals | `moving-average-crossover-with-shading-signals` | Moving Averages | price | Decam9 | batch 12 |
| 573 | Moving Average Deviation Rate | `ma-deviation-rate` | Moving Averages | own |  |  |
| 574 | Moving Average Percentage Difference | `moving-average-percentage-difference` | Moving Averages | own | GapLogic | batch 37 |
| 575 | Moving Average Shift | `ma-shift` | Moving Averages | price |  |  |
| 576 | Moving Averages With Continuous Periods | `moving-averages-with-continuous-periods` | Moving Averages | price | The_Peaceful_Lizard | batch 15 |
| 577 | Moving Volume-Weighted Avg Price, % Channel, BBs | `moving-volume-weighted-avg-price-channel-bbs` | Channels & Bands | price | NeanderTraderBC | batch 37 |
| 578 | Moving VWAP-KAMA Cloud | `moving-vwap-kama-cloud` | Moving Averages | price | SovereignCharts | batch 12 |
| 579 | MPO4 Lines – Modal Engine | `mpo4-lines-modal-engine` | Oscillators | own | Uncle_the_shooter | batch 15 |
| 580 | mr.crypto731 | `mr-crypto731` | Momentum | own | Ali_Smith | batch 20 |
| 581 | MSL Squeeze Pulse | `msl-squeeze-pulse` | Volatility | own | MarketStructureLab | batch 16 |
| 582 | Multi-Band Trend Line | `multi-band-trend-line` | Trend | price | Mr_Rakun | batch 4 |
| 583 | Multi-Oscillator Adaptive Kernel \| AlphaAlgos | `multi-oscillator-adaptive-kernel-alphaalgos` | Oscillators | own | AlphaNatt | batch 4 |
| 584 | Multiple Divergences | `multiple-divergences` | Momentum | price | PeterO |  |
| 585 | Multiple Exponential Fibnonacci Moving Averages | `multiple-exponential-fibnonacci-moving-averages` | Moving Averages | price | LensOfChartist | batch 13 |
| 586 | Multiple Moving Averages | `multiple-ma` | Moving Averages | price |  |  |
| 587 | Multiple RSI | `multiple-rsi` | Oscillators | own | PrasadJoshi12 | batch 19 |
| 588 | MurreysOscillator | `murreys-math-osc` | Oscillators | own |  |  |
| 589 | Muses afl script | `muses-afl-script` | Trend | price | mostafa47ab (indicator title "L1 Filter Sig") | batch 31 |
| 590 | My auto dual avwap with Auto swing low/pivot low finder | `my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder` | Volume | price | doqkhanh | batch 22 |
| 591 | N Order EMA | `n-order-ema` | Moving Averages | price | The_Peaceful_Lizard | batch 35 |
| 592 | Nadaraya-Watson Trend | `nadaraya-watson-trend` | Trend | price | QuantAlgo | batch 1 |
| 593 | Navier-Cauchy Market Elasticity | `navier-cauchy-market-elasticity` | Oscillators | own | PhenLabs | batch 30 |
| 594 | Neighboring Price Bands | `neighboring-price-bands` | Channels & Bands | price | LuxAlgo | batch 21 |
| 595 | Nexus Sentiment & Risk Matrix | `nexus-sentiment-risk-matrix` | Oscillators | own | Pineify | batch 37 |
| 596 | NLMS Volatility Trail | `nlms-volatility-trail` | Trend | price | BackQuant | batch 4 |
| 597 | Normalized Candles RSI | `normalized-candles-rsi` | Oscillators | own | Jamallo22 | batch 32 |
| 598 | Normalized QQE | `normalized-qqe` | Oscillators | own |  |  |
| 599 | Normalized SPMA \| NAL | `normalized-spma-nal` | Oscillators | own | NordicAlphaLab | batch 30 |
| 600 | Normalized Volume & True Range | `normalized-volume-true-range` | Volume | own | The_Peaceful_Lizard | batch 36 |
| 601 | Nova Flow Lite (Free) | `nova-flow-lite` | Trend | price | NovaQuantX | batch 36 |
| 602 | Nova Statistical Filtering Oscillator | `nova-statistical-filtering-oscillator` | Oscillators | own | Pineify | batch 27 |
| 603 | NY ORB + Fakeout Detector | `ny-orb-fakeout-detector` | Channels & Bands | price | STEFANGAS | batch 27 |
| 604 | OA - SMES | `oa-smes` | Oscillators | own | onurag | batch 4 |
| 605 | OBV & AD Oscillators with Dual Smoothing Options | `obv-ad-oscillators-with-dual-smoothing-options` | Volume | own | hollowwick (indicator title "OBV, AD, VPT & CDV | batch 27 |
| 606 | OBV (Delta or regular) | `obv-gizmo` | Volume | own | GizmoTheInvestor | batch 37 |
| 607 | OBV + Custom MA Strategy | `obv-custom-ma-strategy` | Volume | own | Rafiki-is-Trading | batch 14 |
| 608 | OBV MACD | `obv-macd` | Volume | own |  |  |
| 609 | OBV Oscillator | `obv-oscillator` | Volume | own |  |  |
| 610 | OBVX Conviction Bias | `obvx-conviction-bias` | Volume | own | TheLeadingIndicator | batch 31 |
| 611 | Opal | `opal` | Channels & Bands | price | FlyingSeaHorse | batch 36 |
| 612 | Open Close Cross | `open-close-cross` | Momentum | own | JustUncleL |  |
| 613 | Optimized Trend Tracker | `optimized-trend-tracker` | Trend | price | KivancOzbilgic |  |
| 614 | Order Blocks with Signals | `order-blocks-signals` | Trend | price | ClayeWeight |  |
| 615 | Order Flow Imbalance Oscillator | `order-flow-imbalance-oscillator` | Volume | own | StrikePriceLabs | batch 33 |
| 616 | Oscillator Matrix | `oscillator-matrix` | Oscillators | own | AlphaExtract | batch 6 |
| 617 | PAFT | `paft` | Momentum | own | TREESinvest | batch 30 |
| 618 | Parabolic Stoch SAR Visualizer | `parabolic-stoch-sar-visualizer` | Oscillators | own | BOSWaves | batch 24 |
| 619 | Parallel Pivot Lines | `parallel-pivot-lines` | Channels & Bands | price | LuxAlgo |  |
| 620 | PCR Market Regime Indicator | `pcr-market-regime-indicator` | Momentum | own | Aleksin_Aleksandar | batch 31 |
| 621 | Peak Reversal v2 | `peak-reversal-v2` | Channels & Bands | price | Zettt | batch 11 |
| 622 | Peak Reversal v3 | `peak-reversal-v3` | Channels & Bands | price | Zettt | batch 21 |
| 623 | Percent Off All-time High (% Off High) | `percent-off-all-time-high` | Oscillators | own | xHmmmmm | batch 19 |
| 624 | Percentile Rank Oscillator (Price + VWMA) | `percentile-rank-oscillator` | Oscillators | own | exploretranspose | batch 26 |
| 625 | Percentile-Based BB% Trend - Mattes | `percentile-based-bb-trend-mattes` | Oscillators | own | Mattes00 | batch 7 |
| 626 | Perfect RSI | `perfect-rsi` | Oscillators | own | HabibiBudo | batch 26 |
| 627 | Perforance integral | `perforance-integral` | Momentum | own | Majimbi | batch 37 |
| 628 | Philakone 55 EMA Swing Trading | `philakone-ema-swing` | Moving Averages | price |  |  |
| 629 | Pipstocrat Market Participant Analysis | `pipstocrat-market-participant-analysis` | Momentum | own | Delast2 | batch 23 |
| 630 | Pivot Based Trailing Maxima & Minima | `pivot-trailing-maxmin` | Channels & Bands | price | LuxAlgo |  |
| 631 | Pivot Breakout High&Low Signals | `pivot-breakout-high-low-signals` | Trend | price | Jos-ProTrader | batch 3 |
| 632 | Pivot Breakout with Trend Zones | `pivot-breakout-with-trend-zones` | Trend | price | dreamaker7 | batch 33 |
| 633 | Pivot Market Structure | `pivot-market-structure` | Trend | price | Daniel_Ge | batch 11 |
| 634 | Pivot Oscillator | `pivot-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 635 | Pivot Point SuperTrend | `pivot-point-supertrend` | Trend | price | LonesomeTheBlue |  |
| 636 | Pivot Trend | `pivot-trend` | Trend | price | ChartPrime | batch 1 |
| 637 | POC Volume Bar (Highest Volume in Range) | `poc-volume-bar` | Volume | own | greatbrownball | batch 28 |
| 638 | PolyFilter | `polyfilter` | Moving Averages | price | BackQuant | batch 8 |
| 639 | Polynomial Regression Moving Average (PRMA) | `polynomial-regression-moving-average` | Moving Averages | price | ZakAlgoTrade | batch 24 |
| 640 | Polyphase MACD (PMACD) | `polyphase-macd` | Momentum | own | The_Peaceful_Lizard | batch 19 |
| 641 | PPO Alerts | `ppo-alerts` | Momentum | own |  |  |
| 642 | PPO Divergence | `ppo-divergence` | Momentum | own | Pekipek |  |
| 643 | Predictive Channels | `predictive-channels` | Channels & Bands | price | LuxAlgo |  |
| 644 | Premier RSI Oscillator | `premier-rsi` | Momentum | own |  |  |
| 645 | Premier Stochastic Oscillator | `premier-stochastic` | Oscillators | own |  |  |
| 646 | PREMIUM TRADE ZONES | `premium-trade-zones` | Oscillators | own | ENTRYLAB | batch 27 |
| 647 | Price & Volume Profile (Expo) | `price-volume-profile` | Volume | price | Zeiierman (community) |  |
| 648 | Price Acceleration Indicator (PAI) | `price-acceleration-indicator` | Momentum | own | PHICAPITALINVESTMENTS | batch 35 |
| 649 | Price Action Bands \| Trend & Volatility | `price-action-bands-trend-volatility` | Channels & Bands | price | RadixAlgo | batch 15 |
| 650 | Price Action Breakout Trend | `price-action-breakout-trend` | Trend | price | QuantAlgo | batch 5 |
| 651 | Price Action Signals Filtered +EMA | `price-action-signals-filtered-ema` | Trend | price | Aleksin_Aleksandar | batch 11 |
| 652 | Price Action Trading System | `price-action-system` | Oscillators | price |  |  |
| 653 | Price Action: Engulfing Patterns | `price-action-engulfing-patterns` | Candlestick Patterns | price | Jay9286 | batch 33 |
| 654 | Price Advance & Decline Range Analysis | `price-advance-decline-range-analysis` | Volatility | own | RicardoSantos | batch 16 |
| 655 | Price Change Sentiment Index | `price-change-sentiment-index` | Oscillators | own | TradeVizion | batch 23 |
| 656 | Price Divergence Detector | `price-divergence-detector` | Momentum | price | JustUncleL |  |
| 657 | Price Flow - Buy Sell | `price-flow-buy-sell` | Channels & Bands | price | IVTrader1990 | batch 35 |
| 658 | Price Linear Sequence Counter | `price-linear-sequence-counter` | Momentum | own | RicardoSantos | batch 14 |
| 659 | Price Momentum Oscillator | `price-momentum-oscillator` | Momentum | own |  |  |
| 660 | Price/Volume Value Histogram | `price-volume-value-histogram` | Volume | own | dman103 | batch 2 |
| 661 | Pring Special K\|a2m | `pring-special-k-a2m` | Momentum | own | ask2maniish | batch 34 |
| 662 | Prism Moving Average Trend | `prism-moving-average-trend` | Trend | price | MisinkoMaster | batch 19 |
| 663 | Pro Scalper - 2 MinutesTF by Ayoob | `pro-scalper-2-minutestf-by-ayoob` | Trend | price | FGMNDFBF | batch 30 |
| 664 | Probabilities Module - The Quant Science | `probabilities-module-the-quant-science` | Oscillators | own | thequantscience | batch 31 |
| 665 | Projected Crossover Trend | `projected-crossover-trend` | Trend | price | SchizoQuant | batch 4 |
| 666 | Prometheus Topological Persistent Entropy | `prometheus-topological-persistent-entropy` | Volatility | own | ScorsoneEnterprises | batch 23 |
| 667 | Pullback SAR | `pullback-sar` | Trend | price | szymonsobkowiak | batch 32 |
| 668 | Pullback Scalp Trade V2 | `pullback-scalp-trade-v2` | Trend | price | Sinyalbak_App | batch 12 |
| 669 | Pulse Range | `pulse-range` | Trend | price | MarketStructureLab | batch 13 |
| 670 | Pulse RSI \| Lyro RS | `pulse-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 10 |
| 671 | PulseWave + Divergence | `pulsewave-divergence` | Oscillators | own | Uncle_the_shooter | batch 7 |
| 672 | Pure Coca | `pure-coca` | Oscillators | own | La_Von | batch 7 |
| 673 | Q Impulse Entry | `q-impulse-entry` | Trend | price | Quantora | batch 17 |
| 674 | Q KAMA Clarity Trend | `q-kama-clarity-trend` | Trend | price | Quantora | batch 7 |
| 675 | Q Wave | `q-wave` | Trend | price | Quantora | batch 36 |
| 676 | QG-Particle Oscillator | `qg-particle-oscillator` | Oscillators | own | QuantG | batch 35 |
| 677 | QQE Cross | `qqe-cross` | Trend | price | JustUncleL |  |
| 678 | QQE MOD | `qqe-mod` | Momentum | own |  |  |
| 679 | QQE Signals | `qqe-signals` | Oscillators | price | colinmck |  |
| 680 | QTechLabs Machine Learning Logistic Regression Indicator | `qtechlabs-machine-learning-logistic-regression-indicator` | Oscillators | price | QTechLabsInfo | batch 33 |
| 681 | Quant VWAP System 3.8 | `quant-vwap-system-3-8` | Oscillators | own | CustomQuantLabs (published as "Quant VWAP System 3.8") | batch 8 |
| 682 | Quantile Regression Bands | `quantile-regression-bands` | Channels & Bands | price | BackQuant | batch 17 |
| 683 | Quantitative Qualitative Estimation | `qqe` | Oscillators | own | Glaz |  |
| 684 | Quantum Regression Oscillator | `quantum-regression-oscillator` | Oscillators | own | abgthecoder | batch 32 |
| 685 | Quantum Trend Signal | `quantum-trend-signal` | Trend | price | ReubenMiles | batch 9 |
| 686 | QuantumTrend SwiftEdge | `quantumtrend-swiftedge` | Trend | price | SwiftEdge | batch 5 |
| 687 | Quartile For Loop | `quartile-for-loop` | Trend | own | SeerQuant | batch 6 |
| 688 | Radiant Mean Reversion Channels | `radiant-mean-reversion-channels` | Oscillators | own | Pineify | batch 34 |
| 689 | Radius Trend [ChartPrime] | `radius-trend` | Trend | price | ChartPrime |  |
| 690 | Range Channel by Atilla Yurtseven | `range-channel-by-atilla-yurtseven` | Channels & Bands | own | AtillaYurtseven | batch 17 |
| 691 | Range Detector | `range-detector` | Trend | price | LuxAlgo |  |
| 692 | Range Identifier | `range-identifier` | Channels & Bands | price |  |  |
| 693 | Range Oscillator | `range-oscillator` | Oscillators | own | Zeiierman | batch 1 |
| 694 | Range Tightening Indicator (RTI) | `range-tightening-indicator` | Volatility | own | Ollie_AllCaps | batch 2 |
| 695 | Rapid Exponential Moving Average | `rapid-exponential-moving-average` | Moving Averages | price | ImmortalFreedom | batch 28 |
| 696 | RCI 3 Lines | `rci-3lines` | Oscillators | own |  |  |
| 697 | ReadyFor401ks Just Tell Me When! | `readyfor401ks-just-tell-me-when` | Trend | price | ReadyFor401k | batch 20 |
| 698 | Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure | `big-trades-bubbles` | Volume | price | samet_lezki | batch 5 |
| 699 | Realtime Volume Bars | `realtime-volume-bars` | Volume | own | the_MarketWhisperer |  |
| 700 | RedK EVEREX | `redk-everex` | Momentum | own | RedKTrader |  |
| 701 | RedK Magic Ribbon | `redk-magic-ribbon` | Moving Averages | price | RedKTrader | batch 2 |
| 702 | RedK Momentum Bars | `redk-momentum-bars` | Momentum | own | RedKTrader |  |
| 703 | RedK RSS_WMA | `redk-rss-wma` | Moving Averages | price | RedKTrader |  |
| 704 | RedK Trader Pressure Index | `redk-tpx` | Momentum | own | RedKTrader |  |
| 705 | RedK Vol_Weighted RSI: Extending the power of the classic RSI | `redk-vol-weighted-rsi` | Momentum | own | RedKTrader | batch 5 |
| 706 | Reflex & Trendflex | `reflex-trendflex` | Oscillators | own | e2e4 | batch 6 |
| 707 | Regression Channel Oscillator | `regression-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 27 |
| 708 | Relative ATR Volatility Indicator | `relative-atr-volatility-indicator` | Volatility | own | ZenAndTheArtOfTrading | batch 20 |
| 709 | Relative Strength Heatmap | `relative-strength-heatmap` | Momentum | own | BackQuant | batch 22 |
| 710 | Relative Valuation Oscillator | `relative-valuation-oscillator` | Oscillators | own | QuantAlgo | batch 14 |
| 711 | Relative Volume Indicator (RVOL) | `relative-volume-indicator` | Volume | own | AlgoCollective | batch 13 |
| 712 | Renko Boxes | `renko-boxes` | Trend | price | LuxAlgo | batch 4 |
| 713 | Renko Chart | `renko-chart` | Trend | price | LonesomeTheBlue |  |
| 714 | Renko Compression Index (RCI) | `renko-compression-index` | Oscillators | own | nasu_is_gaji | batch 34 |
| 715 | Renko Mod | `renko-mod` | Trend | price | RicardoSantos | batch 13 |
| 716 | Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI) | `renko-sniper-pro` | Trend | price | zachsprad | batch 24 |
| 717 | Res/Sup With Concavity & Increasing / Decreasing Trend Analysis | `res-sup-with-concavity-increasing-decreasing-trend-analysis` | Trend | price | Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis") | batch 28 |
| 718 | Retail vs Banker Net Positions – Symmetry Break | `retail-vs-banker-net-positions-symmetry-break` | Volume | own | JasonHyde | batch 17 |
| 719 | Reversal Candle Setup | `reversal-candle-setup` | Candlestick Patterns | price |  |  |
| 720 | Reversal Correlation Pressure | `reversal-correlation-pressure` | Oscillators | own | OmegaTools | batch 27 |
| 721 | Reversal Scalper 2.0- Adib Noorani | `reversal-scalper-2-0-adib-noorani` | Oscillators | own | AdibNoorani | batch 28 |
| 722 | Rhokeo-VW-RSI Histogram for Cumulative Delta by Zeiirman | `rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman` | Oscillators | own | nabil007 | batch 24 |
| 723 | Ripster EMA Clouds | `ripster-ema-clouds` | Trend | price | ripster47 |  |
| 724 | RMA ATR Bands | `rma-atr-bands` | Channels & Bands | price | SchizoQuant | batch 3 |
| 725 | RMI Length | `rmi-trend-sniper` | Momentum | price | TZack88 |  |
| 726 | Robby DSS Bressert Colored Dots | `robby-dss-bressert-colored-dots` | Oscillators | own | huatzhi | batch 21 |
| 727 | ROC-Weighted MA Oscillator | `roc-weighted-ma-oscillator` | Oscillators | own | SeerQuant | batch 2 |
| 728 | Rolling Liquidity Clusters Channel | `rolling-liquidity-clusters-channel` | Channels & Bands | price | LuxAlgo | batch 12 |
| 729 | Rolling Sharpe Ratio Oscillator \| Astral Vision | `rolling-sharpe-ratio-oscillator-astral-vision` | Oscillators | own | AstralVision | batch 13 |
| 730 | Rolling Trendline | `rolling-trendline` | Trend | price | LuxAlgo | batch 5 |
| 731 | Ross Cameron-Inspired Day Trading Strategy | `ross-cameron-inspired-day-trading-strategy` | Momentum | price | manaziir | batch 25 |
| 732 | RRR EMA Ignition BUY & SELL (Sideways-Proof) | `rrr-ema-ignition-buy-sell` | Trend | price | RAGSTER123 | batch 21 |
| 733 | RS Rating (1-99) | `rs-rating` | Momentum | own | kulturdesken | batch 16 |
| 734 | rs_MACD | `rs-macd` | Momentum | price | RicardoSantos | batch 17 |
| 735 | RSI | `rsi-hash-capital` | Oscillators | own | Hash_Capital | batch 31 |
| 736 | RSI & MACD Suite | `rsi-macd-suite` | Oscillators | own | aaboomar | batch 34 |
| 737 | RSI (14) with Auto Zone Colors - Overbought/Oversold Highlighter | `rsi-with-auto-zone-colors-overbought-oversold-highlighter` | Oscillators | own | tarangbharti18 | batch 29 |
| 738 | RSI + ADX + ATR 18-01-25 | `rsi-adx-atr-18-01-25` | Oscillators | own | dipak11298 | batch 37 |
| 739 | RSI + ADX + ATR Combo | `rsi-adx-atr-combo` | Oscillators | own | shawasutosh | batch 26 |
| 740 | RSI + BB + Dispersion | `rsi-bb-dispersion` | Oscillators | own |  |  |
| 741 | RSI + Fibonacci HH LL Support Resistance | `rsi-fibonacci-hh-ll-support-resistance` | Channels & Bands | price | FibonacciFlux | batch 12 |
| 742 | RSI + MACD (RSI Divergence) V3.2 | `rsi-macd-v3-2` | Oscillators | own | MKhoa | batch 24 |
| 743 | RSI + STOCH RSI - Marx_Capital | `rsi-stoch-rsi-marx-capital` | Oscillators | own | Marx_Capital | batch 12 |
| 744 | RSI - 5UP | `rsi-5up` | Oscillators | own | Marrulk | batch 29 |
| 745 | RSI Bands | `rsi-bands` | Channels & Bands | price |  |  |
| 746 | RSI Bars - OnlyFlow | `rsi-bars-onlyflow` | Momentum | price | ofderk | batch 10 |
| 747 | RSI BB StdDev Signal | `rsi-bb-stddev-signal` | Oscillators | own | trade_lexx (Pine title "RSI Signal [trade_lexx]") | batch 8 |
| 748 | RSI Candles | `rsi-candles` | Momentum | own | Glaz |  |
| 749 | RSI Confirm Trend with Williams (W%R) | `rsi-confirm-trend-with-williams` | Momentum | own | javageek | batch 11 |
| 750 | RSI Divergence | `rsi-divergence` | Oscillators | own |  |  |
| 751 | RSI Games 1.2 | `rsi-games-1-2` | Oscillators | own | petejfjohnson | batch 22 |
| 752 | RSI HistoAlert | `rsi-histoalert` | Oscillators | own |  |  |
| 753 | RSI Length | `most-rsi` | Momentum | own |  |  |
| 754 | RSI Length | `parabolic-rsi` | Momentum | own |  |  |
| 755 | RSI Length | `pmax-rsi-t3` | Momentum | own |  |  |
| 756 | RSI Length | `rsi-cyclic-smoothed` | Momentum | own |  |  |
| 757 | RSI Modified | `rsi-modified` | Oscillators | own | Santos_Trader_PT | batch 5 |
| 758 | RSI Momentum Divergence | `rsi-momentum-divergence` | Oscillators | own | ChartPrime |  |
| 759 | RSI Multi Levels kiawosch 7-14-42 Consolidation | `rsi-multi-levels` | Oscillators | own | TFlab | batch 5 |
| 760 | RSI Multicolor editable | `rsi-multicolor-editable` | Oscillators | own | Guillaume46 | batch 8 |
| 761 | RSI Potential | `rsi-potential` | Momentum | own | nasu_is_gaji | batch 35 |
| 762 | RSI Snabbel | `rsi-snabbel` | Oscillators | own |  |  |
| 763 | RSI Supply/Demand | `rsi-supply-demand` | Trend | price | shtcoinr / Lij_MC |  |
| 764 | RSI Swing Signal | `rsi-swing-signal` | Oscillators | own |  |  |
| 765 | RSI Tops and Bottoms | `rsi-tops-bottoms` | Momentum | own | LonesomeTheBlue |  |
| 766 | RSI Trend Bias | `rsi-trend-bias` | Oscillators | own | Botnet101 | batch 24 |
| 767 | RSI Trend Navigator | `rsi-trend-navigator` | Trend | price | QuantAlgo | batch 10 |
| 768 | RSI Zone Step Lines | `rsi-zone-step-lines` | Channels & Bands | price | Devjames | batch 11 |
| 769 | RSI+EMA+MZONES with Divergences | `rsi-ema-mzones-with-divergences` | Oscillators | own | lordoflolz | batch 22 |
| 770 | RSI+Stoch Band Oscillator | `rsi-stoch-band-oscillator` | Oscillators | own | nasu_is_gaji | batch 26 |
| 771 | RSI-50 Step Line | `rsi-50-step-line` | Trend | price | Devjames | batch 5 |
| 772 | RSI-EMA-Crossing with Donchian-Stop-Loss | `rsi-ema-crossing-with-donchian-stop-loss` | Channels & Bands | price | Kahael | batch 28 |
| 773 | RSI: alternative derivation | `rsi-alternative-derivation` | Oscillators | own | AdaptiveRSI | batch 25 |
| 774 | RVOL Effort Matrix | `rvol-effort-matrix` | Volume | own | TheLeadingIndicator | batch 36 |
| 775 | S&R Breakout ATR Confirmation | `s-r-breakout-atr-confirmation` | Trend | price | Jos-ProTrader | batch 33 |
| 776 | SAR + EMA + MACD Signals | `sar-ema-macd` | Oscillators | price |  |  |
| 777 | Savitzky Flow Bands | `savitzky-flow-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 778 | Savitzky-Golay Hampel Filter \| AlphaNatt | `savitzky-golay-hampel-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 15 |
| 779 | Scalping Line | `scalping-line` | Oscillators | own | KivancOzbilgic |  |
| 780 | Scalping Tool with Dynamic Take Profit & Stop Loss | `scalping-tool-dynamic-tp-sl` | Trend | price | TruFREND | batch 3 |
| 781 | ScalpMap - EMA Pivot Targets | `scalpmap-ema-pivot-targets` | Trend | price | blockybears | batch 12 |
| 782 | SCE GANN Predictions | `sce-gann-predictions` | Trend | price | ScorsoneEnterprises | batch 22 |
| 783 | Schaff Trend Cycle | `schaff-trend-cycle` | Oscillators | own | LazyBear |  |
| 784 | SCOTTGO Advanced MACD | `scottgo-advanced-macd` | Momentum | own | SCOTTGO (indicator title "MACD: Clean Visuals (Fixed Arrows)") | batch 27 |
| 785 | Sell & Buy Rates | `sell-buy-rates` | Volume | own | LonesomeTheBlue |  |
| 786 | Sequential Pattern Strength | `sequential-pattern-strength` | Momentum | own | QuantAlgo | batch 9 |
| 787 | Setup 9.1 (Larry Williams) + EMA 50 | `setup-9-1-ema-50` | Moving Averages | price | oDouglasAlex | batch 7 |
| 788 | SExI - Super Exhaustion Indicator | `sexi-super-exhaustion-indicator` | Oscillators | own | Da_Prof | batch 14 |
| 789 | Sharp Modified Moving Average | `sharp-modified-moving-average` | Moving Averages | price | everget | batch 18 |
| 790 | Sharpe Ratio Indicator (180) | `sharpe-ratio-indicator` | Volatility | own | tim_amblard | batch 3 |
| 791 | Sharpe Ratio v4 | `sharpe-ratio-v4` | Oscillators | own | Zettt | batch 32 |
| 792 | Sharpshooter 30 – EMA Distance | `sharpshooter-30-ema-distance` | Moving Averages | price | hrak22 | batch 33 |
| 793 | Shock Percentile Moving Average \| NAL | `shock-percentile-moving-average-nal` | Moving Averages | price | NordicAlphaLab | batch 22 |
| 794 | Sigmoid RSI \| NAL | `sigmoid-rsi-nal` | Oscillators | own | NordicAlphaLab | batch 11 |
| 795 | Signal Moving Average | `signal-ma` | Moving Averages | price | LuxAlgo |  |
| 796 | Simple Moving Averages | `simple-moving-averages` | Moving Averages | price |  |  |
| 797 | Simplified Percentile Clustering | `simplified-percentile-clustering` | Oscillators | own | InvestorUnknown | batch 4 |
| 798 | Sine Weighted Moving Average | `sine-weighted-moving-average` | Moving Averages | price | everget | batch 13 |
| 799 | SL - 4 EMAs, 2 SMAs & Crossover Signals | `sl-4-emas-2-smas-crossover-signals` | Moving Averages | price | MVP202020205 | batch 27 |
| 800 | Slow Heiken Ashi | `slow-heiken-ashi` | Candlestick Patterns | price |  |  |
| 801 | SMA Angle Alerts | `sma-angle-alerts` | Moving Averages | price | readysetfire | batch 21 |
| 802 | SMA DMA Crossing Signal | `sma-dma-crossing-signal` | Moving Averages | price | tradingqueen18 | batch 31 |
| 803 | SMA Squeeze Oscillator | `sma-squeeze-oscillator` | Momentum | own | Uncle_the_shooter | batch 23 |
| 804 | SMA+ADX Filter | `sma-adx-filter` | Trend | price | iping99 | batch 31 |
| 805 | Smart MCDX FINAL PRO | `smart-mcdx-final-pro` | Volume | own | Sachse-1980 | batch 30 |
| 806 | Smart Money Flow Signals | `smart-money-flow-signals` | Volume | own | QuantAlgo | batch 2 |
| 807 | Smart Trend | `smart-trend` | Trend | price | Zofesu | batch 21 |
| 808 | SMC Statistical Liquidity Walls | `smc-statistical-liquidity-walls` | Channels & Bands | price | PhenLabs | batch 25 |
| 809 | SMIIOL | `smiiol` | Momentum | own | iilter | batch 25 |
| 810 | Smooth RSI | `smooth-rsi` | Momentum | own | MarktQuant | batch 8 |
| 811 | Smoothed Heiken Ashi | `smoothed-heiken-ashi` | Trend | price | jackvmk |  |
| 812 | Smoothed Low-Pass Butterworth Filtered Median | `butterworth-filtered-median` | Moving Averages | price | AlphaNatt | batch 8 |
| 813 | Smoothed Source Weighted EMA | `smoothed-source-weighted-ema` | Moving Averages | price | Clokivez | batch 13 |
| 814 | Source | `ott-bands` | Channels & Bands | price | KivancOzbilgic |  |
| 815 | Source | `otto` | Oscillators | own | KivancOzbilgic |  |
| 816 | Source | `range-filter-dw` | Trend | price |  |  |
| 817 | Source-Aligned Oscillators (for Divergences) | `source-aligned-oscillators` | Oscillators | own | QuantNomad | batch 18 |
| 818 | SP - MACD with Divergence | `sp-macd-with-divergence` | Momentum | own | ca_sidnayak | batch 24 |
| 819 | Spira Alligator | `spira-alligator` | Trend | price | Markedsignaler | batch 26 |
| 820 | Squeeze Channel | `squeeze-channel` | Channels & Bands | price | B3AR_Trades | batch 16 |
| 821 | Squeeze Momentum | `squeeze-momentum` | Momentum | own | LazyBear |  |
| 822 | Squeeze Momentum V2 | `squeeze-momentum-v2` | Oscillators | own |  |  |
| 823 | SSL Channel | `ssl-channel` | Trend | price |  |  |
| 824 | SSL Hybrid Scalper | `ssl-hybrid-scalper` | Moving Averages | price | nabeel8369 | batch 11 |
| 825 | ST0P | `st0p` | Oscillators | price |  |  |
| 826 | Standardized MACD HA | `standardized-macd-ha` | Momentum | own | EliCobra |  |
| 827 | Start | `lucid-sar` | Trend | price |  |  |
| 828 | Statistical Price Deviation Index (MAD/VWMA) | `statistical-price-deviation-index` | Oscillators | own | exploretranspose | batch 16 |
| 829 | STH Unrealized Profit/Loss Ratio (STH-NUPL) | `sth-unrealized-profit-loss-ratio` | Oscillators | own | DeVrizii | batch 15 |
| 830 | Stoch VX3 | `stoch-vx3` | Oscillators | own |  |  |
| 831 | Stochastic Heat Map | `stochastic-heat-map` | Momentum | own | Violent |  |
| 832 | Stochastic Momentum Index | `stochastic-momentum-index` | Oscillators | own |  |  |
| 833 | Stochastic Momentum Index UCS | `smi-ucs` | Oscillators | own |  |  |
| 834 | Stochastic OTT | `stochastic-ott` | Oscillators | own | KivancOzbilgic |  |
| 835 | Stockbee ComboBull | `stockbee-combobull` | Momentum | own | traderabhi81 | batch 29 |
| 836 | Stockbee Reversal Bullish v2 | `stockbee-reversal-bullish-v2` | Momentum | own | traderabhi81 | batch 29 |
| 837 | Stop/Take Bounds | `stop-take-bounds` | Volatility | price | Y_Goldman | batch 27 |
| 838 | Super Guppy | `super-guppy` | Trend | price | JustUncleL |  |
| 839 | Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET) | `super-sma-5-8-13-ema-20-200-regime-filter` | Moving Averages | price | afdzjr69 | batch 19 |
| 840 | Super Smoothed MACD | `super-smoothed-macd` | Momentum | own |  |  |
| 841 | Super SuperTrend | `super-supertrend` | Trend | price |  |  |
| 842 | SuperBands | `superbands` | Trend | price | The_Peaceful_Lizard | batch 7 |
| 843 | SuperSmoother MA Oscillator | `supersmoother-ma-oscillator` | Oscillators | own | BOSWaves | batch 1 |
| 844 | SuperTrend AI Clustering | `supertrend-ai-clustering` | Trend | price |  |  |
| 845 | SuperTrend Channels | `supertrend-channels` | Channels & Bands | price |  |  |
| 846 | Support and Resistance Levels with Breaks | `sr-levels-breaks` | Channels & Bands | price |  |  |
| 847 | Support Resistance Channels | `support-resistance-channels` | Trend | price | LonesomeTheBlue |  |
| 848 | Support/Resistance Channel Breakout | `support-resistance-channel-breakout` | Channels & Bands | price | SuprAlgo | batch 31 |
| 849 | Suppot and resistance & BUY SELL SIGNALS | `suppot-and-resistance-buy-sell-signals` | Channels & Bands | price | doganayy2 | batch 20 |
| 850 | Sweep2Trade Pro | `sweep2trade-pro` | Trend | price | chervolino | batch 8 |
| 851 | Swing Highs/Lows & Candle Patterns | `swing-highs-lows-patterns` | Candlestick Patterns | price | LuxAlgo (Pine v5) |  |
| 852 | Swing Points | `swing-points` | Trend | price | CrossTradeTeam | batch 14 |
| 853 | Swing Support and Resistance | `swing-support-and-resistance` | Trend | price | VSB-2024 | batch 25 |
| 854 | Swing Trade Signals | `swing-trade-signals` | Oscillators | price | nicks1008 |  |
| 855 | T3 Length | `t3-psar` | Moving Averages | price |  |  |
| 856 | TA (Miles) Adaptive Trend | `ta-adaptive-trend` | Trend | price | TradingApologist | batch 27 |
| 857 | TASC 2025.02 Autocorrelation Indicator | `tasc-2025-02-autocorrelation` | Oscillators | own | PineCodersTASC | batch 6 |
| 858 | TASC 2025.06 Cybernetic Oscillator | `tasc-2025-06-cybernetic-oscillator` | Oscillators | own | PineCodersTASC | batch 5 |
| 859 | TASC 2025.09 The Continuation Index | `tasc-2025-09-the-continuation-index` | Trend | own | PineCodersTASC | batch 14 |
| 860 | TASC 2026.01 The Reversion Index | `tasc-2026-01-the-reversion-index` | Oscillators | own | PineCodersTASC | batch 26 |
| 861 | TASC 2026.04 A Synthetic Oscillator | `tasc-2026-04-a-synthetic-oscillator` | Oscillators | own | PineCodersTASC | batch 7 |
| 862 | TASC 2026.05 The AutoTune Filter | `tasc-2026-05-the-autotune-filter` | Oscillators | own | PineCodersTASC | batch 8 |
| 863 | TASC 2026.09 Adaptive SuperSmoother | `tasc-2026-09-adaptive-supersmoother` | Moving Averages | own | PineCodersTASC | batch 15 |
| 864 | TDI - Traders Dynamic Index | `tdi-rsi` | Momentum | own |  |  |
| 865 | Tenkan Cloud Signals | `tenkan-cloud-signals` | Trend | price | CodaPro | batch 11 |
| 866 | Terminal Velocity Stop \| Lyro RS | `terminal-velocity-stop-lyro-rs` | Trend | price | LyroRS | batch 13 |
| 867 | TFO + ADX with Histogram & Signal | `tfo-adx-with-histogram-signal` | Oscillators | own | WalrusQuant | batch 26 |
| 868 | The Jewel | `the-jewel` | Oscillators | own | afonso_77 | batch 37 |
| 869 | The Mean Goose v1 | `the-mean-goose-v1` | Channels & Bands | price | FattyGuinness | batch 15 |
| 870 | Theil-Sen Line Filter | `theil-sen-line-filter` | Moving Averages | price | BackQuant | batch 18 |
| 871 | Three Moving Averages | `three-moving-averages` | Moving Averages | price |  |  |
| 872 | Tillson T3 | `tillson-t3` | Trend | price | KivancOzbilgic (fr3762) |  |
| 873 | TMO (True Momentum Oscillator) | `tmo` | Momentum | own | Coulisnosaj | batch 15 |
| 874 | Tom DeMark MACD | `td-macd` | Momentum | own |  |  |
| 875 | TonyUX EMA Scalper | `tonyux-ema-scalper` | Oscillators | price |  |  |
| 876 | Top & Bottom Candle | `top-bottom-candle` | Candlestick Patterns | own |  |  |
| 877 | Tops/Bottoms | `tops-bottoms` | Oscillators | price |  |  |
| 878 | TR High/Low meter | `tr-high-low-meter` | Momentum | own | dman103 | batch 10 |
| 879 | Trade Prime - Fluid Trend Indicator | `trade-prime-fluid-trend-indicator` | Trend | price | tradeprime01 | batch 31 |
| 880 | Trader XO Macro Trend Scanner | `trader-xo` | Oscillators | price |  |  |
| 881 | Traders Dynamic Index | `tdi-hlc-trix` | Oscillators | own |  |  |
| 882 | Trading Activity Index | `trading-activity-index` | Volume | own | Zeiierman | batch 2 |
| 883 | Trading Gaul | `trading-gaul` | Trend | price | investment20223 | batch 26 |
| 884 | TradingMoja / SQZMOM ADX | `tradingmoja-sqzmom-adx` | Momentum | own | Trading_Moja | batch 32 |
| 885 | Transient Zones v1.1 | `transient-zones` | Channels & Bands | price | Jurij (community) |  |
| 886 | Tremor Tracker | `tremor-tracker` | Volatility | own | TheUltimator5 | batch 19 |
| 887 | Trend Direction Zone | `trend-direction-zone` | Trend | price | MarketStructureLab | batch 16 |
| 888 | Trend Double Pullbackv1.0 | `trend-double-pullback-v1-0` | Trend | price | puduxbt | batch 26 |
| 889 | Trend Filter (2-pole) | `trend-filter` | Trend | price | BigBeluga | batch 1 |
| 890 | Trend Flow Oscillator (CMF + MFI) + ADX | `trend-flow-oscillator-adx` | Oscillators | own | WalrusQuant | batch 19 |
| 891 | Trend Following Moving Averages | `trend-following-ma` | Moving Averages | price | LonesomeTheBlue |  |
| 892 | Trend Heatmap | `trend-heatmap` | Trend | own | autocrp | batch 30 |
| 893 | Trend Impulse Channels | `trend-impulse-channels` | Trend | price | Zeiierman |  |
| 894 | Trend Line Auto | `trend-line-auto` | Trend | price | HarryBot |  |
| 895 | Trend Lines v2 | `trend-lines-v2` | Trend | price | LonesomeTheBlue (Pine v4) |  |
| 896 | Trend Magic | `trend-magic` | Trend | price |  |  |
| 897 | Trend Predictor Ribbon Clone - Fixed roj karo moj karo | `trend-predictor-ribbon` | Trend | price | ronitjain18 | batch 6 |
| 898 | Trend Pulse Oscillator | `trend-pulse-oscillator` | Oscillators | own | ChaosTrader63 | batch 35 |
| 899 | Trend Regularity Adaptive MA | `trama` | Moving Averages | price | LuxAlgo |  |
| 900 | Trend Scalper | `trend-scalper` | Moving Averages | price | abedmahmood | batch 35 |
| 901 | Trend State Signals | `trend-state-signals` | Trend | price | MarketStructureLab | batch 4 |
| 902 | Trend Strength/Direction | `trend-strength-direction` | Trend | own | ddcakez | batch 32 |
| 903 | Trend Trader Strategy | `trend-trader` | Trend | price |  |  |
| 904 | Trend Trigger Factor | `trend-trigger-factor` | Oscillators | own |  |  |
| 905 | Trend Volatility Index (TVI) | `trend-volatility-index` | Volatility | own | chikaharu | batch 3 |
| 906 | Trend with ADX/EMA - Buy & Sell Signals | `trend-with-adx-ema-buy-sell-signals` | Trend | price | RMPM | batch 28 |
| 907 | TrendCylinder (Expo) | `trendcylinder` | Trend | price | Zeiierman | batch 4 |
| 908 | Trendlines with Breaks [LuxAlgo] | `trendlines-with-breaks` | Trend | price | LuxAlgo |  |
| 909 | TrendMasterPro_Fekonomi | `trendmasterpro-fekonomi` | Trend | price | fekonomi | batch 20 |
| 910 | TRENDSYNC BUY/SELL BY SIMPLY_DANTE-FX | `trendsync-buy-sell-by-simply-dante-fx` | Trend | price | Simply_Dante-fx | batch 36 |
| 911 | TrendWave Bands | `trendwave-bands` | Channels & Bands | price | BigBeluga | batch 1 |
| 912 | Triangular MA Bands | `tma-bands` | Channels & Bands | price |  |  |
| 913 | Triangular Momentum Oscillator | `triangular-momentum-osc` | Oscillators | own |  |  |
| 914 | Trimmed Mean ATR Bands | `trimmed-mean-atr-bands` | Channels & Bands | price | CryptoNejc | batch 17 |
| 915 | Triple Gaussian Smoothed Ribbon | `triple-gaussian-smoothed-ribbon` | Trend | price | BOSWaves | batch 16 |
| 916 | Triple MA For Loop | `triple-ma-for-loop` | Trend | own | SeerQuant | batch 7 |
| 917 | Triple MA Forecast | `triple-ma-forecast` | Moving Averages | price | yatrader2 (community) |  |
| 918 | Triple RSI \| MisinkoMaster | `triple-rsi-misinkomaster` | Momentum | own | MisinkoMaster | batch 19 |
| 919 | True High/Low RSI for Divergence | `true-high-low-rsi-for-divergence` | Oscillators | own | Lakt_ | batch 29 |
| 920 | True Range eXpansion | `true-range-expansion` | Volatility | price | Sherlock_MacGyver | batch 22 |
| 921 | TTM Squeeze Pro | `ttm-squeeze-pro` | Oscillators | own | John Carter |  |
| 922 | Turtle Trade Channels | `turtle-trade-channels` | Channels & Bands | price | Richard Dennis / William Eckhardt |  |
| 923 | Tweezers & Kangaroo Tail | `tweezers-kangaroo-tail` | Candlestick Patterns | price | LonesomeTheBlue |  |
| 924 | Twin Range Filter | `twin-range-filter` | Trend | price | colinmck |  |
| 925 | Ultimate Buy & Sell | `ultimate-buy-sell` | Trend | price |  |  |
| 926 | Ultimate RSI [LuxAlgo] | `ultimate-rsi` | Momentum | own | LuxAlgo |  |
| 927 | Ultra Clean Support / Resistance Levels | `ultra-clean-support-resistance-levels` | Trend | price | Stocktitian | batch 30 |
| 928 | Ultra Smart Trail | `ultra-smart-trail` | Trend | price | Rathack | batch 18 |
| 929 | UM EMA SMA WMA HMA with Directional Color Change | `um-ema-sma-wma-hma-with-directional-color-change` | Moving Averages | price | UnderwearMillionaire | batch 30 |
| 930 | Universal Large Orders Proxy fabio valentini Chat gpt Recreation | `universal-large-orders-proxy-fabio-valentini-chat-gpt-recreation` | Volume | price | boss11233 | batch 18 |
| 931 | Uptrick: Dynamic Z-Score Deviation | `uptrick-dynamic-z-score-deviation` | Trend | price | Uptrick | batch 6 |
| 932 | Uptrick: Liquid Reversal Bands | `liquid-reversal-bands` | Channels & Bands | price | Uptrick | batch 3 |
| 933 | Uptrick: MultiMA_Volume | `uptrick-multima-volume` | Moving Averages | price | Uptrick | batch 16 |
| 934 | Uptrick: RSI MA Buying/Selling signals | `uptrick-rsi-ma-buying-selling-signals` | Momentum | own | Uptrick | batch 12 |
| 935 | Uptrick: Trend Analysis | `uptrick-trend-analysis` | Momentum | own | Uptrick | batch 14 |
| 936 | Uptrick: Volatility Reversion Bands | `uptrick-volatility-reversion-bands` | Channels & Bands | price | Uptrick | batch 4 |
| 937 | Uptrick: Zero Lag HMA Trend Suite | `zero-lag-hma-trend-suite` | Moving Averages | price | Uptrick | batch 3 |
| 938 | User Defined Range Selector and Color Changing EMA Line | `user-defined-range-selector-and-color-changing-ema-line` | Moving Averages | price | Crypto_Moses | batch 23 |
| 939 | UT Bot | `ut-bot` | Trend | price |  |  |
| 940 | Variable Moving Average | `variable-ma` | Moving Averages | price | LazyBear |  |
| 941 | VARIS Zones | `varis-zones` | Channels & Bands | price | IAmTheLiquidity2 | batch 17 |
| 942 | VCO Fusion | `vco-fusion` | Oscillators | own | Uncle_the_shooter | batch 20 |
| 943 | Vdub FX Sniper | `vdub-sniper` | Oscillators | price | Vdubus |  |
| 944 | vdubus BinaryPro | `vdubus-binarypro` | Oscillators | price |  |  |
| 945 | VEGA (Velocity of Efficient Gain Adaptation) | `vega` | Momentum | own | B3AR_Trades | batch 20 |
| 946 | Vervoort HA LT Candlestick Oscillator | `vervoort-ha-oscillator` | Oscillators | own |  |  |
| 947 | VIM (Volume in Money) | `vim` | Volume | own | tbtb1111 | batch 29 |
| 948 | Visualisation tendances | `visualisation-tendances` | Trend | price | Benjamin69 | batch 17 |
| 949 | Volatility & Big Market Moves | `volatility-big-market-moves` | Volatility | own | nilstrades_ | batch 24 |
| 950 | Volatility Adaptive Filtered Trend | `volatility-adaptive-filtered-trend` | Trend | price | SchizoQuant | batch 6 |
| 951 | Volatility Band Cloud with Overextension Signals | `volatility-band-cloud-with-overextension-signals` | Channels & Bands | price | Retire_by_50 | batch 35 |
| 952 | Volatility Bands | `volatility-bands` | Channels & Bands | price | pmk07 | batch 23 |
| 953 | Volatility Breakout Pulse (VBP FIX) | `volatility-breakout-pulse` | Channels & Bands | price | JohnsonForexTrader | batch 36 |
| 954 | Volatility Channel Oscillator | `volatility-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 955 | Volatility Halo \| NAL | `volatility-halo-nal` | Volatility | price | NordicAlphaLab | batch 6 |
| 956 | Volatility Quality | `volatility-quality` | Volatility | own | AlphaExtract | batch 18 |
| 957 | Volatility-Driven VWAP Structure | `volatility-driven-vwap-structure` | Channels & Bands | price | Zeiierman | batch 3 |
| 958 | Volatility-Gated Trend Oscillator | `volatility-gated-trend-oscillator` | Oscillators | own | QuantAlgo | batch 9 |
| 959 | VOLD Ratio Histogram | `vold-ratio-histogram` | Volume | own | Th16rry | batch 23 |
| 960 | Volumatic S/R Levels | `volumatic-sr-levels` | Trend | price | BigBeluga |  |
| 961 | Volume + RSI & MA Differential | `volume-rsi-ma-differential` | Volume | own | ozzy_livin | batch 7 |
| 962 | Volume Accumulation Percentage | `volume-accumulation-pct` | Volume | own |  |  |
| 963 | Volume and Volatility Ratio Indicator-WODI | `volume-and-volatility-ratio-indicator-wodi` | Volume | own | W0DI | batch 16 |
| 964 | Volume Bands | `volume-bands` | Channels & Bands | price | MisinkoMaster | batch 6 |
| 965 | Volume Bar Breakout | `volume-bar-breakout` | Volume | price | tradeswithashish |  |
| 966 | Volume bar range | `volume-bar-range` | Volume | price | pandorid | batch 25 |
| 967 | Volume Bars Color | `volume-bars-color` | Volume | own | Evgenyc111 | batch 20 |
| 968 | Volume Buy/Sell Split | `volume-buy-sell-split` | Volume | own | LHAMA-Trading | batch 26 |
| 969 | Volume Candle Coloring v5 (BARCOLOR STABLE) | `volume-candle-coloring-v5` | Volume | price | sugogou | batch 37 |
| 970 | Volume Candle Highlighter | `volume-candle-highlighter` | Volume | price | Dougie_dee | batch 5 |
| 971 | Volume Colored Bars | `volume-colored-bars` | Volume | own |  |  |
| 972 | Volume Comparison with Buyer/Seller Pressure | `volume-comparison-with-buyer-seller-pressure` | Volume | own | ask2maniish | batch 26 |
| 973 | Volume Divergence | `volume-divergence` | Volume | own | baymucuk |  |
| 974 | Volume Flow Indicator | `volume-flow-indicator` | Volume | own |  |  |
| 975 | Volume Flow v3 | `volume-flow-v3` | Volume | own | DepthHouse / oh92 (community) |  |
| 976 | Volume Footprint | `volume-footprint` | Volume | price | LuxAlgo |  |
| 977 | Volume LinReg Trend | `volume-linreg-trend` | Volume | own | LonesomeTheBlue |  |
| 978 | Volume Positive Negative (VPN) | `volume-positive-negative` | Volume | own | LevelUpTools | batch 2 |
| 979 | Volume Price Confirmation Indicator | `vpci` | Volume | own |  |  |
| 980 | Volume Profile Heatmap | `volume-profile-heatmap` | Volume | price | KeyAlgos | batch 13 |
| 981 | Volume SuperTrend AI | `volume-supertrend-ai` | Trend | price |  |  |
| 982 | Volume Surge Detector | `volume-surge-detector` | Volume | own | SpeculationLab | batch 19 |
| 983 | Volume Variation Index Indicator | `volume-variation-index-indicator` | Volume | own | thequantscience | batch 35 |
| 984 | Volume Weighted MACD V2 | `vw-macd-v2` | Momentum | own |  |  |
| 985 | Volume Weighted Median Price (VWMP) | `volume-weighted-median-price` | Moving Averages | price | vsov | batch 14 |
| 986 | Volume Weighted RSI (VW RSI) | `volume-weighted-rsi` | Momentum | own | CsokosGeza | batch 34 |
| 987 | Volume Weighted Trend | `volume-weighted-trend` | Trend | price | QuantAlgo | batch 1 |
| 988 | Volume with Alert | `volume-with-alert` | Volume | own | BullBearSR | batch 30 |
| 989 | Volume with EMA and Coloring Rules | `volume-with-ema-and-coloring-rules` | Volume | own | itisfilipe | batch 37 |
| 990 | Volume-Based Moving Average | `volume-based-moving-average` | Moving Averages | price | The_Forex_Steward | batch 36 |
| 991 | Volume-Based RSI Color Indicator with MAs | `volume-based-rsi-color-indicator-with-mas` | Oscillators | own | Riccardo02 | batch 32 |
| 992 | Volume-Gated Trend Ribbon | `volume-gated-trend-ribbon` | Trend | price | QuantAlgo | batch 3 |
| 993 | Volume-Weighted MA Crossover | `volume-weighted-ma-crossover` | Moving Averages | price | AlphaNatt | batch 9 |
| 994 | Volume-Weighted Money Flow | `volume-weighted-money-flow` | Volume | own | sgbpulse | batch 33 |
| 995 | Volume-Weighted Pivot Bands | `volume-weighted-pivot-bands` | Channels & Bands | price | LeafAlgo | batch 33 |
| 996 | Volume-Weighted Price Z-Score | `volume-weighted-price-z-score` | Oscillators | own | QuantAlgo | batch 6 |
| 997 | Volumetric Compressed MA | `volumetric-compressed-ma` | Moving Averages | price | serkany88 | batch 14 |
| 998 | Volumetric Entropy Index | `volumetric-entropy-index` | Volume | own | Sherlock_MacGyver | batch 27 |
| 999 | Volumetric Tensegrity | `volumetric-tensegrity` | Volume | own | TheLeadingIndicator | batch 30 |
| 1000 | VolVol | `volvol` | Volume | price | kunalgolani | batch 26 |
| 1001 | Vortex Pro with Moving average | `vortex-pro-with-moving-average` | Oscillators | own | pointalgo | batch 25 |
| 1002 | Voss Predictive Filter | `voss-predictive-filter` | Oscillators | own | e2e4 | batch 8 |
| 1003 | VPSA-VTD | `vpsa-vtd` | Volume | own | CatTheTrader | batch 11 |
| 1004 | Vulkan Profit | `vulkan-profit` | Trend | price | AlgoCollective | batch 33 |
| 1005 | VuManChu Swing Free | `vumanchu-swing` | Trend | price |  |  |
| 1006 | VWAP & Dual MA Ribbon Tracker Pro | `vwap-dual-ma-ribbon-tracker-pro` | Trend | own | Simon20cent | batch 19 |
| 1007 | VWAP Deviation Oscillator | `vwap-deviation-oscillator` | Oscillators | own | BackQuant | batch 9 |
| 1008 | VWAP Predictive Breakout + RSI + OB + Trend/Chop | `vwap-predictive-breakout-rsi-ob-trend-chop` | Volume | price | Viggy02 | batch 31 |
| 1009 | VWAP/MVWAP/EMA Crossover | `vwap-mvwap-ema-crossover` | Trend | price | DerrickLaFlame |  |
| 1010 | VWMA/SMA Delta Volatility (Statistical Anomaly Detector) | `vwma-sma-delta-volatility` | Volatility | own | tkarolak | batch 14 |
| 1011 | VWMACD & SZO | `vwmacd-szo` | Momentum | own |  |  |
| 1012 | VWMACD-MFI-OBV Composite | `vwmacd-mfi-obv-composite` | Volume | own | munair | batch 27 |
| 1013 | VWRSI Crossovers & Extremes | `vwrsi-crossovers-extremes` | Momentum | own | TheAITradingDesk | batch 35 |
| 1014 | Waddah Attar Explosion | `waddah-attar-explosion` | Momentum | own | LazyBear/ShayanKM |  |
| 1015 | WAE Sniper Scalp XAUUSD M1 Tuned | `wae-sniper-scalp-xauusd-m1-tuned` | Momentum | own | khonthailoei19071983 | batch 19 |
| 1016 | Wave N + KDJ + Volumi + SMC + Ichimoku | `wave-n-kdj-volumi-smc-ichimoku` | Trend | price | Nikus63 | batch 31 |
| 1017 | WaveFunction MACD | `wavefunction-macd` | Momentum | own | TechnoBlooms | batch 27 |
| 1018 | Wavelet Filter with Adaptive Upsampling | `wavelet-filter-with-adaptive-upsampling` | Oscillators | own | BackQuant | batch 29 |
| 1019 | Wavelet Transform Trend | `wavelet-transform-trend` | Trend | price | QuantAlgo | batch 12 |
| 1020 | Wavelet-Trend ML Integration | `wavelet-trend-ml-integration` | Oscillators | own | AlphaExtract | batch 1 |
| 1021 | WaveTrend | `wavetrend` | Oscillators | own | LazyBear |  |
| 1022 | WaveTrend Oscillator | `wavetrend-oscillator` | Momentum | own | LazyBear |  |
| 1023 | Weierstrass Function (Fractal Cycles) | `weierstrass-function` | Oscillators | own | fract | batch 17 |
| 1024 | Weighted percentile nearest rank | `weighted-percentile-nearest-rank` | Moving Averages | price | gorx1 | batch 10 |
| 1025 | Weighted Regression Bands | `weighted-regression-bands` | Channels & Bands | price | Zeiierman | batch 5 |
| 1026 | Weis Wave Candle | `weis-wave-candle` | Trend | own | Uncle_the_shooter | batch 34 |
| 1027 | Weis Wave Volume | `weis-wave-volume` | Volume | own |  |  |
| 1028 | Whale Activity Impact Oscillator | `whale-activity-impact-oscillator` | Volume | own | mdeacey | batch 18 |
| 1029 | Whale Volume Absorption & Aggression @MaxMaserati 3.0 | `whale-volume-absorption-aggression-maxmaserati-3-0` | Volume | own | MaxMaserati | batch 22 |
| 1030 | WICK.ED Fractals | `wicked-fractals` | Oscillators | price | Mit Nayi (community) |  |
| 1031 | Williams Alligator + Fractals | `williams-combo` | Trend | price | vlkvr (Pine v3) |  |
| 1032 | Williams BBDiv Signal | `williams-bbdiv-signal` | Oscillators | own | trade_lexx | batch 20 |
| 1033 | Williams Percent Range with Threshold | `williams-percent-range-with-threshold` | Oscillators | own | xdextra | batch 29 |
| 1034 | Williams Vix Fix | `williams-vix-fix` | Volatility | own | ChrisMoody |  |
| 1035 | WLSMA: fast approximation | `wlsma-fast-approximation` | Moving Averages | price | gorx1 | batch 33 |
| 1036 | Wyckoff Effort vs. Result | `wyckoff-effort-vs-result` | Volume | price | TradeTechanalysis | batch 34 |
| 1037 | x5-smooth-ema | `x5-smooth-ema` | Moving Averages | price | traderninezero | batch 19 |
| 1038 | XAUUSD Buy/Sell Alerts with SL & TP | `xauusd-buy-sell-alerts-with-sl-tp` | Moving Averages | price | alexandrossolomou1 | batch 8 |
| 1039 | XAUUSD Family Scalping (5min) | `xauusd-family-scalping` | Oscillators | price | cupra_inc | batch 8 |
| 1040 | Z-Score | `z-score` | Oscillators | own | joecalledher | batch 21 |
| 1041 | Z-Score Oscillator | `z-score-oscillator` | Oscillators | own | B3AR_Trades | batch 12 |
| 1042 | Z-Score STDEMA Bands | `z-score-stdema-bands` | Oscillators | own | TiagoTF | batch 24 |
| 1043 | Z-Score Trend Monitor | `z-score-trend-monitor` | Oscillators | own | EdgeTerminal | batch 31 |
| 1044 | Zero Lag EMA | `zero-lag-ema` | Moving Averages | price |  |  |
| 1045 | Zero Lag LSMA (ZLSMA) | `zlsma` | Moving Averages | price | veryfid |  |
| 1046 | Zero Lag MACD | `zero-lag-macd` | Momentum | own | AC (based on Glaz) |  |
| 1047 | Zero Lag Signals For Loop | `zero-lag-signals-for-loop` | Trend | price | QuantAlgo | batch 1 |
| 1048 | Zero-Lag GARCH Bands \| NAL | `zero-lag-garch-bands-nal` | Volatility | price | NordicAlphaLab | batch 12 |
| 1049 | ZigZag with Fibonacci Levels | `zigzag-fibonacci` | Trend | price | LonesomeTheBlue |  |
| 1050 | ZVOL - Z-Score Volume Heatmap | `zvol-z-score-volume-heatmap` | Volume | own | TheLeadingIndicator | batch 28 |
| 1051 | 🌊 ALMA Bands | `alma-bands` | Moving Averages | price | B3AR_Trades | batch 26 |
