from pathlib import Path
import subprocess
from html.parser import HTMLParser
from xml.etree import ElementTree

ROOT = Path(__file__).parents[1]
PAGE = ROOT / "game/MarbleFlick/index.html"


def run_node_checks():
    source = PAGE.read_text()
    script = r'''
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(process.argv[1], "utf8");
const js = html.match(/<script>\s*\/\/ ===== Variables & Setup =====([\s\S]*?)<\/script>/)[1];
const elements = {};
const noop = () => {};
function makeElement(id) {
  return elements[id] = { id, style: {}, disabled: false, textContent: "", onclick: null,
    classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop,
    addEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
}
const ctx = new Proxy({}, { get: () => noop });
for (const id of ["board","modeHuman","modeAI","descHuman","descAI","turn","winnerBanner","restartBtn"]) makeElement(id);
elements.board.getContext = () => ctx;
let domReady = null;
const document = { readyState: "loading", getElementById: id => elements[id] || null, querySelector: () => null,
  addEventListener: (name, fn) => { if (name === "DOMContentLoaded") domReady = fn; } };
const storage = { getItem: () => JSON.stringify({ wins: 3, losses: 2, draws: 1 }), setItem: noop, removeItem: noop };
const window = { innerWidth: 360, addEventListener: noop, MarbleFlickTest: null };
let nextTimer = 1; const timers = new Map();
const fakeSetTimeout = (fn) => { const id=nextTimer++; timers.set(id, fn); return id; };
const fakeClearTimeout = (id) => timers.delete(id);
const sandbox = { window, document, localStorage: storage, console, Math, JSON, Number,
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout, requestAnimationFrame: fakeSetTimeout, cancelAnimationFrame: fakeClearTimeout };
vm.runInNewContext(js, sandbox, { filename: "MarbleFlick/index.html" });
const api = sandbox.window.MarbleFlickTest;
if (!api) throw new Error("test API not exposed");
const assert = (value, message) => { if (!value) throw new Error(message); };
assert(api.getState().phase === "READY" && api.getState().turn === 0, "initial state");
assert(api.getState().pieces === 8, "initial pieces");
makeElement("aiStats"); makeElement("resetStatsBtn"); domReady();
assert(elements.aiStats.textContent.includes("Wins: 3") && typeof elements.resetStatsBtn.onclick === "function", "DOMContentLoaded stats binding");
assert(api.determineRoundResult(0, 0) === "draw", "0/0 draw");
assert(api.determineRoundResult(0, 3) === "white", "0/>0 white");
assert(api.determineRoundResult(2, 0) === "black", ">0/0 black");
assert(api.determineRoundResult(2, 2) === null, ">0/>0 continue");
assert(api.normalizeStats({ wins: 2, losses: 1, draws: 3 }).wins === 2, "stats normalize");
assert(api.normalizeStats({ wins: -1, losses: "bad" }).wins === 0, "malformed stats safe default");
api.setState({ aiMode: true, turn: 1, phase: "READY", winner: null, activeMotionCount: 0 });
const scheduledVersion = api.getState().gameVersion; api.scheduleAiMove(0);
const oldAiCallback = [...timers.values()][0]; api.setMode(false); oldAiCallback();
assert(api.getState().phase === "READY" && api.getState().turn === 0 && api.getState().aiMode === false, "actual AI to 2P stale callback");
api.setMode(true); api.setState({ turn: 1, phase: "READY" }); api.scheduleAiMove(0);
const oldRestartCallback = [...timers.values()][0]; api.resetGame(); oldRestartCallback();
assert(api.getState().phase === "READY" && api.getState().turn === 0 && api.getState().activeMotionCount === 0, "actual restart stale callback");
api.setState({ aiMode: true, turn: 1, phase: "ROUND_OVER", winner: "black" }); api.scheduleAiMove(0);
const roundOverCallback = [...timers.values()][0]; roundOverCallback();
assert(api.getState().activeMotionCount === 0, "round-over stale callback");
api.setState({ aiMode: false, turn: 0, phase: "MOVING", winner: null, activeMotionCount: 2, activeShotToken: 9 });
const versionBeforeModeAttempt=api.getState().gameVersion; api.setMode(true);
assert(api.getState().gameVersion === versionBeforeModeAttempt && api.getState().phase === "MOVING", "moving mode toggle changed state");
api.setState({ phase: "READY", activeMotionCount: 0 });
api.setState({ aiMode: true, turn: 1, phase: "READY", winner: null });
const capturedVersion = api.getState().gameVersion; api.scheduleAiMove(0); api.setState({ gameVersion: capturedVersion + 1, aiMode: false });
for (const fn of timers.values()) fn();
setTimeout(() => {
  const stale = api.getState();
  assert(stale.phase === "READY" && stale.activeMotionCount === 0, "stale AI callback mutated state");
  api.setState({ gameVersion: stale.gameVersion, phase: "MOVING", activeMotionCount: 2, activeShotToken: 9, turn: 0, winner: null });
  api.setState({}); api.settleShot(9);
  assert(api.getState().turn === 0, "early settlement changed turn");
  api.setState({ activeMotionCount: 0 }); api.settleShot(9);
  assert(api.getState().turn === 1, "final settlement did not hand off turn");
  api.resetStats(); api.setState({ aiMode: true, roundStatsRecorded: false });
  api.recordAiResult("black"); api.recordAiResult("black");
  assert(api.getState().stats.wins === 1, "winner stats double counted");
  console.log("actual-js-contract-pass");
}, 0);
'''
    result = subprocess.run(["node", "-e", script, str(PAGE)], capture_output=True, text=True, timeout=5)
    assert result.returncode == 0, result.stderr or result.stdout
    assert "actual-js-contract-pass" in result.stdout


