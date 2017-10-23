"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var util_1 = require("./util");
var logger_impl_1 = require("./logger-impl");
var ts_project_service_new_1 = require("./ts-project-service-new");
function getSessionNew(TypeScriptSession, TypeScriptProjectService, TypeScriptCommandNames, logger, host, ts_impl, defaultOptionsHolder, mainFile, projectEmittedWithAllFiles) {
    ts_project_service_new_1.extendProjectServiceNew(TypeScriptProjectService, ts_impl, host, projectEmittedWithAllFiles);
    var IDESession = /** @class */ (function (_super) {
        __extends(IDESession, _super);
        function IDESession() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        IDESession.prototype.reloadFileFromDisk = function (info) {
            info.reloadFromFile();
        };
        IDESession.prototype.getScriptInfo = function (projectService, fileName) {
            return projectService && projectService.getScriptInfoForNormalizedPath(fileName);
        };
        IDESession.prototype.appendGlobalErrors = function (result, processedProjects, empty) {
            var _this = this;
            try {
                result = _super.prototype.appendGlobalErrors.call(this, result, processedProjects, empty);
                if (!processedProjects)
                    return result;
                var _loop_1 = function (projectName) {
                    if (processedProjects.hasOwnProperty(projectName)) {
                        var processedProject_1 = processedProjects[projectName];
                        var anyProject = processedProject_1;
                        var errors = anyProject.getProjectErrors ?
                            anyProject.getProjectErrors() :
                            //ts2.5 method
                            anyProject.getGlobalProjectErrors();
                        if (errors && errors.length > 0) {
                            var items = errors.map(function (el) { return _this.formatDiagnostic(projectName, processedProject_1, el); });
                            result = result.concat({
                                file: projectName,
                                diagnostics: items
                            });
                        }
                    }
                };
                for (var projectName in processedProjects) {
                    _loop_1(projectName);
                }
                return result;
            }
            catch (err) {
                logger_impl_1.serverLogger("Error appending global project errors " + err.message, true);
            }
            return result;
        };
        IDESession.prototype.beforeFirstMessage = function () {
            var _this = this;
            if (defaultOptionsHolder.options != null) {
                var serviceDefaults_1 = this.getProjectService().getCompilerOptionsForInferredProjects();
                this.setDefaultOptions(serviceDefaults_1);
                defaultOptionsHolder.watchConfig(function () {
                    _this.setDefaultOptions(serviceDefaults_1);
                }, ts_impl);
                if (defaultOptionsHolder.configFileName) {
                    var projectService = this.getProjectService();
                    logger_impl_1.serverLogger("Opening external project for config " + defaultOptionsHolder.configFileName, true);
                    projectService.openExternalProject({
                        projectFileName: defaultOptionsHolder.configFileName,
                        rootFiles: [{ fileName: defaultOptionsHolder.configFileName }],
                        options: {}
                    });
                }
            }
            _super.prototype.beforeFirstMessage.call(this);
        };
        IDESession.prototype.setDefaultOptions = function (serviceDefaults) {
            if (serviceDefaults === void 0) { serviceDefaults = {}; }
            var result = {};
            util_1.copyPropertiesInto(serviceDefaults, result);
            var compilerOptions = defaultOptionsHolder.options;
            if (compilerOptions && compilerOptions.compileOnSave == null) {
                result.compileOnSave = true;
            }
            util_1.copyPropertiesInto(compilerOptions, result);
            this.getProjectService().setCompilerOptionsForInferredProjects(result);
        };
        IDESession.prototype.setNewLine = function (project, options) {
            //todo lsHost is a private field
            var host = project.lsHost || project;
            if (!host) {
                logger_impl_1.serverLogger("API was changed host is not found", true);
                return;
            }
            if (host && ts_impl.getNewLineCharacter) {
                host.getNewLine = function () {
                    return ts_impl.getNewLineCharacter(options ? options : {});
                };
            }
        };
        IDESession.prototype.getCompileOptionsEx = function (project) {
            if (project.getCompilerOptions) {
                return project.getCompilerOptions();
            }
            return project.getCompilationSettings();
        };
        IDESession.prototype.needRecompile = function (project) {
            if (!project)
                return true;
            var compilerOptions = this.getCompileOptionsEx(project);
            if (compilerOptions && compilerOptions.___processed_marker) {
                return project.compileOnSaveEnabled;
            }
            return true;
        };
        IDESession.prototype.afterCompileProcess = function (project, requestedFile, wasOpened) {
            if (project) {
                var projectService = this.getProjectService();
                var externalProjects = projectService.externalProjects;
                for (var _i = 0, externalProjects_1 = externalProjects; _i < externalProjects_1.length; _i++) {
                    var project_1 = externalProjects_1[_i];
                    //close old projects
                    var projectName = this.getProjectName(project_1);
                    logger_impl_1.serverLogger("Close external project " + projectName, true);
                    projectService.closeExternalProject(projectName);
                }
                if (wasOpened) {
                    logger_impl_1.serverLogger("Close the opened file", true);
                    this.closeClientFileEx(requestedFile);
                }
            }
        };
        IDESession.prototype.isExternalProject = function (project) {
            var projectKind = project.projectKind;
            return projectKind && projectKind == ts_impl.server.ProjectKind.External;
        };
        IDESession.prototype.getProjectForCompileRequest = function (req, normalizedRequestedFile) {
            if (req.file) {
                var projectService = this.getProjectService();
                var project = void 0;
                try {
                    var project_2 = this.getProjectForFileEx(normalizedRequestedFile);
                }
                catch (e) {
                    //no project
                }
                if (project) {
                    return { project: project };
                }
                project = this.getFromExistingProject(normalizedRequestedFile);
                if (project) {
                    return { project: project };
                }
                var openClientFile = projectService.openClientFileWithNormalizedPath(normalizedRequestedFile);
                project = this.getFromExistingProject(normalizedRequestedFile);
                var configFileNameForExternalProject = openClientFile.configFileName;
                if (project && openClientFile && configFileNameForExternalProject) {
                    projectService.openExternalProject({
                        projectFileName: configFileNameForExternalProject,
                        rootFiles: [{ fileName: configFileNameForExternalProject }],
                        options: {}
                    });
                    //reduce memory usage: 'old' project will be closed only after 'new' project was created
                    //so we don't release source files
                    projectService.closeClientFile(normalizedRequestedFile);
                    var externalProject = projectService.findProject(configFileNameForExternalProject);
                    if (externalProject != null) {
                        logger_impl_1.serverLogger("External Project was created for compiling", true);
                        return { project: externalProject, wasOpened: false };
                    }
                    else {
                        logger_impl_1.serverLogger("Error while creating External Project for compiling", true);
                    }
                }
                else {
                    logger_impl_1.serverLogger("File was opened for compiling", true);
                    return { project: project, wasOpened: true };
                }
            }
            else if (req.projectFileName) {
                var projectService = this.getProjectService();
                var configProject = projectService.findProject(normalizedRequestedFile);
                if (configProject) {
                    return { project: configProject, wasOpened: false };
                }
                logger_impl_1.serverLogger("External project was created for compiling project", true);
                projectService.openExternalProject({
                    projectFileName: normalizedRequestedFile,
                    rootFiles: [{ fileName: normalizedRequestedFile }],
                    options: {}
                });
                var externalProject = projectService.findProject(normalizedRequestedFile);
                if (externalProject != null) {
                    logger_impl_1.serverLogger("External Project(2) was created for compiling", true);
                    return { project: externalProject };
                }
                else {
                    logger_impl_1.serverLogger("Error while creating External Project(2) for compiling", true);
                }
            }
            return { project: null };
        };
        IDESession.prototype.positionToLineOffset = function (project, fileName, position) {
            //todo review performance
            var scriptInfo = this.getProjectService().getScriptInfo(fileName);
            if (!scriptInfo) {
                logger_impl_1.serverLogger("ERROR! Cannot find script info for file " + fileName, true);
                return undefined;
            }
            return scriptInfo.positionToLineOffset(position);
        };
        IDESession.prototype.containsFileEx = function (project, file, reqOpen) {
            return project.containsFile(file, reqOpen);
        };
        IDESession.prototype.getProjectName = function (project) {
            return project.getProjectName();
        };
        IDESession.prototype.getProjectConfigPathEx = function (project) {
            if (this.isExternalProject(project)) {
                return this.getProjectName(project);
            }
            //ts2.2
            if (project.getConfigFilePath) {
                return project.getConfigFilePath();
            }
            var configFileName = project.configFileName;
            return configFileName;
        };
        IDESession.prototype.executeCommand = function (request) {
            var startTime = this.getTime();
            var command = request.command;
            try {
                if (TypeScriptCommandNames.Open == command || TypeScriptCommandNames.Close == command) {
                    _super.prototype.executeCommand.call(this, request);
                    //open | close command doesn't send answer so we have to override
                    return util_1.doneRequest;
                }
                else if (TypeScriptCommandNames.ReloadProjects == command) {
                    projectEmittedWithAllFiles.reset();
                    _super.prototype.executeCommand.call(this, request);
                    return util_1.doneRequest;
                }
                else if (TypeScriptCommandNames.IDEChangeFiles == command) {
                    var updateFilesArgs = request.arguments;
                    return this.updateFilesEx(updateFilesArgs);
                }
                else if (TypeScriptCommandNames.IDECompile == command) {
                    var fileArgs = request.arguments;
                    return this.compileFileEx(fileArgs);
                }
                else if (TypeScriptCommandNames.IDECompletions == command) {
                    return this.getCompletionEx(request);
                }
                else if (TypeScriptCommandNames.IDEGetErrors == command) {
                    var args = request.arguments;
                    return { response: { infos: this.getDiagnosticsEx(args.files) }, responseRequired: true };
                }
                else if (TypeScriptCommandNames.IDEGetMainFileErrors == command) {
                    var args = request.arguments;
                    return { response: { infos: this.getMainFileDiagnosticsForFileEx(args.file) }, responseRequired: true };
                }
                else if (TypeScriptCommandNames.IDEGetProjectErrors == command) {
                    var args = request.arguments;
                    var projectDiagnosticsForFileEx = this.getProjectDiagnosticsForFileEx(args.file);
                    return { response: { infos: projectDiagnosticsForFileEx }, responseRequired: true };
                }
                return _super.prototype.executeCommand.call(this, request);
            }
            finally {
                var processingTime = Date.now() - startTime;
                logger_impl_1.serverLogger("Message " + request.seq + " '" + command + "' server time, mills: " + processingTime, true);
            }
        };
        IDESession.prototype.getProjectForFileEx = function (fileName, projectFile) {
            var _this = this;
            if (!projectFile) {
                fileName = ts_impl.normalizePath(fileName);
                var scriptInfo = this.getScriptInfo(this.getProjectService(), fileName);
                if (scriptInfo) {
                    var projects = this.getConfiguredProjects(this.projectService);
                    if (projects && projects.length > 1) {
                        var candidates = [];
                        for (var _i = 0, projects_1 = projects; _i < projects_1.length; _i++) {
                            var currentProject = projects_1[_i];
                            var projectConfigPathEx = this.getProjectConfigPathEx(currentProject);
                            if (projectConfigPathEx) {
                                candidates.push(currentProject);
                            }
                        }
                        if (candidates.length == 1) {
                            return candidates[0];
                        }
                        //ok, we have several tsconfig.json that include the file
                        //we should use the nearest config
                        if (candidates.length > 0) {
                            var candidatesProjectDirToProject_1 = {};
                            candidates.forEach(function (el) {
                                return candidatesProjectDirToProject_1[ts_impl.getDirectoryPath(_this.getProjectConfigPathEx(el))] = el;
                            });
                            var directory = ts_impl.getDirectoryPath(fileName);
                            while (directory && directory.length != ts_impl.getRootLength(directory)) {
                                var nearestProject = candidatesProjectDirToProject_1[directory];
                                if (nearestProject) {
                                    return nearestProject;
                                }
                                var newDirectory = ts_impl.getDirectoryPath(directory);
                                directory = newDirectory != directory ? newDirectory : null;
                            }
                        }
                    }
                }
                return this.getProjectService().getDefaultProjectForFile(fileName, true);
            }
            return this.getProjectService().findProject(projectFile);
        };
        IDESession.prototype.tsVersion = function () {
            return "2.0.5";
        };
        IDESession.prototype.closeClientFileEx = function (normalizedFileName) {
            var scriptInfoForNormalizedPath = this.getProjectService().getScriptInfoForNormalizedPath(normalizedFileName);
            if (!scriptInfoForNormalizedPath || !this.isScriptOpenEx(scriptInfoForNormalizedPath)) {
                return;
            }
            this.projectService.closeClientFile(normalizedFileName);
        };
        IDESession.prototype.configFileDiagnosticEvent = function (triggerFile, configFile, errors) {
        };
        IDESession.prototype.refreshStructureEx = function () {
            _super.prototype.refreshStructureEx.call(this);
            this.getProjectService().refreshInferredProjects();
        };
        IDESession.prototype.changeFileEx = function (fileName, content, tsconfig) {
            fileName = ts_impl.normalizePath(fileName);
            var projectService = this.getProjectService();
            var info = projectService.getScriptInfoForNormalizedPath(fileName);
            if (info && this.isScriptOpenEx(info)) {
                if (projectService.getOrCreateScriptInfo) {
                    projectService.getOrCreateScriptInfo(fileName, true, content);
                    return;
                }
                info.open(content);
            }
            else {
                projectService.openClientFileWithNormalizedPath(fileName, content);
            }
        };
        IDESession.prototype.isScriptOpenEx = function (info) {
            if (info.isScriptOpen) {
                return info.isScriptOpen();
            }
            return info.isOpen;
        };
        IDESession.prototype.getLanguageService = function (project, sync) {
            if (sync === void 0) { sync = true; }
            return project.getLanguageService(sync);
        };
        IDESession.prototype.event = function (info, eventName) {
            if (logger_impl_1.isLogEnabled) {
                logger_impl_1.serverLogger("Event " + eventName);
            }
        };
        IDESession.prototype.lineOffsetToPosition = function (project, fileName, line, offset) {
            //todo review performance
            var scriptInfo = this.getProjectService().getScriptInfo(fileName);
            if (!scriptInfo) {
                logger_impl_1.serverLogger("ERROR! Cannot find script info for file " + fileName, true);
                return undefined;
            }
            return scriptInfo.lineOffsetToPosition(line, offset);
        };
        /**
         * todo change d.ts files & replace any by ts.server.ProjectService
         */
        IDESession.prototype.getProjectService = function () {
            return this.projectService;
        };
        IDESession.prototype.getFromExistingProject = function (normalizedRequestedFile) {
            var projectService = this.getProjectService();
            {
                //prefer configured project
                var configuredProjects = this.getConfiguredProjects(projectService);
                for (var _i = 0, configuredProjects_1 = configuredProjects; _i < configuredProjects_1.length; _i++) {
                    var project = configuredProjects_1[_i];
                    if (this.containsFileEx(project, normalizedRequestedFile, false)) {
                        return project;
                    }
                }
            }
            {
                var inferredProjects = projectService.inferredProjects;
                for (var _a = 0, inferredProjects_1 = inferredProjects; _a < inferredProjects_1.length; _a++) {
                    var project = inferredProjects_1[_a];
                    if (this.containsFileEx(project, normalizedRequestedFile, false)) {
                        return project;
                    }
                }
            }
            return null;
        };
        IDESession.prototype.getConfiguredProjects = function (projectService) {
            var configuredProjects = projectService.configuredProjects;
            return Array.isArray(configuredProjects) ? configuredProjects : Array.from(configuredProjects.values());
        };
        return IDESession;
    }(TypeScriptSession));
    var cancellationToken;
    try {
        var factory = require("./cancellationToken");
        cancellationToken = factory(host.args);
    }
    catch (e) {
        cancellationToken = {
            isCancellationRequested: function () {
                return false;
            },
            setRequest: function (_requestId) {
                return void 0;
            },
            resetRequest: function (_requestId) {
                return void 0;
            }
        };
    }
    var nullTypingsInstaller = {
        enqueueInstallTypingsRequest: function () {
        },
        attach: function (projectService) {
        },
        onProjectClosed: function (p) {
        },
        globalTypingsCacheLocation: undefined
    };
    //todo remove after replacing typing
    var IDESessionImpl = IDESession;
    var useSingleInferredProject = defaultOptionsHolder.isUseSingleInferredProject();
    var version = ts_impl.version;
    var tsVersion = util_1.parseNumbersInVersion(version);
    var session;
    if (util_1.isVersionMoreOrEqual(tsVersion, 2, 3, 1)) {
        var pluginProbeLocations = defaultOptionsHolder.pluginState.pluginProbeLocations;
        var options = {
            host: host,
            cancellationToken: cancellationToken,
            useSingleInferredProject: useSingleInferredProject,
            typingsInstaller: nullTypingsInstaller,
            byteLength: Buffer.byteLength,
            hrtime: process.hrtime,
            pluginProbeLocations: pluginProbeLocations,
            logger: logger,
            canUseEvents: true
        };
        session = new IDESessionImpl(options);
    }
    else {
        session = new IDESessionImpl(host, cancellationToken, useSingleInferredProject, nullTypingsInstaller, Buffer.byteLength, process.hrtime, logger, true);
    }
    return session;
}
exports.getSessionNew = getSessionNew;
