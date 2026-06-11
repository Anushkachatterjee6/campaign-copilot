import asyncio
import logging
import os
import random
import uuid
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl


logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("channel-simulator")

DEFAULT_CALLBACK_URL = os.environ.get(
    "CRM_RECEIPT_CALLBACK_URL",
    "http://crm:8000/api/communications/receipts/",
)
MAX_RETRIES = int(os.environ.get("CALLBACK_MAX_RETRIES", "3"))
RETRY_BASE_SECONDS = float(os.environ.get("CALLBACK_RETRY_BASE_SECONDS", "0.5"))
EVENT_DELAY_SECONDS = float(os.environ.get("EVENT_DELAY_SECONDS", "0.25"))


class SimulatorProbabilities(BaseModel):
    delivered: float = Field(default_factory=lambda: probability_from_env("PROB_DELIVERED", 0.94), ge=0, le=1)
    failed: float = Field(default_factory=lambda: probability_from_env("PROB_FAILED", 0.04), ge=0, le=1)
    opened: float = Field(default_factory=lambda: probability_from_env("PROB_OPENED", 0.55), ge=0, le=1)
    read: float = Field(default_factory=lambda: probability_from_env("PROB_READ", 0.48), ge=0, le=1)
    clicked: float = Field(default_factory=lambda: probability_from_env("PROB_CLICKED", 0.16), ge=0, le=1)


class Recipient(BaseModel):
    id: int | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class SimulationRequest(BaseModel):
    communication_id: int
    recipient: Recipient
    message: str = Field(min_length=1)
    channel: Literal["email", "whatsapp", "sms", "push"]
    callback_url: HttpUrl | None = None
    probabilities: SimulatorProbabilities | None = None


class SimulationAcceptedResponse(BaseModel):
    job_id: str
    communication_id: int
    callback_url: str
    status: str


app = FastAPI(title="Channel Simulator", version="1.0.0")


def probability_from_env(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        logger.warning("Invalid probability for %s; using default %s", name, default)
        return default


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/simulate", response_model=SimulationAcceptedResponse, status_code=202)
async def simulate_delivery(request: SimulationRequest, background_tasks: BackgroundTasks):
    probabilities = request.probabilities or SimulatorProbabilities()
    if probabilities.delivered + probabilities.failed > 1:
        raise HTTPException(
            status_code=400,
            detail="delivered + failed probabilities must be less than or equal to 1.",
        )

    job_id = str(uuid.uuid4())
    callback_url = str(request.callback_url or DEFAULT_CALLBACK_URL)
    background_tasks.add_task(run_simulation, job_id, request, callback_url, probabilities)
    logger.info(
        "Accepted simulation job_id=%s communication_id=%s channel=%s",
        job_id,
        request.communication_id,
        request.channel,
    )
    return {
        "job_id": job_id,
        "communication_id": request.communication_id,
        "callback_url": callback_url,
        "status": "accepted",
    }


async def run_simulation(
    job_id: str,
    request: SimulationRequest,
    callback_url: str,
    probabilities: SimulatorProbabilities,
) -> None:
    events = generate_events(probabilities)
    logger.info(
        "Generated events job_id=%s communication_id=%s events=%s",
        job_id,
        request.communication_id,
        events,
    )

    async with httpx.AsyncClient(timeout=10) as client:
        for event_type in events:
            await asyncio.sleep(EVENT_DELAY_SECONDS)
            payload = {
                "communication_id": request.communication_id,
                "event_type": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "recipient": request.recipient.model_dump(),
                "channel": request.channel,
                "provider_event_id": f"sim_{job_id}_{event_type}",
                "payload": {
                    "job_id": job_id,
                    "message_preview": request.message[:120],
                    "simulated": True,
                },
            }
            await post_callback_with_retry(client, callback_url, payload)


def generate_events(probabilities: SimulatorProbabilities) -> list[str]:
    if random.random() < probabilities.failed:
        return ["failed"]

    events: list[str] = []
    if random.random() < probabilities.delivered:
        events.append("delivered")
    else:
        return ["failed"]

    if random.random() < probabilities.opened:
        events.append("opened")
    if "opened" in events and random.random() < probabilities.read:
        events.append("read")
    if ("opened" in events or "read" in events) and random.random() < probabilities.clicked:
        events.append("clicked")

    return events


async def post_callback_with_retry(
    client: httpx.AsyncClient,
    callback_url: str,
    payload: dict,
) -> None:
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.post(callback_url, json=payload)
            response.raise_for_status()
            logger.info(
                "Callback sent event_type=%s communication_id=%s attempt=%s",
                payload["event_type"],
                payload["communication_id"],
                attempt,
            )
            return
        except Exception as exc:
            last_error = exc
            sleep_for = RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                "Callback failed event_type=%s communication_id=%s attempt=%s retry_in=%.2fs error=%s",
                payload["event_type"],
                payload["communication_id"],
                attempt,
                sleep_for,
                exc,
            )
            await asyncio.sleep(sleep_for)

    logger.error(
        "Callback permanently failed event_type=%s communication_id=%s error=%s",
        payload["event_type"],
        payload["communication_id"],
        last_error,
    )
