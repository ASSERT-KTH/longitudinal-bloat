const pomParser = require("pom-parser");

module.exports.parsePom = function (filePath) {
    return new Promise((resolve, reject) => {
        pomParser.parse({ filePath }, (err, pomResponse) => {
            if (err) {
                return reject(err);
            }
            if (!pomResponse.pomObject || !pomResponse.pomObject.project) {
                return reject("Invalid POM file")
            }
            const pom = pomResponse.pomObject.project;
            let groupId = pom.groupid;
            if (groupId == null && pom.parent != null) {
                groupId = pom.parent.groupid;
            }
            let artifactId = pom.artifactid;
            if (artifactId == null && pom.parent != null) {
                artifactId = pom.parent.artifactId;
            }

            const parentId = module.exports.removeEndNumber(
                groupId + ":" + artifactId
            );
            const output = {
                groupId,
                artifactId,
                parentId,
                version: module.exports.getVersion(pom, pom.version),
                java_version: module.exports.getJavaVersion(pom),
                dependencies: new Set(),
                modules: []
            };
            if (pom.modules && pom.modules.module) {
                if (!Array.isArray(pom.modules.module)) {
                    pom.modules.module = [pom.modules.module];
                }
                output.modules = pom.modules.module
            }
            if (pom.dependencies && pom.dependencies.dependency) {
                if (!Array.isArray(pom.dependencies.dependency)) {
                    pom.dependencies.dependency = [pom.dependencies.dependency];
                }
                for (let dependency of pom.dependencies.dependency) {
                    let id = module.exports.removeEndNumber(
                        dependency.groupid + ":" + dependency.artifactid
                    );
                    let version = module.exports.getVersion(
                        pom,
                        dependency.version,
                        dependency.groupid,
                        dependency.artifactid
                    );
                    output.dependencies.add({
                        id,
                        groupId: dependency.groupid,
                        artifactId: dependency.artifactid,
                        version,
                        scope: dependency.scope
                    });
                }
            }
            return resolve(output);
        });
    });
};

module.exports.removeEndNumber = function (id) {
    while (!isNaN(id[id.length - 1])) {
        id = id.substring(0, id.length - 1);
    }
    return id;
};

module.exports.getVersion = (pom, version, groupId, artifactId) => {
    if (Array.isArray(version)) {
        version = version[0];
    }
    if (version == null || version.length == 0) {
        if (groupId != null && artifactId != null  && pom.dependencymanagement && pom.dependencymanagement.dependencies) {
            let deps = pom.dependencymanagement.dependencies.dependency;
            if (!Array.isArray(deps)) {
                deps = [deps];
            }
            for (let dep of deps) {
                if (dep.groupid == groupId && dep.artifactid == artifactId) {
                    return module.exports.getVersion(pom, dep.version);
                }
            }
        }
        return version;
    }
    if (version[0] == "$") {
        const variable = version.substring(2, version.length - 1);
        if (
            variable == "project.parent.version" &&
            pom.parent &&
            pom.parent.version
        ) {
            return module.exports.getVersion(pom, pom.parent.version);
        }
        if (pom.properties) {
            if (pom.properties[variable]) {
                return module.exports.getVersion(pom, pom.properties[variable]);
            }
            for (let property in pom.properties) {
                if (property.toLocaleLowerCase() == variable.toLocaleLowerCase()) {
                    return module.exports.getVersion(pom, pom.properties[property]);
                }
            }
        }
        if (variable == "project.version") {
            if (pom.version == version) {
                console.log(pom);
                return null;
            }
            return module.exports.getVersion(pom, pom.version);
        }
    }
    return version;
};
module.exports.getJavaVersion = function (pom) {
    if (pom.properties) {
        if (pom.properties["maven.compiler.source"]) {
            return module.exports.getVersion(pom, pom.properties["maven.compiler.source"]);
        }
        if (pom.properties["java.version"]) {
            return module.exports.getVersion(pom, pom.properties["java.version"]);
        }
        if (pom.properties["maven.compiler.release"]) {
            return module.exports.getVersion(pom, pom.properties["maven.compiler.release"]);
        }
    }
    if (pom.build && pom.build.plugins && pom.build.plugins.plugin) {
        if (!Array.isArray(pom.build.plugins.plugin)) {
            pom.build.plugins.plugin = [pom.build.plugins.plugin];
        }
        for (let plugin of pom.build.plugins.plugin) {
            if (plugin.artifactid == "maven-compiler-plugin") {
                if (plugin.configuration) {
                    if (plugin.configuration.source) {
                        return module.exports.getVersion(pom, plugin.configuration.source);
                    }
                    if (plugin.configuration.release) {
                        return module.exports.getVersion(pom, plugin.configuration.release);
                    }
                }
            }
        }
    }
    return undefined;
}