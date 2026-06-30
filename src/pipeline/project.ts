import { CanonicalCandidate } from '../types';
import { ProjectionConfig } from '../config/projectionTypes';
import { normalizePhone, normalizeDate, normalizeCountry, canonicalizeSkill } from './normalize';

function applyOverride(value: any, override?: string): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(v => applyOverride(v, override));
  }
  if (typeof value === 'object') return value;
  
  const str = String(value);
  switch (override) {
    case 'phone': return normalizePhone(str);
    case 'date': return normalizeDate(str);
    case 'country': return normalizeCountry(str) ?? str;
    case 'skill': return canonicalizeSkill(str);
    default: return value;
  }
}

export function project(record: CanonicalCandidate, config: ProjectionConfig): unknown {
  const result: Record<string, any> = {};
  const data = JSON.parse(JSON.stringify(record));

  for (const [outputKey, fieldConfig] of Object.entries(config.fields)) {
    const path = fieldConfig.from;
    let extractedValue: any = undefined;

    if (path.includes('[].')) {
      const [arrayPart, propPart] = path.split('[].');
      const targetArray = data[arrayPart];
      if (Array.isArray(targetArray)) {
        extractedValue = targetArray
          .map((item: any) => (item && typeof item === 'object' ? item[propPart] : undefined))
          .filter((v) => v !== undefined && v !== null);
      }
    } else if (path.endsWith('[0]')) {
      const arrayKey = path.replace('[0]', '');
      const targetArray = data[arrayKey];
      if (Array.isArray(targetArray) && targetArray.length > 0) {
        extractedValue = targetArray[0];
      }
    } else if (path.includes('.')) {
      const parts = path.split('.');
      let current = data;
      for (const part of parts) {
        if (current && typeof current === 'object') {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }
      extractedValue = current;
    } else {
      extractedValue = data[path];
    }

    if (fieldConfig.normalizeOverride) {
      extractedValue = applyOverride(extractedValue, fieldConfig.normalizeOverride);
    }

    if (
      extractedValue === undefined || 
      extractedValue === null || 
      (Array.isArray(extractedValue) && extractedValue.length === 0)
    ) {
      if (fieldConfig.required && config.on_missing === 'error') {
        throw new Error(`Required field missing: ${outputKey}`);
      }
      if (config.on_missing === 'omit') {
        continue;
      }
      result[outputKey] = null;
    } else {
      result[outputKey] = extractedValue;
    }
  }

  if (config.include_provenance && data.provenance) {
    result._provenance = data.provenance;
  }
  
  if (config.include_confidence && data.overall_confidence !== undefined) {
    result._confidence = data.overall_confidence;
  }

  if (data._conflicts && data._conflicts.length > 0) {
    result._conflicts = data._conflicts;
  }

  return result;
}