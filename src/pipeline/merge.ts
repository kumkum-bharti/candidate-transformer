import {
    CanonicalCandidate,
    ConflictRecord,
    ExtractedField,
    ExperienceEntry,
    LinkEntry,
    Location,
    SkillEntry,
    SourceName,
} from "../types";
import { canonicalizeSkill, normalizeCountry, normalizePhone } from "./normalize";

type CandidateMatch = {
    key: string;
    fields: ExtractedField[];
};

type MergeResult = {
    value: unknown;
    conflict?: ConflictRecord;
};

function firstStringFromValue(value: unknown): string {
    if (Array.isArray(value)) {
        const first = value.find((v) => typeof v === "string" && v.trim());
        return typeof first === "string" ? first.trim() : "";
    }
    return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
    return firstStringFromValue(value).toLowerCase();
}

function normalizeName(value: unknown): string {
    return firstStringFromValue(value).toLowerCase().replace(/\s+/g, " ");
}

function toStringValue(value: unknown): string {
    return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === null || value === undefined || value === "") {
        return [];
    }
    return [value];
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
}

function cloneExperienceEntries(entries: ExperienceEntry[]): ExperienceEntry[] {
    return entries.map((entry) => ({ ...entry }));
}

function cloneSkillEntries(entries: SkillEntry[]): SkillEntry[] {
    return entries.map((entry) => ({ name: entry.name, confidence: entry.confidence, sources: [...entry.sources] }));
}

function cloneLinks(value: LinkEntry | null): LinkEntry | null {
    if (!value) {
        return null;
    }
    return {
        linkedin: value.linkedin ?? null,
        github: value.github ?? null,
        portfolio: value.portfolio ?? null,
        other: value.other ? [...value.other] : null,
    };
}

function createEmptyCandidate(): CanonicalCandidate {
    return {
        candidate_id: "",
        full_name: null,
        emails: [],
        phones: [],
        location: null,
        links: null,
        headline: null,
        years_experience: null,
        skills: [],
        experience: [],
        education: [],
        provenance: [],
        overall_confidence: 0,
        _conflicts: [],
        _degraded: false,
    };
}

function getFieldValues(field: string, fields: ExtractedField[]): ExtractedField[] {
    return fields.filter((record) => record.field === field);
}

function mergeStrings(field: string, candidates: { value: unknown; source: SourceName }[], policy: "structured" | "unstructured"): MergeResult {
    const values = candidates.map((candidate) => toStringValue(candidate.value).trim()).filter(Boolean);
    if (values.length === 0) {
        return { value: null };
    }

    const uniqueValues = [...new Set(candidates.map((candidate) => toStringValue(candidate.value).trim().toLowerCase()).filter(Boolean))];
    if (uniqueValues.length === 1) {
        return { value: toStringValue(candidates[0].value).trim() };
    }

    const winnerIndex = policy === "structured"
        ? candidates.findIndex((candidate) => candidate.source === "csv" || candidate.source === "ats_json")
        : candidates.findIndex((candidate) => candidate.source === "github" || candidate.source === "resume");

    const winningCandidate = candidates[winnerIndex >= 0 ? winnerIndex : 0];
    const winningValue = toStringValue(winningCandidate.value).trim();
    const rejectedValues = candidates
        .filter((candidate, index) => index !== (winnerIndex >= 0 ? winnerIndex : 0))
        .map((candidate) => ({ value: candidate.value, source: candidate.source }));

    if (rejectedValues.length === 0) {
        return { value: winningValue };
    }

    return {
        value: winningValue,
        conflict: {
            field,
            winningValue,
            rejectedValues,
            reason: policy === "structured"
                ? "Structured sources are prioritized for identity fields."
                : "Unstructured sources are prioritized for skills.",
        },
    };
}

function mergeArrayValues(field: string, candidates: { value: unknown; source: SourceName }[]): MergeResult {
    const merged: string[] = [];
    for (const candidate of candidates) {
        for (const value of asArray(candidate.value)) {
            const text = toStringValue(value).trim();
            if (text) {
                merged.push(text);
            }
        }
    }
    return { value: uniqueStrings(merged) };
}

