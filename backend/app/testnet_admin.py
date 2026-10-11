"""Admin-only Spot Testnet settings API. No browser UI."""
import logging
from contextlib import suppress
from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from .auth import current_user
from .binance_spot import BinanceAPIError, BinanceSpotClient, BinanceSpotConfig
from .testnet_settings import (apply_migrations,credentials_status,delete_credentials,get_settings,
 load_credentials_for_testnet,load_master_key,mark_credentials_test_failed,mark_credentials_test_passed,
 save_credentials,update_settings)

logger=logging.getLogger(__name__)
router=APIRouter()

class TestnetSettingsInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    allowed_symbols:list[str]=Field(min_length=1,max_length=2)
    max_order_notional:str=Field(min_length=1,max_length=32)
    max_daily_notional:str=Field(min_length=1,max_length=32)
    enabled:bool=False

class TestnetCredentialsInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    api_key:SecretStr=Field(min_length=1,max_length=4096,repr=False)
    api_secret:SecretStr=Field(min_length=1,max_length=4096,repr=False)

@router.on_event("startup")
def startup_testnet_admin():
    load_master_key()
    apply_migrations()

@router.get("/v1/admin/settings/testnet")
def read_settings(user=Security(current_user,scopes=["trading:admin"])):
    return get_settings()

@router.put("/v1/admin/settings/testnet")
def write_settings(payload:TestnetSettingsInput,user=Security(current_user,scopes=["trading:admin"])):
    try:
        return update_settings(allowed_symbols=payload.allowed_symbols,max_order_notional=payload.max_order_notional,
            max_daily_notional=payload.max_daily_notional,actor=user.username,enabled=payload.enabled)
    except ValueError as exc:
        reason=str(exc); status=409 if reason=="testnet_activation_requires_owner_review" else 422
        raise HTTPException(status_code=status,detail=reason) from None

@router.get("/v1/admin/settings/testnet/credentials/status")
def read_credentials_status(user=Security(current_user,scopes=["trading:admin"])):
    return credentials_status()

@router.put("/v1/admin/settings/testnet/credentials")
def write_credentials(payload:TestnetCredentialsInput,user=Security(current_user,scopes=["trading:admin"])):
    try:
        load_master_key()
        save_credentials(api_key=payload.api_key.get_secret_value(),api_secret=payload.api_secret.get_secret_value(),actor=user.username)
    except (RuntimeError,ValueError) as exc:
        reason=str(exc)
        if reason.startswith("testnet_encryption_key_"): raise HTTPException(status_code=503,detail=reason) from None
        raise HTTPException(status_code=422,detail="invalid_testnet_credentials") from None
    return {"saved":True,"credentials_present":True,"test_passed":False}

@router.post("/v1/admin/settings/testnet/credentials/test")
def test_credentials(user=Security(current_user,scopes=["trading:admin"])):
    try:
        key,secret=load_credentials_for_testnet()
        account=BinanceSpotClient(BinanceSpotConfig(api_key=key,api_secret=secret)).account()
        if not isinstance(account,dict) or account.get("canTrade") is not True: raise BinanceAPIError("testnet_account_not_trade_enabled")
    except Exception:
        with suppress(Exception): mark_credentials_test_failed(user.username)
        logger.warning("testnet_credentials_check_failed actor=%s",user.username)
        raise HTTPException(status_code=502,detail="testnet_credentials_check_failed") from None
    mark_credentials_test_passed(user.username)
    return {"ok":True,"test_passed":True,"environment":"SPOT_TESTNET"}

@router.delete("/v1/admin/settings/testnet/credentials")
def remove_credentials(user=Security(current_user,scopes=["trading:admin"])):
    delete_credentials(user.username)
    return {"deleted":True,"credentials_present":False,"enabled":False}
