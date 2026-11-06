import {scenes} from "./scenes.mjs";

const required = 3;
const labels = {clear: "정리 성공", miss: "말려듦"};
const byId = (id) => document.getElementById(id);
const game = byId("game");
const actions = byId("actions");
const title = byId("story-title");
const photo = byId("photo");
const recap = byId("recap");
const progress = [...byId("progress").children];
let current = 0;
let results = [];

function story(tag, heading, copy, tone = "") {
  byId("story-tag").textContent = tag;
  byId("story-tag").dataset.tone = tone;
  title.textContent = heading;
  byId("story-copy").textContent = copy;
  byId("quote").hidden = true;
  recap.hidden = true;
}

function showLine(speaker, line) {
  byId("speaker").textContent = speaker;
  byId("line").textContent = line;
  byId("quote").hidden = false;
}

function updateProgress(finished = false) {
  const score = results.filter((outcome) => outcome === "clear").length;
  byId("score").querySelector("b").textContent = score;
  progress.forEach((step, index) => {
    const outcome = results[index];
    step.dataset.outcome = outcome ?? "";
    step.setAttribute("aria-label", `${index + 1}장 ${outcome ? labels[outcome] : index === current && !finished ? "진행 중" : "대기"}`);
    if (index === current && !finished) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
  byId("chapter-label").textContent = finished ? "최종 결과" : `CH. ${String(current + 1).padStart(2, "0")}`;
  return score;
}

function moveFocus(newScene = false) {
  if (newScene) game.scrollIntoView({block: "start"});
  title.focus({preventScroll: newScene});
}

function button(label, action, number) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = number ? "choice" : "primary";
  if (number) {
    const marker = document.createElement("span");
    marker.textContent = String(number);
    marker.setAttribute("aria-hidden", "true");
    control.append(marker);
  }
  control.append(document.createTextNode(label));
  control.addEventListener("click", action, {once: true});
  return control;
}

function showPhoto(frame, caption) {
  photo.alt = frame.alt;
  photo.src = `./images/${frame.image}`;
  byId("photo-caption").textContent = caption;
}

function chooseFrom(choices, scene) {
  actions.replaceChildren(...choices.map((choice, index) => button(choice.text, () => {
    if (choice.outcome === "retry") {
      story("한 번 더", scene.title, choice.feedback);
      showPhoto(scene.followPhoto, `${scene.place} · 이어지는 대화`);
      showLine(scene.speaker, scene.followup.line);
      chooseFrom(scene.followup.choices, scene);
      moveFocus();
    } else {
      results.push(choice.outcome);
      updateProgress();
      showPhoto(scene.resultPhoto, `${scene.place} · 선택 직후`);
      story("선택 결과", labels[choice.outcome], choice.feedback, choice.outcome);
      const isLast = current + 1 === scenes.length;
      actions.replaceChildren(button(isLast ? "최종 결과 보기" : "다음 장면 →", () => {
        if (isLast) showEnding();
        else {
          current += 1;
          showScene();
        }
      }));
      moveFocus();
    }
  }, index + 1)));
}

function showScene() {
  const scene = scenes[current];
  showPhoto(scene, `${scene.place} · ${scene.time}`);
  for (const frame of [scene.followPhoto, scene.resultPhoto]) {
    new Image().src = `./images/${frame.image}`;
  }
  updateProgress();
  story(scene.place, scene.title, scene.setup);
  showLine(scene.speaker, scene.line);
  chooseFrom(scene.choices, scene);
  moveFocus(true);
}

function showEnding() {
  const score = updateProgress(true);
  const passed = score >= required;
  const heading = score === scenes.length ? "완벽 클리어!" : passed ? "클리어!" : "한 번 더 도전!";
  story("나의 엔딩", heading, `네 장면 중 ${score}개를 정리했어요. ${passed ? "오늘도 내 페이스로 귀가합니다." : "다른 선택으로 이어지는 대화를 다시 만나 보세요."}`, passed ? "clear" : "miss");
  recap.replaceChildren(...scenes.map((scene, index) => {
    const row = document.createElement("li");
    const status = document.createElement("strong");
    status.dataset.outcome = results[index];
    status.textContent = labels[results[index]];
    row.append(scene.place, status);
    return row;
  }));
  recap.hidden = false;
  actions.replaceChildren(button("처음부터 다시 하기", start));
  moveFocus();
}

function start() {
  current = 0;
  results = [];
  showScene();
}

byId("start").addEventListener("click", start, {once: true});
byId("start").disabled = false;
