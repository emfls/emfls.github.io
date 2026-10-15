"""Resolve operating artifacts outside the public site repository when configured."""

import os
from pathlib import Path


def ops_root(default=None):
    configured = os.environ.get("EMFLS_OPS_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    if default is not None:
        return Path(default).resolve()
    return Path(__file__).resolve().parents[1]


def ops_path(relative, default=None):
    path = Path(relative)
    if path.is_absolute():
        return path
    return ops_root(default) / path
