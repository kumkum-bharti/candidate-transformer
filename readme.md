# Candidate Profile Transformer

A deterministic, multi-source data fusion and transformation pipeline designed to ingest unstructured and semi-structured profile data (CSVs, ATS JSON, GitHub API responses, and Resumes), merge them into a unified canonical schema, resolve formatting conflicts gracefully, and output targeted structural views via configuration files.

## Installation & Setup

Ensure you have Node.js installed in your environment, then execute:

```bash
npm install
npm run build

Running the Tests
To verify the core data normalizers, identity linkers, priority merging heuristics, and end-to-end integration workflows, run the Vitest test suite:

Bash
npx vitest run

Usage
1. Default Pipeline Execution
Run the pipeline against the sample datasets using the default system configuration layout:

npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --explain --out output.json

2. Custom Schema Projection
To dynamically reshape the output object keys or filter properties using an external preset config file:

Bash

npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --config src/config/exampleCustomConfig.ts


Architectural Highlights
Source Adapter Pattern: Input parsers are completely isolated from the core pipeline logic. Adding a new data vendor source only requires registering a single translator map.

Deterministic Conflict Resolution: Conflicting data items are handled through deterministic source priorities (e.g., corporate ATS inputs override unstructured portfolio files for company data), and all overrides are logged explicitly inside an audit array.

Resilient Data Guardrails: Structural schemas validate the integrity of downstream payloads without crashing processing loops on messy real-world data exceptions.