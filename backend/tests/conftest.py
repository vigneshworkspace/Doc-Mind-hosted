import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.core.deps import get_db
from main import app

# Use SQLite in-memory with a shared cache so all connections share the same DB
SQLALCHEMY_TEST_URL = "sqlite:///file::memory:?cache=shared&uri=true"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False, "uri": True},
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def stub_ai_provider(monkeypatch):
    """Make generation deterministic and offline. Without this, generators hit the
    live Gemini cascade — flaky (rate limits/quota) and now raising GenerationError
    on failure. Patches generators._provider() with a fake whose structured_output
    returns schema-valid data (honouring 'exactly N' for quizzes)."""
    import re
    from app.services import generators

    class _FakeProvider:
        async def structured_output(self, messages, schema, system_prompt=""):
            text = " ".join(
                m.get("content", "") for m in messages
                if isinstance(m.get("content"), str)
            )
            name = getattr(schema, "__name__", "")
            if name == "_QuizList":
                m = re.search(r"exactly (\d+)", text)
                n = int(m.group(1)) if m else 3
                return schema(questions=[
                    generators._QuizQuestion(
                        question_text=f"Sample question {i + 1}",
                        options=["A", "B", "C", "D"],
                        correct_answer="A",
                        explanation="Because A is correct.",
                    ) for i in range(n)
                ])
            if name == "_FlashCardList":
                return schema(cards=[
                    generators._FlashCard(question="Q1", answer="A1"),
                    generators._FlashCard(question="Q2", answer="A2"),
                ])
            # Generic best-effort for any other schema a future test exercises.
            try:
                return schema()
            except Exception:  # pragma: no cover
                raise NotImplementedError(f"stub_ai_provider has no case for {name}")

        async def chat_completion(self, messages, system_prompt=""):
            return "Stubbed answer."

        async def stream_completion(self, messages, system_prompt=""):
            for tok in ["Stubbed ", "answer."]:
                yield tok

    monkeypatch.setattr(generators, "_provider", lambda: _FakeProvider())
