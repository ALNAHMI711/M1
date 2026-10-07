from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


@dataclass(frozen=True)
class UsdmAsset:
    asset: str
    wallet_balance: str
    cross_wallet_balance: str
    balance_change: str


@dataclass(frozen=True)
class UsdmPosition:
    symbol: str
    position_side: str
    quantity: str
    entry_price: str
    unrealized_pnl: str
    margin_type: str


@dataclass(frozen=True)
class UsdmAccountUpdate:
    event_time: int | None
    transaction_time: int | None
    reason: str | None
    assets: tuple[UsdmAsset, ...]
    positions: tuple[UsdmPosition, ...]


def _decimal_string(value: object, field: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"invalid_{field}")
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"invalid_{field}") from exc
    if not number.is_finite():
        raise ValueError(f"invalid_{field}")
    return value


def parse_account_update(payload: dict) -> UsdmAccountUpdate:
    if not isinstance(payload, dict) or payload.get("e") != "ACCOUNT_UPDATE":
        raise ValueError("invalid_account_update")

    account = payload.get("a")
    if not isinstance(account, dict):
        raise ValueError("account_update_missing_account")

    raw_assets = account.get("B", [])
    raw_positions = account.get("P", [])
    if not isinstance(raw_assets, list) or not isinstance(raw_positions, list):
        raise ValueError("invalid_account_update_arrays")

    assets: list[UsdmAsset] = []
    for item in raw_assets:
        if not isinstance(item, dict):
            raise ValueError("invalid_account_asset")
        asset = item.get("a")
        if not isinstance(asset, str) or not asset:
            raise ValueError("invalid_account_asset_name")
        assets.append(
            UsdmAsset(
                asset=asset,
                wallet_balance=_decimal_string(item.get("wb"), "wallet_balance"),
                cross_wallet_balance=_decimal_string(item.get("cw"), "cross_wallet_balance"),
                balance_change=_decimal_string(item.get("bc"), "balance_change"),
            )
        )

    positions: list[UsdmPosition] = []
    for item in raw_positions:
        if not isinstance(item, dict):
            raise ValueError("invalid_account_position")
        symbol = item.get("s")
        position_side = item.get("ps")
        margin_type = item.get("mt")
        if not isinstance(symbol, str) or not symbol:
            raise ValueError("invalid_position_symbol")
        if position_side not in {"BOTH", "LONG", "SHORT"}:
            raise ValueError("invalid_position_side")
        if not isinstance(margin_type, str):
            raise ValueError("invalid_margin_type")
        normalized_margin_type = margin_type.upper()
        if normalized_margin_type not in {"CROSSED", "ISOLATED"}:
            raise ValueError("invalid_margin_type")
        positions.append(
            UsdmPosition(
                symbol=symbol,
                position_side=position_side,
                quantity=_decimal_string(item.get("pa"), "position_quantity"),
                entry_price=_decimal_string(item.get("ep"), "entry_price"),
                unrealized_pnl=_decimal_string(item.get("up"), "unrealized_pnl"),
                margin_type=normalized_margin_type,
            )
        )

    event_time = payload.get("E")
    transaction_time = payload.get("T")
    if event_time is not None and not isinstance(event_time, int):
        raise ValueError("invalid_event_time")
    if transaction_time is not None and not isinstance(transaction_time, int):
        raise ValueError("invalid_transaction_time")

    reason = account.get("m")
    if reason is not None and not isinstance(reason, str):
        raise ValueError("invalid_update_reason")

    return UsdmAccountUpdate(
        event_time=event_time,
        transaction_time=transaction_time,
        reason=reason,
        assets=tuple(assets),
        positions=tuple(positions),
    )
