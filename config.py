#!/usr/bin/env python3
"""Shared paths and Golden Helix runtime configuration."""

import argparse
import os

parser = argparse.ArgumentParser()
parser.add_argument("base_path")
args = parser.parse_args()
base_path = os.path.abspath(args.base_path)

task_dir = os.environ["TASK_DIR"]
workspace_dir = os.environ["WORKSPACE_DIR"]

# VSPipeline and gautil use these locations for workspace data and temporary files.
os.environ["GOLDENHELIX_USERDATA"] = f"{workspace_dir}/AppData"
os.environ["GH_CRASH_DUMP_DIR"] = f"{workspace_dir}/AppData/VarSeq/User Data"
os.environ["GH_TEMPDIR"] = "/scratch"

run_data = f"{base_path}/Run_Data"
manifests = f"{base_path}/Sample_Manifest"
projects = f"{base_path}/VarSeq_Projects"
template = f"{task_dir}/Genexus_OPA_v1.vsproject-template"
manifest_script = f"{task_dir}/process_manifest.py"

workspace_userdata = f"{workspace_dir}/AppData/VarSeq/User Data"
create_evaluation = f"{workspace_userdata}/ReportTemplates/upstate_import_variants_to_eval/script_cancer.js"

# upstate_genexus_dp_af_ratie = f"{workspace_dir}/AppData/VarSeq/User Data/ReportTemplates/upstate_genexus_dp_af_ratie"
# copy_fdp_af_to_evaluation = f"{workspace_dir}/AppData/VarSeq/User Data/ReportTemplates/upstate_genexus_dp_af_ratie/script_cancer.js"
# create_evaluation = f"{task_dir}/user_create_evaluation_and_copy_fdp_af.js"
# create_evaluation = f"{task_dir}/user_create_evaluation.js"
# copy_fdp_af_to_evaluation = f"{task_dir}/user_fdp_af_to_evaluation.js"
# /home/ghuser/Workspace/AppData/VarSeq/User Data/ReportTemplates/Upstate_Cancer_Gene_Panel_Template/