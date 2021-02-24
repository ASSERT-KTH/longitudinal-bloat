import os
import datetime
import json
import statistics as stat


dependabot = json.load(open("../dataset/project_dependabot.json", 'r'))
PATH_COMMITS = "../jdbl-experiments/dataset/data/commits/"
PATH = '../dependency_usage_tree.csv'

def macro(name, value):
    print(f'\\def\\{name}{{{value}}}')

def difference_in_months(start_date, end_date):
    return (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)

def toTable(name, data):
    data.sort()            
    min = data[0]
    max = data[-1]
    half_list = int(len(data)//2)
    upper_quartile = stat.median(data[-half_list:])
    lower_quartile = stat.median(data[:half_list])
    median = stat.median(data)
    average = stat.mean(data)

    values = [min, lower_quartile, median, average, upper_quartile, max]
    output = f"{name} "
    for value in values:
        output += f"& \\np{{{round(value, 2)}}} "
    
    return output + "\\\\"

projects = {}
dependencies = set()
bloated_dependencies = set()
datasets = {'release': set(), 'pomUpdate': set(), 'dependabot': set()}
commit_dates = {'release': [], 'pomUpdate': [], 'dependabot': []}
nbDep = {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}
nbBloat = {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}
nbFullBloat = {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}

nbUpdated = {'release': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0},'dependabot': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}}
nbUpdatedBloat = {'release': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0},'dependabot': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}}

nbDepUpdated = {'release': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0},'dependabot': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}}
nbDepUpdatedBloat = {'release': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0},'dependabot': {'direct': 0, 'transitive': 0, 'unknown': 0, 'inherited': 0}}

DependencyHistoryStatus = {}
bloatOrigin = {}
countBloatIntroducedByUpdatedDep = 0

bloatedDep = {}

projectsDepStats = {}

with open(PATH, 'r') as fd:
    line = fd.readline()
    header = line.strip().split('\t')
    line = fd.readline()

    previousCommit = None
    updatedBloated = set()
    previousCommitDirectDep = {}
    directDep = {}

    while line:
        elements = line.strip().split('\t')

        data = {}
        for i in range(len(header)):
            try:
                data[header[i]] = elements[i]
            except :
                print(line)
        data['Date'] = datetime.datetime.strptime(data['Date'], '%Y-%m-%dT%H:%M:%SZ')

        if data['Project'] not in projects:
            projects[data['Project']] = []
            projectsDepStats[data['Project']] = {}
        if data['Commit'] not in projectsDepStats[data['Project']]:
            projects[data['Project']].append(data['Commit'])
            projectsDepStats[data['Project']][data['Commit']] = {
                'nbDirect': 0,
                'nbTransitive': 0
            }
        if data['DependencyType'] == 'direct':
            projectsDepStats[data['Project']][data['Commit']]['nbDirect'] += 1           
        else:
            projectsDepStats[data['Project']][data['Commit']]['nbTransitive'] += 1

        line = fd.readline()

        

