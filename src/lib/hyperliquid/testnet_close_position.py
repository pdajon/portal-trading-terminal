import json
import os
import sys
import time
import traceback

import eth_account
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants


def fail(message: str) -> None:
    print(json.dumps({"error": message, "success": False}))
    sys.exit(1)


def parse_float(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def find_position(user_state: dict, coin: str) -> dict | None:
    asset_positions = user_state.get("assetPositions")
    if not isinstance(asset_positions, list):
        return None

    for asset_position in asset_positions:
        if not isinstance(asset_position, dict):
            continue
        position = asset_position.get("position")
        if not isinstance(position, dict):
            continue
        if position.get("coin") != coin:
            continue
        return position
    return None


def main() -> None:
    payload_raw = os.environ.get("PORTAL_CLOSE_POSITION_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing close-position payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    coin = payload["coin"]
    symbol = payload["symbol"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    info = Info(constants.TESTNET_API_URL, skip_ws=True)

    result = exchange.market_close(coin)
    if not isinstance(result, dict) or result.get("status") != "ok":
        fail("Close position failed — exchange rejected market close.")

    for _ in range(8):
        user_state = info.user_state(address)
        position = find_position(user_state, coin)
        size = abs(parse_float(position.get("szi"))) if isinstance(position, dict) else 0.0
        if size <= 0:
            print(json.dumps({"success": True, "symbol": symbol}))
            return
        time.sleep(0.25)

    fail("Close position failed — live position still open after close attempt.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet close-position failed.")
