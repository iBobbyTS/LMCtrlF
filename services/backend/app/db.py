from __future__ import annotations

from pathlib import Path

from peewee import DatabaseProxy, SqliteDatabase


database_proxy: DatabaseProxy = DatabaseProxy()
database_instance: SqliteDatabase | None = None


def initialize_database(database_path: str) -> SqliteDatabase:
    global database_instance

    if database_instance is not None and not database_instance.is_closed():
        database_instance.close()

    resolved_path = Path(database_path).expanduser().resolve()
    resolved_path.parent.mkdir(parents=True, exist_ok=True)

    database_instance = SqliteDatabase(
        resolved_path,
        check_same_thread=False,
        pragmas={
            "foreign_keys": 1,
            "journal_mode": "wal",
        },
    )
    database_proxy.initialize(database_instance)
    database_instance.connect(reuse_if_open=True)
    return database_instance


def close_database() -> None:
    global database_instance

    if database_instance is not None and not database_instance.is_closed():
        database_instance.close()
