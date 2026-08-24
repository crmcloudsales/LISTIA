from __future__ import annotations

import time
from typing import Any, TypedDict

import litellm
from langgraph.graph import END, StateGraph

from .contracts import ExecuteRequest


class ExecutionState(TypedDict, total=False):
    request: ExecuteRequest
    output_text: str | None
    usage: dict[str, Any]
    provider_cost_usd: float | None
    latency_ms: int
    error: str | None


async def execute_model(state: ExecutionState) -> ExecutionState:
    request = state["request"]
    started = time.perf_counter()
    try:
        response = await litellm.acompletion(
            model=request.model,
            messages=[message.model_dump() for message in request.messages],
            timeout=request.timeout_seconds,
            metadata={
                "listia_organization_id": request.organization_id,
                "listia_task_type": request.task_type,
                "listia_quality_tier": request.quality_tier,
                **request.metadata,
            },
        )
        output_text = None
        if response.choices:
            output_text = response.choices[0].message.content

        usage: dict[str, Any] = {}
        if getattr(response, "usage", None) is not None:
            raw_usage = response.usage
            usage = raw_usage.model_dump() if hasattr(raw_usage, "model_dump") else dict(raw_usage)

        provider_cost_usd = None
        try:
            provider_cost_usd = float(litellm.completion_cost(completion_response=response))
        except Exception:
            # Cost must never be invented. The caller can reconcile it from provider billing/telemetry later.
            provider_cost_usd = None

        return {
            **state,
            "output_text": output_text,
            "usage": usage,
            "provider_cost_usd": provider_cost_usd,
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "error": None,
        }
    except Exception as exc:
        return {
            **state,
            "output_text": None,
            "usage": {},
            "provider_cost_usd": None,
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "error": f"{type(exc).__name__}: {exc}",
        }


def build_graph():
    graph = StateGraph(ExecutionState)
    graph.add_node("execute_model", execute_model)
    graph.set_entry_point("execute_model")
    graph.add_edge("execute_model", END)
    return graph.compile()


execution_graph = build_graph()
