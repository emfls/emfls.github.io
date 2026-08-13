from pathlib import Path


PAGE = Path("kor/report/visa/romania.html")


def test_romania_page_answers_the_main_search_question_first():
    html = PAGE.read_text(encoding="utf-8")

    assert "루마니아 비자 필요할까?" in html
    assert "한국인은 관광 비자가 필요하지 않습니다" in html
    assert "솅겐 전체에서 최근 180일 중 합산 90일" in html
    assert "https://eviza.mae.ro/LongStayVisa" in html
    assert "South Korea" in html


def test_romania_page_avoids_unverified_fixed_amounts_and_timelines():
    html = PAGE.read_text(encoding="utf-8")

    assert "약 2,500 USD" not in html
    assert "평균 임금의 1.5배" not in html
    assert "단기 비자는 보통 15일 이내" not in html
    assert "입국을 보장하지 않습니다" in html
    assert "광고를 클릭" not in html
