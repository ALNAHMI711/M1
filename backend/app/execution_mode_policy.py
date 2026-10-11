from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ExecutionMode = Literal["DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"]
SUBMISSION_MODES = frozenset({"PAPER", "TESTNET"})
KNOWN_MODES = frozenset({"DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"})


@dataclass(frozen=True)
class ExecutionModeDecision:
    allowed: bool
    reasons: tuple[str, ...]


def check_execution_mode(*, mode: str, transport_mode: str | None) -> ExecutionModeDecision:
    """Fail-closed mode/transport compatibility policy; never sends an order."""
    if mode not in KNOWN_MODES:
        return ExecutionModeDecision(False, ("invalid_execution_mode",))
    if mode == "LIVE":
        return ExecutionModeDecision(False, ("live_execution_not_implemented",))
    if mode not in SUBMISSION_MODES:
        return ExecutionModeDecision(False, ("mode_does_not_allow_submission",))
    if transport_mode != mode:
        return ExecutionModeDecision(False, ("transport_mode_mismatch",))
    return ExecutionModeDecision(True, ())
