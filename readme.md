# Candidate Profile Transformer

A deterministic pipeline that merges candidate data from multiple structured and unstructured sources (Recruiter CSV, ATS JSON, GitHub profiles, Resumes) into one clean, confidence-scored, fully-traceable candidate record.

Built for the Eightfold Engineering Intern assignment.

## Project Structure

```
src/
├── adapters/         Source-specific parsers (CSV, ATS JSON, GitHub, Resume)
│   └── registry.ts   Central adapter registration point
├── config/           Default output schema + example custom projection config
├── pipeline/
│   ├── normalize.ts  Phone/date/country/skill normalization
│   ├── merge.ts       Candidate matching, conflict resolution, confidence scoring
│   ├── project.ts     Runtime config-driven output projection
│   ├── validate.ts    Output schema validation
│   └── index.ts       Pipeline orchestration
└── cli.ts             Command-line entry point
```

## Setup

Requires Node.js 18+.

```bash
npm install
npm run build
```

## Usage

**Default output:**
```bash
npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --github samples/github_profile.json --resume samples/resume_kumkum.txt --explain
```

**Custom config output:**
```bash
npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --config src/config/exampleCustomConfig.json
```

| Flag | Description |
|---|---|
| `--csv <path>` | Recruiter CSV export |
| `--ats <path>` | ATS JSON export |
| `--github <path-or-username>` | Local fixture or live GitHub username |
| `--resume <path>` | Resume file (.txt / .pdf / .docx) |
| `--config <path>` | Custom projection config (defaults to the full canonical schema) |
| `--explain` | Includes the internal conflict log in output |
| `--out <path>` | Writes output to a file instead of stdout |

## Tests

```bash
npx vitest run
```

Covers normalization functions, the conflict-resolution policy (including the CSV-vs-ATS `current_company` conflict case), and a full pipeline integration run against the sample inputs.

## Design Decisions

**Source adapters.** Each source implements a single `extract()` function and self-registers in `registry.ts`. Every later pipeline stage only ever consumes the common `ExtractedField` shape — never raw CSV rows, JSON keys, or PDF text. Adding a new source means writing one adapter file, with no changes elsewhere in the pipeline.

**Conflict resolution.** Identity fields (name, title, company) are resolved in favor of structured sources (CSV, ATS), since that data is typically HR-verified. Skills are resolved in favor of unstructured sources (resume, GitHub), since those carry the real skill signal. List fields (emails, phones, links) are unioned and deduplicated rather than picking a single winner. Every override is recorded in an internal conflict log (visible via `--explain`), so no resolved value is silently irreversible.

**Identity matching.** Candidates are matched primarily by lowercased, trimmed email. If email is missing or inconsistent, the matcher falls back to normalized full name + phone — a stated scope limitation, not a guarantee against false matches.

**Config-driven projection.** The internal canonical record is always fully populated and never mutated. A separate projection step applies the runtime config (field selection, renaming, per-field normalization, provenance/confidence toggles, missing-value behavior) to a copy of the record before validation.

## Edge Cases Handled

- Missing/conflicting email across sources → falls back to name+phone match, lower confidence
- Corrupted or unreadable resume → adapter returns no fields, pipeline continues with remaining sources
- Conflicting `current_company` between CSV and ATS → resolved via priority policy, both values retained in the conflict log
- Same skill written differently across sources → canonicalized via alias map into a single entry
- Candidate present in only one source → confidence reflects single-source uncertainty

## Out of Scope

Fuzzy/ML-based identity resolution, persistent storage, confidence decay by data age, and large-scale dedup optimization beyond a few thousand candidates. Left out deliberately under the assignment's time constraints.