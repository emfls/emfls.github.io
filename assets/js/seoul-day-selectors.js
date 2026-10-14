(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SeoulDaySelectors = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const sealalaHours = {
    sauna: { weekday: "월·목·금 07:00–21:00", weekend: "주말·공휴일 07:00–22:00" },
    jjimjil: "주말·공휴일 07:00–21:30",
    waterpark: "주말·공휴일 10:00–19:00 (오후권 15:00–19:00)",
  };

  function saunaPlan({ venue, day, service }) {
    const weekend = day === "weekend";
    const holiday = day === "holiday";
    const weekendOrHoliday = weekend || holiday;

    if (!new Set(["sealalala", "clubkseoul"]).has(venue)) {
      return { available: false, message: "시설을 선택해 주세요." };
    }
    if (!new Set(["sauna", "jjimjil", "waterpark"]).has(service)) {
      return { available: false, message: "이용 목적을 선택해 주세요." };
    }

    if (venue === "sealalala") {
      if (service === "waterpark") {
        if (!weekendOrHoliday) return { available: false, message: "씨랄라 워터파크는 공식 안내상 주말·공휴일 운영입니다." };
        return {
          available: true,
          hours: sealalaHours.waterpark,
          price: "종일권 성인 60,000원·어린이 50,000원 / 오후권 성인 50,000원·어린이 40,000원",
          note: "워터파크 이용객 찜질방 입장료 무료 안내가 있습니다. 운영·요금은 방문 전 공식 페이지에서 다시 확인하세요.",
        };
      }
      if (service === "jjimjil") {
        if (!weekendOrHoliday) return { available: false, message: "씨랄라 찜질방은 공식 안내상 주말·공휴일 운영입니다." };
        return {
          available: true,
          hours: sealalaHours.jjimjil,
          price: "입장 성인 10,000원·어린이 9,000원 + 찜질복 성인 5,000원·어린이 3,000원",
          note: "찜질복이 별도 요금으로 표시되어 있습니다. 방문 전 공식 페이지에서 확인하세요.",
        };
      }
      if (day === "tuesday" || day === "wednesday") {
        return { available: false, message: "씨랄라 사우나는 화·수요일 휴장으로 안내되어 있습니다." };
      }
      return {
        available: true,
        hours: weekendOrHoliday ? sealalaHours.sauna.weekend : sealalaHours.sauna.weekday,
        price: "성인 10,000원·어린이 9,000원",
        note: "사우나 이용은 찜질방 의류 제공과 구분됩니다. 방문 전 공식 페이지에서 확인하세요.",
      };
    }

    if (service === "waterpark") {
      return { available: false, message: "클럽K 서울 공식 이용 안내에는 워터파크 상품이 없습니다." };
    }
    if (service === "sauna") {
      return {
        available: true,
        hours: "연중무휴 24시간",
        price: "사우나 성인 13,000원·미취학 아동 9,000원",
        note: "사우나권은 찜질복 별도입니다. 주차 지원은 성인 5시간·미취학 아동 3시간으로 안내됩니다.",
      };
    }
    if (holiday) {
      return {
        available: true,
        hours: "연중무휴 24시간",
        price: "공휴일 요금은 공식 페이지에서 별도 확인 필요",
        note: "공식 요금표는 평일·주말 요금을 구분합니다. 공휴일 가격을 주말 가격으로 가정하지 않았습니다.",
      };
    }
    return {
      available: true,
      hours: "연중무휴 24시간",
      price: weekend ? "찜질방 성인 19,000원·미취학 아동 12,000원" : "찜질방 성인 17,000원·미취학 아동 12,000원",
      note: weekend ? "주말 요금 기준입니다. 주차 지원은 성인 12시간·미취학 아동 6시간으로 안내됩니다." : "평일 요금 기준입니다. 주차 지원은 성인 12시간·미취학 아동 6시간으로 안내됩니다.",
    };
  }

  const museums = {
    national: {
      name: "국립중앙박물관 어린이박물관",
      hours: "매일 09:30–17:20, 회차제 운영",
      price: "무료",
      booking: "온라인 사전 예약",
      url: "https://mvcm.museum.go.kr/MUSEUM/contents/M0104090000.do",
    },
    seoul: {
      name: "서울상상나라",
      hours: "10:00–18:00 (입장 마감 17:00), 월요일 휴관",
      price: "36개월 이상 4,000원, 36개월 미만 무료 안내",
      booking: "개인 관람 사전 예약, 방문 전날까지 예약 가능 안내",
      url: "https://www.seoulchildrensmuseum.org/reservation/individualregistration.do",
    },
  };

  function familyPlan({ date, preference, today }) {
    const todayText = today || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const eventDates = new Set(["2026-10-17", "2026-10-18"]);
    const eventEligible = eventDates.has(date) && date >= todayText;
    const plans = [];
    if ((preference === "outdoor" || preference === "either") && eventEligible) {
      plans.push({
        name: "2026 한강페스티벌 가을 — 가족 프로그램",
        hours: "2026년 10월 17–18일, 광나루·잠원한강공원 행사별 일정",
        price: "무료 안내",
        booking: "현장 참여 프로그램 포함. 프로그램별 참여 조건과 운영 여부는 공식 공지 확인",
        url: "https://hangang.seoul.go.kr/www/eventMng/detail.do?evntSn=463&mid=538",
      });
    }
    if (preference !== "outdoor") plans.push(museums.national);
    if (preference !== "outdoor") plans.push(museums.seoul);
    if (!plans.length) {
      return {
        plans: [museums.national, museums.seoul],
        note: eventDates.has(date)
          ? "해당 행사 날짜가 지났습니다. 아래 상설 박물관의 운영·예약 페이지에서 방문일 정보를 확인하세요."
          : "선택한 날짜에는 이 행사 안내에 포함된 한강페스티벌 일정이 없습니다. 아래 박물관 선택지를 확인하세요.",
      };
    }
    return {
      plans,
      note: eventEligible && preference !== "indoor"
        ? "행사 일정은 날짜별이며 실시간 인원·취소 여부를 확인하지 않습니다. 출발 전에 공식 공지를 확인하세요."
        : "운영일, 회차, 예약 잔여석은 실시간으로 조회하지 않습니다. 방문 전에 공식 예약 화면을 확인하세요.",
    };
  }

  return { saunaPlan, familyPlan };
});
