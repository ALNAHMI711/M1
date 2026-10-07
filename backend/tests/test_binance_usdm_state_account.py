from app.binance_usdm_account import parse_account_update
from app.binance_usdm_snapshot import UsdmAccountSnapshot, UsdmSnapshotAsset, UsdmSnapshotPosition
from app.binance_usdm_state import accept_account_update, from_snapshot


def test_account_update_merges_partial_asset_and_position_state():
    state = from_snapshot(
        UsdmAccountSnapshot(
            assets=(UsdmSnapshotAsset("USDT", "10", "9"),),
            positions=(UsdmSnapshotPosition("BTCUSDT", "BOTH", "0", "0", "0"),),
        ),
        snapshot_version=1,
    )
    update = parse_account_update(
        {
            "e": "ACCOUNT_UPDATE", "E": 200, "T": 199,
            "a": {
                "m": "ORDER",
                "B": [{"a": "USDT", "wb": "12", "cw": "11", "bc": "2"}],
                "P": [{"s": "BTCUSDT", "pa": "0.01", "ep": "100", "up": "1", "ps": "BOTH", "mt": "crossed"}],
            },
        }
    )
    updated = accept_account_update(state, update)
    assert updated.last_event_time == 200
    assert updated.snapshot.assets[0].wallet_balance == "12"
    assert updated.snapshot.assets[0].available_balance == "9"
    assert updated.snapshot.positions[0].quantity == "0.01"


def test_stale_account_update_does_not_mutate_snapshot():
    state = from_snapshot(
        UsdmAccountSnapshot(assets=(UsdmSnapshotAsset("USDT", "10", "9"),), positions=()),
        snapshot_version=1,
    )
    first = parse_account_update({"e": "ACCOUNT_UPDATE", "E": 200, "a": {"B": [], "P": []}})
    stale = parse_account_update({
        "e": "ACCOUNT_UPDATE", "E": 199,
        "a": {"B": [{"a": "USDT", "wb": "1", "cw": "1", "bc": "0"}], "P": []},
    })
    state = accept_account_update(state, first)
    assert accept_account_update(state, stale) == state
