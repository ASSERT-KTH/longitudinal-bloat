# A Longitudinal Analysis of Bloated Java Dependencies

This repository contains the data and script for the paper "A Longitudinal Analysis of Bloated Java Dependencies"

## Repository Structure

```
- dataset
  - projects.csv            # list of 500 projects used in the paper
  - commits.csv             # list of commits that are analyzed
  - project_dependabot.json # dependabot commits for each project
  - project_releases.json   # commits associated to a release for each project
- dependency_usage_tree
  - <project>
    - <commit>
      - depclean.json       # the dependency usage tree extracted by Deplean
      - compile.log.zip     # Maven compilation log
      - depClean.log.zip    # Deplean log
- script
  - create_dataset.js       # ceate projects.csv and commits.csv based on project_releases.json and project_dependabot.json
  - read_dependency_usage_tree.js # extract the information from dependency_usage_tree and generate a csv file
  - analysis.py             # read dependency_usage_tree.csv and generate the macro and table for the paper
```
