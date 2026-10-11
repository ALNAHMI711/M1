"""Read-only Testnet static preflight. Never loads credentials or submits orders."""
from __future__ import annotations

import argparse
import json

from .binance_spot import BinanceAPIError, BinanceSpotClient, BinanceSpotConfig
from .spot_filters import SpotFilterError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--quantity", required=True)
    parser.add_argument("--side", choices=["BUY", "SELL"], default="BUY")
    parser.add_argument("--type", choices=["LIMIT", "MARKET"], default="LIMIT")
    parser.add_argument("--price")
    parser.add_argument("--time-in-force", choices=["GTC", "IOC", "FOK"])
    args = parser.parse_args(argv)
    client = BinanceSpotClient(BinanceSpotConfig("", ""))
    try:
        result = client.order_preflight(
            symbol=args.symbol, side=args.side, order_type=args.type,
            quantity=args.quantity, price=args.price, time_in_force=args.time_in_force,
        )
    except SpotFilterError as exc:
        print(json.dumps({"static_validation_passed": False, "reason": str(exc),
                          "order_placement": False, "live_enabled": False}))
        return 2
    except BinanceAPIError:
        # Never echo raw upstream body, credentials, or signed URLs.
        print(json.dumps({"static_validation_passed": False,
                          "reason": "testnet_metadata_unavailable",
                          "order_placement": False, "live_enabled": False}))
        return 3
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
