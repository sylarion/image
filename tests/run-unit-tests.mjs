import { spawnSync } from 'node:child_process';
const files = ['model-catalog','hardening','phase-a-ingestion','phase-b-detection','phase-c-dna','wizard-identity','wizard-e2e-correction','runtime-integrity','multi-garment-flow-redesign','generation-runner','pre-generation-cost-quote','job-runner-resilience'];
for (const name of files) {
 console.log(`UNIT MOCK TEST: ${name}`);
 const result = spawnSync(process.execPath,['--import','tsx',`tests/${name}.test.ts`],{stdio:'inherit',env:{...process.env,NODE_ENV:'test',AI_MODE:'mock'}});
 if (result.status !== 0) process.exit(result.status || 1);
}
