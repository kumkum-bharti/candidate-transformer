import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { ExtractedField, SourceAdapter } from "../types";

type GitHubProfile = {
    login?: string;
    name?: string;
    bio?: string;
    location?: string;
    repos?: Array<{
        name?: string;
        description?: string;
        language?: string;
    }>;
};

const SKILL_KEYWORDS = [
    "JavaScript",
    "TypeScript",
    "Node.js",
    "React",
    "React Native",
    "MongoDB",
    "Express",
    "Express.js",
    "Python",
    "Java",
    "C++",
    "C#",
    "SQL",
    "HTML",
    "CSS",
    "AWS",
    "Docker",
    "Kubernetes",
    "GraphQL",
    "REST",
    "Redux",
    "Next.js",
    "Spring Boot",
    "Machine Learning",
    "ML",
    "Razorpay",
    "JWT",
    "OCR",
];

function isProfileObject(value: unknown): value is GitHubProfile {
    return Boolean(value) && typeof value === "object";
}

function readLocalProfile(rawInput: unknown): GitHubProfile | null {
    if (Buffer.isBuffer(rawInput)) {
        return JSON.parse(rawInput.toString("utf8")) as GitHubProfile;
    }

    if (isProfileObject(rawInput)) {
        return rawInput;
    }

    if (typeof rawInput === "string") {
        const trimmed = rawInput.trim();
        if (!trimmed) {
            return null;
        }

        if (fs.existsSync(trimmed) && path.extname(trimmed).toLowerCase() === ".json") {
            return JSON.parse(fs.readFileSync(trimmed, "utf8")) as GitHubProfile;
        }

        try {
            return JSON.parse(trimmed) as GitHubProfile;
        } catch {
            return null;
        }
    }

    return null;
}

function fetchGithubProfile(username: string): GitHubProfile {
    const script = `
    const username = process.argv[1];
    const baseUrl = 'https://api.github.com/users/' + encodeURIComponent(username);
    Promise.all([
      fetch(baseUrl).then((response) => response.json()),
      fetch(baseUrl + '/repos').then((response) => response.json())
    ]).then(([profile, repos]) => {
      process.stdout.write(JSON.stringify({ ...profile, repos }));
    }).catch((error) => {
      process.stderr.write(String(error && error.message ? error.message : error));
      process.exit(1);
    });
  `;

    const output = execFileSync(process.execPath, ["-e", script, username], { encoding: "utf8" });
    return JSON.parse(output) as GitHubProfile;
}

function deriveSkills(profile: GitHubProfile): string[] {
    const discovered = new Set<string>();

    for (const repo of profile.repos ?? []) {
        const haystack = `${repo.language ?? ""} ${repo.description ?? ""}`.toLowerCase();
        for (const keyword of SKILL_KEYWORDS) {
            if (haystack.includes(keyword.toLowerCase())) {
                discovered.add(keyword);
            }
        }

        if (repo.language) {
            discovered.add(repo.language);
        }
    }

    return Array.from(discovered);
}

export function extract(rawInput: unknown): ExtractedField[] {
    try {
        const profile = readLocalProfile(rawInput) ?? (typeof rawInput === "string" ? fetchGithubProfile(rawInput.trim()) : null);

        if (!profile) {
            return [];
        }

        const fields: ExtractedField[] = [];

        const recordIndex = 0;
        if (profile.name) fields.push({ field: "full_name", value: profile.name, source: "github", method: "api_field", recordIndex });
        if (profile.bio) fields.push({ field: "headline", value: profile.bio, source: "github", method: "api_field", recordIndex });
        if (profile.location) fields.push({ field: "location", value: profile.location, source: "github", method: "api_field", recordIndex });
        const skills = deriveSkills(profile);
        if (skills.length > 0) fields.push({ field: "skills", value: skills, source: "github", method: "derived", recordIndex });
        return fields;
    } catch {
        return [];
    }
}

export const githubAdapter: SourceAdapter = {
    name: "github",
    extract,
};
