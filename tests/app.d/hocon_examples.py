"""
Expose the shipped examples to the e2e tests.

The examples are loaded from disk rather than copied so the tests exercise the
same code the README points at. The server must be started from the repository
root, which is what `playwright.config.ts` does.
"""

import runpy

_trade_filter = runpy.run_path("examples/trade_filter.py")
_algo_matrix = runpy.run_path("examples/algo_matrix.py")

trade_monitor = _trade_filter["trade_monitor"]
algo_matrix = _algo_matrix["algo_matrix"]
