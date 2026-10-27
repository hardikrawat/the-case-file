# Orchestration Plan: The Case File Remediation & Hardening

## Overview
Remediate 124 feature gaps, 157 bugs, transition to cloud Turso DB, implement security hardening, wire canvas & orphaned panels, complete reputation & collaboration, and establish comprehensive test coverage and quality gates.

## Phase 0: Survey & Scope Mapping
- Spawn 3 Explorers:
  - Explorer 1: Focus on Database & Turso persistence architecture, migrations, schema, Drizzle ORM, and env configuration.
  - Explorer 2: Focus on Auth, Security, Middleware, rate-limiting, SSRF, token leakage, API routes.
  - Explorer 3: Focus on Canvas, Evidence node types (Link node), strings, Zustand state isolation, orphaned panels (CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal), Reputation, and Lineage/Contributions.
- Search for `gap_analysis_report.md` and `bug_analysis_report.md` or extract all issues across code and docs.
- Compile global `PROJECT.md` with Architecture, Feature Inventory, Milestones, and Interface Contracts.

## Phase 1: Dual Track Launch
- **Track 1: E2E Testing Track**
  - Spawn E2E Testing subagent / sub-orchestrator to design test infrastructure, runner, and 4-tier test cases based on user requirements.
  - Generates `TEST_INFRA.md` and upon completion publishes `TEST_READY.md`.
- **Track 2: Implementation Track**
  - **Milestone 1: Turso DB Cloud Persistence & Schema Integrity (R1)**
    - Eliminate in-memory fallbacks, configure Turso client, run migrations/push, ensure indexes & constraints.
  - **Milestone 2: Security Hardening & Auth Protection (R2)**
    - Remove test auth bypasses, fix token leakage, fix SSRF in `/api/preview`, atomic rate limiting, route/middleware protection.
  - **Milestone 3: Canvas Board & Orphaned Panels Wiring (R3)**
    - Add Link Node, node deletion, red string physics/cuts, Zustand board isolation, wire CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal.
  - **Milestone 4: Reputation, Collaboration & Lineage (R4)**
    - Wire reputation updates, collaborator APIs, lineage indicators, fork diff inspection & merge.
  - **Milestone 5: Comprehensive Test Suite & Quality Gates (R5)**
    - Phase 1: Pass 100% of E2E test suite (Tiers 1-4).
    - Phase 2: Adversarial coverage hardening (Tier 5) with Challengers and Workers.

## Phase 2: Final Verification & Audit
- Forensic Integrity Audit (`teamwork_preview_auditor`).
- Lint, typecheck, build, test suite pass.
- Victory Audit submission to Sentinel.
