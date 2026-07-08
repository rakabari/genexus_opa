// @ts-check

/**
 * Genexus / Ion Torrent — copy vendor FORMAT fields into the evaluation state.
 *
 * Problem this solves:
 *   Thermo Fisher Genexus (Ion Torrent) VCFs report read depth and allele
 *   fraction with flow-evaluator FORMAT tags — FDP (flow-corrected depth),
 *   FAO (flow-corrected alt-allele observations) and FRO (flow-corrected
 *   ref-allele observations) — rather than the DP / AD / AF tags VarSeq maps to
 *   depth and VAF by default. When those defaults are absent, VSClinical falls
 *   back to deriving depth and VAF from the raw AO / RO counts, which do not
 *   match the numbers the instrument reported. This script reads the correct
 *   FORMAT fields straight off the imported variant source and writes them onto
 *   each variant in the evaluation, so the corrected values flow into BOTH the
 *   auto-generated report JSON and the shipped VSClinical clinical report — no
 *   forking of the report template required.
 *
 * Script context: evaluation / custom script (`script_cancer.js`). Runs inside a
 * cancer (AMP) evaluation. The evaluation id arrives in `args[0]`, extended by
 * the evaluation "Scripts" action or a `vspipeline` run-custom-script step.
 * Run it before report generation; the standard report render then reads the
 * corrected evaluation state.
 *
 * How it works:
 *   1. Resolve the evaluation's sampleId (FORMAT fields are per-sample).
 *   2. Walk the evaluation's VARIANT biomarkers.
 *   3. For each, follow its project-table link (projectAxisUuid /
 *      projectRecordId) to the primary imported variant source (algKey
 *      'variants') and read FDP / FAO / FRO for this sample.
 *   4. Overwrite the evaluation's depth and VAF via `cancer.updateReadDepths`
 *      and `cancer.updateVariantAlleleFrequency`.
 *
 * @type {import('../@types/custom_script').CustomScript}
 */

// --- Configuration ---------------------------------------------------------
// The primary imported-variant source on the variant table. A standard VarSeq
// variant import exposes its per-sample FORMAT columns on this source.
const VARIANT_SOURCE_ALG_KEY = 'variants';

// Genexus / Ion Torrent flow-evaluator FORMAT tags, given as the *field symbols*
// VarSeq exposes them under. Confirm the exact symbols in the variant table's
// Details panel (Field Information -> Symbol): the symbol usually matches the VCF
// tag, but VarSeq may disambiguate on a name collision. Set DIAGNOSE_FIELDS =
// true for one run to log every symbol available on the variant source.
const TOTAL_DEPTH_FIELD = 'FDP'; // flow-evaluator total read depth
const ALT_COUNT_FIELD = 'FAO'; // flow-evaluator alt-allele observation count
const REF_COUNT_FIELD = 'FRO'; // flow-evaluator ref-allele observation count (optional)

// Genexus also emits a flow-corrected allele-frequency FORMAT tag (AF = FAO/FDP).
// If you would rather trust the vendor's value than recompute it, set this to the
// AF field symbol and it will be used verbatim; leave null to compute FAO/FDP.
const AF_FIELD = null;

// One-time discovery aid: logs the field symbols on the variant source for the
// first variant seen, then stops. Use it once to find the exact symbols, then
// set back to false.
const DIAGNOSE_FIELDS = false;
// ---------------------------------------------------------------------------

