import concurrent.futures
import json
import os
import sys
import time

import eth_account
import requests


HYPERLIQUID_TESTNET_API_URL = "https://api.hyperliquid-testnet.xyz"


def fail(message: str) -> None:
    print(json.dumps({"error": message}))
    sys.exit(1)


def parse_float(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_optional_float(value: object) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None

    return parsed


def parse_env_float(name: str, fallback: float) -> float:
    try:
        parsed = float(os.environ.get(name, ""))
    except (TypeError, ValueError):
        return fallback

    return parsed if parsed > 0 else fallback


ACCOUNT_BALANCE_TIMEOUT_SECONDS = parse_env_float(
    "PORTAL_ACCOUNT_BALANCE_TIMEOUT_SECONDS", 4.0
)
ACCOUNT_OPTIONAL_TIMEOUT_SECONDS = parse_env_float(
    "PORTAL_ACCOUNT_OPTIONAL_TIMEOUT_SECONDS", 1.75
)


def post_hyperliquid_info(payload: dict[str, object], timeout: float) -> object:
    response = requests.post(
        f"{HYPERLIQUID_TESTNET_API_URL}/info",
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()

    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(str(data.get("error")))

    return data


def get_optional_hyperliquid_info(
    payload: dict[str, object], fallback: object, timeout: float | None = None
) -> object:
    try:
        return post_hyperliquid_info(
            payload, timeout if timeout is not None else ACCOUNT_OPTIONAL_TIMEOUT_SECONDS
        )
    except Exception:
        return fallback


def get_coin_for_symbol(symbol: object) -> str | None:
    if not isinstance(symbol, str):
        return None

    normalized_symbol = symbol.upper().strip()

    if normalized_symbol.endswith("-USD"):
        return normalized_symbol.removesuffix("-USD")

    return normalized_symbol or None


def get_spot_balance_totals(
    spot_user_state: object, user_state: object
) -> tuple[float, float, str]:
    if not isinstance(spot_user_state, dict):
        return 0.0, 0.0, "unavailable"

    balances = spot_user_state.get("balances")
    if not isinstance(balances, list):
        return 0.0, 0.0, "unavailable"

    preferred_stables = ("USDC", "TUSDC", "USDT", "USDEEE", "USDH", "TGUSD")
    available_after_maintenance = spot_user_state.get("tokenToAvailableAfterMaintenance")
    available_after_maintenance_by_token: dict[int, float] = {}
    margin_summary = user_state.get("marginSummary") if isinstance(user_state, dict) else None
    cross_margin_summary = (
        user_state.get("crossMarginSummary") if isinstance(user_state, dict) else None
    )
    total_margin_used = parse_float(
        margin_summary.get("totalMarginUsed") if isinstance(margin_summary, dict) else None
    )

    if total_margin_used <= 0:
        total_margin_used = parse_float(
            cross_margin_summary.get("totalMarginUsed")
            if isinstance(cross_margin_summary, dict)
            else None
        )

    if isinstance(available_after_maintenance, list):
        for token_balance in available_after_maintenance:
            if (
                isinstance(token_balance, list)
                and len(token_balance) >= 2
                and isinstance(token_balance[0], int)
            ):
                available_after_maintenance_by_token[token_balance[0]] = parse_float(
                    token_balance[1]
                )

    for balance in balances:
        if not isinstance(balance, dict):
            continue
        coin = balance.get("coin")
        if coin not in preferred_stables:
            continue

        token = balance.get("token")
        total = parse_float(balance.get("total"))
        hold = parse_float(balance.get("hold"))

        if total_margin_used > 0:
            return total, max(total - total_margin_used, 0.0), "spot.balanceMinusTotalMarginUsed"

        available = max(total - hold, 0.0)

        if available > 0 or total > 0:
            return total, available, "spot.balanceMinusHold"

        if isinstance(token, int):
            maintenance_available = available_after_maintenance_by_token.get(token)
            if maintenance_available is not None:
                return total, maintenance_available, "spot.tokenToAvailableAfterMaintenance"

    return 0.0, 0.0, "unavailable"


def get_user_funding_history(account_address: str) -> list[dict[str, object]]:
    end_time = int(time.time() * 1000)
    start_time = end_time - 7 * 24 * 60 * 60 * 1000

    try:
        funding_updates = post_hyperliquid_info(
            {
                "type": "userFunding",
                "user": account_address,
                "startTime": start_time,
                "endTime": end_time,
            },
            ACCOUNT_OPTIONAL_TIMEOUT_SECONDS,
        )
    except Exception:
        return []

    if not isinstance(funding_updates, list):
        return []

    funding_rows: list[dict[str, object]] = []

    for update in funding_updates:
        if not isinstance(update, dict):
            continue

        delta = update.get("delta")
        if not isinstance(delta, dict) or delta.get("type") != "funding":
            continue

        coin = delta.get("coin")
        timestamp = parse_optional_float(update.get("time"))
        size = parse_optional_float(delta.get("szi"))
        payment_usdc = parse_optional_float(delta.get("usdc"))
        funding_rate = parse_optional_float(delta.get("fundingRate"))

        if not isinstance(coin, str) or timestamp is None:
            continue

        funding_rows.append(
            {
                "coin": coin,
                "hash": update.get("hash") if isinstance(update.get("hash"), str) else None,
                "paymentUsdc": payment_usdc,
                "rate": funding_rate,
                "size": size,
                "time": int(timestamp),
            }
        )

    funding_rows.sort(key=lambda row: row.get("time", 0), reverse=True)
    return funding_rows[:200]


def get_user_trade_history(
    account_address: str, aggregate_by_time: bool = False
) -> list[dict[str, object]]:
    try:
        if aggregate_by_time:
            fills = post_hyperliquid_info(
                {
                    "type": "userFills",
                    "user": account_address,
                    "aggregateByTime": True,
                },
                ACCOUNT_OPTIONAL_TIMEOUT_SECONDS,
            )
        else:
            fills = post_hyperliquid_info(
                {"type": "userFills", "user": account_address},
                ACCOUNT_OPTIONAL_TIMEOUT_SECONDS,
            )
    except Exception:
        return []

    if not isinstance(fills, list):
        return []

    rows: list[dict[str, object]] = []

    for fill in fills:
        if not isinstance(fill, dict):
            continue

        coin = fill.get("coin")
        timestamp = parse_optional_float(fill.get("time"))

        if not isinstance(coin, str) or timestamp is None:
            continue

        price = parse_optional_float(fill.get("px"))
        size = parse_optional_float(fill.get("sz"))
        fee = parse_optional_float(fill.get("fee"))
        closed_pnl = parse_optional_float(fill.get("closedPnl"))
        order_id = fill.get("oid")

        rows.append(
            {
                "closedPnl": closed_pnl,
                "coin": coin,
                "direction": fill.get("dir") if isinstance(fill.get("dir"), str) else "--",
                "feeUsdc": fee,
                "hash": fill.get("hash") if isinstance(fill.get("hash"), str) else None,
                "orderId": order_id if isinstance(order_id, (int, str)) else None,
                "price": price,
                "side": fill.get("side") if isinstance(fill.get("side"), str) else None,
                "size": size,
                "time": int(timestamp),
                "tradeValueUsdc": abs(price * size) if price is not None and size is not None else None,
            }
        )

    rows.sort(key=lambda row: row.get("time", 0), reverse=True)
    return rows[:200]


def normalize_order_status(status: object) -> str:
    if isinstance(status, str) and status.strip():
        return status.strip()

    if isinstance(status, dict):
        for key in ("status", "type"):
            value = status.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    return "--"


def get_order_payload(row: dict) -> dict:
    order = row.get("order")
    if isinstance(order, dict):
        return order

    return row


def infer_historical_order_direction(order: dict) -> str:
    reduce_only = bool(order.get("reduceOnly"))
    side = order.get("side")
    if isinstance(side, str):
        normalized = side.lower()
        if normalized in {"b", "buy", "bid"}:
            return "Close Short" if reduce_only else "Open Long"
        if normalized in {"a", "ask", "s", "sell"}:
            return "Close Long" if reduce_only else "Open Short"

    is_buy = order.get("isBuy")
    if isinstance(is_buy, bool):
        if reduce_only:
            return "Close Short" if is_buy else "Close Long"
        return "Open Long" if is_buy else "Open Short"

    return "--"


def get_user_order_history(account_address: str) -> list[dict[str, object]]:
    try:
        orders = post_hyperliquid_info(
            {"type": "historicalOrders", "user": account_address},
            ACCOUNT_OPTIONAL_TIMEOUT_SECONDS,
        )
    except Exception:
        return []

    if not isinstance(orders, list):
        return []

    rows: list[dict[str, object]] = []

    for row in orders:
        if not isinstance(row, dict):
            continue

        order = get_order_payload(row)
        coin = order.get("coin")

        if not isinstance(coin, str):
            continue

        timestamp = parse_optional_float(
            row.get("statusTimestamp")
            if row.get("statusTimestamp") is not None
            else order.get("timestamp")
        )
        price = parse_optional_float(order.get("limitPx") if order.get("limitPx") is not None else order.get("px"))
        size = parse_optional_float(order.get("origSz") if order.get("origSz") is not None else order.get("sz"))
        remaining_size = parse_optional_float(order.get("sz"))
        filled_size: float | None = None

        if size is not None and remaining_size is not None:
            filled_size = max(size - remaining_size, 0.0)

        order_id = order.get("oid")
        trigger_px = parse_optional_float(order.get("triggerPx"))
        trigger_condition = order.get("triggerCondition")
        order_type = order.get("orderType")

        rows.append(
            {
                "coin": coin,
                "direction": infer_historical_order_direction(order),
                "filledSize": filled_size,
                "orderId": order_id if isinstance(order_id, (int, str)) else None,
                "orderValueUsdc": abs(price * size) if price is not None and size is not None else None,
                "price": price,
                "reduceOnly": bool(order.get("reduceOnly")) if order.get("reduceOnly") is not None else None,
                "size": size,
                "status": normalize_order_status(row.get("status")),
                "time": int(timestamp) if timestamp is not None else int(time.time() * 1000),
                "triggerConditions": trigger_condition if isinstance(trigger_condition, str) else ("N/A" if not trigger_px else f"Trigger {trigger_px}"),
                "tpSl": "Yes" if bool(order.get("isPositionTpsl")) else "No",
                "type": order_type if isinstance(order_type, str) and order_type else "Limit",
            }
        )

    rows.sort(key=lambda row: row.get("time", 0), reverse=True)
    return rows[:200]


def format_balance_quantity(value: float | None, coin: str) -> str:
    if value is None:
        return "--"

    maximum_decimals = 2 if coin.upper() in ("USDC", "USDT", "USDH", "TUSDC") else 8
    formatted = f"{value:,.{maximum_decimals}f}"
    if maximum_decimals > 2:
        formatted = formatted.rstrip("0").rstrip(".")
    return f"{formatted} {coin}"


def build_balance_rows(
    spot_user_state: object,
    account_value: float,
    available_to_trade: float,
    user_state: object,
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    balances = spot_user_state.get("balances") if isinstance(spot_user_state, dict) else None
    stable_total: float | None = None

    if isinstance(balances, list):
        for balance in balances:
            if not isinstance(balance, dict):
                continue

            coin = balance.get("coin")
            if not isinstance(coin, str):
                continue

            total = parse_optional_float(balance.get("total"))
            if coin.upper() in ("USDC", "TUSDC", "USDT", "USDEEE", "USDH", "TGUSD") and total and total > 0:
                stable_total = total
                break

    perps_total = stable_total if stable_total is not None else account_value
    rows.append(
        {
            "availableBalance": available_to_trade,
            "availableBalanceDisplay": format_balance_quantity(available_to_trade, "USDC"),
            "coin": "USDC",
            "coinLabel": "USDC (Perps)",
            "contractLabel": "--",
            "pnlPercent": None,
            "pnlUsd": None,
            "repayLabel": "--",
            "sendLabel": "Not available in your jurisdiction",
            "totalBalance": perps_total,
            "totalBalanceDisplay": format_balance_quantity(perps_total, "USDC"),
            "transferLabel": "Transfer to Spot",
            "usdValue": perps_total,
        }
    )

    if not isinstance(balances, list):
        return rows

    for balance in balances:
        if not isinstance(balance, dict):
            continue

        coin = balance.get("coin")
        if not isinstance(coin, str) or coin.upper() in ("USDC", "TUSDC", "USDT", "USDEEE", "USDH", "TGUSD"):
            continue

        total = parse_optional_float(balance.get("total"))
        hold = parse_optional_float(balance.get("hold")) or 0.0

        if total is None or total <= 0:
            continue

        available = max(total - hold, 0.0)
        entry_ntl = parse_optional_float(balance.get("entryNtl"))

        rows.append(
            {
                "availableBalance": available,
                "availableBalanceDisplay": format_balance_quantity(available, coin),
                "coin": coin,
                "coinLabel": coin,
                "contractLabel": "--",
                "pnlPercent": None,
                "pnlUsd": None if entry_ntl is None else -entry_ntl,
                "repayLabel": "--",
                "sendLabel": "Not available in your jurisdiction",
                "totalBalance": total,
                "totalBalanceDisplay": format_balance_quantity(total, coin),
                "transferLabel": "Transfer to/from EVM",
                "usdValue": None,
            }
        )

    return rows


def get_available_to_trade_by_side(
    account_address: str, coin: str | None
) -> tuple[dict[str, float] | None, str | None]:
    return None, None


def main() -> None:
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not account_address:
        if not secret_key:
            fail("Missing Hyperliquid testnet account config.")
        account = eth_account.Account.from_key(secret_key)
        account_address = account.address

    requested_symbol = None
    aggregate_trade_history = False

    for arg in sys.argv[1:]:
        if arg == "--aggregate-trades":
            aggregate_trade_history = True
            continue
        if requested_symbol is None:
            requested_symbol = arg

    requested_coin = get_coin_for_symbol(requested_symbol)

    try:
        user_state = post_hyperliquid_info(
            {"type": "clearinghouseState", "user": account_address, "dex": ""},
            ACCOUNT_BALANCE_TIMEOUT_SECONDS,
        )
    except Exception:
        fail("Unable to fetch Hyperliquid testnet account state.")

    if not isinstance(user_state, dict):
        fail("Unable to fetch Hyperliquid testnet account state.")

    spot_user_state = get_optional_hyperliquid_info(
        {"type": "spotClearinghouseState", "user": account_address},
        {},
        ACCOUNT_BALANCE_TIMEOUT_SECONDS,
    )
    user_abstraction = get_optional_hyperliquid_info(
        {"type": "userAbstraction", "user": account_address},
        None,
        ACCOUNT_BALANCE_TIMEOUT_SECONDS,
    )
    margin_summary = user_state.get("marginSummary")
    cross_margin_summary = user_state.get("crossMarginSummary")

    withdrawable = parse_float(user_state.get("withdrawable"))
    account_value = parse_float(
        margin_summary.get("accountValue") if isinstance(margin_summary, dict) else None
    )
    if account_value <= 0:
        account_value = parse_float(
            cross_margin_summary.get("accountValue")
            if isinstance(cross_margin_summary, dict)
            else None
        )

    spot_account_value, spot_available_to_trade, spot_available_source = get_spot_balance_totals(
        spot_user_state, user_state
    )

    available_to_trade = 0.0
    available_source = "clearinghouse.withdrawable"

    if user_abstraction == "unifiedAccount" and spot_available_to_trade > 0:
        available_to_trade = spot_available_to_trade
        available_source = spot_available_source
    elif withdrawable > 0:
        available_to_trade = withdrawable
    elif account_value > 0:
        available_to_trade = account_value
        available_source = "clearinghouse.accountValue"
    elif spot_account_value > 0:
        available_to_trade = spot_account_value
        available_source = "spot.balanceTotal"
    else:
        available_source = "unavailable"

    if account_value <= 0 and spot_account_value > 0:
        account_value = spot_account_value

    available_to_trade_by_side, available_to_trade_by_side_source = get_available_to_trade_by_side(
        account_address, requested_coin
    )

    if available_to_trade_by_side is None:
        available_to_trade_by_side = {
            "long": available_to_trade,
            "short": available_to_trade,
        }
        available_to_trade_by_side_source = available_source

    funding_history: list[dict[str, object]] = []
    trade_history: list[dict[str, object]] = []
    order_history: list[dict[str, object]] = []
    history_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    history_futures = {
        "funding": history_executor.submit(get_user_funding_history, account_address),
        "trades": history_executor.submit(
            get_user_trade_history, account_address, aggregate_trade_history
        ),
        "orders": history_executor.submit(get_user_order_history, account_address),
    }

    try:
        funding_history = history_futures["funding"].result(
            timeout=ACCOUNT_OPTIONAL_TIMEOUT_SECONDS + 0.5
        )
        trade_history = history_futures["trades"].result(
            timeout=ACCOUNT_OPTIONAL_TIMEOUT_SECONDS + 0.5
        )
        order_history = history_futures["orders"].result(
            timeout=ACCOUNT_OPTIONAL_TIMEOUT_SECONDS + 0.5
        )
    except Exception:
        pass
    finally:
        history_executor.shutdown(wait=False, cancel_futures=True)

    balances = build_balance_rows(
        spot_user_state,
        account_value,
        available_to_trade,
        user_state,
    )

    print(
        json.dumps(
            {
                "accountAddress": account_address,
                "accountValue": account_value,
                "accountMode": user_abstraction,
                "availableToTrade": available_to_trade,
                "availableToTradeBySide": available_to_trade_by_side,
                "availableToTradeBySideSource": available_to_trade_by_side_source,
                "availableToTradeSource": available_source,
                "balances": balances,
                "fundingHistory": funding_history,
                "orderHistory": order_history,
                "success": True,
                "tradeHistory": trade_history,
                "tradeHistoryAggregated": aggregate_trade_history,
            }
        )
    )


if __name__ == "__main__":
    main()
