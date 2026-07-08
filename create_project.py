#!/usr/bin/env python3
"""Create one VarSeq project and cancer evaluation per vcf.gz sample."""

import os, sys
from config import *
from process_manifest import *
from workflow_utils import *

def main():
    os.makedirs(os.environ["GH_CRASH_DUMP_DIR"], exist_ok=True)
    os.makedirs(os.environ["GH_TEMPDIR"], exist_ok=True)

    for run_dir in get_runs_to_process():
        base_name = os.path.basename(run_dir)

        # Manifest processing
        # print(f"INFO: {base_name} - Processing")
        manifest_file = find_manifest(manifests, base_name)
        if not manifest_file:
            continue

        print(f"INFO: {base_name} - Manifest found - Updating SampleCatalog")
        process_manifest(manifest_file)

        # VCF processing
        vcf_paths = find_vcfs(run_dir)
        if not vcf_paths:
            print(f"WARN: {run_dir} - No vcf.gz files found - Skipping")
            continue

        project_root = f"{projects}/{get_run_year(run_dir)}/{base_name}"
        os.makedirs(project_root, exist_ok=True)

        for vcf_path in vcf_paths:
            sample_name = os.path.basename(vcf_path).removesuffix(".vcf.gz")
            project_path = f"{project_root}/{sample_name}"

            if os.path.isdir(project_path) and is_project_successful(project_path):
                print(f"INFO: {base_name}/{sample_name}: ""Project already exists and successful - Skipping")
                continue

            print(f"INFO: {base_name}/{sample_name} - Starting VarSeq project creation")
            process_vcf(project_path, vcf_path, manifest_file)
            print(f"INFO: {base_name}/{sample_name} - Completed VarSeq project creation")

if __name__ == "__main__":
    main()