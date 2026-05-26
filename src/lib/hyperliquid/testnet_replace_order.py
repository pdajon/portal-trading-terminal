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


def fail(message: str, summary: dict | None = None) -> None:
    payload = {"error": message, "success": False}
    if summary is not None:
        payload["summary"] = summary
    print(json.dumps(payload))
    sys.exit(1)


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
        fail("Pending order size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Trade size is too small for the market's minimum size increment.")

    return float(normalized_size)


def normalize_order_price(price: float, size_decimals: int) -> float:
    if not isinstance(price, int | float) or price <= 0:
        fail("Pending order price is invalid.")

    rounded = round(float(f"{price:.5g}"), 6 - size_decimals)

    if rounded <= 0:
        fail("Pending order price is invalid after normalization.")

    if abs(rounded - price) / price > 0.01:
        fail("Pending order price normalization would distort the order too much.")

    return rounded


def parse_float(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


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


def find_open_order(info: Info, address: str, coin: str, order_id: int) -> dict | None:
    frontend_orders = flatten_frontend_orders(info.frontend_open_orders(address))

    for order in frontend_orders:
        if order.get("coin") != coin:
            continue
        if order.get("oid") != order_id:
            continue
        if order.get("reduceOnly") or order.get("isTrigger"):
            continue
        return order

    return None


def find_live_limit_order(
    info: Info,
    address: str,
    coin: str,
    order_id: int,
    retries: int = 3,
    delay_seconds: float = 0.15,
) -> dict | None:
    for attempt in range(retries):
        live_order = find_open_order(info, address, coin, order_id)
        if isinstance(live_order, dict):
            return live_order
        if attempt < retries - 1:
            time.sleep(delay_seconds)
    return None


def wait_until_order_removed(
    info: Info,
    address: str,
    coin: str,
    order_id: int,
    retries: int = 4,
    delay_seconds: float = 0.15,
) -> bool:
    for attempt in range(retries):
        if find_open_order(info, address, coin, order_id) is None:
            return True
        if attempt < retries - 1:
            time.sleep(delay_seconds)
    return False


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


def wait_for_position(
    info: Info,
    address: str,
    coin: str,
    retries: int = 4,
    delay_seconds: float = 0.15,
) -> dict:
    latest_user_state = {}
    latest_position = None

    for attempt in range(1, retries + 1):
        latest_user_state = info.user_state(address)
        latest_position = find_position(latest_user_state, coin)
        position_size = 0.0
        if isinstance(latest_position, dict):
            position_size = abs(parse_float(latest_position.get("szi", 0)))

        if position_size > 0:
            return {
                "attempts": attempt,
                "position": latest_position,
                "positionSize": position_size,
                "userState": latest_user_state,
            }

        if attempt < retries:
            time.sleep(delay_seconds)

    return {
        "attempts": retries,
        "position": latest_position,
        "positionSize": 0.0,
        "userState": latest_user_state,
    }


def make_order_summary(replace_id: str, order_id: int | None = None, status: str = "pending") -> dict:
    return {
        "executionId": replace_id,
        "id": order_id,
        "status": status,
    }


def extract_order_id(result: object) -> int | None:
    statuses = get_statuses(result)
    resting_order = next((get_resting_order(status) for status in statuses if get_resting_order(status)), None)
    filled_order = next((get_filled_order(status) for status in statuses if get_filled_order(status)), None)

    order_id = None
    if isinstance(resting_order, dict):
        order_id = resting_order.get("oid")
    elif isinstance(filled_order, dict):
        order_id = filled_order.get("oid")

    return order_id if isinstance(order_id, int) else None


def place_limit_order(
    exchange: Exchange,
    info: Info,
    address: str,
    coin: str,
    is_buy: bool,
    size: float,
    price: float,
) -> dict:
    place_result = exchange.order(
        coin,
        is_buy,
        size,
        price,
        {"limit": {"tif": "Gtc"}},
        False,
    )

    return {
        "orderId": extract_order_id(place_result),
        "result": place_result,
    }


def main() -> None:
    payload_raw = os.environ.get("PORTAL_REPLACE_ORDER_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing replace payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    replace_id = payload["replaceId"]
    direction = payload["direction"]
    coin = payload["coin"]
    previous_order_id = int(payload["orderId"])
    requested_price = float(payload["price"])
    requested_size = float(payload["size"])
    symbol = payload["symbol"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    size_decimals = get_size_decimals(info, coin)
    normalized_price = normalize_order_price(requested_price, size_decimals)
    normalized_size = normalize_order_size(requested_size, size_decimals)
    replace_timestamp = int(time.time() * 1000)
    is_buy = direction == "long"

    summary = {
        "actualFilledSize": 0.0,
        "direction": direction,
        "fillPrice": 0.0,
        "finalPositionState": None,
        "finalResult": "already closed",
        "intendedPrice": requested_price,
        "intendedSize": requested_size,
        "normalizedPrice": normalized_price,
        "normalizedSize": normalized_size,
        "previousOrderId": previous_order_id,
        "replacementOrder": make_order_summary(replace_id, None, "pending"),
        "replaceId": replace_id,
        "symbol": symbol,
        "timestamp": replace_timestamp,
    }

    existing_order = find_open_order(info, address, coin, previous_order_id)

    if existing_order is None:
        position_wait = wait_for_position(info, address, coin)
        position = position_wait["position"]
        fill_price = 0.0
        if isinstance(position, dict):
            fill_price = parse_float(position.get("entryPx", 0))

        summary.update(
            {
                "actualFilledSize": position_wait["positionSize"],
                "fillPrice": fill_price,
                "finalPositionState": position_wait["userState"],
            }
        )

        if position_wait["positionSize"] > 0 and fill_price > 0:
            summary["replacementOrder"] = make_order_summary(replace_id, previous_order_id, "filled")
            summary["finalResult"] = "filled"

        print(json.dumps({"success": True, "summary": summary}))
        return

    existing_price = parse_float(existing_order.get("limitPx"))
    existing_size = abs(parse_float(existing_order.get("sz")))
    existing_is_buy = bool(existing_order.get("isBuy"))

    if existing_price <= 0 or existing_size <= 0:
        fail("Pending order update failed — existing order is invalid on exchange.", summary)

    if normalized_price == existing_price and normalized_size == existing_size:
        summary["replacementOrder"] = make_order_summary(replace_id, previous_order_id, "live")
        summary["normalizedPrice"] = existing_price
        summary["normalizedSize"] = existing_size
        summary["intendedPrice"] = existing_price
        summary["intendedSize"] = existing_size
        summary["finalPositionState"] = info.user_state(address)
        summary["finalResult"] = "live"
        print(json.dumps({"success": True, "summary": summary}))
        return

    cancel_result = exchange.bulk_cancel([{"coin": coin, "oid": previous_order_id}])

    if cancel_result.get("status") != "ok":
        fail("Pending order update rejected by exchange.", summary)

    if not wait_until_order_removed(info, address, coin, previous_order_id):
        fail("Pending order update failed — original order still live on exchange.", summary)

    replacement_attempt = place_limit_order(
        exchange,
        info,
        address,
        coin,
        is_buy,
        normalized_size,
        normalized_price,
    )

    replacement_result = replacement_attempt["result"]
    replacement_order_id = replacement_attempt["orderId"]

    if replacement_result.get("status") == "ok":
        if isinstance(replacement_order_id, int):
            live_order = find_live_limit_order(info, address, coin, replacement_order_id)

            if isinstance(live_order, dict):
                summary["replacementOrder"] = make_order_summary(replace_id, replacement_order_id, "live")
                summary["finalPositionState"] = info.user_state(address)
                summary["finalResult"] = "live"
                print(json.dumps({"success": True, "summary": summary}))
                return

        position_wait = wait_for_position(info, address, coin)
        position = position_wait["position"]
        fill_price = 0.0
        if isinstance(position, dict):
            fill_price = parse_float(position.get("entryPx", 0))

        summary.update(
            {
                "actualFilledSize": position_wait["positionSize"],
                "fillPrice": fill_price,
                "finalPositionState": position_wait["userState"],
            }
        )

        if position_wait["positionSize"] > 0 and fill_price > 0:
            summary["replacementOrder"] = make_order_summary(
                replace_id,
                replacement_order_id,
                "filled",
            )
            summary["finalResult"] = "filled"
            print(json.dumps({"success": True, "summary": summary}))
            return

    restore_attempt = place_limit_order(
        exchange,
        info,
        address,
        coin,
        existing_is_buy,
        existing_size,
        existing_price,
    )
    restore_result = restore_attempt["result"]
    restore_order_id = restore_attempt["orderId"]

    if restore_result.get("status") == "ok" and isinstance(restore_order_id, int):
        restored_order = find_live_limit_order(info, address, coin, restore_order_id)
        if isinstance(restored_order, dict):
            summary.update(
                {
                    "intendedPrice": existing_price,
                    "intendedSize": existing_size,
                    "normalizedPrice": existing_price,
                    "normalizedSize": existing_size,
                    "replacementOrder": make_order_summary(replace_id, restore_order_id, "live"),
                    "finalPositionState": info.user_state(address),
                    "finalResult": "restored",
                }
            )
            print(
                json.dumps(
                    {
                        "replaceResult": replacement_result,
                        "restoreResult": restore_result,
                        "success": True,
                        "summary": summary,
                    }
                )
            )
            return

    reject_reason = extract_exchange_error(replacement_result) or "Pending order update failed on exchange."
    fail(reject_reason, summary)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet pending-order update failed.")
