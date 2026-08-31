#!/usr/bin/env python3
"""Score revenue opportunities without fabricating missing performance data."""

from datetime import date


ALLOWED_STATUSES = {
    "VERIFIED",
    "ESTIMATED",
    "STALE_DATA",
    "NOT_CONNECTED",
    "INSUFFICIENT_DATA",
}


def freshness_status(channel, as_of, max_age_days=7):
    if not channel or channel.get("status") == "NOT_CONNECTED":
        return "NOT_CONNECTED"
    end = (channel.get("period") or {}).get("end")
    if not end:
        return "INSUFFICIENT_DATA"
    try:
        age = (date.fromisoformat(as_of) - date.fromisoformat(end)).days
    except (TypeError, ValueError):
        return "INSUFFICIENT_DATA"
    return "STALE_DATA" if age > max_age_days else channel.get("status", "INSUFFICIENT_DATA")


def empty_channel(fields, status="NOT_CONNECTED"):
    if status not in ALLOWED_STATUSES:
        raise ValueError(f"unsupported data status: {status}")
    return {
        **{field: None for field in fields},
        "status": status,
        "period": None,
        "source": None,
    }


def normalize_channel(channel, fields, as_of):
    if channel is None:
        return empty_channel(fields)
    result = {field: channel.get(field) for field in fields}
    result.update(
        {
            "status": freshness_status(channel, as_of),
            "period": channel.get("period"),
            "source": channel.get("source"),
        }
    )
    return result
