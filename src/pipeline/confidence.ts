const IDENTITY_FIELDS = new Set(["full_name", "emails", "phones"]);
const STRONG_FIELDS = new Set(["full_name", "emails", "phones", "skills"]);

function clamp(value: number, min = 0, max = 1): number {
    return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fieldWeight(field: string): number {
    if (IDENTITY_FIELDS.has(field)) {
        return 2;
    }

    if (field === "skills") {
        return 1.5;
    }

    return 1;
}

export function scoreField(field: string, sourceCount: number, hadConflict: boolean, sourceWeights: number[]): number {
    const baseReliability = clamp(average(sourceWeights) || 0.5);
    const agreementBoost = sourceCount >= 2 ? 0.15 : 0;
    const singleSourcePenalty = sourceCount <= 1 ? 0.12 : 0;
    const conflictPenalty = hadConflict ? 0.2 : 0;
    const importanceBoost = STRONG_FIELDS.has(field) ? 0.05 : 0;

    return clamp(baseReliability + agreementBoost + importanceBoost - singleSourcePenalty - conflictPenalty);
}

export function scoreOverall(fieldScores: number[]): number {
    if (fieldScores.length === 0) {
        return 0;
    }

    const weights = fieldScores.map((_, index) => (index < 3 ? 2 : 1));
    const weightedSum = fieldScores.reduce((sum, score, index) => sum + score * weights[index], 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return clamp(weightedSum / totalWeight);
}

export function isDegraded(sourcesUsed: number, sourcesAttempted: number): boolean {
    if (sourcesAttempted <= 0) {
        return false;
    }

    const missingRatio = (sourcesAttempted - sourcesUsed) / sourcesAttempted;
    return missingRatio > 0.5;
}
