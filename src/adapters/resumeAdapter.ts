import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ExtractedField, SourceAdapter } from "../types";

const SKILL_KEYWORDS = [
    "JavaScript",
    "TypeScript",
    "Node.js",
    "React",
    "React Native",
    "MongoDB",
    "Express.js",
    "Express",
    "Python",
    "Java",
    "C++",
    "C#",
    "Spring Boot",
    "Machine Learning",
    "SQL",
    "HTML",
    "CSS",
    "AWS",
    "Docker",
    "Kubernetes",
    "Git",
    "JWT",
    "OCR",
    "Razorpay",
];

function readResumeText(rawInput: unknown): string {
    if (Buffer.isBuffer(rawInput)) {
        return rawInput.toString("utf8");
    }

    if (typeof rawInput === "string") {
        const trimmed = rawInput.trim();
        if (!trimmed) {
            return "";
        }

        if (fs.existsSync(trimmed)) {
            const extension = path.extname(trimmed).toLowerCase();
            if (extension === ".txt") {
                return fs.readFileSync(trimmed, "utf8");
            }
        }

        return rawInput;
    }

    return "";
}

function extractPlainText(rawInput: unknown): string {
    const text = readResumeText(rawInput);

    if (typeof rawInput !== "string") {
        return text;
    }

    const trimmed = rawInput.trim();
    if (!trimmed || !fs.existsSync(trimmed)) {
        return text;
    }

    const extension = path.extname(trimmed).toLowerCase();
    if (extension === ".pdf") {
        const script = `
      const pdfParse = require('pdf-parse');
      const fs = require('fs');
      const filePath = process.argv[1];
      pdfParse(fs.readFileSync(filePath)).then((result) => {
        process.stdout.write(result.text || '');
      }).catch((error) => {
        process.stderr.write(String(error && error.message ? error.message : error));
        process.exit(1);
      });
    `;

        return execFileSync(process.execPath, ["-e", script, trimmed], { encoding: "utf8" });
    }

    if (extension === ".docx") {
        const script = `
      const mammoth = require('mammoth');
      const filePath = process.argv[1];
      mammoth.extractRawText({ path: filePath }).then((result) => {
        process.stdout.write(result.value || '');
      }).catch((error) => {
        process.stderr.write(String(error && error.message ? error.message : error));
        process.exit(1);
      });
    `;

        return execFileSync(process.execPath, ["-e", script, trimmed], { encoding: "utf8" });
    }

    return text;
}

function getSection(text: string, heading: string): string {
    const lines = text.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => line.trim().toLowerCase() === heading.toLowerCase());

    if (startIndex < 0) {
        return "";
    }

    const sectionLines: string[] = [];
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (/^\s*[A-Z][A-Z\s/&-]{2,}\s*$/.test(line.trim())) {
            break;
        }

        sectionLines.push(line);
    }

    return sectionLines.join("\n").trim();
}

function extractName(text: string): string | null {
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) {
            return trimmed;
        }
    }

    return null;
}

function extractEmails(text: string): string[] {
    return Array.from(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
}

function extractPhones(text: string): string[] {
    const matches = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g) ?? [];
    return Array.from(new Set(matches.map((value) => value.trim()).filter(Boolean)));
}

function extractLinks(text: string): string[] {
    const matches = text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s)]+|github\.com\/[^\s)]+)/gi) ?? [];
    return Array.from(new Set(matches.map((value) => (value.startsWith("http") ? value : `https://${value}`))));
}

function extractSkills(text: string): string[] {
    const skillsSection = getSection(text, "SKILLS");
    const sourceText = skillsSection || text;
    const discovered = new Set<string>();

    for (const keyword of SKILL_KEYWORDS) {
        if (sourceText.toLowerCase().includes(keyword.toLowerCase())) {
            discovered.add(keyword);
        }
    }

    return Array.from(discovered);
}

function extractExperience(text: string): Array<Record<string, string | null>> {
    const section = getSection(text, "EXPERIENCE");
    if (!section) {
        return [];
    }

    const blocks = section
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);

    return blocks.map((block) => {
        const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const [firstLine, secondLine, ...rest] = lines;
        const entry: Record<string, string | null> = {
            company: null,
            title: null,
            start: null,
            end: null,
            summary: null,
        };

        if (firstLine) {
            const commaParts = firstLine.split(",").map((part) => part.trim()).filter(Boolean);
            if (commaParts.length >= 2) {
                entry.title = commaParts[0] ?? null;
                entry.company = commaParts[1] ?? null;
            } else {
                entry.title = firstLine;
            }
        }

        if (secondLine && /\d{4}/.test(secondLine)) {
            const dateParts = secondLine.split(/\s*-\s*/).map((part) => part.trim()).filter(Boolean);
            entry.start = dateParts[0] ?? null;
            entry.end = dateParts[1] ?? null;
            entry.summary = rest.join(" ").trim() || null;
        } else {
            entry.summary = [secondLine, ...rest].filter(Boolean).join(" ").trim() || null;
        }

        return entry;
    });
}

export function extract(rawInput: unknown): ExtractedField[] {
    try {
        const text = extractPlainText(rawInput);
        if (!text.trim()) {
            return [];
        }

        const fields: ExtractedField[] = [];
        const recordIndex = 0; // resumes are single-person sources

        const name = extractName(text);
        if (name) {
            fields.push({ field: "full_name", value: name, source: "resume", method: "direct", recordIndex });
        }

        const emails = extractEmails(text);
        if (emails.length > 0) {
            fields.push({ field: "emails", value: emails, source: "resume", method: "regex_extract", recordIndex });
        }

        const phones = extractPhones(text);
        if (phones.length > 0) {
            fields.push({ field: "phones", value: phones, source: "resume", method: "regex_extract", recordIndex });
        }

        const links = extractLinks(text);
        if (links.length > 0) {
            fields.push({ field: "links", value: links, source: "resume", method: "regex_extract", recordIndex });
        }

        const skills = extractSkills(text);
        if (skills.length > 0) {
            fields.push({ field: "skills", value: skills, source: "resume", method: "keyword_match", recordIndex });
        }

        const experience = extractExperience(text);
        if (experience.length > 0) {
            fields.push({ field: "experience", value: experience, source: "resume", method: "section_parse", recordIndex });
        }

        return fields;
    } catch {
        return [];
    }
}

export const resumeAdapter: SourceAdapter = {
    name: "resume",
    extract,
};