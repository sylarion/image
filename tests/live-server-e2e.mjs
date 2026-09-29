import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

async function main() {
  console.log('🚀 Testing LIVE SERVER E2E on http://localhost:3000...\n');

  // 0. Check health
  const statusRes = await fetch('http://localhost:3000/api/engine-status');
  assert.equal(statusRes.status, 200, 'Server must be running');
  console.log('0. Live server is UP and responding');

  // 1. Multipart Form Upload
  console.log('\n1. Uploading real fixture via multipart/form-data to /api/uploads...');
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'real-catalog-five-variants.png');
  const fileBytes = fs.readFileSync(fixturePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileBytes], { type: 'image/png' }), 'real-catalog-five-variants.png');

  const uploadRes = await fetch('http://localhost:3000/api/uploads', {
    method: 'POST',
    body: formData,
  });
  assert.ok(uploadRes.status === 200 || uploadRes.status === 201, 'Upload must succeed with 200 or 201');
  const uploadJson = await uploadRes.json();
  assert.ok(uploadJson.success);
  const sourceImage = uploadJson.data;
  console.log(`   ✓ Uploaded: ${sourceImage.id} (${sourceImage.width}x${sourceImage.height}, SHA: ${sourceImage.sha256.slice(0, 16)}...)`);

  // 2. Visual Scene Analysis & Cropping
  console.log('\n2. Calling /api/vision/analyze-scene with uploaded sourceImageId...');
  const analyzeRes = await fetch('http://localhost:3000/api/vision/analyze-scene', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceImageIds: [sourceImage.id] }),
  });
  assert.equal(analyzeRes.status, 200, 'Analyze scene must succeed with 200');
  const analyzeJson = await analyzeRes.json();
  console.log('analyzeJson:', JSON.stringify(analyzeJson, null, 2));
  assert.ok(analyzeJson.success);
  const { analysisRunId, products, sanityCheck } = analyzeJson.data;

  console.log(`   ✓ AnalysisRun ID: ${analysisRunId}`);
  assert.ok(sanityCheck, 'Sanity check must be returned');
  assert.equal(sanityCheck.passed, true, 'Sanity check must pass');
  assert.equal(sanityCheck.instanceCount, 5, '5 physical garment instances');
  assert.equal(sanityCheck.cropCount, 5, '5 physical crops');
  assert.equal(sanityCheck.productGroupCount, 1, '1 product group');
  assert.equal(sanityCheck.variantCount, 5, '5 variants');
  console.log(`   ✓ Sanity Check: PASS (5 instances -> 5 crops -> 1 product -> 5 variants)`);

  assert.equal(products.length, 1, 'Exactly 1 product choice');
  const product = products[0];
  assert.equal(product.colors.length, 5, 'Exactly 5 color options');
  console.log(`   ✓ Colors detected: ${product.colors.map(c => `${c.name} (${c.hex})`).join(', ')}`);
  for (const c of product.colors) {
    assert.ok(c.cropUrl.startsWith('/uploads/crop-'), 'Every color has an individual physical crop');
  }

  // 3. User Selection & Production Configuration
  console.log('\n3. Simulating User Selection in Wizard:');
  console.log('   - Confirmed commercial name: "Remera de morley estampada"');
  console.log('   - 3 variants selected: Negro, Verde Agua, Beige');
  console.log('   - 4 shots chosen: FRONT, SIDE, BACK, ACTION');
  console.log('   - Destination: INSTAGRAM, Style: LIFESTYLE');

  const selectedColors = product.colors.filter(c =>
    c.name.toLowerCase().includes('negro') ||
    c.name.toLowerCase().includes('verde') ||
    c.name.toLowerCase().includes('beige')
  );
  assert.equal(selectedColors.length, 3, 'Must match exactly 3 colors');

  const projectPayload = {
    analysisRunId,
    products: [
      {
        productGroupId: product.id,
        identity: {
          productGroupId: product.id,
          aiSuggestedName: product.title,
          aiSuggestedCategory: product.category,
          confirmedName: 'Remera de morley estampada',
          confirmedCategory: 'Remera',
          source: 'USER_CORRECTED',
          confirmedAt: new Date().toISOString(),
        },
        selectedVariantIds: selectedColors.map(c => c.id),
        customColorNames: {},
      },
    ],
    shots: ['FRONT', 'SIDE', 'BACK', 'ACTION'],
    destination: 'INSTAGRAM',
    style: 'LIFESTYLE',
    modelId: 'model-female-sofia',
    expectedJobs: 12,
  };

  // 4. Create Production Project
  console.log('\n4. Calling POST /api/projects to create production project...');
  const projectRes = await fetch('http://localhost:3000/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectPayload),
  });
  assert.equal(projectRes.status, 201, 'Project creation must succeed with 201');
  const projectJson = await projectRes.json();
  assert.ok(projectJson.success);
  const project = projectJson.data;

  console.log(`   ✓ Created Project: ${project.id} - "${project.name}"`);
  assert.equal(project.garment.name, 'Remera de morley estampada', 'Name matches user confirmed identity');
  assert.equal(project.garment.colorVariants.length, 3, 'Exactly 3 color variants persisted');
  assert.equal(project.jobs.length, 12, 'EXACTLY 12 generation jobs created (3 colors x 4 shots)');

  // 5. Query Jobs API
  console.log('\n5. Querying GET /api/projects/:id/jobs to verify persisted backend jobs...');
  const jobsRes = await fetch(`http://localhost:3000/api/projects/${project.id}/jobs`);
  assert.equal(jobsRes.status, 200);
  const jobsJson = await jobsRes.json();
  assert.ok(jobsJson.success);
  const jobs = jobsJson.data;

  assert.equal(jobs.length, 12, 'Backend database has strictly 12 jobs');
  console.log(`   ✓ Backend Jobs Count: ${jobs.length}`);

  console.log('\nJobs summary:');
  jobs.forEach((j, i) => {
    console.log(`     [Job ${i + 1}] ${j.label} | Style: ${j.productionStyle} | Ratio: ${j.aspectRatio} | Status: ${j.status}`);
  });

  console.log('\n======================================================');
  console.log('LIVE SERVER ACCEPTANCE GATE RESULTS:');
  console.log('SERVER: http://localhost:3000');
  console.log('INPUT IMAGE: real-catalog-five-variants.png');
  console.log('DETECTED GARMENTS: 5');
  console.log('PHYSICAL CROPS: 5');
  console.log('PRODUCT GROUPS: 1');
  console.log('FINAL VARIANTS: 5');
  console.log('USER CONFIRMED NAME: Remera de morley estampada');
  console.log('USER SELECTED VARIANTS: 3 (Negro, Verde Agua, Beige)');
  console.log('REQUESTED SHOTS: 4');
  console.log('EXPECTED JOBS: 12');
  console.log('ACTUAL BACKEND JOBS: 12');
  console.log('INVARIANT SATISFIED: 3 x 4 = 12 (Ni 4, ni 16, ni 48)');
  console.log('ACCEPTANCE GATE: PASS');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('❌ LIVE SERVER E2E FAILED:', err);
  process.exit(1);
});
