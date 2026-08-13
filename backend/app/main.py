from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.ingestion.scheduler import start_scheduler, stop_scheduler

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("saptanga_newsroom_startup", environment=settings.ENVIRONMENT)
    if settings.INGESTION_SCHEDULER_ENABLED:
        start_scheduler()
    yield
    if settings.INGESTION_SCHEDULER_ENABLED:
        stop_scheduler()


app = FastAPI(
    title="SAPTANGA Central Newsroom",
    description="Backend for SAPTANGA Newsroom: collect, understand, verify, edit, distribute.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
