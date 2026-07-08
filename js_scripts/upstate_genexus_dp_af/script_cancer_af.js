// @ts-check

console.log('GENEXUS FDP/AF SCRIPT_CANCER TOP LEVEL LOADED');

const VARIANT_SOURCE_ALG_KEY = 'variants';
const TOTAL_DEPTH_FIELD = 'FDP';
const AF_FIELD = 'AF';
const DIAGNOSE_FIELDS = false;

try {
    console.log('GENEXUS FDP/AF TOP LEVEL STARTED');

    // In VSPipeline workflow scripts, the current AMP workflow/evaluation context
    // should be active after set_current_workflow.
    //
    // If args are available, use args[0]. Otherwise assume evaluation 0 for the
    // newly-created evaluation.
    const evaluationId =
        typeof args !== 'undefined' && args && args[0] != null
            ? parseInt(args[0])
            : 0;

    if (!Number.isFinite(evaluationId)) {
        throw new Error(`Invalid evaluationId. args=${JSON.stringify(args)}`);
    }

    console.log(`GENEXUS FDP/AF evaluationId = ${evaluationId}`);

    const { sampleId } = await cancer.getSampleState({ evaluationId });
    console.log(`GENEXUS FDP/AF sampleId = ${sampleId}`);

    const biomarkers = await cancer.getEvaluationBiomarkers({ evaluationId });

    let updated = 0;
    let skipped = 0;
    let diagnosed = false;

    for (const biomarker of biomarkers) {
        if (biomarker.variant.type !== 'VARIANT') {
            continue;
        }

        const biomarkerId = biomarker.id;
        const variant = await cancer.getVariant({ biomarkerId, evaluationId });

        const projectTableUuid = variant.projectAxisUuid;
        const projectRecordId = variant.projectRecordId;

        if (projectTableUuid == null || projectRecordId == null) {
            skipped++;
            continue;
        }

        console.log(
            `GENEXUS FDP/AF biomarkerId=${biomarkerId}, tableUuid=${projectTableUuid}, recordId=${projectRecordId}`
        );

        const sources = await project.projectTableSources({
            uuid: projectTableUuid,
            algKey: VARIANT_SOURCE_ALG_KEY,
        });

        const variantSource =
            sources.find(s => s.algKey === VARIANT_SOURCE_ALG_KEY) || sources[0];

        if (variantSource == null) {
            skipped++;
            continue;
        }

        if (DIAGNOSE_FIELDS && !diagnosed) {
            console.log('Variant source fields name -> symbol:');
            console.log(JSON.stringify(
                variantSource.fields.map(f => ({ name: f.name, symbol: f.symbol })),
                null,
                2
            ));
            diagnosed = true;
        }

        const [record] = await project.projectTableRecords({
            sourceUrl: variantSource.url,
            recordId: projectRecordId,
            sampleId,
            fieldSymbols: [TOTAL_DEPTH_FIELD, AF_FIELD],
        });

        if (record == null) {
            skipped++;
            continue;
        }

        const totalDepth = firstNumber(record[0]);
        const vaf = firstNumber(record[1]);

        if (totalDepth == null || vaf == null) {
            skipped++;
            continue;
        }

        await cancer.updateReadDepths({
            evaluationId,
            biomarkerId,
            totalDepth
        });

        await cancer.updateVariantAlleleFrequency({
            evaluationId,
            biomarkerId,
            vaf
        });

        updated++;
    }

    console.log(`Genexus depth/VAF: updated ${updated} variant(s), skipped ${skipped}.`);

} catch (error) {
    console.log(error);
    throw error;
}

function firstNumber(value) {
    const pick = Array.isArray(value)
        ? value.find(v => v != null && v !== 'null')
        : value;

    const n = typeof pick === 'string' ? parseFloat(pick) : pick;
    return Number.isFinite(n) ? n : null;
}

export {};