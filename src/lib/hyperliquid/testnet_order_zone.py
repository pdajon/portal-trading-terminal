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
        fail("Order-zone size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Trade size is too small for the market's minimum size increment.")

    return float(normalized_size)


def normalize_order_price(price: float, size_decimals: int) -> float:
    if not isinstance(price, int | float) or price <= 0:
        fail("Order-zone price is invalid.")

    rounded = round(float(f"{price:.5g}"), 6 - size_decimals)

    if rounded <= 0:
        fail("Order-zone price is invalid after normalization.")

    if abs(rounded - price) / price > 0.01:
        fail("Order-zone price normalization would distort the order too much.")

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


def main() -> None:
    payload_raw = os.environ.get("PORTAL_ORDER_ZONE_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing order-zone payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    coin = payload["coin"]
    direction = payload["direction"]
    symbol = payload["symbol"]
    requested_orders = payload["orders"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    size_decimals = get_size_decimals(info, coin)
    is_buy = direction == "long"

    normalized_orders = []
    order_requests = []

    for requested_order in requested_orders:
        placement_id = requested_order["placementId"]
        intended_price = float(requested_order["price"])
        intended_size = float(requested_order["size"])
        normalized_price = normalize_order_price(intended_price, size_decimals)
        normalized_size = normalize_order_size(intended_size, size_decimals)
        normalized_orders.append(
            {
                "placementId": placement_id,
                "intendedPrice": intended_price,
                "intendedSize": intended_size,
                "normalizedPrice": normalized_price,
                "normalizedSize": normalized_size,
            }
        )
        order_requests.append(
            {
                "coin": coin,
                "is_buy": is_buy,
                "limit_px": normalized_price,
                "order_type": {"limit": {"tif": "Gtc"}},
                "reduce_only": False,
                "sz": normalized_size,
            }
        )

    batch_result = exchange.bulk_orders(order_requests)
    statuses = get_statuses(batch_result)
    open_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    open_order_by_id = {
        order.get("oid"): order
        for order in open_orders
        if isinstance(order.get("oid"), int)
        and order.get("coin") == coin
        and not order.get("reduceOnly")
        and not order.get("isTrigger")
    }

    live_orders = []
    filled_orders = []
    rejected_orders = []
    summary_timestamp = int(time.time() * 1000)

    for index, normalized_order in enumerate(normalized_orders):
        status = statuses[index] if index < len(statuses) else None
        resting = status.get("resting") if isinstance(status, dict) else None
        filled = status.get("filled") if isinstance(status, dict) else None
        error = status.get("error") if isinstance(status, dict) else None
        order_id = None

        if isinstance(resting, dict):
            order_id = resting.get("oid")
        elif isinstance(filled, dict):
            order_id = filled.get("oid")

        item_summary = {
            "actualFilledSize": normalized_order["normalizedSize"] if isinstance(filled, dict) else 0.0,
            "direction": direction,
            "fillPrice": normalized_order["normalizedPrice"] if isinstance(filled, dict) else 0.0,
            "finalResult": "rejected",
            "intendedPrice": normalized_order["intendedPrice"],
            "intendedSize": normalized_order["intendedSize"],
            "limitOrder": {
                "executionId": normalized_order["placementId"],
                "id": order_id if isinstance(order_id, int) else None,
                "status": "rejected" if error else "pending",
            },
            "normalizedPrice": normalized_order["normalizedPrice"],
            "normalizedSize": normalized_order["normalizedSize"],
            "placementId": normalized_order["placementId"],
            "symbol": symbol,
            "timestamp": summary_timestamp,
        }

        if isinstance(resting, dict) and isinstance(order_id, int) and order_id in open_order_by_id:
            item_summary["finalResult"] = "live"
            item_summary["limitOrder"] = {
                "executionId": normalized_order["placementId"],
                "id": order_id,
                "status": "live",
            }
            live_orders.append(item_summary)
            continue

        if isinstance(filled, dict):
            item_summary["finalResult"] = "filled"
            item_summary["limitOrder"] = {
                "executionId": normalized_order["placementId"],
                "id": order_id if isinstance(order_id, int) else None,
                "status": "filled",
            }
            filled_orders.append(item_summary)
            continue

        rejected_orders.append(
            {
                "error": error if isinstance(error, str) and error else "Order-zone child order rejected.",
                "intendedPrice": normalized_order["intendedPrice"],
                "placementId": normalized_order["placementId"],
            }
        )

    summary = {
        "direction": direction,
        "filledOrders": filled_orders,
        "liveOrders": live_orders,
        "rejectedOrders": rejected_orders,
        "symbol": symbol,
        "timestamp": summary_timestamp,
    }

    if not live_orders and not filled_orders:
        fail("Hyperliquid rejected all order-zone placements.", summary)

    print(json.dumps({"success": True, "summary": summary}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet order-zone placement failed.")
