import { CanonicalCandidate } from '../types';
import { ProjectionConfig } from '../config/projectionTypes';
import { mergeCandidates } from './merge';
import { scoreField, scoreOverall, isDegraded } from './confidence';
import { project } from './project';
import { validate } from './validate';

export function runPipeline(
    rawInputs: { csv?: any[]; ats?: any[]; github?: any[]; resume?: any[] },
    config: ProjectionConfig
): any[] {
    const allExtractedFields: any[][] = [];

    if (rawInputs.csv && rawInputs.csv.length > 0) allExtractedFields.push(rawInputs.csv[0]);
    if (rawInputs.ats && rawInputs.ats.length > 0) allExtractedFields.push(rawInputs.ats[0]);
    if (rawInputs.github && rawInputs.github.length > 0) allExtractedFields.push(rawInputs.github[0]);
    if (rawInputs.resume && rawInputs.resume.length > 0) allExtractedFields.push(rawInputs.resume[0]);

    const mergedCandidates = mergeCandidates(allExtractedFields);
    const finalProjectedCandidates: any[] = [];

    for (const candidate of mergedCandidates) {
        const fieldsGroupedByName = new Map<string, number>();

        for (const fieldArray of allExtractedFields) {
            for (const f of fieldArray) {
                fieldsGroupedByName.set(f.field, (fieldsGroupedByName.get(f.field) || 0) + 1);
            }
        }

        const fieldScores: number[] = [];
        const attemptedSources = new Set<string>();
        allExtractedFields.flat().forEach(f => attemptedSources.add(f.source));

        for (const [fieldName, count] of fieldsGroupedByName.entries()) {
            const hadConflict = candidate._conflicts.some(c => c.field === fieldName);
            const weights = Array(count).fill(0.8);

            const fScore = scoreField(fieldName, count, hadConflict, weights);
            fieldScores.push(fScore);
        }

        candidate.overall_confidence = scoreOverall(fieldScores);

        const usedSources = new Set<string>();
        if (candidate.full_name) candidate.provenance.forEach(p => usedSources.add(p.source as string));

        candidate._degraded = isDegraded(usedSources.size, attemptedSources.size);

        const projected = project(candidate, config);

        const validationResult = validate(projected);
        if (!validationResult.valid && validationResult.errors) {
            console.warn(`[Validation Warning] Candidate ${candidate.candidate_id} has structural issues:`, validationResult.errors);
        }

        finalProjectedCandidates.push(projected);
    }

    return finalProjectedCandidates;
}