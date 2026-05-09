"""Lyria — Hearth's music-generation gateway (stretch F-16).

This module is the **agent-side contract** for music generation. It does
not own the audio playback path — that's the frontend's Tone.js
``AudioEngine``. Lyria's job is to take a ``promptForGen`` string from
``MoodProfile.music`` and return a 30-second WAV clip the audio engine
can crossfade in.

Integration pipeline
--------------------
::

    profile.music.promptForGen changes
        │
        ▼
    Frontend audio engine (Nathan)
        │  fetch(`/api/hearth/music/generate?prompt=…&seed=…`)
        ▼
    BFF route (Lyubah, Hono)
        │  forwards to Python (subprocess CLI or LangGraph backend tool)
        ▼
    hearth.lyria.generate_clip(prompt, duration_s=30, seed=…)
        │
        ▼
    Vertex AI Lyria  →  WAV bytes  →  cached by content hash
        │
        ▼
    Frontend gets bytes (or 404 → fall back to pre-baked clip)

Gating
------
``USE_LYRIA=true`` enables the call. Default is False — MVP demo path
runs entirely on pre-baked clips. Even when enabled, any auth or quota
failure logs and returns None so the frontend's pre-baked fallback
kicks in (no white screen, no broken demo).

Caching
-------
Each (prompt, seed) pair is cached by SHA-256 hash to ``~/.hearth/lyria-cache``
so re-renders of the same demo run are free. The cache survives across
``langgraph dev`` reloads.

Why this is a stretch feature
-----------------------------
Vertex AI Lyria 2 / Lyria 3 Clip Preview requires:
1. ``google-cloud-aiplatform`` (not currently in pyproject).
2. ``GOOGLE_APPLICATION_CREDENTIALS`` pointing at a service-account JSON.
3. A GCP project with Lyria access enabled (request via Vertex console).
4. Latency budget of ~10–20s per 30s clip — too slow to do live during
   a single chat turn; usually queued and crossfaded in when ready.

The MVP demo runs without any of this. The scaffold here is so the
hand-off to live generation is a one-day swap, not a one-week swap.
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


_CACHE_DIR = Path(os.getenv("HEARTH_LYRIA_CACHE", "~/.hearth/lyria-cache")).expanduser()


def _is_enabled() -> bool:
    return os.getenv("USE_LYRIA", "").lower() in {"1", "true", "yes"}


def _cache_key(prompt: str, *, seed: Optional[int], duration_s: int) -> Path:
    digest = hashlib.sha256(
        f"{prompt}|seed={seed}|d={duration_s}".encode("utf-8")
    ).hexdigest()[:16]
    return _CACHE_DIR / f"{digest}.wav"


def _read_cached(path: Path) -> Optional[bytes]:
    if path.exists():
        try:
            return path.read_bytes()
        except OSError as exc:
            logger.warning("[lyria] cache read failed for %s: %s", path, exc)
    return None


def _write_cached(path: Path, data: bytes) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    except OSError as exc:
        logger.warning("[lyria] cache write failed for %s: %s", path, exc)


# ----------------------------- public API ----------------------------------


def generate_clip(
    prompt: str,
    *,
    duration_s: int = 30,
    seed: Optional[int] = None,
    negative_prompt: Optional[str] = None,
) -> Optional[bytes]:
    """Generate a Lyria clip from a text prompt.

    Args:
        prompt: Music-generation prompt, e.g.
            ``"instrumental lo-fi, 65 BPM, sparse harmonic content, "``
            ``"warm rhodes and analog pads, gentle vinyl crackle, "``
            ``"contemplative and focused, no drums in the foreground"``.
        duration_s: Clip length in seconds. Lyria 2 is 30s native; longer
            requests are concatenated (with audible seams). Keep at 30
            for clean loops.
        seed: Optional integer for reproducible generation. Same seed +
            prompt = same output.
        negative_prompt: Optional adjectives to avoid (e.g. ``"drums, "``
            ``"vocals, dissonant"``).

    Returns:
        WAV bytes (48kHz, 16-bit PCM) on success. ``None`` when:
          - ``USE_LYRIA`` is False (default — MVP path)
          - ``google-cloud-aiplatform`` is not installed
          - Vertex auth is not configured
          - The API call fails for any reason
        The caller is expected to fall back to a pre-baked clip in any
        of those cases.

    Side effects:
        Caches successful generations under ``~/.hearth/lyria-cache``
        keyed by sha256(prompt, seed, duration). The cache is persistent
        across runs.
    """
    if not _is_enabled():
        logger.info("[lyria] disabled (USE_LYRIA != true) — caller should fall back")
        return None

    cache_path = _cache_key(prompt, seed=seed, duration_s=duration_s)
    cached = _read_cached(cache_path)
    if cached is not None:
        logger.info("[lyria] cache hit %s", cache_path.name)
        return cached

    # ---- Vertex AI Lyria call — wire when GCP is set up. ------------------
    #
    # Pseudocode for live integration:
    #
    #   from google.cloud import aiplatform
    #   from vertexai.preview.generative_models import GenerativeModel
    #   aiplatform.init(project=os.environ["GOOGLE_PROJECT_ID"],
    #                   location="us-central1")
    #   model = GenerativeModel("lyria-002")  # or "lyria-3-clip-preview"
    #   response = model.generate(
    #       prompt=prompt,
    #       negative_prompt=negative_prompt,
    #       seed=seed,
    #       duration_seconds=duration_s,
    #   )
    #   audio_bytes = response.audio.data  # WAV @ 48kHz
    #
    # Until that's wired:
    try:
        # Importing here so `USE_LYRIA=false` (the default) doesn't pay the
        # google-cloud-aiplatform import cost at module load.
        import google.cloud.aiplatform  # noqa: F401  # type: ignore[import-not-found]
    except ImportError:
        logger.warning(
            "[lyria] USE_LYRIA=true but google-cloud-aiplatform not installed; "
            "falling back to None. Add it to pyproject.toml + uv sync."
        )
        return None

    logger.warning(
        "[lyria] USE_LYRIA=true but live generation is stubbed; "
        "falling back to None. See module docstring for the wiring."
    )
    return None


# --------------------------- prompt utilities ------------------------------


def prompt_for_profile_music(music_prompt: str, *, mood_phase: str) -> str:
    """Augment a profile's promptForGen with phase-specific framing.

    The MoodProfile's ``music.promptForGen`` is the agent's lyrical
    description of what should play. Adding the evolution phase as a
    framing clause helps Lyria pick consistent dynamics (ramp-up,
    sustain, wind-down). Caller is responsible for negative_prompt.
    """
    framing = {
        "ramp": "gradually building energy, leaving room for entry",
        "sustain": "steady-state, no major dynamic shifts",
        "wind_down": "decaying energy, final breath, slow release",
    }.get(mood_phase, "steady-state")

    return f"{music_prompt}. {framing}."


__all__ = ["generate_clip", "prompt_for_profile_music"]
