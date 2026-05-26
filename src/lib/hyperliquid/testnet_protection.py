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


def log_debug(event: str, payload: dict) -> None:
    print(json.dumps({"event": event, **payload}), file=sys.stderr)


def parse_float(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


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
        fail("Protection size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Protection size is too small for the market's minimum size increment.")

    return float(normalized_size)


def normalize_order_price(price: float, size_decimals: int) -> float:
    if not isinstance(price, int | float) or price <= 0:
        fail("Protection price is invalid.")

    rounded = round(float(f"{price:.5g}"), 6 - size_decimals)

    if rounded <= 0:
        fail("Protection price is invalid after normalization.")

    if abs(rounded - price) / price > 0.01:
        fail("Protection price normalization would distort the order too much.")

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


def make_order_summary(
    protection_id: str,
    order_id: int | None = None,
    status: str = "pending",
) -> dict:
    return {
        "executionId": protection_id,
        "id": order_id,
        "status": status,
    }


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


def find_live_protection_orders(
    info: Info,
    address: str,
    coin: str,
    normalized_tp: float,
    normalized_sl: float,
    retries: int = 6,
    delay_seconds: float = 0.25,
) -> tuple[dict | None, dict | None, object]:
    latest_frontend_orders: object = []

    for _ in range(retries):
        latest_frontend_orders = info.frontend_open_orders(address)
        flattened_orders = flatten_frontend_orders(latest_frontend_orders)
        tp_order = None
        sl_order = None

        for order in flattened_orders:
            if order.get("coin") != coin:
                continue
            if not order.get("reduceOnly"):
                continue
            if not order.get("isTrigger"):
                continue

            trigger_px = parse_float(order.get("triggerPx"))
            order_type = order.get("orderType")

            if (
                tp_order is None
                and order_type == "Take Profit Market"
                and abs(trigger_px - normalized_tp) < 1e-9
            ):
                tp_order = order
            elif (
                sl_order is None
                and order_type == "Stop Market"
                and abs(trigger_px - normalized_sl) < 1e-9
            ):
                sl_order = order

        if tp_order and sl_order:
            return tp_order, sl_order, latest_frontend_orders

        time.sleep(delay_seconds)

    return None, None, latest_frontend_orders


def main() -> None:
    payload_raw = os.environ.get("PORTAL_PROTECTION_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing protection payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    protection_id = payload["protectionId"]
    position_execution_id = payload["positionExecutionId"]
    direction = payload["direction"]
    coin = payload["coin"]
    symbol = payload["symbol"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    size_decimals = get_size_decimals(info, coin)
    protection_timestamp = int(time.time() * 1000)

    user_state = info.user_state(address)
    position = find_position(user_state, coin)
    actual_size = abs(parse_float(position.get("szi"))) if isinstance(position, dict) else 0.0
    actual_entry = parse_float(position.get("entryPx")) if isinstance(position, dict) else 0.0

    summary = {
        "actualEntry": actual_entry,
        "actualPositionSize": actual_size,
        "direction": direction,
        "finalPositionState": user_state,
        "finalResult": "protection failed",
        "positionExecutionId": position_execution_id,
        "protectionId": protection_id,
        "slOrder": make_order_summary(protection_id, None, "missing"),
        "stop": 0.0,
        "symbol": symbol,
        "target": 0.0,
        "timestamp": protection_timestamp,
        "tpOrder": make_order_summary(protection_id, None, "missing"),
    }

    if not isinstance(position, dict) or actual_size <= 0 or actual_entry <= 0:
        fail("Protection sync failed — no live position found to protect.", summary)

    live_direction = "long" if parse_float(position.get("szi")) > 0 else "short"
    if live_direction != direction:
        fail("Protection sync failed — live position direction does not match.", summary)

    normalized_size = normalize_order_size(actual_size, size_decimals)
    normalized_stop = normalize_order_price(float(payload["stop"]), size_decimals)
    normalized_target = normalize_order_price(float(payload["target"]), size_decimals)
    summary["stop"] = normalized_stop
    summary["target"] = normalized_target

    if direction == "long":
        if normalized_stop > actual_entry or normalized_target <= actual_entry:
            fail("Protection sync failed — invalid long stop/target structure.", summary)
        reduce_is_buy = False
    else:
        if normalized_stop < actual_entry or normalized_target >= actual_entry:
            fail("Protection sync failed — invalid short stop/target structure.", summary)
        reduce_is_buy = True

    canceled_order_ids = cancel_existing_protection(exchange, info, address, coin)

    tp_request = {
        "coin": coin,
        "is_buy": reduce_is_buy,
        "limit_px": normalized_target,
        "order_type": {
            "trigger": {
                "isMarket": True,
                "tpsl": "tp",
                "triggerPx": normalized_target,
            }
        },
        "reduce_only": True,
        "sz": normalized_size,
    }
    sl_request = {
        "coin": coin,
        "is_buy": reduce_is_buy,
        "limit_px": normalized_stop,
        "order_type": {
            "trigger": {
                "isMarket": True,
                "tpsl": "sl",
                "triggerPx": normalized_stop,
            }
        },
        "reduce_only": True,
        "sz": normalized_size,
    }

    protection_result = exchange.bulk_orders(
        [tp_request, sl_request],
        grouping="positionTpsl",
    )
    log_debug(
        "portal.protection.submit",
        {
            "canceledOrderIds": canceled_order_ids,
            "coin": coin,
            "executionId": protection_id,
            "normalizedSize": normalized_size,
            "protectionResult": protection_result,
            "sl": normalized_stop,
            "symbol": symbol,
            "tp": normalized_target,
        },
    )

    if protection_result.get("status") != "ok":
        reject_reason = (
            extract_exchange_error(protection_result)
            or "Protection sync failed — exchange rejected TP/SL placement."
        )
        fail(reject_reason, summary)

    tp_order, sl_order, frontend_open_orders = find_live_protection_orders(
        info,
        address,
        coin,
        normalized_target,
        normalized_stop,
    )

    log_debug(
        "portal.protection.reconcile",
        {
            "coin": coin,
            "executionId": protection_id,
            "frontendOpenOrders": frontend_open_orders,
            "slOrder": sl_order,
            "tpOrder": tp_order,
        },
    )

    if not tp_order or not sl_order:
        fail("Protection sync failed — TP/SL orders not confirmed live.", summary)

    summary["tpOrder"] = make_order_summary(
        protection_id,
        tp_order.get("oid") if isinstance(tp_order.get("oid"), int) else None,
        "live",
    )
    summary["slOrder"] = make_order_summary(
        protection_id,
        sl_order.get("oid") if isinstance(sl_order.get("oid"), int) else None,
        "live",
    )
    summary["finalPositionState"] = info.user_state(address)
    summary["finalResult"] = "success"

    print(
        json.dumps(
            {
                "success": True,
                "summary": summary,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet protection sync failed.")
