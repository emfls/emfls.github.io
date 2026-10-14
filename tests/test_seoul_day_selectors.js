const test = require("node:test");
const assert = require("node:assert/strict");
const { saunaPlan, familyPlan } = require("../assets/js/seoul-day-selectors.js");

test("SeaLaLa sauna is closed Tuesday and Wednesday", () => {
  for (const day of ["tuesday", "wednesday"]) {
    assert.equal(saunaPlan({ venue: "sealalala", day, service: "sauna" }).available, false);
  }
});

test("SeaLaLa jjimjil and waterpark are only offered on weekends or holidays", () => {
  assert.equal(saunaPlan({ venue: "sealalala", day: "friday", service: "jjimjil" }).available, false);
  assert.equal(saunaPlan({ venue: "sealalala", day: "monday", service: "waterpark" }).available, false);
  assert.equal(saunaPlan({ venue: "sealalala", day: "weekend", service: "jjimjil" }).available, true);
});

test("Club K does not assume holiday jjimjil pricing equals weekend pricing", () => {
  const result = saunaPlan({ venue: "clubkseoul", day: "holiday", service: "jjimjil" });
  assert.equal(result.available, true);
  assert.match(result.price, /별도 확인/);
  assert.match(result.note, /가정하지 않았습니다/);
});

test("Family selector includes the dated event only on a future festival date", () => {
  const result = familyPlan({ date: "2026-10-17", preference: "either", today: "2026-10-14" });
  assert.ok(result.plans.some(plan => plan.name.includes("한강페스티벌")));
  const expired = familyPlan({ date: "2026-10-17", preference: "outdoor", today: "2026-10-19" });
  assert.ok(!expired.plans.some(plan => plan.name.includes("한강페스티벌")));
  assert.match(expired.note, /지났습니다/);
});

test("Family selector retains museum options outside the festival dates", () => {
  const result = familyPlan({ date: "2026-11-01", preference: "either", today: "2026-10-14" });
  assert.equal(result.plans.length, 2);
  assert.ok(result.plans.some(plan => plan.name.includes("국립중앙박물관")));
  assert.ok(result.plans.some(plan => plan.name.includes("서울상상나라")));
});
