const COUNTRY_CODES: Record<string, string> = {
    india: "IN",
    "united states": "US",
    usa: "US",
    us: "US",
    "united kingdom": "GB",
    uk: "GB",
    britain: "GB",
    england: "GB",
    canada: "CA",
    australia: "AU",
    germany: "DE",
    france: "FR",
    singapore: "SG",
    uae: "AE",
    "united arab emirates": "AE",
};

const COUNTRY_CALLING_CODES: Record<string, string> = {
    IN: "91",
    US: "1",
    CA: "1",
    GB: "44",
    AU: "61",
    DE: "49",
    FR: "33",
    SG: "65",
    AE: "971",
};

const SKILL_ALIASES: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    "reactjs": "React",
    "react.js": "React",
    react: "React",
    node: "Node.js",
    nodejs: "Node.js",
    "node.js": "Node.js",
    ts: "TypeScript",
    typescript: "TypeScript",
    mongodb: "MongoDB",
    sql: "SQL",
    html: "HTML",
    css: "CSS",
};

const MONTHS: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
};

function titleCase(raw: string): string {
    return raw
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function padMonth(month: number): string {
    return month.toString().padStart(2, "0");
}

export function normalizePhone(raw: string, defaultCountry = "IN"): string {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }

    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) {
        return "";
    }

    if (hasPlus) {
        return `+${digits}`;
    }

    if (digits.length === 10) {
        const callingCode = COUNTRY_CALLING_CODES[defaultCountry.toUpperCase()] ?? COUNTRY_CALLING_CODES.IN;
        return `+${callingCode}${digits}`;
    }

    if (defaultCountry.toUpperCase() === "IN" && digits.length === 12 && digits.startsWith("91")) {
        return `+${digits}`;
    }

    const callingCode = COUNTRY_CALLING_CODES[defaultCountry.toUpperCase()];
    if (callingCode && digits.startsWith(callingCode)) {
        return `+${digits}`;
    }

    return `+${digits}`;
}

export function normalizeDate(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    const yyyymm = trimmed.match(/^(\d{4})[-/](\d{1,2})$/);
    if (yyyymm) {
        const year = Number(yyyymm[1]);
        const month = Number(yyyymm[2]);
        if (month >= 1 && month <= 12) {
            return `${year}-${padMonth(month)}`;
        }
        return null;
    }

    const monthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (monthYear) {
        const month = MONTHS[monthYear[1].toLowerCase()];
        const year = Number(monthYear[2]);
        if (month && year >= 1900) {
            return `${year}-${padMonth(month)}`;
        }
        return null;
    }

    const slashMonthYear = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMonthYear) {
        const month = Number(slashMonthYear[1]);
        const year = Number(slashMonthYear[2]);
        if (month >= 1 && month <= 12) {
            return `${year}-${padMonth(month)}`;
        }
        return null;
    }

    const dashedMonthYear = trimmed.match(/^(\d{1,2})-(\d{4})$/);
    if (dashedMonthYear) {
        const month = Number(dashedMonthYear[1]);
        const year = Number(dashedMonthYear[2]);
        if (month >= 1 && month <= 12) {
            return `${year}-${padMonth(month)}`;
        }
        return null;
    }

    const compact = trimmed.match(/^(\d{4})(\d{2})$/);
    if (compact) {
        const year = Number(compact[1]);
        const month = Number(compact[2]);
        if (month >= 1 && month <= 12) {
            return `${year}-${padMonth(month)}`;
        }
    }

    return null;
}

export function normalizeCountry(raw: string): string | null {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    return COUNTRY_CODES[normalized] ?? null;
}

export function canonicalizeSkill(raw: string): string {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) {
        return "";
    }

    return SKILL_ALIASES[normalized] ?? titleCase(raw.trim());
}
