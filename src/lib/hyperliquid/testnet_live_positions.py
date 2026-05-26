import json
import os
import sys

import eth_account
from hyperliquid.info import Info
from hyperliquid.utils import constants


def fail(message: str) -> None:
    print(json.dumps({"error": message}))
    sys.exit(1)


def parse_float(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_nullable_float(value: object) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def get_mark_prices_by_coin(info: Info) -> dict[str, float]:
    try:
        meta, asset_contexts = info.meta_and_asset_ctxs()
    except Exception:
        return {}

    universe = meta.get("universe") if isinstance(meta, dict) else None
    if not isinstance(universe, list) or not isinstance(asset_contexts, list):
        return {}

    mark_prices: dict[str, float] = {}

    for index, asset in enumerate(universe):
        if not isinstance(asset, dict):
            continue

        coin = asset.get("name")
        if not isinstance(coin, str) or index >= len(asset_contexts):
            continue

        context = asset_contexts[index]
        if not isinstance(context, dict):
            continue

        mark_price = parse_nullable_float(context.get("markPx"))
        if mark_price is not None:
            mark_prices[coin] = mark_price

    return mark_prices


def get_mark_price_for_coin(
    coin: str,
    mark_prices: dict[str, float],
    mids: dict | object,
) -> float:
    mark_price = mark_prices.get(coin)

    if mark_price is not None:
        return mark_price

    return parse_float(mids.get(coin) if isinstance(mids, dict) else None)


def parse_open_funding(position: dict) -> float | None:
    cum_funding = position.get("cumFunding")
    if not isinstance(cum_funding, dict):
        return None

    for key in ("sinceOpen", "sinceChange", "allTime"):
        parsed = parse_nullable_float(cum_funding.get(key))
        if parsed is not None:
            # Hyperliquid reports cumulative funding as a position accumulator; Portal displays trader PnL impact.
            return -parsed

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


def main() -> None:
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not account_address:
        if not secret_key:
            fail("Missing Hyperliquid testnet account config.")
        account = eth_account.Account.from_key(secret_key)
        account_address = account.address

    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    user_state = info.user_state(account_address)
    frontend_open_orders = flatten_frontend_orders(info.frontend_open_orders(account_address))
    mark_prices = get_mark_prices_by_coin(info)
    mids = info.all_mids()

    positions = []

    asset_positions = user_state.get("assetPositions")
    if isinstance(asset_positions, list):
        for asset_position in asset_positions:
            if not isinstance(asset_position, dict):
                continue
            position = asset_position.get("position")
            if not isinstance(position, dict):
                continue

            coin = position.get("coin")
            if not isinstance(coin, str):
                continue

            size = parse_float(position.get("szi"))
            if abs(size) <= 0:
                continue

            entry_price = parse_float(position.get("entryPx"))
            leverage = position.get("leverage")
            leverage_value = (
                parse_float(leverage.get("value"))
                if isinstance(leverage, dict)
                else 0.0
            )
            mark_price = get_mark_price_for_coin(coin, mark_prices, mids)
            liquidation_price = parse_float(position.get("liquidationPx"))
            pnl_usd = parse_float(position.get("unrealizedPnl"))
            position_value = parse_nullable_float(position.get("positionValue"))
            margin_used = parse_nullable_float(position.get("marginUsed"))
            funding_usd = parse_open_funding(position)

            pnl_percent = 0.0
            if entry_price > 0 and mark_price > 0:
                direction_multiplier = 1 if size > 0 else -1
                pnl_percent = ((mark_price - entry_price) / entry_price) * 100 * direction_multiplier

            tp_order = None
            sl_order = None
            for order in frontend_open_orders:
                if order.get("coin") != coin:
                    continue
                if not order.get("reduceOnly") or not order.get("isTrigger"):
                    continue
                order_type = order.get("orderType")
                if tp_order is None and order_type == "Take Profit Market":
                    tp_order = order
                elif sl_order is None and order_type == "Stop Market":
                    sl_order = order

            positions.append(
                {
                    "direction": "long" if size > 0 else "short",
                    "entryPrice": entry_price,
                    "leverageValue": leverage_value if leverage_value > 0 else None,
                    "liquidationPrice": liquidation_price if liquidation_price > 0 else None,
                    "markPrice": mark_price,
                    "marginUsedUsd": margin_used,
                    "pnlPercent": pnl_percent,
                    "pnlUsd": pnl_usd,
                    "positionValueUsd": position_value,
                    "protectionMissing": tp_order is None or sl_order is None,
                    "fundingUsd": funding_usd,
                    "size": abs(size),
                    "stopPrice": parse_float(sl_order.get("triggerPx")) if isinstance(sl_order, dict) else None,
                    "slOrderId": sl_order.get("oid") if isinstance(sl_order, dict) else None,
                    "slStatus": "live" if isinstance(sl_order, dict) else "missing",
                    "symbol": f"{coin}-USD",
                    "targetPrice": parse_float(tp_order.get("triggerPx")) if isinstance(tp_order, dict) else None,
                    "tpOrderId": tp_order.get("oid") if isinstance(tp_order, dict) else None,
                    "tpStatus": "live" if isinstance(tp_order, dict) else "missing",
                }
            )

    print(json.dumps({"positions": positions, "success": True}))


if __name__ == "__main__":
    main()