export default {
    description: 'Genexus: copy FDP/FAO/FRO into evaluation depth & VAF',
    icon: 'gear',
    fileFilter: undefined,

    async run({
        selected, inputs, api: { table, project, cancer, core }, args,
    }) {
        try {
            // args is a string[]; the evaluation id is supplied by the run context.
            const [evalId] = args;
            const evaluationId = parseInt(evalId);

            // FORMAT fields are per-sample; resolve the sample this evaluation is on.
            const { sampleId } = await cancer.getSampleState({ evaluationId });

            const biomarkers = await cancer.getEvaluationBiomarkers({ evaluationId });

            let updated = 0;
            let skipped = 0;
            let diagnosed = false;

            for (const biomarker of biomarkers) {
                // Only small variants carry FORMAT read counts — skip CNVs, SVs,
                // fusions, and auto-generated wild-type negative findings.
                if (biomarker.variant.type !== 'VARIANT') {
                    continue;
                }

                const biomarkerId = biomarker.id;
                const variant = await cancer.getVariant({ biomarkerId, evaluationId });

                // projectAxisUuid / projectRecordId link the evaluation variant back to
                // its record on the project variant table. Manually-entered variants have
                // neither — leave their values untouched.
                const projectTableUuid = variant.projectAxisUuid;
                const projectRecordId = variant.projectRecordId;
                if (projectTableUuid == null || projectRecordId == null) {
                    skipped++;
                    continue;
                }

                // Resolve the primary imported-variant source on this variant's table.
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

                // One-time diagnostic: dump every field symbol so you can confirm the
                // Genexus tags exist and are spelled as configured above.
                if (DIAGNOSE_FIELDS && !diagnosed) {
                    console.log('Variant source fields (name -> symbol):');
                    console.log(JSON.stringify(
                        variantSource.fields.map(f => ({ name: f.name, symbol: f.symbol })),
                        null,
                        2,
                    ));
                    diagnosed = true;
                }

                const fieldSymbols = [TOTAL_DEPTH_FIELD, ALT_COUNT_FIELD, REF_COUNT_FIELD];
                if (AF_FIELD) {
                    fieldSymbols.push(AF_FIELD);
                }

                const [record] = await project.projectTableRecords({
                    sourceUrl: variantSource.url,
                    recordId: projectRecordId,
                    sampleId, // required: FDP/FAO/FRO are per-sample FORMAT fields
                    fieldSymbols,
                });
                if (record == null) {
                    skipped++;
                    continue;
                }

                const totalDepth = firstNumber(record[0]); // FDP
                const altDepth = firstNumber(record[1]); // FAO
                // const refDepth = firstNumber(record[2]); // FRO (if you prefer FAO/(FAO+FRO))
                const reportedAf = AF_FIELD ? firstNumber(record[3]) : null;

                // If the Genexus tags are not present on this variant (e.g. it came from a
                // different caller), leave the built-in values in place rather than writing
                // nulls over them.
                if (totalDepth == null || altDepth == null) {
                    skipped++;
                    continue;
                }

                // Depth / counts: totalDepth = FDP, altDepth = FAO.
                await cancer.updateReadDepths({ evaluationId, biomarkerId, altDepth, totalDepth });

                // VAF = the vendor AF field if configured, else FAO / FDP (Thermo Fisher's
                // definition). FAO/FDP differs from FAO/(FAO+FRO) because FDP counts reads
                // not assigned to ref or alt — pick one convention and keep it consistent.
                let vaf = reportedAf;
                if (vaf == null && totalDepth > 0) {
                    vaf = altDepth / totalDepth;
                }
                if (vaf != null) {
                    await cancer.updateVariantAlleleFrequency({ evaluationId, biomarkerId, vaf });
                }

                updated++;
            }

            console.log(`Genexus depth/VAF: updated ${updated} variant(s), skipped ${skipped}.`);
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
};

/**
 * Read a numeric value from a project-table field that may come back as a scalar,
 * a per-allele array (Number=A FORMAT fields such as FAO can decompose to a
 * one-element array), or null/'null'. Returns the first finite number, else null.
 * @param {any} value
 * @returns {number | null}
 */
function firstNumber(value) {
    const pick = Array.isArray(value)
        ? value.find(v => v != null && v !== 'null')
        : value;
    const n = typeof pick === 'string' ? parseFloat(pick) : pick;
    return Number.isFinite(n) ? n : null;
}
