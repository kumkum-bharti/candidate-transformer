import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { ExtractedField, SourceAdapter } from "../types";

function readCsvInput(rawInput: unknown): string {
    if (Buffer.isBuffer(rawInput)) {
        return rawInput.toString("utf8");
    }

    if (typeof rawInput === "string") {
        const trimmed = rawInput.trim();
        if (trimmed && fs.existsSync(trimmed) && path.extname(trimmed).toLowerCase() === ".csv") {
            return fs.readFileSync(trimmed, "utf8");
        }

        return rawInput;
    }

    return "";
}

export function extract(rawInput: unknown): ExtractedField[] {
    try {
        const csvText = readCsvInput(rawInput);
        if (!csvText.trim()) {
            return [];
        }

        const rows = parse(csvText, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as Record<string, string>[];

       const fields: ExtractedField[] = [];
            rows.forEach((row, recordIndex) => {
            if (row.name) fields.push({ field: "full_name", value: row.name, source: "csv", method: "direct", recordIndex });
            if (row.email) fields.push({ field: "emails", value: row.email, source: "csv", method: "direct", recordIndex });
            if (row.phone) fields.push({ field: "phones", value: row.phone, source: "csv", method: "direct", recordIndex });
            if (row.current_company || row.title) {
                fields.push({
                field: "experience",
                value: { company: row.current_company || null, title: row.title || null },
                source: "csv",
                method: "direct",
                recordIndex,
                });
            }
            });

        return fields;
    } catch {
        return [];
    }
}

export const csvAdapter: SourceAdapter = {
    name: "csv",
    extract,
};