function mergeSkills(candidates: { value: unknown; source: SourceName }[]): MergeResult {
    const byName = new Map<string, SkillEntry>();

    for (const candidate of candidates) {
        for (const value of asArray(candidate.value)) {
            const raw = toStringValue(value).trim();
            if (!raw) {
                continue;
            }

            const name = canonicalizeSkill(raw);
            const existing = byName.get(name);
            if (existing) {
                if (!existing.sources.includes(candidate.source)) {
                    existing.sources.push(candidate.source);
                }
            } else {
                byName.set(name, {
                    name,
                    confidence: candidate.source === "github" || candidate.source === "resume" ? 0.8 : 0.6,
                    sources: [candidate.source],
                });
            }
        }
    }
    return { value: Array.from(byName.values()) };
}

function mergeExperience(candidates: { value: unknown; source: SourceName }[]): MergeResult {
    const entries: ExperienceEntry[] = [];
    for (const candidate of candidates) {
        for (const value of asArray(candidate.value)) {
            if (value && typeof value === "object") {
                const entry = value as ExperienceEntry;
                entries.push({
                    company: entry.company ?? null,
                    title: entry.title ?? null,
                    start: entry.start ?? null,
                    end: entry.end ?? null,
                    summary: entry.summary ?? null,
                });
            }
        }
    }
    return { value: entries };
}

function mergeLinks(candidates: { value: unknown; source: SourceName }[]): MergeResult {
    const merged: LinkEntry = {
        linkedin: null,
        github: null,
        portfolio: null,
        other: [],
    };

    for (const candidate of candidates) {
        for (const value of asArray(candidate.value)) {
            if (typeof value === "string") {
                merged.other = merged.other ?? [];
                merged.other.push(value.trim());
                continue;
            }

            if (value && typeof value === "object") {
                const link = value as Partial<LinkEntry>;
                if (link.linkedin) merged.linkedin = link.linkedin;
                if (link.github) merged.github = link.github;
                if (link.portfolio) merged.portfolio = link.portfolio;
                if (Array.isArray(link.other)) {
                    merged.other = [...(merged.other ?? []), ...link.other.map((item) => toStringValue(item).trim()).filter(Boolean)];
                }
            }
        }
    }

    merged.other = merged.other && merged.other.length > 0 ? uniqueStrings(merged.other) : null;
    return { value: merged };
}

function mergeLocation(candidates: { value: unknown; source: SourceName }[]): MergeResult {
    const objectCandidate = candidates.find((c) => c.value && typeof c.value === "object" && !Array.isArray(c.value));
    if (objectCandidate) {
        const loc = objectCandidate.value as Record<string, unknown>;
        const value: Location = {
            city: typeof loc.city === "string" && loc.city.trim() ? loc.city.trim() : null,
            region: typeof loc.region === "string" && loc.region.trim() ? loc.region.trim() : null,
            country: typeof loc.country === "string" && loc.country.trim() ? loc.country.trim() : null,
        };
        value.country = normalizeCountry(value.country ?? "") ?? value.country;

        const rejected = candidates.filter((c) => c !== objectCandidate && toStringValue(c.value).trim());
        if (rejected.length === 0) {
            return { value };
        }

        return {
            value,
            conflict: {
                field: "location",
                winningValue: value,
                rejectedValues: rejected.map((c) => ({ value: c.value, source: c.source })),
                reason: "Structured location object preferred over free-text location string.",
            },
        };
    }

    const stringCandidate = candidates.find((c) => typeof c.value === "string" && c.value.trim());
    if (stringCandidate) {
        const raw = toStringValue(stringCandidate.value).trim();
        const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
        const value: Location = {
            city: parts[0] ?? null,
            region: parts.length > 2 ? parts[1] : null,
            country: parts.length > 1 ? parts[parts.length - 1] : null,
        };
        return { value };
    }

    return { value: null };
}

function mergeIdentity(field: string, candidates: { value: unknown; source: SourceName }[]): MergeResult {
    const policy = field === "skills" ? "unstructured" : "structured";
    return mergeStrings(field, candidates, policy);
}

export function mergeField(field: string, candidates: { value: unknown; source: SourceName }[]): MergeResult {
    if (field === "skills") {
        return mergeSkills(candidates);
    }
    if (field === "emails" || field === "phones") {
        return mergeArrayValues(field, candidates);
    }
    if (field === "links.other") {
        return mergeArrayValues(field, candidates);
    }
    if (field === "experience") {
        return mergeExperience(candidates);
    }
    if (field === "links") {
        return mergeLinks(candidates);
    }
    if (field === "location") {
        return mergeLocation(candidates);
    }
    return mergeIdentity(field, candidates);
}

