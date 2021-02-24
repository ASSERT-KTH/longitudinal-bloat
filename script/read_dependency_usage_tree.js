const fs = require("fs")
const path = require("path")
const async = require("async")
const ProgressBar = require("progress")

const utils = require("./utils")

const ROOT = "dependency_usage_tree"

const commits_root = "../jdbl-experiments/dataset/data/commits/"
const PATH_poms = "../jdbl-experiments/dataset/data/pom_commits/"

const dependabot = JSON.parse(fs.readFileSync("../dataset/dependabot.json"))
const projectVersions = JSON.parse(fs.readFileSync("../datasetproject_versions.json"))

let projects = fs.readdirSync(ROOT)

function extractUsage(deps, usedClasses, usage, directId, level) {
    if (usage == null) {
        usage = []
        level = 1
    }
    for (let dep of deps) {
        usage.push(dep)
        if (level == 1) {
            directId = dep.groupId + ":" + dep.artifactId
        }
        for (let cl of dep.allTypes) {
            if (usedClasses[cl]) {
                usedClasses[cl].push(dep)
            }
        }
        dep.level = level
        dep.directId = directId;
        extractUsage(dep.children, usedClasses, usage, directId, level + 1)
        let childUsed = false;
        for (let child of dep.children) {
            if (child.status == "used" || child.childUsed) {
                childUsed = true;
                break;
            }
        }
        dep.childUsed = childUsed;
    }
    return usage;
}

function getDepClean(project, commit) {
    let depclean_path = path.join(ROOT, project, commit, "depclean.json")
    const content = fs.readFileSync(depclean_path).toString().replace(/: NaN,/g, ": -1,")
    return data = JSON.parse(content)
}

let countFix = 0
let countCommit = 0
let countCompilationError = 0

const bar = new ProgressBar("[:bar] :current/:total (:percent) :rate/bps :etas :step", {
    complete: "=",
    incomplete: " ",
    width: 30,
    total: projects.length,
});

