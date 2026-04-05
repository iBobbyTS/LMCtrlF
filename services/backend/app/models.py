from __future__ import annotations

from datetime import datetime, timezone

from peewee import CharField, DateTimeField, ForeignKeyField, IntegerField, Model, TextField

from app.db import database_proxy


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BaseModel(Model):
    class Meta:
        database = database_proxy


class Project(BaseModel):
    id = CharField(primary_key=True)
    name = TextField()
    accent = CharField()
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)

    class Meta:
        table_name = "projects"


class Document(BaseModel):
    id = CharField(primary_key=True)
    project = ForeignKeyField(Project, backref="documents", on_delete="CASCADE", column_name="project_id")
    name = TextField()
    file_path = TextField()
    md5 = CharField()
    status = CharField()
    progress = IntegerField(default=0)
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)

    class Meta:
        table_name = "documents"
        indexes = ((("project", "file_path"), True),)


class ModelSettings(BaseModel):
    id = CharField(primary_key=True)
    selected_provider_id = CharField()
    providers_json = TextField()
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)

    class Meta:
        table_name = "model_settings"


class ChatThread(BaseModel):
    id = CharField(primary_key=True)
    project = ForeignKeyField(Project, backref="chat_threads", on_delete="CASCADE", column_name="project_id")
    title = TextField()
    summary = TextField(default="")
    lmstudio_last_response_id = CharField(null=True)
    created_at = DateTimeField(default=utc_now)
    updated_at = DateTimeField(default=utc_now)

    class Meta:
        table_name = "chat_threads"


class ChatMessage(BaseModel):
    id = CharField(primary_key=True)
    thread = ForeignKeyField(ChatThread, backref="messages", on_delete="CASCADE", column_name="thread_id")
    sender_type = CharField()
    role = TextField()
    content = TextField()
    reasoning_content = TextField(default="")
    citations_json = TextField(default="[]")
    created_at = DateTimeField(default=utc_now)

    class Meta:
        table_name = "chat_messages"
        indexes = ((("thread", "created_at"), False),)
