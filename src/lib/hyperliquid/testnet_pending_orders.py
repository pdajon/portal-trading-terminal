import json
import os
import sys
from datetime import datetime, timezone

import eth_account
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


def infer_direction(order: dict) -> str | None:
    is_buy = order.get("isBuy")
    if isinstance(is_buy, bool):
        return "long" if is_buy else "short"

    side = order.get("side")
    if isinstance(side, str):
        normalized = side.lower()
        if normalized in {"buy", "b", "bid"}:
            return "long"
        if normalized in {"sell", "s", "ask", "a"}:
            return "short"

    return None


def format_created_at(order: dict) -> str:
    for key in ("timestamp", "createdAt", "time", "t"):
        value = order.get(key)
        if isinstance(value, (int, float)) and value > 0:
            seconds = value / 1000 if value > 10_000_000_000 else value
            return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace("+00:00", "Z")
        if isinstance(value, str) and value:
            try:
                numeric_value = float(value)
            except ValueError:
                return value
            seconds = numeric_value / 1000 if numeric_value > 10_000_000_000 else numeric_value
            return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace("+00:00", "Z")

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> None:
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not secret_key and not account_address:
        fail("Missing Hyperliquid testnet account config.")

    if secret_key:
        account = eth_account.Account.from_key(secret_key)
        address = account_address or account.address
    else:
        address = account_address

    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    frontend_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    pending_orders: list[dict] = []

    for order in frontend_orders:
        coin = order.get("coin")
        if not isinstance(coin, str):
            continue

        order_id = order.get("oid")
        if not isinstance(order_id, int):
            continue

        direction = infer_direction(order)
        if direction is None:
            continue

        trigger_price = (
            parse_float(order.get("triggerPx"))
            if order.get("triggerPx") is not None
            else 0.0
        )
        price = parse_float(order.get("limitPx")) or trigger_price
        size = abs(parse_float(order.get("sz")))
        original_size = abs(parse_float(order.get("origSz"))) or size

        if price <= 0 or size <= 0:
            continue

        pending_orders.append(
            {
                "createdAt": format_created_at(order),
                "direction": direction,
                "orderId": order_id,
                "originalSize": original_size,
                "price": price,
                "reduceOnly": bool(order.get("reduceOnly")),
                "size": size,
                "status": "live",
                "symbol": f"{coin}-USD",
                "triggerCondition": order.get("triggerCondition")
                if isinstance(order.get("triggerCondition"), str)
                else None,
                "triggerPrice": trigger_price if trigger_price > 0 else None,
                "triggerType": order.get("orderType")
                if isinstance(order.get("orderType"), str)
                else None,
            }
        )

    print(json.dumps({"pendingOrders": pending_orders, "success": True}))


if __name__ == "__main__":
    main()
