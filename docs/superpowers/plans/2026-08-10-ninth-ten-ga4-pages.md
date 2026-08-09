# Ninth GA4 Priority Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the next ten GA4-backed existing pages and fix Russian CRC-32 correctness.

**Architecture:** A static-page contract test covers review metadata, schema, limitations, links, and responsive ads; a behavioral test executes CRC-32 against its standard check vector. HTML changes remain local to each page.

**Tech Stack:** Static HTML/CSS/JavaScript, Python pytest/unittest, Node.js for JavaScript behavior checks.

## Global Constraints

- Preserve canonical URLs on `https://emfls.github.io`.
- Use review date `2026-08-10` and reevaluation date `2026-09-07`.
- Do not guarantee financial outputs, admission, camping permission, game efficiency, random fairness, uniqueness, or trademark availability.

---

- [ ] Add and run failing page-contract and CRC behavior tests.
- [ ] Improve Russian CRC and Japanese finance calculator.
- [ ] Improve two Korean game guides.
- [ ] Improve Almaty travel, Indonesia/Hungary visa, and Cheorwon camping trust information.
- [ ] Improve Russian team generator and English nickname generator.
- [ ] Update growth log and run focused/full/syntax/link/diff checks.
- [ ] Commit and push main, then inspect Pages deployment.
