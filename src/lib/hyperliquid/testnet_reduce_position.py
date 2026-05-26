import json
import os
import sys
import time
import traceback
from decimal import Decimal, ROUND_DOWN

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


def get_size_decimals(info: Info, coin: str) -> int:
    meta = info.meta()
    for asset in meta.get("universe", []):
        if asset.get("name") == coin:
            size_decimals = asset.get("szDecimals")
            if isinstance(size_decimals, int) and size_decimals >= 0:
                return size_decimals
            break
    fail(f"Missing size precision metadata for {coin}.")


def normalize_order_size(size: float, size_decimals: int) -> float:
    if not isinstance(size, int | float) or size <= 0:
        fail("Reduce size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Reduce size is too small for the market's minimum size increment.")

    return float(normalized_size)


def get_statuses(result: object) -> list[object]:
    if not isinstance(result, dict):
        return []
    response = result.get("response")
    if not isinstance(response, dict):
        return []
    data = response.get("data")
    if not isinstance(data, dict):
        return []
    statuses = data.get("statuses")
    if not isinstance(statuses, list):
        return []
    return statuses


def get_resting_order(status: dict) -> dict | None:
    resting = status.get("resting")
    return resting if isinstance(resting, dict) else None


def get_filled_order(status: dict) -> dict | None:
    filled = status.get("filled")
    return filled if isinstance(filled, dict) else None


def extract_exchange_error(result: object) -> str | None:
    if isinstance(result, dict):
        direct_error = result.get("error")
        if isinstance(direct_error, str) and direct_error:
            return direct_error

        response = result.get("response")
        if isinstance(response, dict):
            response_error = response.get("error")
            if isinstance(response_error, str) and response_error:
                return response_error

            data = response.get("data")
            if isinstance(data, dict):
                statuses = data.get("statuses")
                if isinstance(statuses, list):
                    for status in statuses:
                        if isinstance(status, dict):
                            status_error = status.get("error")
                            if isinstance(status_error, str) and status_error:
                                return status_error
    return None


def main() -> None:
    payload_raw = os.environ.get("PORTAL_REDUCE_POSITION_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing reduce-position payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    coin = payload["coin"]
    symbol = payload["symbol"]
    percent = float(payload["percent"])

    if not 0 < percent <= 100:
        fail("Invalid reduce-position percent.")

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    info = Info(constants.TESTNET_API_URL, skip_ws=True)

    initial_user_state = info.user_state(address)
    position = find_position(initial_user_state, coin)
    current_size = abs(parse_float(position.get("szi"))) if isinstance(position, dict) else 0.0

    if current_size <= 0:
        fail("Reduce position failed — no live position exists.")

    size_decimals = get_size_decimals(info, coin)
    requested_reduce_size = current_size * (percent / 100)
    normalized_reduce_size = normalize_order_size(requested_reduce_size, size_decimals)

    if normalized_reduce_size > current_size:
        normalized_reduce_size = normalize_order_size(current_size, size_decimals)

    reduce_result = exchange.market_close(coin, sz=normalized_reduce_size)
    reduce_statuses = get_statuses(reduce_result)
    reduce_resting = next((get_resting_order(status) for status in reduce_statuses if get_resting_order(status)), None)
    reduce_filled = next((get_filled_order(status) for status in reduce_statuses if get_filled_order(status)), None)
    reduce_order_id = None
    if isinstance(reduce_resting, dict):
        reduce_order_id = reduce_resting.get("oid")
    elif isinstance(reduce_filled, dict):
        reduce_order_id = reduce_filled.get("oid")

    if not isinstance(reduce_result, dict) or reduce_result.get("status") != "ok":
        fail(
            extract_exchange_error(reduce_result)
            or "Reduce position failed — exchange rejected reduce-only market order."
        )

    remaining_size = current_size
    reduced_size = 0.0
    for _ in range(10):
        user_state = info.user_state(address)
        next_position = find_position(user_state, coin)
        remaining_size = abs(parse_float(next_position.get("szi"))) if isinstance(next_position, dict) else 0.0
        reduced_size = max(current_size - remaining_size, 0.0)
        if reduced_size > 0 or remaining_size <= 0:
            print(
                json.dumps(
                    {
                        "reducedSize": reduced_size,
                        "remainingSize": remaining_size,
                        "requestedReduceSize": requested_reduce_size,
                        "normalizedReduceSize": normalized_reduce_size,
                        "success": True,
                        "symbol": symbol,
                        "reduceOrderId": reduce_order_id,
                    }
                )
            )
            return
        time.sleep(0.25)

    fail("Reduce position failed — live position size did not update after reduce attempt.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet reduce-position failed.")
