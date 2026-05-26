import json
import os
import sys
import time
import traceback

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
        return order

    return None


def main() -> None:
    payload_raw = os.environ.get("PORTAL_CANCEL_ORDER_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing cancel payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    cancel_id = payload["cancelId"]
    coin = payload["coin"]
    direction = payload["direction"]
    order_id = int(payload["orderId"])
    symbol = payload["symbol"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    cancel_timestamp = int(time.time() * 1000)

    summary = {
        "cancelId": cancel_id,
        "direction": direction,
        "finalPositionState": None,
        "finalResult": "already closed",
        "orderId": order_id,
        "symbol": symbol,
        "timestamp": cancel_timestamp,
    }

    existing_order = find_open_order(info, address, coin, order_id)

    if existing_order is None:
        summary["finalPositionState"] = info.user_state(address)
        print(json.dumps({"success": True, "summary": summary}))
        return

    cancel_result = exchange.bulk_cancel([{"coin": coin, "oid": order_id}])

    if cancel_result.get("status") != "ok":
        fail("Pending order cancel rejected by exchange.", summary)

    for attempt in range(4):
        if find_open_order(info, address, coin, order_id) is None:
            summary["finalPositionState"] = info.user_state(address)
            summary["finalResult"] = "canceled"
            print(json.dumps({"success": True, "summary": summary}))
            return
        if attempt < 3:
            time.sleep(0.15)

    fail("Pending order cancel failed — order still live on exchange.", summary)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet order cancel failed.")