with open(PATH, 'r') as fd:
    line = fd.readline()
    header = line.strip().split('\t')
    line = fd.readline()

    previousCommit = None
    updatedBloated = set()
    previousCommitDirectDep = {}
    directDep = {}

    while line:
        elements = line.strip().split('\t')

        data = {}
        for i in range(len(header)):
            data[header[i]] = elements[i]
        data['Date'] = datetime.datetime.strptime(data['Date'], '%Y-%m-%dT%H:%M:%SZ')

        if len(projects[data['Project']]) < 2:
            line = fd.readline()
            continue

        datasets[data['CommitType']].add(data['Commit'])
        nbDep[data['DependencyType']] += 1

        isDependabotProject = data['Project'] in dependabot
        
        if previousCommit != data['Commit']:
            # print(previousCommit, len(updatedBloated), previousCommitDirectDep.values())
            # for dep in directDep:
            #     if dep in previousCommitDirectDep and len(previousCommitDirectDep[dep]) < len(directDep[dep]):
            #         # print(dep, previousCommitDirectDep[dep])
            #         print(data['Project'], previousCommit, data['Commit'], dep, len(previousCommitDirectDep[dep]), len(directDep[dep]), len(directDep[dep]) - len(previousCommitDirectDep[dep]))
            for dep in updatedBloated:
                if len(previousCommitDirectDep[dep]) < len(directDep[dep]):
                    countBloatIntroducedByUpdatedDep +=  len(directDep[dep]) - len(previousCommitDirectDep[dep])
            previousCommit = data['Commit']
            previousCommitDirectDep = directDep
            directDep = {}
            updatedBloated = set()
        

        if data['DirectParent'] not in directDep:
            directDep[data['DirectParent']] = set()
        directDep[data['DirectParent']].add(data['Dependency'])

        commit_dates[data['CommitType']].append(data['Date'])

        if data['DependencyHistoryStatus'] == "newDepVersion":
            nbUpdated[data['CommitType']][data['DependencyType']] += 1
            if isDependabotProject:
                nbDepUpdated[data['CommitType']][data['DependencyType']] += 1
            
        dependencies.add(data['Dependency'])
        if data['DependencyBloatFixedStatus'] == 'bloated':
            bloated_dependencies.add(data['Dependency'])

            nbBloat[data['DependencyType']] += 1
            if data['IsChildUsed'] == 'true':
                nbFullBloat[data['DependencyType']] += 1
            if (data['DependencyHistoryStatus'] == 'newDep' or data['DependencyHistoryStatus'] == 'firstAnalysing') and data['DependencyType'] == 'direct':
                if data['Dependency'] not in bloatedDep:
                    bloatedDep[data['Dependency']] = 0
                bloatedDep[data['Dependency']] += 1
            if data['DependencyHistoryStatus'] == "newDepVersion":
                nbUpdatedBloat[data['CommitType']][data['DependencyType']] += 1
                if isDependabotProject:
                    nbDepUpdatedBloat[data['CommitType']][data['DependencyType']] += 1
                if data['DependencyType'] == 'direct':
                    updatedBloated.add(data['Dependency'])
        
        

        if data['DependencyType'] not in bloatOrigin:
            bloatOrigin[data['DependencyType']] = {}
        if data['BloatOrigin'] not in bloatOrigin[data['DependencyType']]:
            bloatOrigin[data['DependencyType']][data['BloatOrigin']] = 0
        bloatOrigin[data['DependencyType']][data['BloatOrigin']] += 1

        if data['DependencyType'] not in DependencyHistoryStatus:
            DependencyHistoryStatus[data['DependencyType']] = {}
        if data['DependencyHistoryStatus'] not in DependencyHistoryStatus[data['DependencyType']]:
            DependencyHistoryStatus[data['DependencyType']][data['DependencyHistoryStatus']] = 0
        DependencyHistoryStatus[data['DependencyType']][data['DependencyHistoryStatus']] += 1
        

        line = fd.readline()
    
    print("# Projects", len(projects))
    print("# Dataset Release:", len(datasets['release']), "PomUpdate", len(datasets['pomUpdate']), "Dependabot", len(datasets['dependabot']))
    print("First commit Release:", min(commit_dates['release']), "PomUpdate", "Dependabot", min(commit_dates['dependabot']))
    print("Last commit Release:", max(commit_dates['release']), "PomUpdate", "Dependabot", max(commit_dates['dependabot']))
    print("# Deps", nbDep)
    print("# Bloats", nbBloat)
    print("nbUpdated", nbUpdated)
    print("nbUpdatedBloat", nbUpdatedBloat)
    print("nbDepUpdated", nbUpdated)
    print("nbDepUpdatedBloat", nbUpdatedBloat)
    print("countBloatIntroducedByUpdatedDep", countBloatIntroducedByUpdatedDep)
    print("# Bloats with used child", nbFullBloat)
    print("Origin of the bloat", bloatOrigin)
    print("DependencyHistoryStatus", DependencyHistoryStatus)

    index = 0
    for (dep, value) in sorted(bloatedDep.items(), key=lambda item: item[1], reverse=True):
        if index > 50:
            break
        print(dep, value)
        index += 1

    nbSingleCommit = 0
    for project in projects:
        if len(projects[project]) < 2:
            nbSingleCommit += 1
    macro("nbProjectsNum", len(projects) - nbSingleCommit)
    macro("nbReleasesNum", len(datasets['release']))
    macro("nbDependabotNum", len(datasets['dependabot']))

    macro("nbDependenciesNum", len(dependencies))
    macro("nbBloatedDependenciesNum", len(bloated_dependencies))

    macro("nbUsedUpdateNum", nbUpdated['release']['direct'])
    macro("nbBloatUpdateNum", nbUpdatedBloat['release']['direct'])

    macro("nbDepUsedUpdateNum", nbDepUpdated['release']['direct'])
    macro("nbDepBloatUpdateNum", nbDepUpdatedBloat['release']['direct'])

    macro("nbUsedDependabotUpdateNum", nbUpdated['dependabot']['direct'])
    macro("nbBloatDependabotUpdateNum", nbUpdatedBloat['dependabot']['direct'])

    macro("nbBloatIntroducedByUpdateNum", countBloatIntroducedByUpdatedDep)


    macro("originTransitiveBloatNewDepNum", bloatOrigin['transitive']['newDep'] + bloatOrigin['inherited']['newDep'])
    macro("originTransitiveBloatRemoveNum", bloatOrigin['transitive']['removedCode'] + bloatOrigin['inherited']['removedCode'] + bloatOrigin['transitive']["removedCode newVersion"] + bloatOrigin['inherited']["removedCode newVersion"])
    macro("originTransitiveBloatUpdateNum", bloatOrigin['transitive']['updatedCode'] + bloatOrigin['inherited']['updatedCode'] + bloatOrigin['transitive']["updatedCode newVersion"] + bloatOrigin['inherited']["updatedCode newVersion"])
    macro("originTransitiveBloatNewVersionNum", bloatOrigin['transitive']["updatedCode newVersion"] + bloatOrigin['inherited']["updatedCode newVersion"])
    
    macro("originDirectBloatNewDepNum", bloatOrigin['direct']['newDep'])
    macro("originDirectBloatRemoveNum", bloatOrigin['direct']['removedCode'] + bloatOrigin['direct']["removedCode newVersion"])
    macro("originDirectBloatUpdateNum", bloatOrigin['direct']['updatedCode'] + bloatOrigin['direct']["updatedCode newVersion"])
    macro("originDirectBloatNewVersionNum", bloatOrigin['direct']["updatedCode newVersion"])


    print("Table 1")

    months = []
    analyzedCommits = []
    direct_init = []
    direct_last = []
    transitive_init = []
    transitive_last = []
    for project in projects:
        if len(projects[project]) == 1:
            continue
        
        project_commits_path = os.path.join(PATH_COMMITS, project + ".raw.json")
        project_commits = json.load(open(project_commits_path, 'r'))

        last_commit = datetime.datetime.strptime(project_commits[0]['commit']['author']['date'], '%Y-%m-%dT%H:%M:%SZ')
        first_commit = datetime.datetime.strptime(project_commits[-1]['commit']['author']['date'], '%Y-%m-%dT%H:%M:%SZ')
        
        months.append(difference_in_months(first_commit, last_commit))

        analyzedCommits.append(len(projects[project]))
        direct_init.append(projectsDepStats[project][projects[project][0]]['nbDirect'])
        transitive_init.append(projectsDepStats[project][projects[project][0]]['nbTransitive'])

        direct_last.append(projectsDepStats[project][projects[project][-1]]['nbDirect'])
        transitive_last.append(projectsDepStats[project][projects[project][-1]]['nbTransitive'])

    print(toTable("\# Months", months))
    print(toTable("\# Analyzed commits", analyzedCommits))
    print(toTable("\# Direct initial", direct_init))
    print(toTable("\# Direct final", direct_last))
    print(toTable("\# Transitive initial", transitive_init))
    print(toTable("\# Transitive final", transitive_last))
    