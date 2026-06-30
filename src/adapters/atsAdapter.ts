import fs from "fs";
import path from "path";
import { ExtractedField, SourceAdapter } from "../types";

type AtsCandidate = {
    applicant_name?: string;
    contact_email?: string;
    mobile?: string;
    employer?: string;
    role_applied?: string;
    loc_city?: string;
    loc_country?: string;
};

function readJsonInput(rawInput: unknown): unknown {
    if (Buffer.isBuffer(rawInput)) {
        return JSON.parse(rawInput.toString("utf8"));
    }

    if (typeof rawInput === "string") {
        const trimmed = rawInput.trim();
        if (trimmed && fs.existsSync(trimmed) && path.extname(trimmed).toLowerCase() === ".json") {
            return JSON.parse(fs.readFileSync(trimmed, "utf8"));
        }

        return JSON.parse(rawInput);
    }

    return rawInput;
}

function toCandidates(payload: unknown): AtsCandidate[] {
    if (!payload || typeof payload !== "object") {
        return [];
    }

    const record = payload as { candidates?: unknown };
    if (Array.isArray(record.candidates)) {
        return record.candidates.filter((candidate): candidate is AtsCandidate => Boolean(candidate) && typeof candidate === "object") as AtsCandidate[];
    }

    return [payload as AtsCandidate];
}

export function extract(rawInput: unknown): ExtractedField[] {
    try {
        const payload = readJsonInput(rawInput);
        const candidates = toCandidates(payload);
        const fields: ExtractedField[] = [];

        candidates.forEach((candidate, recordIndex) => {
            if (candidate.applicant_name) fields.push({ field: "full_name", value: candidate.applicant_name, source: "ats_json", method: "direct", recordIndex });
            if (candidate.contact_email) fields.push({ field: "emails", value: candidate.contact_email, source: "ats_json", method: "direct", recordIndex });
            if (candidate.mobile) fields.push({ field: "phones", value: candidate.mobile, source: "ats_json", method: "direct", recordIndex });
            if (candidate.loc_city || candidate.loc_country) {
                fields.push({ field: "location", value: { city: candidate.loc_city ?? null, country: candidate.loc_country ?? null }, source: "ats_json", method: "direct", recordIndex });
            }
            if (candidate.employer || candidate.role_applied) {
                fields.push({ field: "experience", value: { company: candidate.employer ?? null, title: candidate.role_applied ?? null }, source: "ats_json", method: "direct", recordIndex });
            }
            if (candidate.role_applied) fields.push({ field: "headline", value: candidate.role_applied, source: "ats_json", method: "direct", recordIndex });
            });

        return fields;
    } catch {
        return [];
    }
}

export const atsAdapter: SourceAdapter = {
    name: "ats_json",
    extract,
};
