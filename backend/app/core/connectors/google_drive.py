import os
import io
import tempfile
from typing import List, Tuple, Dict, Any
from app.core.connectors.base import DataSourceConnector


class GoogleDriveConnector(DataSourceConnector):

    def __init__(self, config: Dict):
        self.config = config
        self.credentials = None
        self._build_credentials()

    def _build_credentials(self):
        from google.oauth2.credentials import Credentials

        self.credentials = Credentials(
            token=self.config.get("access_token"),
            refresh_token=self.config.get("refresh_token"),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        )

    def _service(self):
        from googleapiclient.discovery import build

        return build("drive", "v3", credentials=self.credentials)

    def test_connection(self) -> Tuple[bool, str]:
        try:
            svc = self._service()
            about = svc.about().get(fields="user").execute()
            email = about.get("user", {}).get("emailAddress", "unknown")
            return True, f"Connected to Google Drive as {email}"
        except Exception as e:
            return False, str(e)

    def list_sources(self) -> List[Dict]:
        """List recent Google Drive files (PDFs + Docs)"""
        try:
            svc = self._service()
            results = (
                svc.files()
                .list(
                    q="mimeType='application/pdf' or mimeType='application/vnd.google-apps.document'",
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
            return []

    def pull_data(self, source_ids: List[str], custom_query=None) -> List[Dict]:
        """Download and extract text from selected Drive files"""
        from googleapiclient.http import MediaIoBaseDownload

        svc = self._service()
        results = []

        for file_id in source_ids:
            try:
                meta = svc.files().get(fileId=file_id, fields="name,mimeType").execute()
                name = meta["name"]
                mime = meta["mimeType"]

                if mime == "application/vnd.google-apps.document":
                    # Export Google Doc as plain text
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
                    # Download PDF and extract text
                    request = svc.files().get_media(fileId=file_id)
                    buf = io.BytesIO()
                    downloader = MediaIoBaseDownload(buf, request)
                    done = False
                    while not done:
                        _, done = downloader.next_chunk()

                    # Write to temp file and use PyPDF
                    with tempfile.NamedTemporaryFile(
                        suffix=".pdf", delete=False
                    ) as tmp:
                        tmp.write(buf.getvalue())
                        tmp_path = tmp.name

                    from langchain_community.document_loaders import PyPDFLoader

                    loader = PyPDFLoader(tmp_path)
                    pages = loader.load()
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


def get_gdrive_auth_url() -> str:
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
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
    auth_url, _ = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent"
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> Dict:
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
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
    flow.fetch_token(code=code)
    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
    }