def test_marbleflick_actual_js_state_contract():
    run_node_checks()


def test_marbleflick_page_contract():
    text = PAGE.read_text()
    assert text.count("<h1>") == 1
    assert "Marble Flick – 2 Player &amp; AI Browser Game" in text
    assert 'href="/game/">Games</a>' in text and '"name": "Games"' in text
    assert text.count('type="button" class="ai-btn"') == 1
    assert 'aria-pressed="true"' in text and 'aria-pressed="false"' in text
    assert 'aria-label="Marble Flick game board"' in text
    assert 'id="winnerBanner" role="status" aria-live="polite"' in text
    assert 'touchcancel' in text and 'localStorage.clear' not in text
    assert 'AI record is stored only in this browser on this device.' in text
    assert '"@type":"VideoGame"' in text and '"dateModified":"2026-09-21"' in text
    assert '"@type": "FAQPage"' not in text
    assert 'window.location.href=\'../\'' not in text


def test_marbleflick_rss_item_matches_page_metadata():
    class Metadata(HTMLParser):
        def __init__(self): super().__init__(); self.title=""; self.description=""; self.in_title=False
        def handle_starttag(self, tag, attrs):
            attrs=dict(attrs)
            if tag == "title": self.in_title=True
            if tag == "meta" and attrs.get("name") == "description": self.description=attrs["content"]
        def handle_endtag(self, tag):
            if tag == "title": self.in_title=False
        def handle_data(self, data):
            if self.in_title: self.title += data
    metadata=Metadata(); metadata.feed(PAGE.read_text())
    canonical="https://emfls.github.io/game/MarbleFlick/"
    items=[item for item in ElementTree.parse(ROOT/"feed.xml").getroot().iter("item") if item.findtext("link") == canonical]
    assert len(items) == 1
    item=items[0]
    assert item.findtext("title") == metadata.title
    assert item.findtext("description") == metadata.description
    assert item.findtext("guid") == canonical
    assert item.findtext("pubDate") == "Mon, 21 Sep 2026 00:00:00 +0000"
