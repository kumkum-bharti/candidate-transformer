import { SourceAdapter, SourceName } from "../types";
import { atsAdapter } from "./atsAdapter";
import { csvAdapter } from "./csvAdapter";
import { githubAdapter } from "./githubAdapter";
import { resumeAdapter } from "./resumeAdapter";

export const adapters: SourceAdapter[] = [csvAdapter, atsAdapter, githubAdapter, resumeAdapter];

export const adapterMap: Record<SourceName, SourceAdapter> = {
    csv: csvAdapter,
    ats_json: atsAdapter,
    github: githubAdapter,
    resume: resumeAdapter,
};
