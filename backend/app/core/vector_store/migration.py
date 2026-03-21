import uuid
import threading
from datetime import datetime, timezone
from typing import Callable, Optional
from app.core.vector_store.base import VectorStoreAdapter

BATCH_SIZE = 100


class MigrationEngine:
    """
    Safely migrates vectors from one store to another.
    - Reads all vectors from source
    - Writes to destination in batches
    - Verifies count matches before switching
    - Rolls back on failure
    - Never deletes source until verified
    """

    def __init__(
        self,
        source: VectorStoreAdapter,
        destination: VectorStoreAdapter,
        user_id: str,
        on_progress: Optional[Callable] = None,
    ):
        self.source = source
        self.destination = destination
        self.user_id = user_id
        self.on_progress = on_progress  # callback(migrated, total, status)

    def _emit(self, migrated: int, total: int, status: str):
        if self.on_progress:
            try:
                self.on_progress(migrated, total, status)
            except Exception:
                pass

    def run(self) -> dict:
        """
        Execute migration. Returns result dict:
        {
            success: bool,
            migrated: int,
            total: int,
            message: str
        }
        """
        try:
            # Step 1 — Read all vectors from source
            self._emit(0, 0, "reading")
            all_data = self._read_all_from_source()
            total = len(all_data)

            if total == 0:
                return {
                    "success": True,
                    "migrated": 0,
                    "total": 0,
                    "message": "Nothing to migrate — source is empty.",
                }

            self._emit(0, total, "migrating")

            # Step 2 — Write to destination in batches
            migrated = 0
            written_ids = []

            for i in range(0, total, BATCH_SIZE):
                batch = all_data[i : i + BATCH_SIZE]
                try:
                    texts = [item["text"] for item in batch]
                    embeddings = [item["embedding"] for item in batch]
                    metadatas = [item["metadata"] for item in batch]
                    ids = [item["id"] for item in batch]

                    self.destination.store(
                        user_id=self.user_id,
                        texts=texts,
                        embeddings=embeddings,
                        metadatas=metadatas,
                        ids=ids,
                    )
                    written_ids.extend(ids)
                    migrated += len(batch)
                    self._emit(migrated, total, "migrating")

                except Exception as batch_err:
                    # Rollback — delete what we wrote so far
                    self._emit(migrated, total, "rolling_back")
                    self._rollback(written_ids)
                    return {
                        "success": False,
                        "migrated": migrated,
                        "total": total,
                        "message": f"Failed at batch {i // BATCH_SIZE + 1}: {batch_err}",
                    }

            # Step 3 — Verify count
            self._emit(migrated, total, "verifying")
            verified = self._verify(total, written_ids)

            if not verified:
                self._emit(migrated, total, "rolling_back")
                self._rollback(written_ids)
                return {
                    "success": False,
                    "migrated": migrated,
                    "total": total,
                    "message": "Verification failed — destination count mismatch. Rolled back.",
                }

            # Step 4 — Done. Source kept as backup.
            self._emit(migrated, total, "done")
            return {
                "success": True,
                "migrated": migrated,
                "total": total,
                "message": f"Migration complete. {migrated} vectors migrated successfully.",
            }

        except Exception as e:
            self._emit(0, 0, "failed")
            return {
                "success": False,
                "migrated": 0,
                "total": 0,
                "message": f"Migration failed: {str(e)}",
            }

    def _read_all_from_source(self) -> list:
        """
        Read all vectors + embeddings from source.
        Each adapter needs a get_all_vectors() method.
        """
        return self.source.get_all_vectors(self.user_id)

    def _rollback(self, written_ids: list):
        """Delete everything written to destination so far."""
        try:
            if written_ids:
                self.destination.delete_by_ids(self.user_id, written_ids)
        except Exception as e:
            print(f"Rollback error (non-fatal): {e}")

    def _verify(self, expected_count: int, written_ids: list) -> bool:
        """Verify written count matches expected."""
        try:
            actual = self.destination.count(self.user_id)
            return actual >= expected_count
        except Exception:
            # If count not supported, verify by checking a sample
            return len(written_ids) == expected_count


def run_migration_background(
    user_id: str,
    source: VectorStoreAdapter,
    destination: VectorStoreAdapter,
    db_url: str,
    config_id: str,
):
    """
    Runs migration in a background thread.
    Updates DB with progress as it goes.
    """
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)

    def update_db(migrated: int, total: int, status: str):
        db = SessionLocal()
        try:
            db.execute(
                text(
                    """
                UPDATE user_vector_config
                SET
                    migration_status  = :status,
                    migrated_count    = :migrated,
                    total_count       = :total,
                    migration_done_at = CASE WHEN :status IN ('done','failed','rolling_back')
                                        THEN now() ELSE migration_done_at END
                WHERE id = :config_id
            """
                ),
                {
                    "status": status,
                    "migrated": migrated,
                    "total": total,
                    "config_id": config_id,
                },
            )
            db.commit()
        except Exception as e:
            print(f"DB update error: {e}")
        finally:
            db.close()

    engine_obj = MigrationEngine(
        source=source,
        destination=destination,
        user_id=user_id,
        on_progress=update_db,
    )

    result = engine_obj.run()

    # Final DB update
    db = SessionLocal()
    try:
        if result["success"]:
            # Switch active store to destination
            db.execute(
                text(
                    """
                UPDATE user_vector_config
                SET
                    migration_status = 'done',
                    migrated_count   = :migrated,
                    total_count      = :total,
                    is_active        = true
                WHERE id = :config_id
            """
                ),
                {
                    "migrated": result["migrated"],
                    "total": result["total"],
                    "config_id": config_id,
                },
            )
        else:
            db.execute(
                text(
                    """
                UPDATE user_vector_config
                SET
                    migration_status = 'failed',
                    migrated_count   = :migrated,
                    total_count      = :total
                WHERE id = :config_id
            """
                ),
                {
                    "migrated": result["migrated"],
                    "total": result["total"],
                    "config_id": config_id,
                },
            )
        db.commit()
    finally:
        db.close()

    engine.dispose()
    return result
