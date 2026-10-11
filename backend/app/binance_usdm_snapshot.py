from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


@dataclass(frozen=True)
class UsdmSnapshotAsset:
    asset: str
    wallet_balance: str
    available_balance: str


@dataclass(frozen=True)
class UsdmSnapshotPosition:
    symbol: str
    position_side: str
    quantity: str
    entry_price: str
    unrealized_pnl: str


@dataclass(frozen=True)
class UsdmAccountSnapshot:
    assets: tuple[UsdmSnapshotAsset, ...]
    positions: tuple[UsdmSnapshotPosition, ...]


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


def parse_account_snapshot(response: dict) -> UsdmAccountSnapshot:
    if not isinstance(response, dict):
        raise ValueError("invalid_account_snapshot")
    if response.get("status") != 200:
        raise ValueError("account_snapshot_failed")
    result = response.get("result")
    if not isinstance(result, dict):
        raise ValueError("missing_account_snapshot_result")

    raw_assets = result.get("assets", [])
    raw_positions = result.get("positions", [])
    if not isinstance(raw_assets, list) or not isinstance(raw_positions, list):
        raise ValueError("invalid_account_snapshot_arrays")

    assets: list[UsdmSnapshotAsset] = []
    for item in raw_assets:
        if not isinstance(item, dict):
            raise ValueError("invalid_snapshot_asset")
        asset = item.get("asset")
        if not isinstance(asset, str) or not asset:
            raise ValueError("invalid_snapshot_asset_name")
        assets.append(
            UsdmSnapshotAsset(
                asset=asset,
                wallet_balance=_decimal_string(item.get("walletBalance"), "wallet_balance"),
                available_balance=_decimal_string(item.get("availableBalance"), "available_balance"),
            )
        )

    positions: list[UsdmSnapshotPosition] = []
    for item in raw_positions:
        if not isinstance(item, dict):
            raise ValueError("invalid_snapshot_position")
        symbol = item.get("symbol")
        position_side = item.get("positionSide")
        if not isinstance(symbol, str) or not symbol:
            raise ValueError("invalid_snapshot_position_symbol")
        if position_side not in {"BOTH", "LONG", "SHORT"}:
            raise ValueError("invalid_snapshot_position_side")
        positions.append(
            UsdmSnapshotPosition(
                symbol=symbol,
                position_side=position_side,
                quantity=_decimal_string(item.get("positionAmt"), "position_quantity"),
                entry_price=_decimal_string(item.get("entryPrice"), "entry_price"),
                unrealized_pnl=_decimal_string(item.get("unrealizedProfit"), "unrealized_pnl"),
            )
        )

    return UsdmAccountSnapshot(
        assets=tuple(assets),
        positions=tuple(positions),
    )
