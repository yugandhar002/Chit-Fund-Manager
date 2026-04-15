# DECISIONS.md — Architecture Decision Records

## ADR-001: React Native + Expo with SQLite
**Date**: 2026-04-15
**Status**: Accepted
**Context**: Need cross-platform mobile app (Android + iOS) with offline-first local storage.
**Decision**: Use React Native with Expo SDK and expo-sqlite for local database.
**Rationale**: User has prior experience with Expo (wholesale billing app). Expo provides easy cross-platform builds. SQLite gives reliable offline-first storage without needing a backend server.

## ADR-002: Single Organizer, Single Device
**Date**: 2026-04-15
**Status**: Accepted
**Context**: Only the chit fund organizer needs access. No member-facing features needed.
**Decision**: Build as a single-user app with local-only data. No authentication, no cloud sync.
**Rationale**: Simplifies architecture significantly. The organizer is the only user and operates from one phone.
