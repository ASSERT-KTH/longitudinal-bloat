const fs = require("fs")
const fse = require('fs-extra');
const path = require("path")

function toCSV() {
    return ([...arguments].join("\t")) + "\n"
}

// const ROOT = "resultsDependabot"
// const ROOT2ANALYZE = "resultsBloatedCommit"
// const ROOT_UPDATE_DEP = "resultsChangedPom"
// const ROOT_FINAL = "../dependency_usage_tree"

const ROOT_PROJECT_INFO = "/home/thomas/git/jdbl-experiments/dataset/data/repo_details/"
const PATH_COMMITS = "../jdbl-experiments/dataset/data/commits/"


const versions = JSON.parse(fs.readFileSync("../dataset/project_releases.json"))
const dependabot = JSON.parse(fs.readFileSync("../dataset/project_dependabot.json"))
// const updatePom = JSON.parse(fs.readFileSync("commitsChangeDeps.json"))

let projects = Object.keys(versions)

projects_commits = {}
for (let project of projects) {
    let commits = Object.values(versions[project])
    let dependabotCommits = []
    let updatedPoms = []

    if (dependabot[project]) {
        dependabotCommits = Object.keys(dependabot[project])
    }
    commits = [...new Set(commits.concat(dependabotCommits).concat(updatedPoms))]
    projects_commits[project] = commits
}

projects = projects.filter(a => projects_commits[a]).sort((a, b) => Object.keys(versions[b]).length - Object.keys(versions[a]).length)


let id = 0
const dependabotProjects = new Set()

projectOutput = toCSV("Project ID", "Project", "Stars", "NbCommits", "Repo Creation Date", "First Commit Date", "Last Commit Date")
commitOutput = toCSV("Project ID", "Project", "Commit", "Origin")

for (let project of projects) {
    id++
    if (id > 500) {
        break
    }

    const p_info = JSON.parse(fs.readFileSync(path.join(ROOT_PROJECT_INFO, project + ".json")))
    const commits = JSON.parse(fs.readFileSync(path.join(PATH_COMMITS, project + ".raw.json")))
    const commitsDate = {}
    for (let commit of commits) {
        commitsDate[commit.sha] = commit.commit.author.date;
    }
    projectOutput += toCSV(id, project, p_info.stargazers_count, commits.length, p_info.created_at, commits[commits.length - 1].commit.author.date, commits[0].commit.author.date)

    for (let commit of projects_commits[project]) {
        let origin = "release"
        if (dependabot[project] && dependabot[project][commit]) {
            origin = "dependabot"
            dependabotProjects.add(project)
        }
        commitOutput += toCSV(id, project, commit, commitsDate[commit], origin)

        // let depclean_path = path.join(ROOT, project.replace("/", "_"), commit)
        // if (!fs.existsSync(depclean_path)) {
        //     depclean_path = path.join(ROOT_UPDATE_DEP, project.replace("/", "_"), commit)
        //     if (!fs.existsSync(depclean_path)) {
        //         depclean_path = path.join(ROOT2ANALYZE, project.replace("/", "_"), commit)
        //         if (!fs.existsSync(depclean_path)) {
        //             continue;
        //         }
        //     }
        // }
        // fs.mkdirSync(path.join(ROOT_FINAL, project), true)
        // fse.copySync(depclean_path, path.join(ROOT_FINAL, project.replace("/", "_"), commit), { overwrite: true }, function (err) {
        //     if (err) {
        //         console.error(err);
        //     } else {
        //         console.error("success!");
        //     }
        // });
    }
}

fs.writeFileSync("../dataset/commits.csv", commitOutput)
fs.writeFileSync("../dataset/projects.csv", projectOutput)