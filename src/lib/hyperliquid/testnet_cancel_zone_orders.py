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
        fail("Zone cancel size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Trade size is too small for the market's minimum size increment.")

    return float(normalized_size)


def normalize_order_price(price: float, size_decimals: int) -> float:
    if not isinstance(price, int | float) or price <= 0:
        fail("Zone cancel price is invalid.")

    rounded = round(float(f"{price:.5g}"), 6 - size_decimals)

    if rounded <= 0:
        fail("Zone cancel price is invalid after normalization.")

    if abs(rounded - price) / price > 0.01:
        fail("Zone cancel price normalization would distort the order too much.")

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


def get_open_order_map(info: Info, address: str, coin: str) -> dict[int, dict]:
    open_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    return {
        order.get("oid"): order
        for order in open_orders
        if isinstance(order.get("oid"), int)
        and order.get("coin") == coin
        and not order.get("reduceOnly")
        and not order.get("isTrigger")
    }


def find_matching_open_order(
    open_order_map: dict[int, dict],
    *,
    is_buy: bool,
    current_price: float,
    current_size: float,
    claimed_order_ids: set[int],
) -> dict | None:
    for order_id, order in open_order_map.items():
        if order_id in claimed_order_ids:
            continue
        if bool(order.get("isBuy")) != is_buy:
            continue

        live_price = parse_float(order.get("limitPx"))
        live_size = abs(parse_float(order.get("sz")))

        if abs(live_price - current_price) > 0.01:
            continue
        if abs(live_size - current_size) > 1e-9:
            continue

        return order

    return None


def extract_exchange_error(result: object) -> str | None:
    if not isinstance(result, dict):
        return None

    direct_error = result.get("error")
    if isinstance(direct_error, str) and direct_error:
        return direct_error

    response = result.get("response")
    if not isinstance(response, dict):
        return None

    data = response.get("data")
    if not isinstance(data, dict):
        return None

    statuses = data.get("statuses")
    if not isinstance(statuses, list):
        return None

    for status in statuses:
        if isinstance(status, dict):
            status_error = status.get("error")
            if isinstance(status_error, str) and status_error:
                return status_error

    return None


def reconcile_cancels(
    info: Info,
    address: str,
    coin: str,
    resolved_orders: list[dict],
    retries: int = 6,
    delay_seconds: float = 0.15,
) -> tuple[list[dict], dict]:
    latest_user_state: dict = {}
    order_map: dict[int, dict] = {}

    for attempt in range(retries):
        order_map = get_open_order_map(info, address, coin)
        all_gone = True

        for order in resolved_orders:
            if isinstance(order_map.get(order["orderId"]), dict):
                all_gone = False
                break

        if all_gone:
            latest_user_state = info.user_state(address)
            break

        if attempt < retries - 1:
            time.sleep(delay_seconds)

    if not latest_user_state:
        latest_user_state = info.user_state(address)

    canceled_orders = []
    for order in resolved_orders:
        is_live = isinstance(order_map.get(order["orderId"]), dict)
        if is_live:
            fail("Zone delete failed — linked order still live on exchange.")

        canceled_orders.append(
            {
                "localOrderId": order["localOrderId"],
                "orderId": order["orderId"],
                "currentPrice": order["currentPrice"],
                "normalizedCurrentPrice": order["normalizedCurrentPrice"],
                "intendedSize": order["intendedSize"],
                "normalizedSize": order["normalizedSize"],
                "status": "canceled",
            }
        )

    return canceled_orders, latest_user_state


def main() -> None:
    payload_raw = os.environ.get("PORTAL_CANCEL_ZONE_ORDERS_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing zone-cancel payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    direction = payload["direction"]
    coin = payload["coin"]
    symbol = payload["symbol"]
    requested_orders = payload["orders"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    size_decimals = get_size_decimals(info, coin)
    is_buy = direction == "long"
    timestamp = int(time.time() * 1000)

    open_order_map = get_open_order_map(info, address, coin)
    resolved_orders = []
    unresolved_orders = []
    claimed_order_ids: set[int] = set()

    for requested_order in requested_orders:
        requested_order_id = int(requested_order["orderId"])
        intended_size = float(requested_order["size"])
        current_price = float(requested_order["currentPrice"])
        normalized_current_price = normalize_order_price(current_price, size_decimals)
        normalized_size = normalize_order_size(intended_size, size_decimals)

        existing_order = open_order_map.get(requested_order_id)

        if not isinstance(existing_order, dict):
            existing_order = find_matching_open_order(
                open_order_map,
                is_buy=is_buy,
                current_price=normalized_current_price,
                current_size=normalized_size,
                claimed_order_ids=claimed_order_ids,
            )

        if not isinstance(existing_order, dict):
            unresolved_orders.append(
                {
                    "localOrderId": requested_order["localOrderId"],
                    "orderId": requested_order_id,
                    "currentPrice": current_price,
                    "normalizedCurrentPrice": normalized_current_price,
                    "intendedSize": intended_size,
                    "normalizedSize": normalized_size,
                    "status": "already closed",
                }
            )
            continue

        resolved_order_id = existing_order.get("oid")
        if not isinstance(resolved_order_id, int):
            unresolved_orders.append(
                {
                    "localOrderId": requested_order["localOrderId"],
                    "orderId": requested_order_id,
                    "currentPrice": current_price,
                    "normalizedCurrentPrice": normalized_current_price,
                    "intendedSize": intended_size,
                    "normalizedSize": normalized_size,
                    "status": "already closed",
                }
            )
            continue

        claimed_order_ids.add(resolved_order_id)
        resolved_orders.append(
            {
                "localOrderId": requested_order["localOrderId"],
                "orderId": resolved_order_id,
                "currentPrice": current_price,
                "normalizedCurrentPrice": normalized_current_price,
                "intendedSize": intended_size,
                "normalizedSize": normalized_size,
            }
        )

    if resolved_orders and unresolved_orders:
        fail("Zone delete failed — could not resolve all linked orders on exchange.")

    if not resolved_orders:
        latest_user_state = info.user_state(address)
        summary = {
            "canceledOrders": unresolved_orders,
            "direction": direction,
            "finalPositionState": latest_user_state,
            "finalResult": "already closed",
            "symbol": symbol,
            "timestamp": timestamp,
        }
        print(json.dumps({"success": True, "summary": summary}))
        return

    cancel_result = exchange.bulk_cancel(
        [{"coin": coin, "oid": order["orderId"]} for order in resolved_orders]
    )
    exchange_error = extract_exchange_error(cancel_result)
    if exchange_error:
        fail(exchange_error)

    canceled_orders, latest_user_state = reconcile_cancels(info, address, coin, resolved_orders)
    summary = {
        "canceledOrders": canceled_orders,
        "direction": direction,
        "finalPositionState": latest_user_state,
        "finalResult": "canceled",
        "symbol": symbol,
        "timestamp": timestamp,
    }
    print(json.dumps({"success": True, "summary": summary}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet zone cancel failed.")
