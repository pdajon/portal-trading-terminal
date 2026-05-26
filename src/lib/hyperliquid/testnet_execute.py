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
        fail("Market order size is invalid.")

    quantizer = Decimal("1").scaleb(-size_decimals)
    normalized_size = Decimal(str(size)).quantize(quantizer, rounding=ROUND_DOWN)

    if normalized_size <= 0:
        fail("Trade size is too small for the market's minimum size increment.")

    return float(normalized_size)


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


def get_resting_order(status: dict) -> dict | None:
    resting = status.get("resting")
    return resting if isinstance(resting, dict) else None


def get_filled_order(status: dict) -> dict | None:
    filled = status.get("filled")
    return filled if isinstance(filled, dict) else None


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


def wait_for_position(
    info: Info,
    address: str,
    coin: str,
    retries: int = 8,
    delay_seconds: float = 0.25,
) -> dict:
    latest_user_state = {}
    latest_position = None

    for attempt in range(1, retries + 1):
        latest_user_state = info.user_state(address)
        latest_position = find_position(latest_user_state, coin)
        position_size = 0.0
        if isinstance(latest_position, dict):
            try:
                position_size = abs(float(latest_position.get("szi", 0)))
            except (TypeError, ValueError):
                position_size = 0.0

        log_debug(
            "portal.execution.position_wait",
            {
                "attempt": attempt,
                "coin": coin,
                "position": latest_position,
                "positionSize": position_size,
            },
        )

        if position_size > 0:
            return {
                "attempts": attempt,
                "position": latest_position,
                "positionSize": position_size,
                "userState": latest_user_state,
            }

        if attempt < retries:
            time.sleep(delay_seconds)

    return {
        "attempts": retries,
        "position": latest_position,
        "positionSize": 0.0,
        "userState": latest_user_state,
    }


def make_order_summary(execution_id: str, order_id: int | None = None, status: str = "pending") -> dict:
    return {
        "executionId": execution_id,
        "id": order_id,
        "status": status,
    }


def main() -> None:
    payload_raw = os.environ.get("PORTAL_EXECUTION_PAYLOAD")
    secret_key = os.environ.get("HYPERLIQUID_TESTNET_SECRET_KEY")
    account_address = os.environ.get("HYPERLIQUID_TESTNET_ACCOUNT_ADDRESS", "")

    if not payload_raw:
        fail("Missing execution payload.")

    if not secret_key:
        fail("Missing Hyperliquid testnet signer config.")

    payload = json.loads(payload_raw)
    execution_id = payload["executionId"]
    direction = payload["direction"]
    coin = payload["coin"]
    requested_leverage = payload.get("leverage")
    requested_margin_mode = payload.get("marginMode", "cross")
    max_slippage_percent = payload.get("maxSlippagePercent", 8)
    symbol = payload["symbol"]
    requested_size = float(payload["size"])
    market_slippage = float(max_slippage_percent) / 100

    if requested_margin_mode not in ("cross", "isolated"):
        fail("Invalid margin mode.")

    account = eth_account.Account.from_key(secret_key)
    address = account_address or account.address
    info = Info(constants.TESTNET_API_URL, skip_ws=True)
    exchange = Exchange(account, constants.TESTNET_API_URL, account_address=address)
    size_decimals = get_size_decimals(info, coin)
    normalized_size = normalize_order_size(requested_size, size_decimals)
    is_buy = direction == "long"
    execution_timestamp = int(time.time() * 1000)

    if requested_leverage is not None:
        leverage = int(requested_leverage)
        is_cross_margin = requested_margin_mode != "isolated"
        leverage_result = exchange.update_leverage(leverage, coin, is_cross_margin)
        leverage_error = extract_exchange_error(leverage_result)
        log_debug(
            "portal.execution.leverage",
            {
                "coin": coin,
                "executionId": execution_id,
                "isCrossMargin": is_cross_margin,
                "leverage": leverage,
                "leverageResult": leverage_result,
                "marginMode": requested_margin_mode,
                "symbol": symbol,
            },
        )
        if leverage_error:
            fail(f"Leverage update failed: {leverage_error}")

    entry_result = exchange.market_open(coin, is_buy, normalized_size, slippage=market_slippage)
    entry_statuses = get_statuses(entry_result)
    entry_resting = next((get_resting_order(status) for status in entry_statuses if get_resting_order(status)), None)
    entry_filled = next((get_filled_order(status) for status in entry_statuses if get_filled_order(status)), None)
    entry_order_id = None
    if isinstance(entry_resting, dict):
        entry_order_id = entry_resting.get("oid")
    elif isinstance(entry_filled, dict):
        entry_order_id = entry_filled.get("oid")

    log_debug(
        "portal.execution.entry",
        {
            "coin": coin,
            "direction": direction,
            "entryOrderId": entry_order_id,
            "entryResult": entry_result,
            "executionId": execution_id,
            "maxSlippagePercent": max_slippage_percent,
            "normalizedSize": normalized_size,
            "requestedSize": requested_size,
            "slippage": market_slippage,
            "symbol": symbol,
        },
    )

    summary = {
        "actualFilledSize": 0.0,
        "direction": direction,
        "entryOrder": make_order_summary(execution_id, entry_order_id, "accepted"),
        "executionId": execution_id,
        "fillPrice": 0.0,
        "finalPositionState": None,
        "finalResult": "entry failed",
        "intendedSize": requested_size,
        "normalizedSize": normalized_size,
        "symbol": symbol,
        "timestamp": execution_timestamp,
    }

    if entry_result.get("status") != "ok":
      summary["entryOrder"] = make_order_summary(execution_id, entry_order_id, "rejected")
      reject_reason = extract_exchange_error(entry_result) or "Market order rejected by exchange."
      fail(reject_reason, summary)

    position_wait = wait_for_position(info, address, coin)
    position = position_wait["position"]
    actual_filled_size = position_wait["positionSize"]

    fill_price = 0.0
    if isinstance(position, dict):
        try:
            fill_price = float(position.get("entryPx", 0))
        except (TypeError, ValueError):
            fill_price = 0.0

    summary.update(
        {
            "actualFilledSize": actual_filled_size,
            "fillPrice": fill_price,
            "finalPositionState": position_wait["userState"],
        }
    )

    if actual_filled_size <= 0 or fill_price <= 0:
        fail("Entry reconciliation failed — live fill price not confirmed.", summary)

    summary["entryOrder"] = make_order_summary(execution_id, entry_order_id, "filled")
    summary["finalResult"] = "success"

    print(
        json.dumps(
            {
                "entryResult": entry_result,
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
        fail("Hyperliquid testnet execution failed.")
