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
        fail("Limit order size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Trade size is too small for the market's minimum size increment.")

    return float(normalized_size)


def normalize_order_price(price: float, size_decimals: int) -> float:
    if not isinstance(price, int | float) or price <= 0:
        fail("Limit order price is invalid.")

    rounded = round(float(f"{price:.5g}"), 6 - size_decimals)

    if rounded <= 0:
        fail("Limit order price is invalid after normalization.")

    if abs(rounded - price) / price > 0.01:
        fail("Limit order price normalization would distort the order too much.")

    return rounded


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
            try:
                position_size = abs(float(latest_position.get("szi", 0)))
            except (TypeError, ValueError):
                position_size = 0.0

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


def find_live_limit_order(
    info: Info,
    address: str,
    coin: str,
    order_id: int,
    reduce_only: bool = False,
    retries: int = 3,
    delay_seconds: float = 0.15,
) -> dict | None:
    for attempt in range(retries):
        frontend_orders = flatten_frontend_orders(info.frontend_open_orders(address))
        for order in frontend_orders:
            if order.get("coin") != coin:
                continue
            if bool(order.get("reduceOnly")) != reduce_only or order.get("isTrigger"):
                continue
            if order.get("oid") == order_id:
                return order
        if attempt < retries - 1:
            time.sleep(delay_seconds)
    return None


def make_order_summary(placement_id: str, order_id: int | None = None, status: str = "pending") -> dict:
    return {
        "executionId": placement_id,
        "id": order_id,
        "status": status,
    }


def main() -> None:
    payload_raw = os.environ.get("PORTAL_LIMIT_ORDER_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing limit-order payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    placement_id = payload["placementId"]
    direction = payload["direction"]
    coin = payload["coin"]
    symbol = payload["symbol"]
    requested_size = float(payload["size"])
    requested_price = float(payload["price"])
    reduce_only = bool(payload.get("reduceOnly", False))

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    size_decimals = get_size_decimals(info, coin)
    normalized_size = normalize_order_size(requested_size, size_decimals)
    normalized_price = normalize_order_price(requested_price, size_decimals)
    is_buy = direction == "long"
    placement_timestamp = int(time.time() * 1000)

    limit_result = exchange.order(
        coin,
        is_buy,
        normalized_size,
        normalized_price,
        {"limit": {"tif": "Gtc"}},
        reduce_only,
    )
    statuses = get_statuses(limit_result)
    resting_order = next((get_resting_order(status) for status in statuses if get_resting_order(status)), None)
    filled_order = next((get_filled_order(status) for status in statuses if get_filled_order(status)), None)

    order_id = None
    if isinstance(resting_order, dict):
        order_id = resting_order.get("oid")
    elif isinstance(filled_order, dict):
        order_id = filled_order.get("oid")

    summary = {
        "actualFilledSize": 0.0,
        "direction": direction,
        "fillPrice": 0.0,
        "finalPositionState": None,
        "finalResult": "rejected",
        "intendedPrice": requested_price,
        "intendedSize": requested_size,
        "limitOrder": make_order_summary(placement_id, order_id, "pending"),
        "normalizedPrice": normalized_price,
        "normalizedSize": normalized_size,
        "placementId": placement_id,
        "symbol": symbol,
        "timestamp": placement_timestamp,
    }

    if limit_result.get("status") != "ok":
        summary["limitOrder"] = make_order_summary(placement_id, order_id, "rejected")
        reject_reason = extract_exchange_error(limit_result) or "Limit order rejected by exchange."
        fail(reject_reason, summary)

    if isinstance(resting_order, dict) and isinstance(order_id, int):
        live_order = find_live_limit_order(info, address, coin, order_id, reduce_only)

        if not isinstance(live_order, dict):
            fail("Limit order placement failed — order not confirmed live.", summary)

        summary["limitOrder"] = make_order_summary(placement_id, order_id, "live")
        summary["finalResult"] = "live"
        print(json.dumps({"limitResult": limit_result, "success": True, "summary": summary}))
        return

    if reduce_only and isinstance(filled_order, dict):
        filled_size = 0.0
        fill_price = 0.0
        try:
            filled_size = float(filled_order.get("totalSz", 0))
        except (TypeError, ValueError):
            filled_size = 0.0
        try:
            fill_price = float(filled_order.get("avgPx", 0))
        except (TypeError, ValueError):
            fill_price = 0.0

        if filled_size <= 0 or fill_price <= 0:
            fail("Reduce-only limit close filled, but fill details were not confirmed.", summary)

        summary.update(
            {
                "actualFilledSize": filled_size,
                "fillPrice": fill_price,
                "finalPositionState": info.user_state(address),
                "finalResult": "filled",
                "limitOrder": make_order_summary(placement_id, order_id, "filled"),
            }
        )
        print(json.dumps({"limitResult": limit_result, "success": True, "summary": summary}))
        return

    position_wait = wait_for_position(info, address, coin)
    position = position_wait["position"]
    actual_filled_size = position_wait["positionSize"]

    fill_price = 0.0
    if isinstance(position, dict):
        try:
            fill_price = float(position.get("entryPx", 0))
        except (TypeError, ValueError):
            fill_price = 0.0

    summary.update(
        {
            "actualFilledSize": actual_filled_size,
            "fillPrice": fill_price,
            "finalPositionState": position_wait["userState"],
        }
    )

    if actual_filled_size <= 0 or fill_price <= 0:
        fail("Limit-order reconciliation failed — live fill price not confirmed.", summary)

    summary["limitOrder"] = make_order_summary(placement_id, order_id, "filled")
    summary["finalResult"] = "filled"

    print(json.dumps({"limitResult": limit_result, "success": True, "summary": summary}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet limit-order placement failed.")
