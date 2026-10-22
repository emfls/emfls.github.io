import os
import plistlib
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.skipif(sys.platform != "darwin", reason="the launcher requires macOS /bin/zsh")
def test_run_local_ops_requires_an_explicit_absolute_ops_dir():
    env = os.environ.copy()
    env.pop("EMFLS_OPS_DIR", None)
    result = subprocess.run(
        ["/bin/zsh", str(ROOT / "scripts/run_local_ops.sh"), "ga4"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 78
    assert "Set EMFLS_OPS_DIR" in result.stderr


def test_launchd_templates_target_the_current_installation_and_keep_schedule():
    expected_minutes = {
        "keyword-hunter": (10, 17),
        "adsense": (10, 47),
        "ga4": (11, 17),
        "gsc": (11, 47),
        "derived-measurement": (12, 17),
    }
    templates = ROOT / "ops/launchd"
    assert {path.name for path in templates.glob("*.plist")} == {
        f"com.emfls.ops.{task}.plist" for task in expected_minutes
    }
    for task, (hour, minute) in expected_minutes.items():
        path = templates / f"com.emfls.ops.{task}.plist"
        plist = plistlib.loads(path.read_bytes())
        ops_dir = plist["EnvironmentVariables"]["EMFLS_OPS_DIR"]
        launcher = plist["ProgramArguments"][1]
        assert Path(ops_dir).is_absolute()
        assert ops_dir == "/Users/whitesmile/Developer/emfls-ops"
        assert Path(launcher).is_absolute()
        assert launcher == "/Users/whitesmile/Developer/emfls.github.io/scripts/run_local_ops.sh"
        assert Path(plist["StandardOutPath"]).is_absolute()
        assert plist["StandardOutPath"].startswith(f"{ops_dir}/logs/")
        assert Path(plist["StandardErrorPath"]).is_absolute()
        assert plist["StandardErrorPath"].startswith(f"{ops_dir}/logs/")
        assert (plist["StartCalendarInterval"]["Hour"], plist["StartCalendarInterval"]["Minute"]) == (hour, minute)
