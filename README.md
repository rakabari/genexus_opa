# Run VSPipeline

This repository contains a task for creating variant analysis projects from VCF files using VSPipeline project templates.

## Overview

The VSPipeline task automates project creation by processing a directory of input VCF files with a specified project template. Additional versions of this task with extended input options may be added in the future.

## Prerequisites

Before running the VSPipeline task, ensure that the **SampleCatalog** is updated with associations between samples and their corresponding BAM files. The task uses the SampleCatalog to look up BAM files for samples identified in the VCF files.

This prerequisite is required if your project template performs BAM file analysis, such as coverage statistics or quality metrics.

## Update Sample Catalog from Manifest

The `update_catalog_from_manifest.task.yaml` file provides a helper utility to populate or update the SampleCatalog from a TSV or CSV manifest file. This task simplifies the process of importing sample information into the workspace.

### Key Features

- Supports TSV and CSV file formats
- Updates BAM file paths for samples
- Can import any patient or sample metadata for reporting purposes

This utility should be used prior to running the VSPipeline task if you need to associate samples with BAM files or add additional metadata for downstream reporting.

## VSPipeline Task

The `vspipeline.task.yaml` file defines a task that creates a project from a template and a collection of VCF files.

It will import all `*.vcf.gz` files in the selected Input Folder.

### Task Parameters

- **Project Template**: Template configuration for project creation
- **Input VCF Directory**: Directory containing VCF files to process
- **Output Location**: Directory where the project will be created
- **Sample Catalog**: The default workspace sample catalog is used to associate samples with their BAM files

