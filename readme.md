Candidate Profile Transformer

A deterministic, multi-source data fusion and transformation engine. This pipeline ingests fractured candidate profile data across multiple structured and unstructured sources (including Recruiter CSV exports, ATS JSON objects, GitHub profiles, and Resume texts), normalizes formatting to international standards, and outputs clean canonical candidate identities wrapped in rigorous validation layers.

The architecture separates internal data normalization from a configurable projection layer, enabling consumers to reshape, remap, and transform downstream output models at runtime without modifying the underlying integration logic.

Project Architecture

The codebase relies on an isolated, modular layout designed for scalability:

src/
├── adapters/          # Source-specific parsers translating inputs into standard fields
│   ├── csvAdapter.ts  # Normalizer for spreadsheet exports
│   ├── atsAdapter.ts  # Normalizer for JSON applicant systems
│   └── registry.ts    # Central adapter registration point
├── config/            # Default layouts and custom schema projection profiles
│   ├── defaultConfig.ts
│   └── exampleCustomConfig.json
├── pipeline/          # Core processing pipeline engines
│   ├── merge.ts       # Identity matching, merge loops, and conflict logging
│   ├── project.ts     # Schema projection, remapping, and data pruning
│   ├── validate.ts    # Outbound data validation schemas
│   └── index.ts       # Pipeline orchestration engine
└── cli.ts             # CLI command handling, argument parsing, and standard output


Installation and Setup

This project is built using TypeScript and Node.js.

Prerequisites

Node.js (version 18.x or higher recommended)

npm (version 9.x or higher)

1. Install Dependencies

Initialize the project workspace and download all required packages:

npm install


2. Compile TypeScript

Transpile the TypeScript source code into production-ready ES6 JavaScript inside the static dist/ directory:

npm run build


Running the Tests

To verify the core data normalizers, identity linkers, priority merging heuristics, and end-to-end integration workflows, run the Vitest test suite:

npx vitest run


CLI Usage

The system exposes a unified Command-Line Interface to execute merge configurations.

1. Default Pipeline Run

Process and merge a structured recruiter spreadsheet and an ATS applicant payload, outputting a unified audit profile:

npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --explain --out output.json


Key Parameters:

--csv <path>: Path to raw recruiter spreadsheet records.

--ats <path>: Path to semi-structured JSON exports.

--explain: Appends an explicit audit trail outlining data collisions and rejected source values.

--out <path>: Local file path where the unified output payload is written.

2. Custom Schema Projection Run

Remap field paths, cast nested objects, and drop metadata properties dynamically at runtime using a JSON layout config:

npx ts-node src/cli.ts --csv samples/recruiter_export.csv --ats samples/ats_export.json --config src/config/exampleCustomConfig.json


Canonical Output Schema Specification

The internal canonical profile matches the structured schemas requested in the assignment:

candidate_id (string): Unique identifier for the merged profile.

full_name (string): Normalized full name of the candidate.

emails (string[]): Consolidated array of validated email addresses without duplicates.

phones (string[]): Consolidated phone numbers formatted to the international E.164 standard (e.g., +919876543210).

location (object): Includes nested keys { city, region, country } with the country represented in ISO-3166 alpha-2 format.

links (object): Contains structured URLs { linkedin, github, portfolio, other[] }.

headline (string | null): The professional headline or current title.

years_experience (number | null): Derived total years of professional experience.

skills (array of objects): Canonical list of skills, containing { name, confidence, sources[] }.

experience (array of objects): Chronological list of past jobs containing { company, title, start, end, summary } with dates normalized to YYYY-MM.

education (array of objects): List of academic profiles containing { institution, degree, field, end_year }.

provenance (array of objects): System audit logging tracking { field, source, method } to trace the origin of every merged attribute.

overall_confidence (number): Dynamic aggregated pipeline confidence score.

Example Custom Configuration File (exampleCustomConfig.json)

{
  "fields": {
    "full_name": { 
      "from": "full_name", 
      "type": "string", 
      "required": true 
    },
    "primary_email": { 
      "from": "emails[0]", 
      "type": "string", 
      "required": true 
    },
    "phone": { 
      "from": "phones[0]", 
      "type": "string", 
      "required": false,
      "normalize": "E164" 
    },
    "skills": { 
      "from": "skills[].name", 
      "type": "array", 
      "required": false,
      "normalize": "canonical" 
    }
  },
  "include_confidence": true,
  "on_missing": "null"
}


Architectural Highlights and Design Decisions

The Source Adapter Pattern

To scale to thousands of candidates or interface with new external data vendors, we avoid modifying the core processing pipeline. Instead, we use a decentralized Adapter design pattern. Each incoming vendor platform maps to an isolated source parser extending a common interface. Adding support for a new data vendor requires writing a single isolated file without risking regression bugs in the merge engine.

Deterministic Conflict Merging

Data conflict resolution uses deterministic, hierarchical source authority. Values from corporate ATS integrations override values parsed from unstructured resume documents or spreadsheet exports. If an override occurs, the losing value is never discarded; instead, it is appended to a structured historical audit array (_conflicts) so downstream systems have full visibility.

Resilient Identity Linking Fallbacks

When standard keys (like emails) are absent or malformed, our matching engine falls back to generating deterministic composite signatures (e.g., lowercase name combined with standardized E.164 phone vectors) to safely isolate or join records without risk of profile corruption.