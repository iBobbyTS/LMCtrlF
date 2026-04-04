from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.projects import router as projects_router
from app.core.config import Settings, get_settings
from app.db import close_database, initialize_database
from app.models import Document, Project


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    database = initialize_database(app_settings.database_path)
    database.create_tables([Project, Document], safe=True)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            yield
        finally:
            close_database()

    app = FastAPI(title=app_settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["null"],
        allow_origin_regex=r"https?://(127\.0\.0\.1|localhost)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(projects_router)
    return app


settings = get_settings()
app = create_app(settings)


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=False,
    )


if __name__ == "__main__":
    main()
