"""Gemini API key discovery and model failover helpers."""

from __future__ import annotations

import os
from collections.abc import Sequence
from typing import Any


_STUB_PREFIXES = ("stub", "<paste", "<set", "replace-with-")


def _is_stub(value: str) -> bool:
    v = value.strip()
    if not v:
        return True
    return any(v.startswith(prefix) for prefix in _STUB_PREFIXES)


def _split_keys(value: str | None) -> list[str]:
    if not value:
        return []
    # Comma is the documented format. Newlines/semicolons are tolerated so a
    # copied list from a credential manager still works.
    normalized = value.replace("\n", ",").replace(";", ",")
    return [part.strip() for part in normalized.split(",") if part.strip()]


def get_gemini_api_keys() -> list[str]:
    """Return non-stub Gemini keys in failover order.

    Preferred env:
      GEMINI_API_KEYS=primary,backup

    Back-compat envs are appended after that list:
      GEMINI_API_KEY, GOOGLE_API_KEY, GEMINI_API_KEY_BACKUP, GOOGLE_API_KEY_BACKUP
    """

    raw_keys: list[str] = []
    raw_keys.extend(_split_keys(os.getenv("GEMINI_API_KEYS")))
    for env_name in (
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY_BACKUP",
        "GOOGLE_API_KEY_BACKUP",
    ):
        value = os.getenv(env_name)
        if value:
            raw_keys.append(value.strip())

    keys: list[str] = []
    seen: set[str] = set()
    for key in raw_keys:
        if _is_stub(key) or key in seen:
            continue
        keys.append(key)
        seen.add(key)
    return keys


def has_gemini_api_key() -> bool:
    return bool(get_gemini_api_keys())


def build_gemini_chat_model(
    *,
    model: str,
    temperature: float = 0,
    api_keys: Sequence[str] | None = None,
) -> Any:
    """Build a Gemini chat model with automatic backup-key fallback.

    LangChain's `with_fallbacks` retries on the next model when the primary
    raises, which covers quota exhaustion, transient auth failures after key
    rotation, and temporary backend errors without changing agent code.
    """

    from langchain_google_genai import ChatGoogleGenerativeAI

    keys = list(api_keys or get_gemini_api_keys())
    if not keys:
        keys = ["stub"]

    models = [
        ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            api_key=key,
        )
        for key in keys
    ]
    primary = models[0]
    if len(models) == 1:
        return primary
    return primary.with_fallbacks(models[1:])
