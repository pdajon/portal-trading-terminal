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


def get_pending_orders(info: Info, address: str) -> list[dict]:
    open_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    return [
        order
        for order in open_orders
        if isinstance(order.get("oid"), int)
        and not order.get("reduceOnly")
        and not order.get("isTrigger")
    ]


def main() -> None:
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    info = Info(constants.TESTNET_API_URL, skip_ws=True)

    pending_orders = get_pending_orders(info, address)
    if not pending_orders:
      print(json.dumps({"success": True, "canceledOrderCount": 0}))
      return

    cancel_requests = [
        {"coin": order["coin"], "oid": order["oid"]}
        for order in pending_orders
    ]
    cancel_result = exchange.bulk_cancel(cancel_requests)
    exchange_error = extract_exchange_error(cancel_result)
    if exchange_error:
        fail(exchange_error)

    for _ in range(8):
        if not get_pending_orders(info, address):
            print(json.dumps({"success": True, "canceledOrderCount": len(pending_orders)}))
            return
        time.sleep(0.25)

    fail("Cancel all orders failed — pending orders still live on exchange.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet cancel-all-orders failed.")
