"""Editorial decisions are separate from measured keyword state."""
import json
from pathlib import Path
try:
    from .content_launch_policy import normalize_keyword
except ImportError:
    from content_launch_policy import normalize_keyword


def decisions_from_document(data):
    """Return exact editorial decisions, applying only explicitly reviewed HOLD aliases."""
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('decisions'), list):
        raise ValueError('invalid content-launch decisions schema')
    decisions = {}
    hold_aliases = set()
    allowed = {'HOLD', 'NO_NEW_PAGE', 'UPDATE_EXISTING', 'APPROVE'}
    for row in data['decisions']:
        if not isinstance(row, dict):
            raise ValueError('invalid content-launch decision row')
        keyword = normalize_keyword(row.get('keyword'))
        decision = row.get('decision')
        if not keyword or decision not in allowed:
            raise ValueError('invalid content-launch decision')
        if keyword in decisions and decisions[keyword] != decision:
            raise ValueError('conflicting content-launch decisions')
        decisions[keyword] = decision

        if 'holdAliases' not in row:
            continue
        aliases = row['holdAliases']
        if decision != 'HOLD' or not isinstance(aliases, list):
            raise ValueError('hold aliases require a HOLD decision and a list')
        row_aliases = set()
        for value in aliases:
            if not isinstance(value, str):
                raise ValueError('invalid content-launch hold alias')
            alias = normalize_keyword(value)
            if not alias or alias == keyword or alias in row_aliases:
                raise ValueError('invalid or duplicate content-launch hold alias')
            row_aliases.add(alias)
        hold_aliases.update(row_aliases)

    for alias in hold_aliases:
        if alias in decisions and decisions[alias] != 'HOLD':
            raise ValueError('conflicting content-launch hold alias')
        decisions[alias] = 'HOLD'
    return decisions


def load_decisions(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError) as exc:
        raise ValueError('content-launch decisions are unavailable') from exc
    return decisions_from_document(data)
