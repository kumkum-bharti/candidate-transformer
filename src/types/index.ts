// Core shapes used across every pipeline stage.
// Every adapter outputs ExtractedField[]; nothing downstream looks at raw input formats again.

export type SourceName = "csv" | "ats_json" | "github" | "resume";


export interface ExtractedField {
  field: string;
  value: unknown;
  source: SourceName;
  method: string;
  recordIndex: number;   // NEW — groups fields from the same row/record within this source
}

export interface SourceAdapter {
  name: SourceName;
  // Each adapter decides internally how to parse its own raw input.
  // Must never throw on malformed input - return [] instead (see edge case handling).
  extract(rawInput: unknown): ExtractedField[];
}

export interface ConflictRecord {
  field: string;
  winningValue: unknown;
  rejectedValues: { value: unknown; source: SourceName }[];
  reason: string;
}

export interface ProvenanceEntry {
  field: string;
  source: SourceName | SourceName[];
  method: string;
}

export interface Location {
  city?: string | null;
  region?: string | null;
  country?: string | null; // ISO-3166 alpha-2
}

export interface ExperienceEntry {
  company?: string | null;
  title?: string | null;
  start?: string | null;   // YYYY-MM
  end?: string | null;     // YYYY-MM
  summary?: string | null;
}

export interface EducationEntry {
  institution?: string | null;
  degree?: string | null;
  field?: string | null;
  end_year?: number | null;
}

export interface SkillEntry {
  name: string;
  confidence: number;
  sources: SourceName[];
}

export interface LinkEntry {
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  other?: string[] | null;
}

// Internal canonical record - always fully populated, never mutated by output config.
export interface CanonicalCandidate {
  candidate_id: string;
  full_name: string | null;
  emails: string[];
  phones: string[];           // E.164
  location: Location | null;
  links: LinkEntry | null;
  headline: string | null;
  years_experience: number | null;
  skills: SkillEntry[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  provenance: ProvenanceEntry[];
  overall_confidence: number;
  _conflicts: ConflictRecord[];   // internal only - exposed via --explain
  _degraded: boolean;             // internal flag, more than half sources missing/unusable
}
