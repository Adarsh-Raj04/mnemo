import os
import io
import tempfile
from typing import List, Tuple, Dict
from app.core.connectors.base import DataSourceConnector
from google_auth_oauthlib.flow import Flow


# ── Shared flow config ───────────────────────────────────────────────────────


def _make_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
    )


# In-memory flow store keyed by OAuth state parameter.
# Replace with Redis / DB for multi-instance / multi-process deployments.
_flow_store: Dict[str, Flow] = {}


# ── Auth helpers ─────────────────────────────────────────────────────────────


def get_gdrive_auth_url() -> Tuple[str, str]:
    """Return (auth_url, state). Store the flow so the code verifier survives."""
    flow = _make_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    _flow_store[state] = flow
    return auth_url, state


def exchange_code_for_tokens(code: str, state: str) -> Dict:
    """
    Exchange the authorization code for tokens.
    Reuses the stored flow so the PKCE code verifier is preserved.
    """
    flow = _flow_store.pop(state, None)

    if flow is None:
        # Fallback for clients where Google doesn't enforce PKCE
        flow = _make_flow()

    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
    }


# ── Connector ────────────────────────────────────────────────────────────────


class GoogleDriveConnector(DataSourceConnector):

    def __init__(self, config: Dict):
        self.config = config
        self.credentials = None
        self._svc = None
        self._build_credentials()

    def _build_credentials(self):
        from google.oauth2.credentials import Credentials

        self.credentials = Credentials(
            token=self.config.get("access_token"),
            refresh_token=self.config.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )

    def _service(self):
        """Build and cache the Drive service (auto-refreshes expired tokens)."""
        if self._svc is None:
            from googleapiclient.discovery import build
            import google.auth.transport.requests

            # Refresh token if expired before building the service
            if self.credentials.expired and self.credentials.refresh_token:
                self.credentials.refresh(google.auth.transport.requests.Request())

            self._svc = build(
                "drive",
                "v3",
                credentials=self.credentials,
                cache_discovery=False,
            )
        return self._svc

    def test_connection(self) -> Tuple[bool, str]:
        try:
            svc = self._service()
            about = svc.about().get(fields="user").execute()
            email = about.get("user", {}).get("emailAddress", "unknown")
            return True, f"Connected to Google Drive as {email}"
        except Exception as e:
            return False, str(e)

    def list_sources(self) -> List[Dict]:
        """List recent Google Drive files (PDFs + Docs)."""
        try:
            svc = self._service()
            results = (
                svc.files()
                .list(
                    q=(
                        "mimeType='application/pdf' or "
                        "mimeType='application/vnd.google-apps.document'"
                    ),
                    pageSize=50,
                    fields="files(id, name, mimeType, size, modifiedTime)",
                )
                .execute()
            )
            files = results.get("files", [])
            return [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "type": "pdf" if f["mimeType"] == "application/pdf" else "doc",
                    "size": int(f.get("size", 0)),
                    "modified": f.get("modifiedTime", ""),
                }
                for f in files
            ]
        except Exception as e:
            raise RuntimeError(f"Failed to list Drive sources: {e}") from e

    def pull_data(self, source_ids: List[str], custom_query=None) -> List[Dict]:
        """Download and extract text from selected Drive files."""
        from googleapiclient.http import MediaIoBaseDownload

        svc = self._service()
        results = []

        for file_id in source_ids:
            try:
                meta = svc.files().get(fileId=file_id, fields="name,mimeType").execute()
                name = meta["name"]
                mime = meta["mimeType"]

                if mime == "application/vnd.google-apps.document":
                    content = (
                        svc.files()
                        .export(fileId=file_id, mimeType="text/plain")
                        .execute()
                    )
                    text = (
                        content.decode("utf-8")
                        if isinstance(content, bytes)
                        else content
                    )
                    results.append(
                        {
                            "text": text,
                            "metadata": {
                                "filename": name,
                                "source": "google_drive",
                                "file_id": file_id,
                            },
                        }
                    )

                elif mime == "application/pdf":
                    request = svc.files().get_media(fileId=file_id)
                    buf = io.BytesIO()
                    downloader = MediaIoBaseDownload(buf, request)
                    done = False
                    while not done:
                        _, done = downloader.next_chunk()

                    tmp_path = None
                    try:
                        with tempfile.NamedTemporaryFile(
                            suffix=".pdf", delete=False
                        ) as tmp:
                            tmp.write(buf.getvalue())
                            tmp_path = tmp.name

                        from langchain_community.document_loaders import PyPDFLoader

                        loader = PyPDFLoader(tmp_path)
                        pages = loader.load()
                    finally:
                        # Always clean up temp file even if loader throws
                        if tmp_path and os.path.exists(tmp_path):
                            os.unlink(tmp_path)

                    for page in pages:
                        results.append(
                            {
                                "text": page.page_content,
                                "metadata": {
                                    "filename": name,
                                    "source": "google_drive",
                                    "file_id": file_id,
                                    "page": page.metadata.get("page", 0) + 1,
                                },
                            }
                        )

            except Exception as e:
                print(f"Failed to pull Drive file {file_id}: {e}")
                continue

        return results

    def serialize_to_text(self, row: Dict, columns: List[str]) -> str:
        return str(row)
