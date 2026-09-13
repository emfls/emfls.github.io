"""Editorial decisions are separate from measured keyword state."""
import json
try:
    from .content_launch_policy import normalize_keyword
except ImportError:
    from content_launch_policy import normalize_keyword

def load_decisions(path):
    try:
        data=json.loads(path.read_text(encoding='utf-8'))
        return {normalize_keyword(x.get('keyword')): x.get('decision') for x in data.get('decisions',[]) if isinstance(x,dict) and x.get('decision') in {'HOLD','APPROVE'}}
    except (OSError, ValueError, TypeError):
        return {}
