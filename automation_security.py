"""Fail-closed controls shared by legacy publishing automation."""

import os


AUTOMATION_ENABLE_ENV = "EMFLS_AUTOMATION_ENABLED"


def require_automation_enabled() -> None:
    """Stop legacy automation unless the operator explicitly opts in."""
    if os.environ.get(AUTOMATION_ENABLE_ENV) != "1":
        raise SystemExit(
            f"Automation is disabled by default. Set {AUTOMATION_ENABLE_ENV}=1 only after review."
        )


def required_env(name: str) -> str:
    """Return a required secret without providing a source-code fallback."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value
