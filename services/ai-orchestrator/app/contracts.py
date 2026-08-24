from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


class ExecuteRequest(BaseModel):
    organization_id: str
    task_type: str
    quality_tier: Literal["q0", "q1", "q2", "q3", "q4"] = "q2"
    model: str
    messages: list[Message]
    timeout_seconds: int = Field(default=90, ge=5, le=600)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExecuteResponse(BaseModel):
    ok: bool
    model: str
    output_text: str | None = None
    latency_ms: int
    provider_cost_usd: float | None = None
    usage: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
