import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { runPipeline } from './pipeline/index';
import { defaultConfig } from './config/defaultConfig';
import { ProjectionConfigSchema } from './config/projectionTypes';
import { adapterMap as adapterRegistry } from './adapters/registry';

const program = new Command();

program
  .name('candidate-transformer')
  .description('Deterministic Profile Fusion & Data Extraction Pipeline')
  .version('1.0.0')
  .option('--csv <path>', 'Path to recruiter CSV export file')
  .option('--ats <path>', 'Path to ATS JSON export file')
  .option('--github <pathOrUsername>', 'Path to GitHub JSON profile or a username string')
  .option('--resume <path>', 'Path to resume text/pdf/docx file')
  .option('--config <path>', 'Path to custom projection JSON config file')
  .option('--explain', 'Include detailed _conflicts tracking array in stdout/file output')
  .option('--out <path>', 'Path to write final JSON output instead of printing to stdout')
  .action(async (options) => {
    try {
      let activeConfig = defaultConfig;

      if (options.config) {
        const configPath = path.resolve(options.config);
        if (!fs.existsSync(configPath)) {
          console.error(`Error: Configuration file not found at ${configPath}`);
          process.exit(1);
        }
        const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const validated = ProjectionConfigSchema.safeParse(rawConfig);
        if (!validated.success) {
          console.error('Error: Invalid configuration schema layout provided:', validated.error.errors);
          process.exit(1);
        }
        activeConfig = validated.data;
      }

      const rawInputs: { csv?: any[]; ats?: any[]; github?: any[]; resume?: any[] } = {};

      if (options.csv) {
        const csvPath = path.resolve(options.csv);
        if (fs.existsSync(csvPath)) {
          const content = fs.readFileSync(csvPath, 'utf-8');
          const fields = adapterRegistry.csv.extract(content);
          rawInputs.csv = [fields];
        }
      }

      if (options.ats) {
        const atsPath = path.resolve(options.ats);
        if (fs.existsSync(atsPath)) {
          const content = fs.readFileSync(atsPath, 'utf-8');
          const fields = adapterRegistry.ats_json.extract(content);
          rawInputs.ats = [fields];
        }
      }

      if (options.github) {
        const ghPath = path.resolve(options.github);
        if (fs.existsSync(ghPath)) {
          const content = fs.readFileSync(ghPath, 'utf-8');
          const fields = adapterRegistry.github.extract(content);
          rawInputs.github = [fields];
        }
      }

      if (options.resume) {
        const resumePath = path.resolve(options.resume);
        if (fs.existsSync(resumePath)) {
          const content = fs.readFileSync(resumePath, 'utf-8');
          const fields = adapterRegistry.resume.extract(content);
          rawInputs.resume = [fields];
        }
      }

      const outputData = runPipeline(rawInputs, activeConfig);

      if (!options.explain) {
        for (const record of outputData) {
          if (record && typeof record === 'object') {
            delete record._conflicts;
          }
        }
      }

      const formattedJson = JSON.stringify(outputData, null, 2);

      if (options.out) {
        const outPath = path.resolve(options.out);
        fs.writeFileSync(outPath, formattedJson, 'utf-8');
        console.log(`Pipeline execution completed successfully. Output saved to: ${outPath}`);
      } else {
        console.log(formattedJson);
      }
    } catch (err: any) {
      console.error(`Pipeline Execution Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);