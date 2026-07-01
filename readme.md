# Candidate Profile Transformer

Merges candidate data from multiple sources (Recruiter CSV, ATS JSON, GitHub, Resume) 
into one clean, confidence-scored, traceable record per candidate.

## Setup

Requires Node.js 18+.

```bash
npm install
```

## Running the Pipeline

**Default output (all four sources):**
```bash
npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --github samples/github_profile.json --resume samples/resume_kumkum.txt --explain --out output.json

```

**Custom config output:**
```bash
npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --config src/config/exampleCustomConfig.json

```

**Custom config with all sources:**
```bash
npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --github samples/github_profile.json --resume samples/resume_kumkum.txt --config src/config/exampleCustomConfig.json --explain

```

**Flags:**

| Flag | Description |
|---|---|
| `--csv` | Recruiter CSV export path |
| `--ats` | ATS JSON export path |
| `--github` | Local fixture (.json) or live GitHub username |
| `--resume` | Resume file (.txt / .pdf / .docx) |
| `--config` | Custom projection config JSON (optional) |
| `--explain` | Appends conflict audit log to output |
| `--out` | Write output to file instead of stdout |

## Running Tests

```bash
npx vitest run
```

Covers phone/date/skill normalization, the CSV-vs-ATS conflict resolution case, 
and a full pipeline integration run against the sample inputs.

## Adding a New Source

Each source is a self-contained adapter implementing one function:

```typescript
export const myAdapter: SourceAdapter = {
  name: "my_source",
  extract(rawInput: unknown): ExtractedField[] {
    // parse rawInput, return one ExtractedField per value found
    // catch all errors internally and return [] instead of throwing
  }
};
```

Register it in `src/adapters/registry.ts` and pass it to the CLI via a new flag.
Nothing else in the pipeline changes — normalize, merge, project, and validate 
are all source-agnostic.

## Custom Config Format

```json
{
  "fields": {
    "full_name": { "from": "full_name", "type": "string", "required": true },
    "primary_email": { "from": "emails[0]", "type": "string", "required": true },
    "phone": { "from": "phones[0]", "type": "string", "required": false, "normalize": "phone" },
    "skills": { "from": "skills[].name", "type": "array", "required": false, "normalize": "skill" }
  },
  "include_provenance": true,
  "include_confidence": true,
  "on_missing": "null"
}
```

The runtime schema is defined in [src/config/projectionTypes.ts](src/config/projectionTypes.ts).
`from` remaps a canonical field to an output path, `normalize` is optional, and `on_missing` controls 
behavior when a value is absent: `null`, `omit`, or `error`.

One implementation note: parsing wildcard paths like `skills[].name` required writing 
a small custom path evaluator — using a full JSONPath library felt like overkill for 
this scope but the edge cases (nested arrays, mixed null values) were genuinely fiddly 
to handle cleanly. Config files are pure JSON rather than TypeScript modules; 
dynamically importing `.ts` configs caused transpilation and path resolution issues 
on Windows that JSON + Zod validation sidesteps entirely.

## Edge Cases Handled

- Email missing or inconsistent across sources → falls back to name+phone as match key; 
  confidence is lower on that candidate. Note: this can incorrectly merge two people 
  with the same name and phone — acceptable for this scope, called out explicitly.
- Corrupted or unreadable resume → adapter returns `[]`, pipeline continues with 
  remaining sources.
- Conflicting `current_company` between CSV and ATS → CSV/ATS win for identity fields 
  (usually HR-verified data); resume/GitHub win for skills (richer signal). 
  Both values are kept in the conflict log, visible via `--explain`.
- Same skill in different forms across sources ("JS", "javascript") → collapsed into 
  one canonical entry via alias map; confidence is combined not duplicated.
- Candidate in only one source → confidence reflects single-source uncertainty 
  rather than defaulting high.

## Assumptions and Out of Scope

- Match key assumes email is unique per candidate. No fuzzy/ML-based name matching.
- No persistent storage — each pipeline run is stateless.
- Confidence decay by data age not implemented (no reliable timestamp in sample data).
- Not optimized for truly large-scale dedup beyond a few thousand records.