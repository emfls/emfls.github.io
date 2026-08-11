from pathlib import Path
from typing import Optional

from scripts.generate_english_travel_links import (
    CountryGroup,
    TravelPage,
    apply_generated_block,
    collect_pages,
    country_slug,
    group_by_country,
    related_pages,
    render_country_hub,
    render_related_block,
)


def write_travel_page(root: Path, filename: str, *, country: Optional[str], city: str) -> Path:
    page = root / "report" / "travel" / filename
    page.parent.mkdir(parents=True, exist_ok=True)
    address = f'"addressCountry": "{country}"' if country else ""
    page.write_text(
        f'''<!doctype html><html lang="en"><head>
        <title>{city} Travel Guide</title>
        <link rel="canonical" href="https://emfls.github.io/report/travel/{filename}">
        <script type="application/ld+json">{{"about":{{"name":"{city}","address":{{{address}}}}}}}</script>
        </head><body><h1>{city} Travel Guide</h1><footer>Footer</footer></body></html>''',
        encoding="utf-8",
    )
    return page


def test_collect_pages_prefers_structured_country_and_uses_known_prefix_fallback(tmp_path):
    write_travel_page(tmp_path, "united-arab-emirates-dubai.html", country="United Arab Emirates", city="Dubai")
    write_travel_page(tmp_path, "united-arab-emirates-abu-dhabi.html", country=None, city="Abu Dhabi")

    pages, exceptions = collect_pages(tmp_path)

    assert [(page.country, page.city) for page in pages] == [
        ("United Arab Emirates", "Abu Dhabi"),
        ("United Arab Emirates", "Dubai"),
    ]
    assert exceptions == []


def test_country_slug_normalizes_spaces_and_punctuation():
    assert country_slug("Côte d’Ivoire") == "cote-d-ivoire"


def test_group_and_related_pages_stay_in_country_and_wrap_deterministically():
    pages = [
        TravelPage(Path(f"usa-{city}.html"), f"USA {city}", "USA", city, f"https://emfls.github.io/report/travel/usa-{city}.html")
        for city in ("Austin", "Boston", "Chicago", "Denver", "Erie")
    ]
    pages.append(
        TravelPage(Path("canada-toronto.html"), "Canada Toronto", "Canada", "Toronto", "https://emfls.github.io/report/travel/canada-toronto.html")
    )

    groups = group_by_country(pages)
    related = related_pages(groups["USA"][4], groups["USA"])

    assert list(groups) == ["Canada", "USA"]
    assert [page.city for page in related] == ["Austin", "Boston", "Chicago"]
    assert all(page.country == "USA" for page in related)


def test_render_related_block_contains_static_same_country_links_only():
    chicago = TravelPage(Path("report/travel/usa-chicago.html"), "Chicago Guide", "USA", "Chicago", "https://emfls.github.io/report/travel/usa-chicago.html")
    boston = TravelPage(Path("report/travel/usa-boston.html"), "Boston Guide", "USA", "Boston", "https://emfls.github.io/report/travel/usa-boston.html")

    block = render_related_block(chicago, [boston])

    assert 'href="https://emfls.github.io/report/travel/"' in block
    assert 'href="https://emfls.github.io/report/travel/country/usa/"' in block
    assert 'href="https://emfls.github.io/report/travel/usa-boston.html"' in block
    assert "/jp/" not in block
    assert "/kor/" not in block


def test_apply_generated_block_replaces_existing_block_without_duplication():
    original = "<html><body><main>Guide</main><footer>Footer</footer></body></html>"
    first = apply_generated_block(original, "travel-related", "<section>Links</section>", "<footer")
    second = apply_generated_block(first, "travel-related", "<section>New links</section>", "<footer")

    assert second.count("emfls:travel-related:start") == 1
    assert second.count("emfls:travel-related:end") == 1
    assert "<section>Links</section>" not in second
    assert second.index("<section>New links</section>") < second.index("<footer")


def test_render_country_hub_paginates_at_one_hundred_static_city_links():
    pages = tuple(
        TravelPage(
            Path(f"report/travel/usa-city-{index:03d}.html"),
            f"City {index:03d} Guide",
            "USA",
            f"City {index:03d}",
            f"https://emfls.github.io/report/travel/usa-city-{index:03d}.html",
        )
        for index in range(101)
    )
    group = CountryGroup("USA", "usa", pages)

    first = render_country_hub(group, 1)
    second = render_country_hub(group, 2)

    assert first.count('class="travel-city-link"') == 100
    assert second.count('class="travel-city-link"') == 1
    assert 'href="https://emfls.github.io/report/travel/country/usa/page/2/"' in first
    assert '<link rel="canonical" href="https://emfls.github.io/report/travel/country/usa/page/2/">' in second
