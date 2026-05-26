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


def get_symbol_protection_orders(info: Info, address: str, coin: str) -> list[dict]:
    open_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    return [
        order
        for order in open_orders
        if order.get("coin") == coin
        and isinstance(order.get("oid"), int)
        and order.get("reduceOnly")
        and order.get("isTrigger")
    ]


def main() -> None:
    payload_raw = os.environ.get("PORTAL_CANCEL_PROTECTION_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing cancel protection payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    cancel_id = payload["cancelId"]
    coin = payload["coin"]
    symbol = payload["symbol"]

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    info = Info(constants.TESTNET_API_URL, skip_ws=True)

    protection_orders = get_symbol_protection_orders(info, address, coin)
    cancel_timestamp = int(time.time() * 1000)

    summary = {
        "cancelId": cancel_id,
        "canceledOrderCount": 0,
        "finalResult": "already cleared",
        "symbol": symbol,
        "timestamp": cancel_timestamp,
    }

    if not protection_orders:
        print(json.dumps({"success": True, "summary": summary}))
        return

    cancel_result = exchange.bulk_cancel(
        [{"coin": coin, "oid": order["oid"]} for order in protection_orders]
    )
    exchange_error = extract_exchange_error(cancel_result)
    if exchange_error:
        fail(exchange_error)

    for _ in range(8):
        if not get_symbol_protection_orders(info, address, coin):
            summary["canceledOrderCount"] = len(protection_orders)
            summary["finalResult"] = "canceled"
            print(json.dumps({"success": True, "summary": summary}))
            return
        time.sleep(0.25)

    fail("Protection cancel failed - TP/SL orders are still live on exchange.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet protection cancel failed.")
