from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import (
    auth,
    documents,
    chat,
    sharing,
    settings,
    vector_store,
    connectors,
    prompts,
    storage,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Mnemo API",
    version="2.0.0",
    root_path="/mnemo"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(sharing.router)
app.include_router(settings.router)
app.include_router(vector_store.router)
app.include_router(connectors.router)
app.include_router(prompts.router)
app.include_router(storage.router)


@app.get("/")
def root():
    return {"message": "Mnemo API is running", "version": "2.0.0"}