function addConflict(target: CanonicalCandidate, conflict?: ConflictRecord): void {
    if (conflict) {
        target._conflicts.push(conflict);
    }
}

function applyField(target: CanonicalCandidate, field: string, value: unknown): void {
    switch (field) {
        case "full_name":
            target.full_name = typeof value === "string" ? value : target.full_name;
            break;
        case "headline":
            target.headline = typeof value === "string" ? value : target.headline;
            break;
        case "location":
            if (value && typeof value === "object") {
                target.location = value as Location;
            }
            break;
        case "emails":
            target.emails = uniqueStrings([...(target.emails ?? []), ...asArray(value).map((item) => toStringValue(item).trim())]);
            break;
        case "phones":
            target.phones = uniqueStrings([...(target.phones ?? []), ...asArray(value).map((item) => normalizePhone(toStringValue(item), "IN"))]);
            break;
        case "skills": {
            const existing = new Map(target.skills.map((entry) => [entry.name, entry] as const));
            for (const item of asArray(value)) {
                if (item && typeof item === "object") {
                    const skill = item as SkillEntry;
                    const current = existing.get(skill.name);
                    if (current) {
                        current.confidence = Math.max(current.confidence, skill.confidence);
                        current.sources = Array.from(new Set([...current.sources, ...skill.sources]));
                    } else {
                        existing.set(skill.name, { name: skill.name, confidence: skill.confidence, sources: [...skill.sources] });
                    }
                }
            }
            target.skills = Array.from(existing.values());
            break;
        }
        case "experience":
            target.experience = cloneExperienceEntries([...(target.experience ?? []), ...(asArray(value).filter((item) => item && typeof item === "object") as ExperienceEntry[])]);
            break;
        case "links":
            target.links = mergeLinkObjects(target.links, value);
            break;
        default:
            break;
    }
}

function mergeLinkObjects(existing: LinkEntry | null, value: unknown): LinkEntry | null {
    const next = cloneLinks(existing) ?? { linkedin: null, github: null, portfolio: null, other: null };

    if (value && typeof value === "object" && !Array.isArray(value)) {
        const link = value as Partial<LinkEntry>;
        if (link.linkedin) next.linkedin = link.linkedin;
        if (link.github) next.github = link.github;
        if (link.portfolio) next.portfolio = link.portfolio;
        if (Array.isArray(link.other)) {
            next.other = uniqueStrings([...(next.other ?? []), ...link.other.map((item) => toStringValue(item).trim()).filter(Boolean)]);
        }
    }
    return next;
}

function addCandidateField(candidate: CandidateMatch[], field: ExtractedField): void {
    candidate.push({ key: field.field, fields: [field] });
}

export function matchCandidates(allExtractedFields: ExtractedField[][]): Map<string, ExtractedField[]> {
    const groups = new Map<string, ExtractedField[]>();

    for (const sourceFields of allExtractedFields) {
        const byRecord = new Map<number, ExtractedField[]>();
        for (const f of sourceFields) {
            const recordKey = f.recordIndex ?? 0;
            const arr = byRecord.get(recordKey) ?? [];
            arr.push(f);
            byRecord.set(recordKey, arr);
        }

        for (const recordFields of byRecord.values()) {
            const emailField = recordFields.find((f) => f.field === "emails" && firstStringFromValue(f.value).trim());
            const nameField = recordFields.find((f) => f.field === "full_name" && firstStringFromValue(f.value).trim());
            const phoneField = recordFields.find((f) => f.field === "phones" && firstStringFromValue(f.value).trim());

            const recordEmail = normalizeEmail(emailField?.value);
            const recordName = normalizeName(nameField?.value);
            const recordPhone = phoneField
                ? normalizePhone(firstStringFromValue(phoneField.value), "IN").trim()
                : "";

            let key: string;

            if (recordEmail) {
                const nameMatchKey = [...groups.keys()].find((k) =>
                    !k.includes("@") &&
                    groups.get(k)?.some((f) => f.field === "full_name" && normalizeName(f.value) === recordName)
                );
                if (nameMatchKey) {
                    const existing = groups.get(nameMatchKey)!;
                    groups.delete(nameMatchKey);
                    groups.set(recordEmail, existing);
                }
                key = recordEmail;
            } else if (recordName && recordPhone) {
                const emailMatchKey = [...groups.keys()].find((k) =>
                    k.includes("@") &&
                    groups.get(k)?.some((f) => f.field === "full_name" && normalizeName(f.value) === recordName)
                );
                key = emailMatchKey ?? `${recordName}|${recordPhone}`;
            } else if (recordName) {
                const existingKey = [...groups.keys()].find((k) =>
                    groups.get(k)?.some((f) => f.field === "full_name" && normalizeName(f.value) === recordName)
                );
                key = existingKey ?? recordName;
            } else {
                key = `unknown-${groups.size}`;
            }

            const existing = groups.get(key) ?? [];
            groups.set(key, existing.concat(recordFields));
        }
    }

    return groups;
}

