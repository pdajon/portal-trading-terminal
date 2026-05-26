import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from testnet_live_positions import get_mark_price_for_coin, get_mark_prices_by_coin


class FakeInfo:
    def meta_and_asset_ctxs(self):
        return (
            {"universe": [{"name": "BTC"}, {"name": "ETH"}]},
            [{"markPx": "79385.0"}, {"markPx": "2235.6"}],
        )


class MarkPriceTests(unittest.TestCase):
    def test_mark_price_prefers_asset_context_mark_px_over_mid(self):
        mark_prices = get_mark_prices_by_coin(FakeInfo())

        self.assertEqual(mark_prices["BTC"], 79385.0)
        self.assertEqual(
            get_mark_price_for_coin("BTC", mark_prices, {"BTC": "79392.5"}),
            79385.0,
        )

    def test_mark_price_falls_back_to_mid_when_mark_px_missing(self):
        self.assertEqual(get_mark_price_for_coin("BTC", {}, {"BTC": "79392.5"}), 79392.5)


if __name__ == "__main__":
    unittest.main()
