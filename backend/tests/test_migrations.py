import os

import pytest

# Needs the alembic package; skip cleanly where it isn't installed.
pytest.importorskip("alembic")
from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _script_dir() -> ScriptDirectory:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    return ScriptDirectory.from_config(cfg)


# Regression: the migration chain used to have a single revision (0002) whose
# down_revision was None and which add_column'd tables nothing created — so
# `alembic upgrade head` on a fresh DB crashed ("relation documents does not
# exist"). A 0001 baseline now creates the schema and 0002 revises it. These
# tests assert the chain stays bootstrappable from base to a single head.
def test_single_head():
    assert len(_script_dir().get_heads()) == 1, "multiple alembic heads — chain has diverged"


def test_chain_resolves_from_head_to_base():
    s = _script_dir()
    revs = list(s.walk_revisions())  # head -> base
    ids = {r.revision for r in revs}
    for r in revs:
        for down in (r._all_down_revisions or ()):
            assert down in ids, f"revision {r.revision} points at missing down_revision {down!r}"
    assert s.get_bases(), "no base revision — nothing creates the initial schema"


def test_baseline_present_and_head_is_chunks_migration():
    s = _script_dir()
    rev_ids = {r.revision for r in s.walk_revisions()}
    assert "0001" in rev_ids, "missing 0001 baseline that creates the ORM tables"
    assert list(s.get_heads()) == ["0002"], "head should be 0002 (pgvector/FTS on chunks)"
