import json
from typing import List, Tuple, Dict, Any
from app.core.connectors.base import DataSourceConnector

SUPPORTED_DRIVERS = {
    "mssql": "mssql+pyodbc",
    "postgres": "postgresql+psycopg2",
    "mysql": "mysql+pymysql",
}


class SQLConnector(DataSourceConnector):

    def __init__(self, config: Dict):
        self.config = config
        self.db_type = config.get("db_type", "postgres")
        self.engine = self._build_engine()

    def _build_engine(self):
        from sqlalchemy import create_engine

        driver = SUPPORTED_DRIVERS.get(self.db_type, "postgresql+psycopg2")

        if self.db_type == "mssql":
            url = (
                f"{driver}://{self.config['user']}:{self.config['password']}"
                f"@{self.config['host']}:{self.config.get('port', 1433)}"
                f"/{self.config['database']}?driver=ODBC+Driver+17+for+SQL+Server"
            )
        elif self.db_type == "mysql":
            url = (
                f"{driver}://{self.config['user']}:{self.config['password']}"
                f"@{self.config['host']}:{self.config.get('port', 3306)}"
                f"/{self.config['database']}"
            )
        else:
            url = (
                f"{driver}://{self.config['user']}:{self.config['password']}"
                f"@{self.config['host']}:{self.config.get('port', 5432)}"
                f"/{self.config['database']}"
            )
        return create_engine(url, connect_args={"connect_timeout": 10})

    def test_connection(self) -> Tuple[bool, str]:
        try:
            from sqlalchemy import text

            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, f"Connected to {self.db_type} database successfully."
        except Exception as e:
            return False, str(e)

    def list_sources(self) -> List[Dict]:
        """Return list of all tables with row counts"""
        from sqlalchemy import text, inspect

        try:
            inspector = inspect(self.engine)
            tables = inspector.get_table_names()
            result = []
            with self.engine.connect() as conn:
                for table in tables:
                    try:
                        count = conn.execute(
                            text(f'SELECT COUNT(*) FROM "{table}"')
                        ).scalar()
                        cols = [c["name"] for c in inspector.get_columns(table)]
                        result.append(
                            {
                                "id": table,
                                "name": table,
                                "rows": count,
                                "columns": cols,
                            }
                        )
                    except Exception:
                        continue
            return result
        except Exception as e:
            return []

    def pull_data(self, source_ids: List[str], custom_query: str = None) -> List[Dict]:
        """
        Pull rows from selected tables or run custom query.
        Returns list of {text, metadata} dicts.
        """
        from sqlalchemy import text

        results = []

        if custom_query:
            try:
                with self.engine.connect() as conn:
                    rows = conn.execute(text(custom_query)).mappings().all()
                    for i, row in enumerate(rows):
                        row_dict = dict(row)
                        text_ = self.serialize_to_text(row_dict, list(row_dict.keys()))
                        results.append(
                            {
                                "text": text_,
                                "metadata": {
                                    "source": "custom_query",
                                    "row_index": i,
                                    "filename": "custom_query_results",
                                },
                            }
                        )
            except Exception as e:
                raise ValueError(f"Query failed: {e}")
        else:
            for table in source_ids:
                try:
                    with self.engine.connect() as conn:
                        rows = (
                            conn.execute(text(f'SELECT * FROM "{table}" LIMIT 5000'))
                            .mappings()
                            .all()
                        )
                        for i, row in enumerate(rows):
                            row_dict = dict(row)
                            text_ = self.serialize_to_text(
                                row_dict, list(row_dict.keys())
                            )
                            results.append(
                                {
                                    "text": text_,
                                    "metadata": {
                                        "source": table,
                                        "row_index": i,
                                        "filename": f"table_{table}",
                                    },
                                }
                            )
                except Exception as e:
                    print(f"Failed to pull table {table}: {e}")
                    continue

        return results

    def serialize_to_text(self, row: Dict, columns: List[str]) -> str:
        """
        Convert a DB row to natural language.
        Example: {"name": "John", "age": 30} → "name is John, age is 30"
        """
        parts = []
        for col in columns:
            val = row.get(col)
            if val is not None and str(val).strip():
                parts.append(f"{col} is {val}")
        return ", ".join(parts) if parts else str(row)
