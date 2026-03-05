import os

base = r"c:/Users/Sedhupathi/Desktop/technano/backend"

def write_file(path, content):
    full_path = os.path.join(base, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

write_file("alembic.ini", """[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = postgresql+asyncpg://cce_user:cce_pass@postgres:5432/cce_db
[loggers]
keys = root,sqlalchemy,alembic
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
qualname =
[logger_sqlalchemy]
level = WARN
handlers = console
qualname = sqlalchemy.engine
[logger_alembic]
level = INFO
handlers = console
qualname = alembic
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
""")

write_file("alembic/env.py", """import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from core.database import Base
from models import user, submission, optimization, student_growth, hint_interaction
target_metadata = Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
""")

write_file("alembic/script.py.mako", '''"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}

def upgrade() -> None:
    ${upgrades if upgrades else "pass"}

def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
''')

write_file("alembic/versions/001_initial.py", '''"""initial

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Users
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=True),
        sa.Column('role', sa.String(), server_default='student', nullable=True),
        sa.Column('oauth_provider', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )

    # Submissions
    op.create_table('submissions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('original_code', sa.String(), nullable=False),
        sa.Column('time_complexity', sa.String(), nullable=True),
        sa.Column('space_complexity', sa.String(), nullable=True),
        sa.Column('thinking_gap_score', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('cognitive_load', sa.String(), nullable=True),
        sa.Column('detected_patterns', JSONB(), server_default='[]', nullable=True),
        sa.Column('submitted_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Optimizations
    op.create_table('optimizations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('submission_id', sa.String(), nullable=True),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('optimized_code', sa.String(), nullable=False),
        sa.Column('explanation', JSONB(), nullable=False),
        sa.Column('time_complexity_after', sa.String(), nullable=True),
        sa.Column('space_complexity_after', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Student Growth
    op.create_table('student_growth',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('xp_points', sa.Integer(), server_default='0', nullable=True),
        sa.Column('badges', JSONB(), server_default='[]', nullable=True),
        sa.Column('streak_days', sa.Integer(), server_default='0', nullable=True),
        sa.Column('last_active', sa.Date(), nullable=True),
        sa.Column('avg_complexity_score', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('thinking_gap_trend', JSONB(), server_default='[]', nullable=True),
        sa.Column('concept_mastery', JSONB(), server_default='{"arrays":0,"hashmaps":0,"recursion":0,"sorting":0,"dp":0,"trees":0,"graphs":0}', nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )

    # Hint Interactions
    op.create_table('hint_interactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('submission_id', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('hint_level', sa.Integer(), nullable=False),
        sa.Column('conceptual_question', sa.String(), nullable=True),
        sa.Column('student_answer', sa.String(), nullable=True),
        sa.Column('passed', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('confidence_before', sa.Integer(), nullable=True),
        sa.Column('confidence_after', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('hint_interactions')
    op.drop_table('student_growth')
    op.drop_table('optimizations')
    op.drop_table('submissions')
    op.drop_table('users')
''')

print("Alembic setup complete.")
