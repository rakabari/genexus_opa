# Genexus OPA VarSeq Automation

Golden Helix workflow for creating VarSeq projects from sequencing data generated on the Thermo Fisher Scientific Ion Torrent Genexus System using the Oncomine Precision Assay (OPA).

Before this workflow runs, a separate preprocessing script collects the analysis outputs from the Genexus instruments, identifies the associated run and sample names, renames the relevant files, and copies them into the standardized Run_Data directory structure. The prepared files include VCFs, BAMs, coverage reports, sample information, and variant result files.

This workflow then locates the matching run manifest, updates the Golden Helix workspace SampleCatalog, and creates one VarSeq project for each *.vcf.gz file. It imports the sample metadata and BAM path, creates a cancer evaluation containing the imported variants, and removes negative findings generated from wildtype records.

## Input directory

The workflow uses the following directory structure:

```text
Genexus_OPA_Clinical/
├── Run_Data/
│   └── <year>/
│       └── <run_name>/
│           └── *.vcf.gz
├── Sample_Manifest/
│   └── <run_name>~manifest*.tsv
└── VarSeq_Projects/
```

Run directories are expected beneath `Run_Data/<year>/` and must contain `~` in the directory name. The portion of the manifest filename before `~manifest` must match the run directory name.

Manifests older than 60 days are moved to `Sample_Manifest/Archive` before matching.

## Processing flow

For each matching run:

1. Read the manifest and match its headers to fields in the Golden Helix `SampleCatalog`.
2. Upsert each manifest row with `gautil client catalog-upsert`.
3. Find all compressed VCF files below the run directory (vcf.gz extension for vcfs with secondary upstate filters applied).
4. Create a separate VarSeq project for each VCF.
5. Import the VCF with sample metadata and the BAM path from manifest column 19.
6. Download required project sources and wait for project tasks to finish.
7. Create a cancer evaluation, import project variants, and remove negative findings.
8. Copy the task run logs into the project directory.

A project is skipped when its copied `err.txt` log contains no error and ends with `completed successfully`.

## Project output

Projects are written as:

```text
VarSeq_Projects/<year>/<run_name>/<sample_name>/
```

The sample name is taken from the VCF filename after removing `.vcf.gz`.

## Files

| File | Purpose |
|---|---|
| `create_project.workflow.yaml` | Golden Helix workflow definition and fixed input location. |
| `create_project.task.yaml` | Task definition executed in the VSPipeline container. |
| `create_project.py` | Main run and sample processing loop. |
| `config.py` | Runtime paths and Golden Helix environment variables. |
| `workflow_utils.py` | Run discovery, manifest archiving, project checks, and VSPipeline execution. |
| `process_manifest.py` | Manifest-to-SampleCatalog field matching and catalog updates. |
| `user_create_evaluation.js` | Cancer evaluation creation, variant import, and negative-finding removal. |
| `Genexus_OPA_V1.1.vsproject-template` | VarSeq project template required by the task. |

## Golden Helix requirements

The task expects:

- A Golden Helix workspace bot account named by `{workspaceBot}`.
- The VSPipeline Docker image supplied through `VSPIPELINE_DOCKER_IMAGE`.
- `TASK_DIR` and `WORKSPACE_DIR` to be provided by the Golden Helix task runtime.
- `gautil` access to the workspace `SampleCatalog`.
- The VarSeq project template in the task directory.
- Manifest sample names and BAM paths in columns 1 and 19, respectively.

## Running the workflow

The workflow currently uses this fixed Golden Helix location:

```text
sdrive/NGS_Solid_Tumors/Genexus_OPA_Clinical
```

Run **Update Catalog and Create Project** from the Golden Helix automation interface. The workflow scans all eligible run directories and skips samples whose projects previously completed successfully.

## Failure handling

The task runs with shell error handling enabled, and VSPipeline failures stop processing. A failed or incomplete project is not treated as successful and will be attempted again on the next workflow run. Because project creation uses `overwrite=true`, the existing project path may be replaced during that retry.

## Maintainer

Ratilal Akabari  
Senior Bioinformatics Scientist  
Upstate Medical University