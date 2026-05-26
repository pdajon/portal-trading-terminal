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


def get_open_orders(info: Info, address: str) -> tuple[list[dict], list[dict]]:
    open_orders = flatten_frontend_orders(info.frontend_open_orders(address))
    pending_orders = [
        order
        for order in open_orders
        if isinstance(order.get("oid"), int)
        and not order.get("reduceOnly")
        and not order.get("isTrigger")
    ]
    protection_orders = [
        order
        for order in open_orders
        if isinstance(order.get("oid"), int)
        and order.get("reduceOnly")
        and order.get("isTrigger")
    ]
    return pending_orders, protection_orders


def get_open_positions(info: Info, address: str) -> list[dict]:
    user_state = info.user_state(address)
    asset_positions = user_state.get("assetPositions")
    if not isinstance(asset_positions, list):
        return []

    open_positions: list[dict] = []
    for asset_position in asset_positions:
        if not isinstance(asset_position, dict):
            continue
        position = asset_position.get("position")
        if not isinstance(position, dict):
            continue
        if abs(parse_float(position.get("szi"))) <= 0:
            continue
        open_positions.append(position)
    return open_positions


def wait_for_orders_cleared(info: Info, address: str, retries: int = 10, delay_seconds: float = 0.25) -> bool:
    for _ in range(retries):
        pending_orders, protection_orders = get_open_orders(info, address)
        if not pending_orders and not protection_orders:
            return True
        time.sleep(delay_seconds)
    return False


def wait_for_positions_cleared(info: Info, address: str, retries: int = 12, delay_seconds: float = 0.25) -> bool:
    for _ in range(retries):
        if not get_open_positions(info, address):
            return True
        time.sleep(delay_seconds)
    return False


def main() -> None:
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    info = Info(constants.TESTNET_API_URL, skip_ws=True)

    pending_orders, protection_orders = get_open_orders(info, address)
    open_positions = get_open_positions(info, address)

    if not pending_orders and not protection_orders and not open_positions:
        print(
            json.dumps(
                {
                    "success": True,
                    "canceledPendingOrderCount": 0,
                    "canceledProtectionOrderCount": 0,
                    "closedPositionCount": 0,
                }
            )
        )
        return

    all_open_orders = pending_orders + protection_orders
    if all_open_orders:
        cancel_result = exchange.bulk_cancel(
            [{"coin": order["coin"], "oid": order["oid"]} for order in all_open_orders]
        )
        exchange_error = extract_exchange_error(cancel_result)
        if exchange_error:
            fail(exchange_error)

        if not wait_for_orders_cleared(info, address):
            fail("Close all failed — open orders still live on exchange.")

    closed_position_count = 0
    for position in open_positions:
        coin = position.get("coin")
        if not isinstance(coin, str) or not coin:
            continue
        result = exchange.market_close(coin)
        if not isinstance(result, dict) or result.get("status") != "ok":
            fail("Close all failed — exchange rejected market close.")
        closed_position_count += 1

    if closed_position_count > 0 and not wait_for_positions_cleared(info, address):
        fail("Close all failed — live positions still open after close attempt.")

    print(
        json.dumps(
            {
                "success": True,
                "canceledPendingOrderCount": len(pending_orders),
                "canceledProtectionOrderCount": len(protection_orders),
                "closedPositionCount": closed_position_count,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        fail("Hyperliquid testnet close-all failed.")
