from pathlib import Path
from typing import Optional

from scripts.generate_english_travel_links import (
    CountryGroup,
    TravelPage,
    apply_generated_block,
    build_country_groups,
    collect_pages,
    country_slug,
    generate,
    group_by_country,
    related_pages,
    render_country_hub,
    render_related_block,
    validate_generated_links,
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


def test_build_country_groups_merges_localized_country_aliases_by_file_prefix():
    pages = [
        TravelPage(Path("report/travel/romania-brasov.html"), "Brasov", "루마니아", "Brasov", "https://emfls.github.io/report/travel/romania-brasov.html"),
        TravelPage(Path("report/travel/romania-bucharest.html"), "Bucharest", "Romania", "Bucharest", "https://emfls.github.io/report/travel/romania-bucharest.html"),
    ]

    groups = build_country_groups(pages)

    assert [(group.country, group.slug, len(group.pages)) for group in groups] == [("Romania", "romania", 2)]
    assert {page.country for page in groups[0].pages} == {"Romania"}


def test_render_related_block_contains_static_same_country_links_only():
    chicago = TravelPage(Path("report/travel/usa-chicago.html"), "Chicago Guide", "USA", "Chicago", "https://emfls.github.io/report/travel/usa-chicago.html")
    boston = TravelPage(Path("report/travel/usa-boston.html"), "Boston Guide", "USA", "Boston", "https://emfls.github.io/report/travel/usa-boston.html")

    block = render_related_block(chicago, [boston])

    assert 'href="https://emfls.github.io/report/travel/"' in block
    assert 'href="https://emfls.github.io/report/travel/country/usa/"' in block
    assert 'href="https://emfls.github.io/report/travel/usa-boston.html"' in block
    assert "/jp/" not in block
    assert "/kor/" not in block


def test_render_related_block_uses_group_slug_for_localized_country_metadata():
    page = TravelPage(Path("report/travel/qatar-doha.html"), "Doha Guide", "Qatar", "Doha", "https://emfls.github.io/report/travel/qatar-doha.html")
    group = CountryGroup("Qatar", "qatar", (page,))

    block = render_related_block(page, [], group)

    assert 'href="https://emfls.github.io/report/travel/country/qatar/"' in block


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


def test_generate_builds_hubs_and_is_idempotent_in_check_mode(tmp_path):
    travel = tmp_path / "report" / "travel"
    travel.mkdir(parents=True)
    (travel / "index.html").write_text(
        '<!doctype html><html lang="en"><head><link rel="canonical" href="https://emfls.github.io/report/travel/"></head><body><main>Travel</main></body></html>',
        encoding="utf-8",
    )
    for city in ("Austin", "Boston", "Chicago", "Denver"):
        write_travel_page(tmp_path, f"usa-{city.lower()}.html", country="USA", city=city)

    first = generate(tmp_path)
    second = generate(tmp_path, check=True)

    assert first.pages == 4
    assert first.countries == 1
    assert first.changed_files == 7
    assert second.changed_files == 0
    hub = travel / "country" / "usa" / "index.html"
    assert hub.exists()
    assert hub.read_text(encoding="utf-8").count('class="travel-city-link"') == 4
    chicago = (travel / "usa-chicago.html").read_text(encoding="utf-8")
    assert chicago.count("emfls:travel-related:start") == 1
    assert chicago.count("travel guide</a>") >= 3


def test_validate_generated_links_reports_missing_internal_target(tmp_path):
    travel = tmp_path / "report" / "travel"
    travel.mkdir(parents=True)
    (travel / "index.html").write_text("<html><body></body></html>", encoding="utf-8")
    write_travel_page(tmp_path, "usa-austin.html", country="USA", city="Austin")
    write_travel_page(tmp_path, "usa-boston.html", country="USA", city="Boston")
    generate(tmp_path)
    (travel / "usa-boston.html").unlink()

    missing = validate_generated_links(tmp_path)

    assert any(target.endswith("report/travel/usa-boston.html") for _, target in missing)
