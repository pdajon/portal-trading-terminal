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


def flatten_frontend_orders(frontend_orders: object) -> list[dict]:
    flattened: list[dict] = []

    if not isinstance(frontend_orders, list):
        return flattened

    for order in frontend_orders:
        if not isinstance(order, dict):
            continue
        flattened.append(order)
        children = order.get("children")
        if isinstance(children, list):
            for child in children:
                if isinstance(child, dict):
                    flattened.append(child)

    return flattened


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
        fail("Reverse size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Reverse size is too small for the market's minimum size increment.")

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


def cancel_existing_protection(
    exchange: Exchange,
    info: Info,
    address: str,
    coin: str,
) -> list[int]:
    open_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    protection_order_ids: list[int] = []

    for order in open_orders:
        if order.get("coin") != coin:
            continue
        if not order.get("reduceOnly"):
            continue
        if not order.get("isTrigger"):
            continue

        oid = order.get("oid")
        if isinstance(oid, int):
            protection_order_ids.append(oid)

    if not protection_order_ids:
        return []

    unique_oids = sorted(set(protection_order_ids))
    exchange.bulk_cancel([{"coin": coin, "oid": oid} for oid in unique_oids])
    return unique_oids


def wait_for_protection_cleared(
    info: Info,
    address: str,
    coin: str,
    retries: int = 8,
    delay_seconds: float = 0.25,
) -> bool:
    for _ in range(retries):
        flattened_orders = flatten_frontend_orders(info.frontend_open_orders(address))
        remaining_protection_orders = [
            order
            for order in flattened_orders
            if order.get("coin") == coin and order.get("reduceOnly") and order.get("isTrigger")
        ]
        if not remaining_protection_orders:
            return True
        time.sleep(delay_seconds)
    return False


def main() -> None:
    payload_raw = os.environ.get("PORTAL_REVERSE_POSITION_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing reverse-position payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    coin = payload["coin"]
    symbol = payload["symbol"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    info = Info(constants.TESTNET_API_URL, skip_ws=True)

    initial_user_state = info.user_state(address)
    position = find_position(initial_user_state, coin)
    signed_size = parse_float(position.get("szi")) if isinstance(position, dict) else 0.0
    current_size = abs(signed_size)

    if current_size <= 0:
        fail("Reverse position failed — no live position exists.")

    current_direction = "long" if signed_size > 0 else "short"
    reverse_direction = "short" if current_direction == "long" else "long"
    size_decimals = get_size_decimals(info, coin)
    requested_reverse_size = current_size * 2
    normalized_reverse_size = normalize_order_size(requested_reverse_size, size_decimals)
    reverse_is_buy = reverse_direction == "long"

    canceled_protection_order_ids = cancel_existing_protection(exchange, info, address, coin)
    if canceled_protection_order_ids and not wait_for_protection_cleared(info, address, coin):
        fail("Reverse position failed — old TP/SL protection orders did not cancel cleanly.")

    reverse_result = exchange.market_open(coin, reverse_is_buy, normalized_reverse_size)
    reverse_statuses = get_statuses(reverse_result)
    reverse_resting = next((get_resting_order(status) for status in reverse_statuses if get_resting_order(status)), None)
    reverse_filled = next((get_filled_order(status) for status in reverse_statuses if get_filled_order(status)), None)
    reverse_order_id = None
    if isinstance(reverse_resting, dict):
        reverse_order_id = reverse_resting.get("oid")
    elif isinstance(reverse_filled, dict):
        reverse_order_id = reverse_filled.get("oid")

    if not isinstance(reverse_result, dict) or reverse_result.get("status") != "ok":
        fail(
            extract_exchange_error(reverse_result)
            or "Reverse position failed — exchange rejected market reverse order."
        )

    for _ in range(12):
        user_state = info.user_state(address)
        next_position = find_position(user_state, coin)
        next_signed_size = parse_float(next_position.get("szi")) if isinstance(next_position, dict) else 0.0
        next_size = abs(next_signed_size)
        next_direction = "long" if next_signed_size > 0 else "short" if next_signed_size < 0 else None
        next_entry = parse_float(next_position.get("entryPx")) if isinstance(next_position, dict) else 0.0

        if next_direction == reverse_direction and next_size > 0 and next_entry > 0:
            print(
                json.dumps(
                    {
                        "canceledProtectionOrderIds": canceled_protection_order_ids,
                        "newDirection": reverse_direction,
                        "newEntry": next_entry,
                        "newSize": next_size,
                        "normalizedReverseSize": normalized_reverse_size,
                        "reverseOrderId": reverse_order_id,
                        "success": True,
                        "symbol": symbol,
                    }
                )
            )
            return
        time.sleep(0.25)

    fail("Reverse position failed — reversed live position was not confirmed.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet reverse-position failed.")