function buildCandidateId(matchKey: string): string {
    return matchKey;
}

function mergeCandidateFields(fields: ExtractedField[]): CanonicalCandidate {
    const candidate = createEmptyCandidate();
    candidate.candidate_id = buildCandidateId("pending");

    const grouped = new Map<string, { value: unknown; source: SourceName; method: string }[]>();
    for (const field of fields) {
        const list = grouped.get(field.field) ?? [];
        list.push({ value: field.value, source: field.source, method: field.method });
        grouped.set(field.field, list);
    }

    for (const [field, records] of grouped.entries()) {
        const result = mergeField(field, records);
        addConflict(candidate, result.conflict);
        applyField(candidate, field, result.value);
        candidate.provenance.push({
            field,
            source: records.length === 1 ? records[0].source : (records.map((record) => record.source) as SourceName[]),
            method: records[0].method,
        });
    }
    return candidate;
}

export function mergeNewSource(existing: CanonicalCandidate, newFields: ExtractedField[]): CanonicalCandidate {
    const next: CanonicalCandidate = {
        candidate_id: existing.candidate_id,
        full_name: existing.full_name,
        emails: uniqueStrings([...existing.emails]),
        phones: uniqueStrings([...existing.phones]),
        location: existing.location ? { ...existing.location } : null,
        links: cloneLinks(existing.links),
        headline: existing.headline,
        years_experience: existing.years_experience,
        skills: cloneSkillEntries(existing.skills),
        experience: cloneExperienceEntries(existing.experience),
        education: existing.education.map((entry) => ({ ...entry })),
        provenance: existing.provenance.map((entry) => ({ field: entry.field, source: Array.isArray(entry.source) ? [...entry.source] : entry.source, method: entry.method })),
        overall_confidence: existing.overall_confidence,
        _conflicts: [...existing._conflicts],
        _degraded: existing._degraded,
    };

    const grouped = new Map<string, { value: unknown; source: SourceName; method: string }[]>();
    for (const field of newFields) {
        const list = grouped.get(field.field) ?? [];
        list.push({ value: field.value, source: field.source, method: field.method });
        grouped.set(field.field, list);
    }

    for (const [field, records] of grouped.entries()) {
        const result = mergeField(field, records);
        addConflict(next, result.conflict);
        applyField(next, field, result.value);
        next.provenance.push({
            field,
            source: records.length === 1 ? records[0].source : (records.map((record) => record.source) as SourceName[]),
            method: records[0].method,
        });
    }

    next.emails = uniqueStrings(next.emails.map((email) => email.trim().toLowerCase()));
    next.phones = uniqueStrings(next.phones.map((phone) => normalizePhone(phone, "IN")));
    next.skills = Array.from(new Map(next.skills.map((skill) => [skill.name, skill] as const)).values());
    next.experience = cloneExperienceEntries(next.experience);
    return next;
}

export function mergeCandidates(allExtractedFields: ExtractedField[][]): CanonicalCandidate[] {
    const matches = matchCandidates(allExtractedFields);
    const merged: CanonicalCandidate[] = [];

    for (const [key, fields] of matches.entries()) {
        const candidate = mergeCandidateFields(fields);
        candidate.candidate_id = buildCandidateId(key);
        merged.push(candidate);
    }
    return merged;
}