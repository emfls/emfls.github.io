"""Editorial decisions are separate from measured keyword state."""
import json
from pathlib import Path
try:
    from .content_launch_policy import normalize_keyword
except ImportError:
    from content_launch_policy import normalize_keyword

def load_decisions(path):
    try:
        data=json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError) as exc:
        raise ValueError('content-launch decisions are unavailable') from exc
    if not isinstance(data,dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('decisions'),list):
        raise ValueError('invalid content-launch decisions schema')
    decisions={}
    allowed={'HOLD','NO_NEW_PAGE','UPDATE_EXISTING','APPROVE'}
    for row in data['decisions']:
        if not isinstance(row,dict):
            raise ValueError('invalid content-launch decision row')
        keyword=normalize_keyword(row.get('keyword'))
        decision=row.get('decision')
        if not keyword or decision not in allowed:
            raise ValueError('invalid content-launch decision')
        if keyword in decisions and decisions[keyword] != decision:
            raise ValueError('conflicting content-launch decisions')
        decisions[keyword]=decision
    return decisions
