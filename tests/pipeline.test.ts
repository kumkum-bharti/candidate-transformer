import { describe, it, expect } from 'vitest';
import { normalizePhone, normalizeDate, canonicalizeSkill } from '../src/pipeline/normalize';
import { mergeField, matchCandidates } from '../src/pipeline/merge';
import { runPipeline } from '../src/pipeline/index';
import { defaultConfig } from '../src/config/defaultConfig';
import { ExtractedField } from '../src/types';

describe('Phase 2: Data Normalization Core Unit Tests', () => {
  it('should format messy phone values to standard E.164 strings', () => {
    expect(normalizePhone('9876543210', 'IN')).toBe('+919876543210');
    expect(normalizePhone('+91 98765-43210', 'IN')).toBe('+919876543210');
  });

  it('should standardize variations of date strings', () => {
    expect(normalizeDate('2024-06')).toBe('2024-06');
    expect(normalizeDate('June 2024')).toBe('2024-06');
    expect(normalizeDate('06/2024')).toBe('2024-06');
    expect(normalizeDate('invalid-date')).toBeNull();
  });

  it('should map technical tool variants to canonical names', () => {
    expect(canonicalizeSkill('js')).toBe('JavaScript');
    expect(canonicalizeSkill('reactjs')).toBe('React');
    expect(canonicalizeSkill('python')).toBe('Python');
  });
});

describe('Phase 3: Conflict Resolution Core Unit Tests', () => {
  it('should prioritize structured corporate sources over unstructured portfolios for current_company', () => {
    const dataPayload = [
      { value: 'Google', source: 'ats_json' as const },
      { value: 'Personal Project Inc', source: 'github' as const }
    ];
    const result = mergeField('current_company', dataPayload);
    expect(result.value).toBe('Google');
    expect(result.conflict).toBeDefined();
    expect(result.conflict?.field).toBe('current_company');
  });
});

describe('Phase 8: End-to-End Pipeline Integration Verification', () => {
  it('should execute full transformation sequence against mock profiles', () => {
    const mockCsvRow: ExtractedField[] = [
      { field: 'full_name', value: 'Kumkum Bharti', source: 'csv', method: 'direct', recordIndex: 0 },
      { field: 'emails', value: 'kumkum.bharti@example.com', source: 'csv', method: 'direct', recordIndex: 0 },
      { field: 'phones', value: '9876543210', source: 'csv', method: 'direct', recordIndex: 0 },
      { field: 'current_company', value: 'CSV Corp', source: 'csv', method: 'direct', recordIndex: 0 }
    ];

    const mockAtsRow: ExtractedField[] = [
      { field: 'full_name', value: 'Kumkum Bharti', source: 'ats_json', method: 'direct', recordIndex: 0 },
      { field: 'emails', value: 'kumkum.bharti@example.com', source: 'ats_json', method: 'direct', recordIndex: 0 },
      { field: 'current_company', value: 'ATS Systems', source: 'ats_json', method: 'direct', recordIndex: 0 }
    ];

    const pipelineOutputs = runPipeline({ csv: [mockCsvRow], ats: [mockAtsRow] }, defaultConfig);
    
    expect(pipelineOutputs.length).toBe(1);
    expect(pipelineOutputs[0].name).toBe('Kumkum Bharti');
    expect(pipelineOutputs[0].phones).toContain('+919876543210');
    expect(pipelineOutputs[0]._conflicts).toBeDefined();
  });
});