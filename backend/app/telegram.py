import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedTelegramSignal:
    symbol: str
    side: str
    entry: float
    stop_loss: float
    take_profit: float
    score: float
    rr: float


_NUMBER = r"([0-9]+(?:\.[0-9]+)?)"


def _value(pattern: str, text: str) -> float:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        raise ValueError("missing signal field")
    return float(match.group(1))


def parse_telegram_signal(text: str) -> ParsedTelegramSignal:
    normalized = text.upper().replace(",", ".")
    side_match = re.search(r"\b(LONG|SHORT|شراء|بيع)\b", normalized)
    if not side_match:
        raise ValueError("missing side")
    side = "LONG" if side_match.group(1) in {"LONG", "شراء"} else "SHORT"

    symbol_match = re.search(r"\b([A-Z]{2,12})(?:USDT|USDC|USD)\b", normalized)
    if not symbol_match:
        symbol_match = re.search(r"\b([A-Z]{2,12})\b", normalized)
    if not symbol_match:
        raise ValueError("missing symbol")

    entry = _value(r"(?:ENTRY|دخول)\s*[:=]?\s*" + _NUMBER, normalized)
    stop_loss = _value(r"(?:SL|STOP(?:\s*LOSS)?|وقف)\s*[:=]?\s*" + _NUMBER, normalized)
    take_profit = _value(r"(?:TP1|TP|TAKE(?:\s*PROFIT)?|هدف)\s*[:=]?\s*" + _NUMBER, normalized)
    score = _value(r"(?:SCORE|درجة)\s*[:=]?\s*" + _NUMBER, normalized)
    rr = _value(r"(?:RR|R:R)\s*[:=]?\s*" + _NUMBER, normalized)

    return ParsedTelegramSignal(
        symbol=symbol_match.group(1) + "USDT",
        side=side,
        entry=entry,
        stop_loss=stop_loss,
        take_profit=take_profit,
        score=score,
        rr=rr,
    )
