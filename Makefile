.PHONY: keywords keywords-dry-run test-keywords
keywords:
	python3 scripts/keyword_hunter.py
keywords-dry-run:
	python3 scripts/keyword_hunter.py --dry-run
test-keywords:
	python3 -m pytest tests/test_keyword_hunter*.py -q