console.log(`Project\tCommit\tDate\tCommitType\tProjectVersion\tDependency\tDependencyVersion\tDependencyLevel\tDirectParent\tDependencyScope\tDependencyType\tDependencyBloatStatus\tDependencyBloatFixedStatus\tIsChildUsed\tDependencyHistoryStatus\tBloatOrigin\tUsageRatio`)
async.eachSeries(projects, async (project) => {
    if (project == "executions") {
        return
    }
    const indexProject = project.indexOf("_")
    const owner = project.substring(0, indexProject)
    const p = project.substring(indexProject + 1)
    const repo = owner + "/" + p;
    commits_path = path.join(commits_root, owner, p + ".raw.json")
    if (!fs.existsSync(commits_path)) {
        console.error("missing project", commits_path)
        return
    }
    const releaseCommits = {}
    if (projectVersions[repo]) {
        for (let release in projectVersions[repo]) {
            releaseCommits[projectVersions[repo][release]] = release;
        }
    }
    let previousDeps = null;
    const commits = JSON.parse(fs.readFileSync(commits_path))
    for (let commit of commits.reverse()) {
        let depclean_path = path.join(ROOT, project, commit.sha, "depclean.json")
        if (!fs.existsSync(depclean_path)) {
            continue;
        }
        countCommit ++
        try {
            let pomPath = path.join(PATH_poms, repo, commit.sha, "pom.xml")
            const pom = await utils.parsePom(pomPath)
            if (pom.modules.length) {
                continue
            }
            const content = fs.readFileSync(depclean_path).toString().replace(/: NaN,/g, ": -1,")
            const data = JSON.parse(content)
            if (data === false || !data.dependencies) {
                countCompilationError ++
                continue;
            }
            const usedClasses = {}
            for (let cl in data.usage) {
                for (let jar in data.usage[cl]) {
                    for (let dCl of data.usage[cl][jar]) {
                        usedClasses[dCl] = []
                    }
                }
            }
            // console.log("[COMMIT]", repo, commit.sha)
            const coordinates = new Set()
            let usages = extractUsage(data.dependencies.children, usedClasses).sort((a, b) => a.level - b.level).filter(dep => {
                if (coordinates.has(dep.coordinates) || dep.omitted) {
                    return false;
                }
                coordinates.add(dep.coordinates)
                return true;
            })
            for (let cl in usedClasses) {
                usedClasses[cl].sort((a ,b) => a.level - b.level)

                if (!usedClasses[cl][0].cUsedType)
                    usedClasses[cl][0].cUsedType = []
                usedClasses[cl][0].cUsedType.push(cl)
            }
            for (let dep of usages) {
                let isBloated = "bloated"
                if (dep.cUsedType && dep.cUsedType.length) {
                    isBloated = "used"
                } else if (dep.allTypes.length == 0 && dep.status == "unknown") {
                    isBloated = "unknown"
                }
                dep.cStatus = isBloated;
                if (dep.cStatus != dep.status) {
                    // console.log("Problem", dep.coordinates, dep.cStatus, dep.status)
                    countFix ++
                }
            }

            const deps = {}
            for (let dep of usages) {
                const depId = dep.groupId + ":" + dep.artifactId + ":" + dep.directId

                let nbUsedType = 0;
                if (dep.cUsedType) {
                    nbUsedType = dep.cUsedType.length;
                }
                let usageRatio = -1;
                if (dep.allTypes && dep.allTypes.length > 0) {
                    usageRatio = nbUsedType * 1.0 / dep.allTypes.length;
                } 

                deps[depId] = {
                    version: dep.version,
                    cStatus: dep.cStatus,
                    commit: commit.sha,
                    usageRatio: usageRatio
                }
            }
            const isDependabot = dependabot[repo] ? (dependabot[repo][commit.sha] ? true : false) : false
            let commitType = "pomUpdate"
            if (isDependabot) {
                commitType = "dependabot"
            } else if (releaseCommits[commit.sha]) {
                commitType = "release"
            }

            const usageStatus = {}
            if (usages.length == 0) {
                console.error("no dep")
            }
            for (let dep of usages) {
                const depId = dep.groupId + ":" + dep.artifactId + ":" + dep.directId
                const usageRatio = deps[depId].usageRatio
                let status = "firstAnalysing"
                if (previousDeps != null) {
                    if (previousDeps[depId] == null) {
                        status = "newDep"
                    } else if (previousDeps[depId].version != dep.version) {
                        status = "newDepVersion"
                    } else {
                        if (usageRatio > -1 && previousDeps[depId].usageRatio > -1) {
                            if (usageRatio > previousDeps[depId].usageRatio) {
                                status = "usageIncrease"
                            } else if (usageRatio < previousDeps[depId].usageRatio) {
                                status = "usageDecrease"
                            } else {
                                status = "usageStable"
                            }
                        } else {
                            status = "unknownRatio"
                        }
                    }
                } 
                let bloatOrigin = "none"
                if (dep.cStatus == "bloated" && previousDeps != null) {
                    if (!previousDeps[depId]) {
                        bloatOrigin = "newDep"
                    } else if (previousDeps[depId].cStatus == dep.cStatus) {
                        bloatOrigin = "identical"
                    } else if (previousDeps[depId].cStatus == 'used') {
                        bloatOrigin = "code"
                        const dd = getDepClean(project, previousDeps[depId].commit)
                        const usedBy = []
                        for (let cl in dd.usage) {
                            const pdeps = dd.usage[cl]
                            for (let u in pdeps) {
                                if (u.indexOf(dep.groupId + ":" + dep.artifactId) == 0) {
                                    usedBy.push(cl);
                                }
                            }
                        }
                        let nbExist = 0;
                        for (let cl of usedBy) {
                            if (data.usage[cl] != null) {
                                nbExist++;
                                break
                            }
                        }
                        if (nbExist == 0) {
                            bloatOrigin = "removedCode"
                        } else {
                            bloatOrigin = "updatedCode"
                        }
                        if (previousDeps[depId].version != dep.version) {
                            bloatOrigin += " newVersion"
                        }
                    } else {
                        bloatOrigin = "unknown"
                    }
                }
                console.log(`${repo}\t${commit.sha}\t${commit.commit.author.date}\t${commitType}\t${data.dependencies.version}\t${dep.groupId + ":" + dep.artifactId}\t${dep.version}\t${dep.level}\t${dep.directId}\t${dep.scope}\t${dep.type}\t${dep.status}\t${dep.cStatus}\t${dep.childUsed}\t${status}\t${bloatOrigin}\t${usageRatio}`)
            }
            previousDeps = deps
            previousUsage = usageStatus
        } catch (error) {
            console.error(depclean_path, error)
        }
    }
    bar.tick({ step: repo + " countCommit: " + countCommit + " countFix: " + countFix + " countCompilationError: " + countCompilationError + " (" +countCompilationError/countCommit });
}, (err) => {
    console.error(err, "countCommit", countCommit, "countFix", countFix, "countCompilationError", countCompilationError, countCompilationError/countCommit)
})
