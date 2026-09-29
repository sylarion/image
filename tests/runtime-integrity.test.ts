import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GarmentSceneAnalyzer, GeminiSceneSchema } from '../lib/vision/scene-analyzer';
import { getRuntimeAIStatus } from '../lib/ai/config';
import { VisualDetectionPipeline } from '../lib/vision';
import { getAnalysisRunRepository } from '../lib/storage/analysis-run.repository';
import { getImageStorage } from '../lib/storage/image-storage';
import { normalizeImage } from '../lib/images/normalizer';
import { createSelectedProduction } from '../lib/production/selection';
import { VisualWizardAdapters } from '../features/wizard/models/wizard.types';
import { SourceImage } from '../types';
import { POST as upload } from '../app/api/uploads/route';
import { POST as analyze } from '../app/api/vision/analyze-scene/route';
import { POST as create } from '../app/api/projects/route';

async function main() {
 const originalFetch=global.fetch;
 const env={mode:process.env.AI_MODE,key:process.env.GEMINI_API_KEY,provider:process.env.ANALYSIS_PROVIDER};
 try {
  const bytes=await fs.readFile('tests/fixtures/real-catalog-five-variants.png');
  const form=new FormData(); form.append('file',new File([bytes],'real-catalog-five-variants.png',{type:'image/png'}));
  const uploaded=await (await upload(new Request('http://localhost/api/uploads',{method:'POST',body:form}))).json();
  assert.equal(uploaded.success,true);
  const source:SourceImage=uploaded.data;
  process.env.AI_MODE='real'; process.env.ANALYSIS_PROVIDER='gemini'; delete process.env.GEMINI_API_KEY;
  assert.equal(getRuntimeAIStatus().mode,'REAL'); assert.equal(getRuntimeAIStatus().apiKeyConfigured,false);
  await assert.rejects(new VisualDetectionPipeline().processSourceImages([source]),/ANALYSIS_UNAVAILABLE/);
  const failed=await getAnalysisRunRepository().getLatest();
  assert.equal(failed?.mode,'REAL'); assert.equal(failed?.status,'FAILED'); assert.equal(failed?.fallbackUsed,false);
  assert.equal(failed?.detections.length,0);
  process.env.GEMINI_API_KEY='unit-placeholder';
  global.fetch=async()=>new Response('unavailable',{status:503});
  // Filename, fixture hash and NODE_ENV=test cannot bypass real failure.
  await assert.rejects(new GarmentSceneAnalyzer().analyzeScene(source),/ANALYSIS_UNAVAILABLE/);
  await assert.rejects(new GarmentSceneAnalyzer().analyzeScene({...source,originalFilename:'mono-fixture-back.jpg'}),/ANALYSIS_UNAVAILABLE/);

  const output={sceneType:'MULTIPLE_VARIANTS',imageRole:'MULTI_VIEW',confidence:0.9,garments:[
    {boundingBox:{x:0.05,y:0.1,width:0.3,height:0.6},confidence:0.9,probableCategory:'Remera',dominantColor:{name:'Celeste',hex:'#44aabb',confidence:0.9},orientation:'FRONT'},
    {boundingBox:{x:0.4,y:0.1,width:0.3,height:0.6},confidence:0.9,probableCategory:'Remera',dominantColor:{name:'Negro',hex:'#111111',confidence:0.9},orientation:'FRONT'},
  ]};
  global.fetch=async(url,init)=> {
    assert.ok(!String(url).includes('unit-placeholder'));
    const payload=JSON.parse(String(init?.body));
    const inline=payload.contents[0].parts[1].inline_data;
    const stored=await getImageStorage().get(source.storageKey);
    assert.deepEqual(Buffer.from(inline.data,'base64'),stored);
    assert.ok(payload.contents[0].parts[0].text.includes('DETECT EVERY VISIBLE GARMENT INDIVIDUALLY.'));
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]});
  };
  const contract=await new GarmentSceneAnalyzer().analyzeScene(source);
  assert.equal(contract.garments.length,2);
  assert.equal(GeminiSceneSchema.safeParse({...output,garments:[{...output.garments[0],boundingBox:{x:0,y:0,width:0,height:1}}]}).success,false);
  global.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:'{"garments":[{}]}'}]}}]});
  await assert.rejects(new GarmentSceneAnalyzer().analyzeScene(source),/ANALYSIS_UNAVAILABLE/);
  global.fetch=originalFetch;
  process.env.AI_MODE='mock'; delete process.env.GEMINI_API_KEY;
  const unrelatedCapture = {
    ...source,
    originalFilename: 'Captura_de_pantalla_2026-09-28_103332.png',
    sha256: 'c312f96d46a42365c8629ca27ead9227d1f2a100f58ddad6b09855359a4c2df9',
  };
  const showcaseAnalysis = new GarmentSceneAnalyzer().mockSceneAnalysis(unrelatedCapture);
  assert.equal(showcaseAnalysis.garments.length, 7, 'The known showcase fixture must preserve its seven physical dresses');
  assert.deepEqual(showcaseAnalysis.garments.map((garment) => garment.dominantColor.name), ['Verde salvia', 'Negro', 'Bordó', 'Rosa viejo', 'Celeste', 'Beige', 'Crudo estampado']);
  const response=await analyze(new Request('http://localhost/api/vision/analyze-scene',{method:'POST',body:JSON.stringify({sourceImageIds:[source.id]})}));
  const publicResult=await response.json(); assert.equal(publicResult.success,true);
  for(const field of ['provider','confidence','sha256','garmentDNA','boundingBox','observedVariants']) assert.ok(!JSON.stringify(publicResult).includes('"'+field+'"'));
  const run=(await getAnalysisRunRepository().getById(publicResult.data.analysisRunId))!;
  assert.equal(run.mode,'MOCK'); assert.equal(run.fallbackUsed,false);
  assert.equal(run.detections.length,run.crops.length); assert.equal(run.crops.length,run.observedVariants.length);
  for (const observation of run.observedVariants) {
    assert.equal(observation.analysisRunId,run.analysisRunId);
    assert.ok(run.crops.some(c=>c.id===observation.cropId && c.detectionId===observation.detectionId));
    assert.ok(run.productGroups.flatMap(g=>g.variants).some(v=>v.observedVariantIds?.includes(observation.id!)));
  }
  for (const crop of run.crops) assert.ok((await getImageStorage().get(crop.storageKey))!.length>0);
  const products=VisualWizardAdapters.toProductChoices({analyses:run.analyses,crops:run.crops,productGroups:run.productGroups,observability:{} as never});
  assert.equal(products.flatMap(p=>p.colors).length,run.executionMetrics.finalVariantsCount);
  const p=products[0]; assert.ok(p.colors.length>=3);
  const selection={analysisRunId:run.analysisRunId,products:[{productGroupId:p.id,
    identity:{...p.confirmedIdentity!,confirmedName:'Blusa de hojas',confirmedCategory:'Blusa',source:'USER_CORRECTED'},
    selectedVariantIds:p.colors.slice(0,3).map(c=>c.id),customColorNames:{[p.colors[0].id]:'Verde seco'}}],
    shots:['FRONT','SIDE','BACK','ACTION'],destination:'INSTAGRAM',style:'LIFESTYLE',modelId:'model-male-mateo',expectedJobs:12};
  const project=createSelectedProduction(run,selection);
  assert.equal(project.jobs.length,12); assert.equal(project.garment.name,'Blusa de hojas');
  assert.equal(project.garment.colorVariants[0].name,'Verde seco');
  assert.equal(project.garment.colorVariants[0].approximateHex,p.colors[0].hex);
  assert.equal(project.model.modelId,'model-male-mateo');
  assert.ok(project.jobs.every(j=>j.aspectRatio==='4:5' && j.productionStyle==='LIFESTYLE' && j.analysisRunId===run.analysisRunId));
  assert.ok(!project.jobs.some(j=>j.colorVariantId===p.colors[3]?.id));
  assert.throws(()=>createSelectedProduction(run,{...selection,expectedJobs:13}),/JOB_COUNT_MISMATCH/);
  assert.throws(()=>createSelectedProduction(run,{...selection,shots:['FRONT','FRONT']}));
  assert.throws(()=>createSelectedProduction(run,{...selection,products:[{...selection.products[0],selectedVariantIds:['unknown']}]}));
  const persisted=await (await create(new Request('http://localhost/api/projects',{method:'POST',body:JSON.stringify(selection)}))).json();
  assert.ok(persisted.success, `Project route must succeed in test mode: ${JSON.stringify(persisted)}`);
  assert.equal(persisted.data.jobs.length,12);
  const final=await getAnalysisRunRepository().getById(run.analysisRunId);
  assert.equal(final?.expectedJobs,12); assert.equal(final?.actualJobs,12);
  assert.ok(!JSON.stringify(final).includes('unit-placeholder'));
  console.log('PASS: UNIT MOCK TEST — multipart bytes, mocked transport contract, fail-closed REAL runtime, provenance, human selection, 3 x 4 = 12 persisted jobs. NOT real Gemini acceptance.');
 } finally {
  global.fetch=originalFetch;
  for (const [key,value] of Object.entries({AI_MODE:env.mode,GEMINI_API_KEY:env.key,ANALYSIS_PROVIDER:env.provider})) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
