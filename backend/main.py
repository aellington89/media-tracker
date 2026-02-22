import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse

from .database import init_db, DATA_DIR
from .routers import media, categories, tags, stats, field_values

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Media Tracker", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8765", "http://127.0.0.1:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(media.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(field_values.router, prefix="/api")


@app.post("/api/upload/cover")
async def upload_cover(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use JPG, PNG, GIF, or WebP.")
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / filename
    content = await file.read()
    dest.write_bytes(content)

    return JSONResponse({"url": f"/uploads/{filename}"})


# Serve uploaded covers
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Serve frontend static files
app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")


@app.get("/")
@app.get("/{path:path}")
async def serve_spa(path: str = ""):
    index = FRONTEND_DIR / "index.html"
    html = index.read_text(encoding="utf-8")
    ts = int(time.time())
    html = html.replace('/css/main.css"', f'/css/main.css?v={ts}"')
    html = html.replace('/css/components.css"', f'/css/components.css?v={ts}"')
    html = html.replace('/js/app.js"', f'/js/app.js?v={ts}"')
    return HTMLResponse(html)
