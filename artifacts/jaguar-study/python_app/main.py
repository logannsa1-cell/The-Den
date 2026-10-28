from __future__ import annotations

import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


APP_DIR = Path(__file__).resolve().parent
BASE_PATH = os.environ.get("BASE_PATH", "").strip()
if BASE_PATH == "/":
    BASE_PATH = ""
elif BASE_PATH and not BASE_PATH.startswith("/"):
    BASE_PATH = f"/{BASE_PATH}"
BASE_PATH = BASE_PATH.rstrip("/")

templates = Jinja2Templates(directory=str(APP_DIR / "templates"))
app = FastAPI(title="Jaguar", docs_url=None, redoc_url=None)
static_files = StaticFiles(directory=str(APP_DIR / "static"), check_dir=False)
app.mount("/static", static_files, name="static")
if BASE_PATH:
    app.mount(f"{BASE_PATH}/static", static_files, name="prefixed-static")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "base_path": BASE_PATH,
            "api_base": "/api",
            "sign_in_url": "/sign-in",
        },
    )


@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}


if BASE_PATH:
    app.add_api_route(BASE_PATH, home, methods=["GET"], response_class=HTMLResponse)
    app.add_api_route(f"{BASE_PATH}/", home, methods=["GET"], response_class=HTMLResponse)
    app.add_api_route(f"{BASE_PATH}/healthz", health, methods=["GET"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        proxy_headers=True,
    )
