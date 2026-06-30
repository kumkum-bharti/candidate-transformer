import { ProjectionConfig } from './projectionTypes';

export const defaultConfig: ProjectionConfig = {
  fields: {
    id: { from: 'candidate_id', type: 'string', required: true },
    name: { from: 'full_name', type: 'string', required: true },
    emails: { from: 'emails', type: 'array', required: true },
    phones: { from: 'phones', type: 'array', required: true },
    current_headline: { from: 'headline', type: 'string', required: false },
    location_summary: { from: 'location.city', type: 'string', required: false },
    total_years_exp: { from: 'years_experience', type: 'number', required: false },
    skill_tags: { from: 'skills[].name', type: 'array', required: false },
    work_history: { from: 'experience', type: 'array', required: false }
  },
  include_provenance: true,
  include_confidence: true,
  on_missing: 'null'
};