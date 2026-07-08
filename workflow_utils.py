#!/usr/bin/env python3
"""File discovery and VSPipeline helpers for the Genexus OPA workflow."""

import glob
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime

from config import *


def clean_name(name):
    return name.split("~manifest")[0]


def get_run_year(run_dir):
    run_dir = os.path.normpath(run_dir)
    year = os.path.basename(os.path.dirname(run_dir))
    
    # run folders stored beneath a four-digit year directory.
    if not (year.isdigit() and len(year) == 4):
        year = datetime.fromtimestamp(os.path.getmtime(run_dir)).year
    
    return year


def archive_manifests(manifest_dir, days_old=60):
    archive_dir = os.path.join(manifest_dir, "Archive")
    os.makedirs(archive_dir, exist_ok=True)
    cutoff_time = time.time() - (days_old * 24 * 60 * 60)

    for filename in os.listdir(manifest_dir):
        file_path = f"{manifest_dir}/{filename}"
        if os.path.isfile(file_path):
            if os.path.getmtime(file_path) < cutoff_time:
                shutil.move(file_path, f"{archive_dir}/{filename}")


def find_manifest(manifest_dir, base_name):
    archive_manifests(manifest_dir, days_old=60)

    for filename in os.listdir(manifest_dir):
        if base_name == clean_name(filename):
            return os.path.join(manifest_dir, filename)

    return ""


def find_vcfs(run_dir):
    vcf_paths = []

    for root, _, files in os.walk(run_dir):
        for filename in files:
            if filename.endswith(".vcf.gz"):
                vcf_paths.append(os.path.join(root, filename))

    return vcf_paths


def is_project_successful(project_dir):
    project_name = os.path.basename(project_dir)

    if not os.path.isdir(project_dir):
        return False


    for log_dir in os.listdir(project_dir):
        if not log_dir.startswith("run_"):
            continue
        
        # A copied task run is complete only when err.txt ends cleanly.
        err_log = os.path.join(project_dir, log_dir, "err.txt")
        if not os.path.isfile(err_log):
            print(f"INFO: {project_name}: Error log does not exist: {err_log}")
            continue

        with open(err_log, "r", encoding="utf-8") as err:
            lines = err.readlines()

        if not lines:
            continue

        text = "".join(lines).lower()
        last_line = lines[-1].strip().lower()
        if "error" not in text and "completed successfully" in last_line:
            return True

    return False


def get_runs_to_process():
    run_dirs = []

    run_data_pattern = os.path.join(run_data, "*", "*")
    for run_dir in glob.glob(run_data_pattern):
        if not os.path.isdir(run_dir):
            continue

        # run directories include a tilde (processed raw genexus data using secondary scripts)
        if "~" not in os.path.basename(run_dir):
            continue

        run_dirs.append(run_dir)

    if not run_dirs:
        print("INFO: No runs to process: Exiting workflow")
        sys.exit(0)

    return run_dirs


def process_vcf(project_path, vcf_path, manifest_path):
    command = f"""
    /opt/vspipeline/vspipeline \
        -c 'get_version' \
        -c 'project_create path="{project_path}" template="{template}" overwrite=true' \
        -c 'import files="{vcf_path}" \
            sample_fields_file="{manifest_path}" \
            sample_fields_name_col=1 \
            sample_fields_bam_col=19 \
            sample_fields_bam_relative=false' \
        -c 'download_required_sources' \
        -c 'task_wait' \
        -c 'get_task_list' \
        -c 'set_current_workflow workflow="amp" id="Workflow1"' \
        -c 'run_workflow_script "{create_evaluation}"' \
        -c 'task_wait' \
        -c 'get_task_list' \
        -c 'project_save' \
        -c 'project_close'
    """

    subprocess.run(command, shell=True, check=True)
    # Preserve the Golden Helix task logs with the project for restart checks.
    subprocess.run(f"cp -r {os.path.dirname(os.getcwd())} {project_path}", check=True, shell=True)
    # subprocess.run(["cp", "-r", os.path.dirname(os.getcwd()), project_path], check=True)
