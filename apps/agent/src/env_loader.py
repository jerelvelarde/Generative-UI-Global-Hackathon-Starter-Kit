"""Shared dotenv bootstrap for agent runtime and tool modules.

Load order:
1. Repo root `.env` (shared by frontend + BFF + agent)
2. `apps/agent/.env` (optional per-agent override)

This lets local runs work from a single root key while preserving the
ability to override agent-only values in `apps/agent/.env`.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


@lru_cache(maxsize=1)
def bootstrap_env() -> None:
    """Load root + agent dotenv files exactly once per process."""
    repo_root = Path(__file__).resolve().parents[3]
    root_env = repo_root / ".env"
    agent_env = repo_root / "apps" / "agent" / ".env"

    if root_env.exists():
        load_dotenv(dotenv_path=root_env, override=False)
    if agent_env.exists():
        load_dotenv(dotenv_path=agent_env, override=True)

