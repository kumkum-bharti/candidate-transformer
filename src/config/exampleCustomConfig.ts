import { ProjectionConfig } from './projectionTypes';

export const exampleCustomConfig: ProjectionConfig = {
  fields: {
    name: { from: 'full_name', type: 'string', required: true },
    primary_email: { from: 'emails[0]', type: 'string', required: true },
    primary_phone: { from: 'phones[0]', type: 'string', required: false },
    skills: { from: 'skills[].name', type: 'array', required: false }
  },
  include_provenance: false,
  include_confidence: false,
  on_missing: 'omit'
};