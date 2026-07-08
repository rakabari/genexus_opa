// @ts-check

try {
    console.log('Creating evaluation...');

    const { evaluationId } = await cancer.createEvaluation({});
    const tumorType = await cancer.getTumorType({ evaluationId });

    console.log(`Created evaluation with ID ${evaluationId} and tumor type ${tumorType.tumorType}`);
    console.log('Auto-importing variants from variant table...');

    const variantBiomarkerIds = await cancer.addProjectVariants({ evaluationId });

    console.log(`Added ${variantBiomarkerIds.length} variants to evaluation ${evaluationId}.`);

    const biomarkers = await cancer.getEvaluationBiomarkers({ evaluationId });

    /** @type {number[]} */
    const toRemove = [];

    for (const biomarker of biomarkers) {
        if (biomarker.impact === 'NEGATIVE_FINDING') {
            console.log(`Removing biomarker with negative finding: ${biomarker.mutation.name}`);
            toRemove.push(biomarker.variant.mutationId);
        }
    }

    if (toRemove.length > 0) {
        await cancer.removeMutationsFromEvaluation({
            variantIds: toRemove,
            evaluationId,
        });
    }

    console.log(`Removed ${toRemove.length} negative findings from evaluation ${evaluationId}.`);

    console.log('Running Genexus FDP/FAO/FRO depth/VAF script...');

    await cancer.runCustomScript({
        scriptName: 'upstate_genexus_dp_af',
        args: [String(evaluationId)],
        selectedFiles: [],
    });

    console.log(`Finished running Genexus depth/VAF script for evaluation ${evaluationId}.`);
    console.log('Finished creating evaluation and importing variants.');

} catch (error) {
    console.log(error);
    throw error;
}

export {};