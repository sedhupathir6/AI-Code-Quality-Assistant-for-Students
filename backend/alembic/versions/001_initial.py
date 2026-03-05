"""initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # We are using sqlite in the MVP for simplicity during hackathon without forcing full docker setup!
    # JSON -> sa.JSON, String -> sa.String
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=True),
        sa.Column('role', sa.String(), server_default='student', nullable=True),
        sa.Column('oauth_provider', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )

    op.create_table('submissions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('original_code', sa.String(), nullable=False),
        sa.Column('time_complexity', sa.String(), nullable=True),
        sa.Column('space_complexity', sa.String(), nullable=True),
        sa.Column('thinking_gap_score', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('cognitive_load', sa.String(), nullable=True),
        sa.Column('detected_patterns', sa.JSON(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('optimizations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('submission_id', sa.String(), nullable=True),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('optimized_code', sa.String(), nullable=False),
        sa.Column('explanation', sa.JSON(), nullable=False),
        sa.Column('time_complexity_after', sa.String(), nullable=True),
        sa.Column('space_complexity_after', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('student_growth',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('xp_points', sa.Integer(), server_default='0', nullable=True),
        sa.Column('badges', sa.JSON(), nullable=True),
        sa.Column('streak_days', sa.Integer(), server_default='0', nullable=True),
        sa.Column('last_active', sa.Date(), nullable=True),
        sa.Column('avg_complexity_score', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('thinking_gap_trend', sa.JSON(), nullable=True),
        sa.Column('concept_mastery', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )

    op.create_table('hint_interactions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('submission_id', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('hint_level', sa.Integer(), nullable=False),
        sa.Column('conceptual_question', sa.String(), nullable=True),
        sa.Column('student_answer', sa.String(), nullable=True),
        sa.Column('passed', sa.Boolean(), server_default='0', nullable=True),
        sa.Column('confidence_before', sa.Integer(), nullable=True),
        sa.Column('confidence_after', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
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
