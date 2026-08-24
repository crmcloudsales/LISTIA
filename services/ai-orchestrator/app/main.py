from __future__ import annotations

import hmac
import os

from fastapi import FastAPI, Header, HTTPException

from .contracts import ExecuteRequest, ExecuteResponse
from .graph import execution_graph

app = FastAPI(title="LISTIA AI Orchestrator", version="0.1.0", docs_url=None, redoc_url=None)


def require_internal_token(value: str | None) -> None:
    expected = os.getenv("LISTIA_INTERNAL_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="internal_token_not_configured")
    if not value or not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "listia-ai-orchestrator"}


@app.post("/v1/execute", response_model=ExecuteResponse)
async def execute(
    request: ExecuteRequest,
    x_listia_internal_token: str | None = Header(default=None),
) -> ExecuteResponse:
    require_internal_token(x_listia_internal_token)

    result = await execution_graph.ainvoke({"request": request})
    error = result.get("error")
    return ExecuteResponse(
        ok=not bool(error),
        model=request.model,
        output_text=result.get("output_text"),
        latency_ms=int(result.get("latency_ms") or 0),
        provider_cost_usd=result.get("provider_cost_usd"),
        usage=result.get("usage") or {},
        error=error,
    )
