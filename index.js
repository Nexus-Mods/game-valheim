"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_1 = __importDefault(require("bluebird"));
const path = __importStar(require("path"));
const vortex_api_1 = require("vortex-api");
const vortex_parse_ini_1 = __importStar(require("vortex-parse-ini"));
const payloadDeployer = __importStar(require("./payloadDeployer"));
const shortid_1 = require("shortid");
const unstrippedAssembly_1 = require("./unstrippedAssembly");
const common_1 = require("./common");
const installers_1 = require("./installers");
const migrations_1 = require("./migrations");
const tests_1 = require("./tests");
const r2Vortex_1 = require("./r2Vortex");
const githubDownloader_1 = require("./githubDownloader");
const STOP_PATTERNS = ['plugins', 'patchers'];
function toWordExp(input) {
    return '(^|/)' + input + '(/|$)';
}
function findGame() {
    return vortex_api_1.util.GameStoreHelper.findByAppId([common_1.STEAM_ID])
        .then(game => game.gamePath);
}
function requiresLauncher(gamePath) {
    return vortex_api_1.fs.readdirAsync(gamePath)
        .then(files => (files.find(file => file.toLowerCase() === 'steam_appid.txt') !== undefined)
        ? Promise.resolve({
            launcher: 'steam',
            addInfo: {
                appId: common_1.STEAM_ID,
                parameters: ['-force-glcore'],
                launchType: 'gamestore',
            },
        })
        : Promise.resolve(undefined))
        .catch(err => Promise.reject(err));
}
function ensureUnstrippedAssemblies(props) {
    return __awaiter(this, void 0, void 0, function* () {
        const api = props.api;
        const t = api.translate;
        const expectedFilePath = path.join(props.discovery.path, 'unstripped_managed', 'mono.security.dll');
        const fullPackCorLibOld = path.join(props.discovery.path, 'BepInEx', 'core_lib', 'mono.security.dll');
        const fullPackCorLibNew = path.join(props.discovery.path, 'unstripped_corlib', 'mono.security.dll');
        const raiseForceDownloadNotif = () => api.sendNotification({
            message: t('Game updated - Updated assemblies pack required.'),
            type: 'info',
            id: 'forceDownloadNotif',
            noDismiss: true,
            allowSuppress: true,
            actions: [
                {
                    title: 'More',
                    action: (dismiss) => api.showDialog('info', 'Download unstripped assemblies', {
                        bbcode: t('Valheim has been updated and to be able to mod the game you will need to ensure you are using the latest unstripped Unity assemblies or the latest "BepInEx pack". '
                            + 'Vortex has detected that you have previously installed unstripped Unity assemblies / a BepInEx pack, but cannot know for sure whether these files are up to date. '
                            + 'If you are unsure, Vortex can download and install the latest required files for you.{{lb}}'
                            + 'Please note that all mods must also be updated in order for them to function with the new game version.', { replace: { lb: '[br][/br][br][/br]', br: '[br][/br]' } }),
                    }, [
                        { label: 'Close' },
                        {
                            label: 'Download Unstripped Assemblies',
                            action: () => runDownloader().finally(() => dismiss()),
                        },
                    ]),
                },
                {
                    title: 'Never Show Again',
                    action: (dismiss) => {
                        api.store.dispatch(vortex_api_1.actions.suppressNotification('forceDownloadNotif', true));
                        dismiss();
                    },
                },
            ],
        });
        const assignOverridePath = (overridePath) => __awaiter(this, void 0, void 0, function* () {
            const doorStopConfig = path.join(props.discovery.path, 'doorstop_config.ini');
            const parser = new vortex_parse_ini_1.default(new vortex_parse_ini_1.WinapiFormat());
            try {
                const iniData = yield parser.read(doorStopConfig);
                iniData.data['UnityDoorstop']['dllSearchPathOverride'] = overridePath;
                yield parser.write(doorStopConfig, iniData);
            }
            catch (err) {
                api.showErrorNotification('failed to modify doorstop configuration', err);
            }
        });
        const runDownloader = () => __awaiter(this, void 0, void 0, function* () {
            const downloader = new unstrippedAssembly_1.UnstrippedAssemblyDownloader(vortex_api_1.util.getVortexPath('temp'));
            const folderName = (0, shortid_1.generate)();
            try {
                const activeGameMode = vortex_api_1.selectors.activeGameId(api.getState());
                if (activeGameMode !== common_1.GAME_ID) {
                    throw new vortex_api_1.util.ProcessCanceled('Wrong gamemode');
                }
                const archiveFilePath = yield downloader.downloadNewest('full_name', 'denikson-BepInExPack_Valheim');
                yield vortex_api_1.fs.statAsync(archiveFilePath);
                const sevenzip = new vortex_api_1.util.SevenZip();
                const tempPath = path.join(path.dirname(archiveFilePath), folderName);
                yield sevenzip.extractFull(archiveFilePath, tempPath);
                const files = yield vortex_api_1.fs.readdirAsync(tempPath);
                if (files.length === 0) {
                    throw new vortex_api_1.util.DataInvalid('Invalid archive');
                }
                yield new Promise((resolve, reject) => api.events.emit('import-downloads', [archiveFilePath], (dlIds) => __awaiter(this, void 0, void 0, function* () {
                    if (dlIds.length === 0) {
                        return reject(new vortex_api_1.util.ProcessCanceled('Failed to import archive'));
                    }
                    try {
                        for (const dlId of dlIds) {
                            yield new Promise((res2, rej2) => api.events.emit('start-install-download', dlId, true, (err, modId) => {
                                if (err) {
                                    return rej2(err);
                                }
                                api.store.dispatch(vortex_api_1.actions.setModEnabled(props.profile.id, modId, true));
                                return res2(undefined);
                            }));
                        }
                    }
                    catch (err) {
                        return reject(err);
                    }
                    api.store.dispatch(vortex_api_1.actions.suppressNotification('forceDownloadNotif', true));
                    api.store.dispatch(vortex_api_1.actions.setDeploymentNecessary(common_1.GAME_ID, true));
                    yield assignOverridePath('unstripped_corlib');
                    try {
                        yield (0, common_1.removeDir)(tempPath);
                        yield vortex_api_1.fs.removeAsync(tempPath).catch(err => err.code === 'ENOENT');
                    }
                    catch (err) {
                        (0, vortex_api_1.log)('error', 'failed to cleanup temporary files');
                    }
                    return resolve(undefined);
                })));
            }
            catch (err) {
                try {
                    const tempPath = path.join(vortex_api_1.util.getVortexPath('temp'), folderName);
                    yield vortex_api_1.fs.statAsync(tempPath);
                    yield (0, common_1.removeDir)(tempPath);
                }
                catch (err2) {
                    (0, vortex_api_1.log)('debug', 'unstripped assembly downloader cleanup failed', err2);
                }
                (0, vortex_api_1.log)('debug', 'unstripped assembly downloader failed', err);
            }
        });
        const mods = vortex_api_1.util.getSafe(props.state, ['persistent', 'mods', common_1.GAME_ID], {});
        const coreLibModIds = Object.keys(mods).filter(key => {
            const hasCoreLibType = vortex_api_1.util.getSafe(mods[key], ['attributes', 'CoreLibType'], undefined) !== undefined;
            const isEnabled = vortex_api_1.util.getSafe(props.profile, ['modState', key, 'enabled'], false);
            return hasCoreLibType && isEnabled;
        });
        if (coreLibModIds.length > 0) {
            const coreLibModId = coreLibModIds[0];
            const packType = mods[coreLibModId].attributes['CoreLibType'];
            switch (packType) {
                case 'core_lib':
                    assignOverridePath('BepInEx\\core_lib');
                    raiseForceDownloadNotif();
                    return;
                case 'unstripped_corlib':
                    assignOverridePath('unstripped_corlib');
                    raiseForceDownloadNotif();
                    return;
                default:
            }
        }
        for (const filePath of [fullPackCorLibNew, fullPackCorLibOld]) {
            try {
                yield vortex_api_1.fs.statAsync(filePath);
                const dllOverridePath = filePath.replace(props.discovery.path + path.sep, '')
                    .replace(path.sep + 'mono.security.dll', '');
                yield assignOverridePath(dllOverridePath);
                raiseForceDownloadNotif();
                return;
            }
            catch (err) {
            }
        }
        const unstrippedMods = Object.keys(mods).filter(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === 'unstripped-assemblies'; });
        if (unstrippedMods.length > 0) {
            for (const modId of unstrippedMods) {
                if (vortex_api_1.util.getSafe(props.profile, ['modState', modId, 'enabled'], false)) {
                    const dlid = mods[modId].archiveId;
                    const download = vortex_api_1.util.getSafe(api.getState(), ['persistent', 'downloads', 'files', dlid], undefined);
                    if ((download === null || download === void 0 ? void 0 : download.localPath) !== undefined && (0, common_1.guessModId)(download.localPath) !== '15') {
                        const dllOverridePath = expectedFilePath.replace(props.discovery.path + path.sep, '')
                            .replace(path.sep + 'mono.security.dll', '');
                        yield assignOverridePath(dllOverridePath);
                        return;
                    }
                }
            }
        }
        return runDownloader();
    });
}
function prepareForModding(context, discovery) {
    const state = context.api.getState();
    const prevProfId = vortex_api_1.selectors.lastActiveProfileForGame(state, common_1.GAME_ID);
    const profile = vortex_api_1.selectors.profileById(state, prevProfId);
    const modTypes = vortex_api_1.selectors.modPathsForGame(state, common_1.GAME_ID);
    const createDirectories = () => __awaiter(this, void 0, void 0, function* () {
        for (const modType of Object.keys(modTypes)) {
            try {
                yield vortex_api_1.fs.ensureDirWritableAsync(modTypes[modType]);
            }
            catch (err) {
                return Promise.reject(err);
            }
        }
    });
    return new bluebird_1.default((resolve, reject) => createDirectories()
        .then(() => payloadDeployer.onWillDeploy(context, profile === null || profile === void 0 ? void 0 : profile.id))
        .then(() => resolve())
        .catch(err => reject(err)))
        .then(() => ensureUnstrippedAssemblies({ api: context.api, state, profile, discovery }));
}
function modsPath(gamePath) {
    return gamePath !== undefined ? path.join(gamePath, 'BepInEx', 'plugins') : '.';
}
function main(context) {
    context.registerGame({
        id: common_1.GAME_ID,
        name: 'Valheim',
        mergeMods: true,
        queryPath: findGame,
        queryModPath: modsPath,
        logo: 'gameart.jpg',
        executable: () => 'valheim.exe',
        requiresLauncher,
        setup: discovery => prepareForModding(context, discovery),
        requiredFiles: [
            'valheim.exe',
        ],
        environment: {
            SteamAPPId: common_1.STEAM_ID,
        },
        details: {
            steamAppId: +common_1.STEAM_ID,
            stopPatterns: STOP_PATTERNS.map(toWordExp),
            ignoreConflicts: [].concat(common_1.IGNORABLE_FILES, common_1.IGNORABLE_FILES.map(file => file.toLowerCase())),
            ignoreDeploy: [].concat(common_1.IGNORABLE_FILES, common_1.IGNORABLE_FILES.map(file => file.toLowerCase())),
        },
    });
    const getGamePath = () => {
        const state = context.api.getState();
        const discovery = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', common_1.GAME_ID], undefined);
        if ((discovery === null || discovery === void 0 ? void 0 : discovery.path) === undefined) {
            context.api.showErrorNotification('Valheim was not discovered', 'Please re-install the game.', { allowReport: false });
            throw new vortex_api_1.util.ProcessCanceled('Game path not found');
        }
        return discovery.path;
    };
    const isSupported = (gameId) => (gameId === common_1.GAME_ID);
    const hasInstruction = (instructions, pred) => instructions.find(instr => (instr.type === 'copy')
        && (pred(instr))) !== undefined;
    const findInstrMatch = (instructions, pattern, mod) => {
        if (mod === undefined) {
            mod = (input) => input;
        }
        return hasInstruction(instructions, (instr) => mod(instr.source).toLowerCase() === pattern.toLowerCase());
    };
    const vbuildDepTest = () => {
        const gamePath = getGamePath();
        if (gamePath === undefined) {
            return undefined;
        }
        const buildShareAssembly = path.join(gamePath, 'InSlimVML', 'Mods', 'CR-BuildShare_VML.dll');
        return (0, tests_1.isDependencyRequired)(context.api, {
            dependentModType: 'vbuild-mod',
            masterModType: 'inslimvml-mod',
            masterName: 'BuildShare (AdvancedBuilding)',
            masterURL: 'https://www.nexusmods.com/valheim/mods/5',
            requiredFiles: [buildShareAssembly],
        });
    };
    const customMeshesTest = () => {
        if (getGamePath() === undefined) {
            return undefined;
        }
        const basePath = modsPath(getGamePath());
        const requiredAssembly = path.join(basePath, 'CustomMeshes.dll');
        return (0, tests_1.isDependencyRequired)(context.api, {
            dependentModType: 'valheim-custom-meshes',
            masterModType: '',
            masterName: 'CustomMeshes',
            masterURL: 'https://www.nexusmods.com/valheim/mods/184',
            requiredFiles: [requiredAssembly],
        });
    };
    const customTexturesTest = () => {
        if (getGamePath() === undefined) {
            return undefined;
        }
        const basePath = modsPath(getGamePath());
        const requiredAssembly = path.join(basePath, 'CustomTextures.dll');
        return (0, tests_1.isDependencyRequired)(context.api, {
            dependentModType: 'valheim-custom-textures',
            masterModType: '',
            masterName: 'CustomTextures',
            masterURL: 'https://www.nexusmods.com/valheim/mods/48',
            requiredFiles: [requiredAssembly],
        });
    };
    const betterContinentsTest = () => {
        if (getGamePath() === undefined) {
            return undefined;
        }
        const basePath = modsPath(getGamePath());
        const requiredAssembly = path.join(basePath, 'BetterContinents.dll');
        return (0, tests_1.isDependencyRequired)(context.api, {
            dependentModType: 'better-continents-mod',
            masterModType: '',
            masterName: 'Better Continents',
            masterURL: 'https://www.nexusmods.com/valheim/mods/446',
            requiredFiles: [requiredAssembly],
        });
    };
    context.registerAction('mod-icons', 115, 'import', {}, 'Import From r2modman', () => {
        (0, r2Vortex_1.migrateR2ToVortex)(context.api);
    }, () => {
        const state = context.api.getState();
        const activeGameId = vortex_api_1.selectors.activeGameId(state);
        return (0, r2Vortex_1.userHasR2Installed)()
            && (getGamePath() !== undefined)
            && (activeGameId === common_1.GAME_ID);
    });
    const dependencyTests = [vbuildDepTest, customMeshesTest,
        customTexturesTest, betterContinentsTest];
    for (const testFunc of dependencyTests) {
        context.registerTest(testFunc.name.toString(), 'gamemode-activated', testFunc);
        context.registerTest(testFunc.name.toString(), 'mod-installed', testFunc);
    }
    context.registerTest('multiple-lib-mods', 'gamemode-activated', () => (0, tests_1.hasMultipleLibMods)(context.api));
    context.registerTest('multiple-lib-mods', 'mod-installed', () => (0, tests_1.hasMultipleLibMods)(context.api));
    context.registerInstaller('valheim-better-continents', 20, installers_1.testBetterCont, installers_1.installBetterCont);
    context.registerInstaller('valheim-core-remover', 20, installers_1.testCoreRemover, installers_1.installCoreRemover);
    context.registerInstaller('valheim-inslimvm', 20, installers_1.testInSlimModLoader, installers_1.installInSlimModLoader);
    context.registerInstaller('valheim-vbuild', 20, installers_1.testVBuild, installers_1.installVBuildMod);
    context.registerInstaller('valheim-full-bep-pack', 10, installers_1.testFullPack, installers_1.installFullPack);
    context.registerInstaller('valheim-config-manager', 10, installers_1.testConfManager, installers_1.installConfManager);
    context.registerMigration((oldVersion) => (0, migrations_1.migrate103)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate104)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate106)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate109)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate1013)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate1015)(context.api, oldVersion));
    context.registerModType('inslimvml-mod-loader', 20, isSupported, getGamePath, (instructions) => {
        const hasVMLIni = findInstrMatch(instructions, common_1.INSLIMVML_IDENTIFIER, path.basename);
        return bluebird_1.default.Promise.Promise.resolve(hasVMLIni);
    }, { name: 'InSlimVML Mod Loader' });
    context.registerModType('inslimvml-mod', 10, isSupported, () => getGamePath() !== undefined ? path.join(getGamePath(), 'InSlimVML', 'Mods') : undefined, (instructions) => {
        const vmlSuffix = '_vml.dll';
        const mod = (input) => (input.length > vmlSuffix.length)
            ? path.basename(input).slice(-vmlSuffix.length)
            : '';
        const testRes = findInstrMatch(instructions, 'cr-buildshare_vml.dll', path.basename)
            || findInstrMatch(instructions, '_vml.dll', mod);
        return bluebird_1.default.Promise.Promise.resolve(testRes);
    }, { name: 'InSlimVML Mod' });
    context.registerModType('vbuild-mod', 10, isSupported, () => getGamePath() !== undefined ? path.join(getGamePath(), 'AdvancedBuilder', 'Builds') : undefined, (instructions) => {
        const res = findInstrMatch(instructions, common_1.VBUILD_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(res);
    }, { name: 'BuildShare Mod' });
    context.registerModType('valheim-custom-meshes', 10, isSupported, () => getGamePath() !== undefined ? path.join(modsPath(getGamePath()), 'CustomMeshes') : undefined, (instructions) => {
        const modifier = (filePath) => {
            const segments = filePath.toLowerCase().split(path.sep);
            return (segments.includes('custommeshes'))
                ? filePath
                : path.extname(filePath);
        };
        const supported = findInstrMatch(instructions, common_1.FBX_EXT, modifier)
            || findInstrMatch(instructions, common_1.OBJ_EXT, modifier);
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'CustomMeshes Mod' });
    context.registerModType('valheim-custom-textures', 10, isSupported, () => getGamePath() !== undefined ? path.join(modsPath(getGamePath()), 'CustomTextures') : undefined, (instructions) => {
        const textureRgx = new RegExp(/^texture_.*.png$/);
        let supported = false;
        for (const instr of instructions) {
            const segments = (!!instr.source)
                ? instr.source.toLowerCase().split(path.sep)
                : [];
            if (segments.includes('customtextures')) {
                supported = false;
                break;
            }
            if ((instr.type === 'copy')
                && textureRgx.test(path.basename(instr.source).toLowerCase())) {
                supported = true;
                break;
            }
        }
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'CustomTextures Mod' });
    context.registerModType('unstripped-assemblies', 20, isSupported, getGamePath, (instructions) => {
        const testPath = path.join('unstripped_managed', 'mono.posix.dll');
        const supported = hasInstruction(instructions, (instr) => instr.source.toLowerCase().includes(testPath));
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'Unstripped Assemblies' });
    context.registerModType('bepinex-root-mod', 25, isSupported, () => getGamePath() !== undefined ? path.join(getGamePath(), 'BepInEx') : undefined, (instructions) => {
        const matcher = (filePath) => {
            const segments = filePath.split(path.sep);
            for (const stop of STOP_PATTERNS) {
                if (segments.includes(stop)) {
                    return true;
                }
            }
            return false;
        };
        const supported = hasInstruction(instructions, (instr) => matcher(instr.source));
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'BepInEx Root Mod' });
    context.registerModType('better-continents-mod', 25, isSupported, () => getGamePath() !== undefined ? path.join(getGamePath(), 'vortex-worlds') : undefined, (instructions) => {
        const hasBCExt = findInstrMatch(instructions, common_1.BETTER_CONT_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(hasBCExt);
    }, { name: 'Better Continents Mod' });
    context.registerModType('val-conf-man', 20, isSupported, () => getGamePath() !== undefined ? path.join(getGamePath(), 'BepInEx') : undefined, (instructions) => {
        const testRes = findInstrMatch(instructions, common_1.CONF_MANAGER, path.basename);
        return bluebird_1.default.Promise.Promise.resolve(testRes);
    }, { name: 'Configuration Manager' });
    context.once(() => {
        context.api.onAsync('will-deploy', (profileId) => __awaiter(this, void 0, void 0, function* () {
            const state = context.api.getState();
            const profile = vortex_api_1.selectors.profileById(state, profileId);
            if ((profile === null || profile === void 0 ? void 0 : profile.gameId) !== common_1.GAME_ID) {
                return Promise.resolve();
            }
            return payloadDeployer.onWillDeploy(context, profileId)
                .then(() => ensureUnstrippedAssemblies((0, common_1.genProps)(context.api, profileId)))
                .catch(err => err instanceof vortex_api_1.util.UserCanceled
                ? Promise.resolve()
                : Promise.reject(err));
        }));
        context.api.onAsync('did-purge', (profileId) => __awaiter(this, void 0, void 0, function* () { return payloadDeployer.onDidPurge(context.api, profileId); }));
        context.api.events.on('gamemode-activated', (gameMode) => __awaiter(this, void 0, void 0, function* () {
            return (gameMode === common_1.GAME_ID)
                ? (0, githubDownloader_1.checkConfigManagerUpd)(context.api, true) : null;
        }));
        context.api.events.on('check-mods-version', (gameId, mods) => (gameId === common_1.GAME_ID)
            ? (0, githubDownloader_1.checkConfigManagerUpd)(context.api) : null);
        context.api.events.on('did-install-mod', (gameId, archiveId, modId) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (gameId !== common_1.GAME_ID) {
                return;
            }
            const state = context.api.getState();
            const installPath = vortex_api_1.selectors.installPathForGame(state, gameId);
            const mod = (_b = (_a = state.persistent.mods) === null || _a === void 0 ? void 0 : _a[gameId]) === null || _b === void 0 ? void 0 : _b[modId];
            if ((installPath === undefined)
                || ((mod === null || mod === void 0 ? void 0 : mod.installationPath) === undefined)
                || (!!((_c = mod.attributes) === null || _c === void 0 ? void 0 : _c.version))) {
                return;
            }
            const modPath = path.join(installPath, mod.installationPath);
            try {
                const fileEntries = yield (0, common_1.walkDirPath)(modPath);
                const manifestFile = fileEntries.find(entry => path.basename(entry.filePath.toLowerCase()) === 'manifest.json');
                if (manifestFile === undefined) {
                    return;
                }
                const manifestData = yield vortex_api_1.fs.readFileAsync(manifestFile.filePath, { encoding: 'utf8' });
                const data = JSON.parse(manifestData);
                if (data['version_number'] !== undefined) {
                    context.api.store.dispatch(vortex_api_1.actions.setModAttribute(gameId, modId, 'version', data['version_number']));
                }
            }
            catch (err) {
                return;
            }
        }));
    });
    return true;
}
exports.default = main;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDJDQUFzRTtBQUN0RSxxRUFBaUU7QUFDakUsbUVBQXFEO0FBRXJELHFDQUFtQztBQUVuQyw2REFBb0U7QUFFcEUscUNBSWtCO0FBQ2xCLDZDQUV3RTtBQUN4RSw2Q0FBd0c7QUFDeEcsbUNBQW1FO0FBRW5FLHlDQUFtRTtBQUVuRSx5REFBa0Y7QUFHbEYsTUFBTSxhQUFhLEdBQUcsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDOUMsU0FBUyxTQUFTLENBQUMsS0FBSztJQUN0QixPQUFPLE9BQU8sR0FBRyxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLFFBQVE7SUFDZixPQUFPLGlCQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLGlCQUFRLENBQUMsQ0FBQztTQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsUUFBUTtJQUNoQyxPQUFPLGVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1NBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUN6RixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUNoQixRQUFRLEVBQUUsT0FBTztZQUNqQixPQUFPLEVBQUU7Z0JBQ1AsS0FBSyxFQUFFLGlCQUFRO2dCQUNmLFVBQVUsRUFBRSxDQUFDLGVBQWUsQ0FBQztn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QUFPLEdBQUcsRUFBRTtnQkFFWixPQUFPO2FBQ1I7UUFDSCxDQUFDLENBQUEsQ0FBQyxDQUFBO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCBQYXJzZXIsIHsgSW5pRmlsZSwgV2luYXBpRm9ybWF0IH0gZnJvbSAndm9ydGV4LXBhcnNlLWluaSc7XHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBnZW5lcmF0ZSB9IGZyb20gJ3Nob3J0aWQnO1xyXG5cclxuaW1wb3J0IHsgVW5zdHJpcHBlZEFzc2VtYmx5RG93bmxvYWRlciB9IGZyb20gJy4vdW5zdHJpcHBlZEFzc2VtYmx5JztcclxuXHJcbmltcG9ydCB7XHJcbiAgQkVUVEVSX0NPTlRfRVhULCBDT05GX01BTkFHRVIsIEZCWF9FWFQsIEdBTUVfSUQsIEdBTUVfSURfU0VSVkVSLFxyXG4gIGdlblByb3BzLCBndWVzc01vZElkLCBJR05PUkFCTEVfRklMRVMsIElOU0xJTVZNTF9JREVOVElGSUVSLFxyXG4gIElQcm9wcywgSVNDTURQcm9wcywgTkVYVVMsIE9CSl9FWFQsIFBhY2tUeXBlLCByZW1vdmVEaXIsIFNURUFNX0lELCBWQlVJTERfRVhULCB3YWxrRGlyUGF0aCxcclxufSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IGluc3RhbGxCZXR0ZXJDb250LCBpbnN0YWxsQ29yZVJlbW92ZXIsIGluc3RhbGxGdWxsUGFjaywgaW5zdGFsbEluU2xpbU1vZExvYWRlcixcclxuICBpbnN0YWxsVkJ1aWxkTW9kLCB0ZXN0QmV0dGVyQ29udCwgdGVzdENvcmVSZW1vdmVyLCB0ZXN0RnVsbFBhY2ssIHRlc3RJblNsaW1Nb2RMb2FkZXIsXHJcbiAgdGVzdFZCdWlsZCwgdGVzdENvbmZNYW5hZ2VyLCBpbnN0YWxsQ29uZk1hbmFnZXIgfSBmcm9tICcuL2luc3RhbGxlcnMnO1xyXG5pbXBvcnQgeyBtaWdyYXRlMTAxMywgbWlncmF0ZTEwMTUsIG1pZ3JhdGUxMDMsIG1pZ3JhdGUxMDQsIG1pZ3JhdGUxMDYsIG1pZ3JhdGUxMDkgfSBmcm9tICcuL21pZ3JhdGlvbnMnO1xyXG5pbXBvcnQgeyBoYXNNdWx0aXBsZUxpYk1vZHMsIGlzRGVwZW5kZW5jeVJlcXVpcmVkIH0gZnJvbSAnLi90ZXN0cyc7XHJcblxyXG5pbXBvcnQgeyBtaWdyYXRlUjJUb1ZvcnRleCwgdXNlckhhc1IySW5zdGFsbGVkIH0gZnJvbSAnLi9yMlZvcnRleCc7XHJcblxyXG5pbXBvcnQgeyBjaGVja0NvbmZpZ01hbmFnZXJVcGQsIGRvd25sb2FkQ29uZmlnTWFuYWdlciB9IGZyb20gJy4vZ2l0aHViRG93bmxvYWRlcic7XHJcbmltcG9ydCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcblxyXG5jb25zdCBTVE9QX1BBVFRFUk5TID0gWydwbHVnaW5zJywgJ3BhdGNoZXJzJ107XHJcbmZ1bmN0aW9uIHRvV29yZEV4cChpbnB1dCkge1xyXG4gIHJldHVybiAnKF58LyknICsgaW5wdXQgKyAnKC98JCknO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaW5kR2FtZSgpOiBhbnkge1xyXG4gIHJldHVybiB1dGlsLkdhbWVTdG9yZUhlbHBlci5maW5kQnlBcHBJZChbU1RFQU1fSURdKVxyXG4gICAgLnRoZW4oZ2FtZSA9PiBnYW1lLmdhbWVQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVxdWlyZXNMYXVuY2hlcihnYW1lUGF0aCkge1xyXG4gIHJldHVybiBmcy5yZWFkZGlyQXN5bmMoZ2FtZVBhdGgpXHJcbiAgICAudGhlbihmaWxlcyA9PiAoZmlsZXMuZmluZChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSA9PT0gJ3N0ZWFtX2FwcGlkLnR4dCcpICE9PSB1bmRlZmluZWQpXHJcbiAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHtcclxuICAgICAgICBsYXVuY2hlcjogJ3N0ZWFtJyxcclxuICAgICAgICBhZGRJbmZvOiB7XHJcbiAgICAgICAgICBhcHBJZDogU1RFQU1fSUQsXHJcbiAgICAgICAgICBwYXJhbWV0ZXJzOiBbJy1mb3JjZS1nbGNvcmUnXSxcclxuICAgICAgICAgIGxhdW5jaFR5cGU6ICdnYW1lc3RvcmUnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pXHJcbiAgICAgIDogUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IFByb21pc2UucmVqZWN0KGVycikpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhwcm9wczogSVByb3BzKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgYXBpID0gcHJvcHMuYXBpO1xyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG4gIGNvbnN0IGV4cGVjdGVkRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9tYW5hZ2VkJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJPbGQgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAnQmVwSW5FeCcsICdjb3JlX2xpYicsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG4gIGNvbnN0IGZ1bGxQYWNrQ29yTGliTmV3ID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfY29ybGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcblxyXG4gIC8vIGNvbnN0IHVybCA9IHBhdGguam9pbihORVhVUywgJ3ZhbGhlaW0nLCAnbW9kcycsICcxMjAyJykgKyBgP3RhYj1maWxlcyZmaWxlX2lkPTQ4OTkmbm1tPTFgO1xyXG4gIC8vIGNvbnN0IHJhaXNlTWlzc2luZ0Fzc2VtYmxpZXNEaWFsb2cgPSAoKSA9PiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgLy8gICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdNaXNzaW5nIHVuc3RyaXBwZWQgYXNzZW1ibGllcycsIHtcclxuICAvLyAgICAgYmJjb2RlOiB0KCdWYWxoZWltXFwncyBhc3NlbWJsaWVzIGFyZSBkaXN0cmlidXRlZCBpbiBhbiBcIm9wdGltaXNlZFwiIHN0YXRlIHRvIHJlZHVjZSByZXF1aXJlZCAnXHJcbiAgLy8gICAgICsgJ2Rpc2sgc3BhY2UuIFRoaXMgdW5mb3J0dW5hdGVseSBtZWFucyB0aGF0IFZhbGhlaW1cXCdzIG1vZGRpbmcgY2FwYWJpbGl0aWVzIGFyZSBhbHNvIGFmZmVjdGVkLnt7YnJ9fXt7YnJ9fSdcclxuICAvLyAgICAgKyAnSW4gb3JkZXIgdG8gbW9kIFZhbGhlaW0sIHRoZSB1bm9wdGltaXNlZC91bnN0cmlwcGVkIGFzc2VtYmxpZXMgYXJlIHJlcXVpcmVkIC0gcGxlYXNlIGRvd25sb2FkIHRoZXNlICdcclxuICAvLyAgICAgKyAnZnJvbSBOZXh1cyBNb2RzLnt7YnJ9fXt7YnJ9fSBZb3UgY2FuIGNob29zZSB0aGUgVm9ydGV4L21vZCBtYW5hZ2VyIGRvd25sb2FkIG9yIG1hbnVhbCBkb3dubG9hZCAnXHJcbiAgLy8gICAgICsgJyhzaW1wbHkgZHJhZyBhbmQgZHJvcCB0aGUgYXJjaGl2ZSBpbnRvIHRoZSBtb2RzIGRyb3B6b25lIHRvIGFkZCBpdCB0byBWb3J0ZXgpLnt7YnJ9fXt7YnJ9fSdcclxuICAvLyAgICAgKyAnVm9ydGV4IHdpbGwgdGhlbiBiZSBhYmxlIHRvIGluc3RhbGwgdGhlIGFzc2VtYmxpZXMgd2hlcmUgdGhleSBhcmUgbmVlZGVkIHRvIGVuYWJsZSAnXHJcbiAgLy8gICAgICsgJ21vZGRpbmcsIGxlYXZpbmcgdGhlIG9yaWdpbmFsIG9uZXMgdW50b3VjaGVkLicsIHsgcmVwbGFjZTogeyBicjogJ1ticl1bL2JyXScgfSB9KSxcclxuICAvLyAgIH0sIFtcclxuICAvLyAgICAgeyBsYWJlbDogJ0NhbmNlbCcsIGFjdGlvbjogKCkgPT4gcmVqZWN0KG5ldyB1dGlsLlVzZXJDYW5jZWxlZCgpKSB9LFxyXG4gIC8vICAgICB7XHJcbiAgLy8gICAgICAgbGFiZWw6ICdEb3dubG9hZCBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLFxyXG4gIC8vICAgICAgIGFjdGlvbjogKCkgPT4gdXRpbC5vcG4odXJsKVxyXG4gIC8vICAgICAgICAgLmNhdGNoKGVyciA9PiBudWxsKVxyXG4gIC8vICAgICAgICAgLmZpbmFsbHkoKCkgPT4gcmVzb2x2ZSgpKSxcclxuICAvLyAgICAgfSxcclxuICAvLyAgIF0pO1xyXG4gIC8vIH0pO1xyXG5cclxuICBjb25zdCByYWlzZUZvcmNlRG93bmxvYWROb3RpZiA9ICgpID0+IGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgIG1lc3NhZ2U6IHQoJ0dhbWUgdXBkYXRlZCAtIFVwZGF0ZWQgYXNzZW1ibGllcyBwYWNrIHJlcXVpcmVkLicpLFxyXG4gICAgdHlwZTogJ2luZm8nLFxyXG4gICAgaWQ6ICdmb3JjZURvd25sb2FkTm90aWYnLFxyXG4gICAgbm9EaXNtaXNzOiB0cnVlLFxyXG4gICAgYWxsb3dTdXBwcmVzczogdHJ1ZSxcclxuICAgIGFjdGlvbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTW9yZScsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4gYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnRG93bmxvYWQgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICAgICAgYmJjb2RlOiB0KCdWYWxoZWltIGhhcyBiZWVuIHVwZGF0ZWQgYW5kIHRvIGJlIGFibGUgdG8gbW9kIHRoZSBnYW1lIHlvdSB3aWxsIG5lZWQgdG8gZW5zdXJlIHlvdSBhcmUgdXNpbmcgdGhlIGxhdGVzdCB1bnN0cmlwcGVkIFVuaXR5IGFzc2VtYmxpZXMgb3IgdGhlIGxhdGVzdCBcIkJlcEluRXggcGFja1wiLiAnXHJcbiAgICAgICAgICAgICAgICAgICsgJ1ZvcnRleCBoYXMgZGV0ZWN0ZWQgdGhhdCB5b3UgaGF2ZSBwcmV2aW91c2x5IGluc3RhbGxlZCB1bnN0cmlwcGVkIFVuaXR5IGFzc2VtYmxpZXMgLyBhIEJlcEluRXggcGFjaywgYnV0IGNhbm5vdCBrbm93IGZvciBzdXJlIHdoZXRoZXIgdGhlc2UgZmlsZXMgYXJlIHVwIHRvIGRhdGUuICdcclxuICAgICAgICAgICAgICAgICAgKyAnSWYgeW91IGFyZSB1bnN1cmUsIFZvcnRleCBjYW4gZG93bmxvYWQgYW5kIGluc3RhbGwgdGhlIGxhdGVzdCByZXF1aXJlZCBmaWxlcyBmb3IgeW91Lnt7bGJ9fSdcclxuICAgICAgICAgICAgICAgICAgKyAnUGxlYXNlIG5vdGUgdGhhdCBhbGwgbW9kcyBtdXN0IGFsc28gYmUgdXBkYXRlZCBpbiBvcmRlciBmb3IgdGhlbSB0byBmdW5jdGlvbiB3aXRoIHRoZSBuZXcgZ2FtZSB2ZXJzaW9uLicsXHJcbiAgICAgICAgICAgICAgICAgIHsgcmVwbGFjZTogeyBsYjogJ1ticl1bL2JyXVticl1bL2JyXScsIGJyOiAnW2JyXVsvYnJdJyB9IH0pLFxyXG4gICAgICAgIH0sIFtcclxuICAgICAgICAgIHsgbGFiZWw6ICdDbG9zZScgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLFxyXG4gICAgICAgICAgICBhY3Rpb246ICgpID0+IHJ1bkRvd25sb2FkZXIoKS5maW5hbGx5KCgpID0+IGRpc21pc3MoKSksXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0pLFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgdGl0bGU6ICdOZXZlciBTaG93IEFnYWluJyxcclxuICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiB7XHJcbiAgICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zdXBwcmVzc05vdGlmaWNhdGlvbignZm9yY2VEb3dubG9hZE5vdGlmJywgdHJ1ZSkpO1xyXG4gICAgICAgICAgZGlzbWlzcygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBhc3NpZ25PdmVycmlkZVBhdGggPSBhc3luYyAob3ZlcnJpZGVQYXRoOiBzdHJpbmcpID0+IHtcclxuICAgIGNvbnN0IGRvb3JTdG9wQ29uZmlnID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLCAnZG9vcnN0b3BfY29uZmlnLmluaScpO1xyXG4gICAgY29uc3QgcGFyc2VyID0gbmV3IFBhcnNlcihuZXcgV2luYXBpRm9ybWF0KCkpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaW5pRGF0YTogSW5pRmlsZTxhbnk+ID0gYXdhaXQgcGFyc2VyLnJlYWQoZG9vclN0b3BDb25maWcpO1xyXG4gICAgICBpbmlEYXRhLmRhdGFbJ1VuaXR5RG9vcnN0b3AnXVsnZGxsU2VhcmNoUGF0aE92ZXJyaWRlJ10gPSBvdmVycmlkZVBhdGg7XHJcbiAgICAgIGF3YWl0IHBhcnNlci53cml0ZShkb29yU3RvcENvbmZpZywgaW5pRGF0YSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignZmFpbGVkIHRvIG1vZGlmeSBkb29yc3RvcCBjb25maWd1cmF0aW9uJywgZXJyKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBydW5Eb3dubG9hZGVyID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3QgZG93bmxvYWRlciA9IG5ldyBVbnN0cmlwcGVkQXNzZW1ibHlEb3dubG9hZGVyKHV0aWwuZ2V0Vm9ydGV4UGF0aCgndGVtcCcpKTtcclxuICAgIGNvbnN0IGZvbGRlck5hbWUgPSBnZW5lcmF0ZSgpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgYWN0aXZlR2FtZU1vZGUgPSBzZWxlY3RvcnMuYWN0aXZlR2FtZUlkKGFwaS5nZXRTdGF0ZSgpKTtcclxuICAgICAgaWYgKGFjdGl2ZUdhbWVNb2RlICE9PSBHQU1FX0lEKSB7XHJcbiAgICAgICAgLy8gVGhpcyBpcyBhIHZhbGlkIHNjZW5hcmlvIHdoZW4gdGhlIHVzZXIgdHJpZXMgdG8gbWFuYWdlIFZhbGhlaW1cclxuICAgICAgICAvLyAgd2hlbiB0aGUgYWN0aXZlIGdhbWVNb2RlIGlzIHVuZGVmaW5lZC5cclxuICAgICAgICB0aHJvdyBuZXcgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQoJ1dyb25nIGdhbWVtb2RlJyk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgYXJjaGl2ZUZpbGVQYXRoID0gYXdhaXQgZG93bmxvYWRlci5kb3dubG9hZE5ld2VzdCgnZnVsbF9uYW1lJywgJ2Rlbmlrc29uLUJlcEluRXhQYWNrX1ZhbGhlaW0nKTtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB3ZSBjYW4ndCByZWFsbHkgdmFsaWRhdGUgdGhlIGRvd25sb2FkJ3MgaW50ZWdyaXR5OyBidXQgd2VcclxuICAgICAgLy8gIGNhbiBhdCB0aGUgdmVyeSBsZWFzdCBtYWtlIHN1cmUgaXQncyB0aGVyZSBhbmQgaXNuJ3QganVzdCBhbiBlbXB0eSBhcmNoaXZlLlxyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoYXJjaGl2ZUZpbGVQYXRoKTtcclxuICAgICAgY29uc3Qgc2V2ZW56aXAgPSBuZXcgdXRpbC5TZXZlblppcCgpO1xyXG4gICAgICBjb25zdCB0ZW1wUGF0aCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoYXJjaGl2ZUZpbGVQYXRoKSwgZm9sZGVyTmFtZSk7XHJcbiAgICAgIGF3YWl0IHNldmVuemlwLmV4dHJhY3RGdWxsKGFyY2hpdmVGaWxlUGF0aCwgdGVtcFBhdGgpO1xyXG4gICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZzLnJlYWRkaXJBc3luYyh0ZW1wUGF0aCk7XHJcbiAgICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgdXRpbC5EYXRhSW52YWxpZCgnSW52YWxpZCBhcmNoaXZlJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEdpdmUgaXQgYSBzZWNvbmQgZm9yIHRoZSBkb3dubG9hZCB0byByZWdpc3RlciBpbiB0aGUgc3RhdGUuXHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XHJcbiAgICAgICAgYXBpLmV2ZW50cy5lbWl0KCdpbXBvcnQtZG93bmxvYWRzJywgWyBhcmNoaXZlRmlsZVBhdGggXSwgYXN5bmMgKGRsSWRzOiBzdHJpbmdbXSkgPT4ge1xyXG4gICAgICAgIGlmIChkbElkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QobmV3IHV0aWwuUHJvY2Vzc0NhbmNlbGVkKCdGYWlsZWQgdG8gaW1wb3J0IGFyY2hpdmUnKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgZm9yIChjb25zdCBkbElkIG9mIGRsSWRzKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMyLCByZWoyKSA9PlxyXG4gICAgICAgICAgICAgIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtaW5zdGFsbC1kb3dubG9hZCcsIGRsSWQsIHRydWUsIChlcnIsIG1vZElkKSA9PiB7XHJcbiAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlajIoZXJyKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0TW9kRW5hYmxlZChwcm9wcy5wcm9maWxlLmlkLCBtb2RJZCwgdHJ1ZSkpO1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXMyKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnN1cHByZXNzTm90aWZpY2F0aW9uKCdmb3JjZURvd25sb2FkTm90aWYnLCB0cnVlKSk7XHJcbiAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0RGVwbG95bWVudE5lY2Vzc2FyeShHQU1FX0lELCB0cnVlKSk7XHJcbiAgICAgICAgYXdhaXQgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBhd2FpdCByZW1vdmVEaXIodGVtcFBhdGgpO1xyXG4gICAgICAgICAgYXdhaXQgZnMucmVtb3ZlQXN5bmModGVtcFBhdGgpLmNhdGNoKGVyciA9PiBlcnIuY29kZSA9PT0gJ0VOT0VOVCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgbG9nKCdlcnJvcicsICdmYWlsZWQgdG8gY2xlYW51cCB0ZW1wb3JhcnkgZmlsZXMnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodW5kZWZpbmVkKTtcclxuICAgICAgfSkpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgdGVtcFBhdGggPSBwYXRoLmpvaW4odXRpbC5nZXRWb3J0ZXhQYXRoKCd0ZW1wJyksIGZvbGRlck5hbWUpO1xyXG4gICAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyh0ZW1wUGF0aCk7XHJcbiAgICAgICAgYXdhaXQgcmVtb3ZlRGlyKHRlbXBQYXRoKTtcclxuICAgICAgfSBjYXRjaCAoZXJyMikge1xyXG4gICAgICAgIGxvZygnZGVidWcnLCAndW5zdHJpcHBlZCBhc3NlbWJseSBkb3dubG9hZGVyIGNsZWFudXAgZmFpbGVkJywgZXJyMik7XHJcbiAgICAgICAgLy8gQ2xlYW51cCBmYWlsZWQgb3IgaXMgdW5uZWNlc3NhcnkuXHJcbiAgICAgIH1cclxuICAgICAgbG9nKCdkZWJ1ZycsICd1bnN0cmlwcGVkIGFzc2VtYmx5IGRvd25sb2FkZXIgZmFpbGVkJywgZXJyKTtcclxuICAgICAgLy8gcmV0dXJuIHJhaXNlTWlzc2luZ0Fzc2VtYmxpZXNEaWFsb2coKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShwcm9wcy5zdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IGNvcmVMaWJNb2RJZHMgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoa2V5ID0+IHtcclxuICAgIGNvbnN0IGhhc0NvcmVMaWJUeXBlID0gdXRpbC5nZXRTYWZlKG1vZHNba2V5XSxcclxuICAgICAgWydhdHRyaWJ1dGVzJywgJ0NvcmVMaWJUeXBlJ10sIHVuZGVmaW5lZCkgIT09IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IGlzRW5hYmxlZCA9IHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLFxyXG4gICAgICBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSk7XHJcbiAgICByZXR1cm4gaGFzQ29yZUxpYlR5cGUgJiYgaXNFbmFibGVkO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoY29yZUxpYk1vZElkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAvLyBXZSBkb24ndCBjYXJlIGlmIHRoZSB1c2VyIGhhcyBzZXZlcmFsIGluc3RhbGxlZCwgc2VsZWN0IHRoZSBmaXJzdCBvbmUuXHJcbiAgICBjb25zdCBjb3JlTGliTW9kSWQgPSBjb3JlTGliTW9kSWRzWzBdO1xyXG5cclxuICAgIGNvbnN0IHBhY2tUeXBlOiBQYWNrVHlwZSA9IG1vZHNbY29yZUxpYk1vZElkXS5hdHRyaWJ1dGVzWydDb3JlTGliVHlwZSddO1xyXG4gICAgc3dpdGNoIChwYWNrVHlwZSkge1xyXG4gICAgICBjYXNlICdjb3JlX2xpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCdCZXBJbkV4XFxcXGNvcmVfbGliJyk7XHJcbiAgICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGNhc2UgJ3Vuc3RyaXBwZWRfY29ybGliJzpcclxuICAgICAgICBhc3NpZ25PdmVycmlkZVBhdGgoJ3Vuc3RyaXBwZWRfY29ybGliJyk7XHJcbiAgICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgLy8gbm9wIC0gbGV0IHRoZSBmb3IgbG9vcCBiZWxvdyB0cnkgdG8gZmluZCB0aGUgcGFjay5cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgZmlsZVBhdGggb2YgW2Z1bGxQYWNrQ29yTGliTmV3LCBmdWxsUGFja0NvckxpYk9sZF0pIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhmaWxlUGF0aCk7XHJcbiAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICByYWlzZUZvcmNlRG93bmxvYWROb3RpZigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgLy8gbm9wXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgdmFsaWQgdmFyaWFudCBvZiB0aGUgdW5zdHJpcHBlZCBhc3NlbWJseSBtb2RzIGZvdW5kIG9uIE5leHVzLlxyXG4gIGNvbnN0IHVuc3RyaXBwZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGlkID0+IG1vZHNbaWRdPy50eXBlID09PSAndW5zdHJpcHBlZC1hc3NlbWJsaWVzJyk7XHJcbiAgaWYgKHVuc3RyaXBwZWRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIGZvciAoY29uc3QgbW9kSWQgb2YgdW5zdHJpcHBlZE1vZHMpIHtcclxuICAgICAgaWYgKHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLCBbJ21vZFN0YXRlJywgbW9kSWQsICdlbmFibGVkJ10sIGZhbHNlKSkge1xyXG4gICAgICAgIGNvbnN0IGRsaWQgPSBtb2RzW21vZElkXS5hcmNoaXZlSWQ7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWQ6IHR5cGVzLklEb3dubG9hZCA9IHV0aWwuZ2V0U2FmZShhcGkuZ2V0U3RhdGUoKSxcclxuICAgICAgICAgIFsncGVyc2lzdGVudCcsICdkb3dubG9hZHMnLCAnZmlsZXMnLCBkbGlkXSwgdW5kZWZpbmVkKTtcclxuICAgICAgICBpZiAoZG93bmxvYWQ/LmxvY2FsUGF0aCAhPT0gdW5kZWZpbmVkICYmIGd1ZXNzTW9kSWQoZG93bmxvYWQubG9jYWxQYXRoKSAhPT0gJzE1Jykge1xyXG4gICAgICAgICAgLy8gVGhlIE5leHVzIE1vZHMgdW5zdHJpcHBlZCBhc3NtZWJsaWVzIG1vZCBpcyBlbmFibGVkIC0gZG9uJ3QgcmFpc2UgdGhlIG1pc3NpbmdcclxuICAgICAgICAgIC8vICBhc3NlbWJsaWVzIGRpYWxvZy5cclxuICAgICAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGV4cGVjdGVkRmlsZVBhdGgucmVwbGFjZShwcm9wcy5kaXNjb3ZlcnkucGF0aCArIHBhdGguc2VwLCAnJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShwYXRoLnNlcCArICdtb25vLnNlY3VyaXR5LmRsbCcsICcnKTtcclxuICAgICAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJ1bkRvd25sb2FkZXIoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCkge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcmV2UHJvZklkOiBzdHJpbmcgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJldlByb2ZJZCk7XHJcbiAgY29uc3QgbW9kVHlwZXM6IHsgW3R5cGVJZDogc3RyaW5nXTogc3RyaW5nIH0gPSBzZWxlY3RvcnMubW9kUGF0aHNGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBjcmVhdGVEaXJlY3RvcmllcyA9IGFzeW5jICgpID0+IHtcclxuICAgIGZvciAoY29uc3QgbW9kVHlwZSBvZiBPYmplY3Qua2V5cyhtb2RUeXBlcykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKG1vZFR5cGVzW21vZFR5cGVdKTtcclxuICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG4gIHJldHVybiBuZXcgQmx1ZWJpcmQ8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4gY3JlYXRlRGlyZWN0b3JpZXMoKVxyXG4gICAgLnRoZW4oKCkgPT4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlPy5pZCkpXHJcbiAgICAudGhlbigoKSA9PiByZXNvbHZlKCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IHJlamVjdChlcnIpKSlcclxuICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyh7IGFwaTogY29udGV4dC5hcGksIHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb2RzUGF0aChnYW1lUGF0aDogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIGdhbWVQYXRoICE9PSB1bmRlZmluZWQgPyBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKSA6ICcuJztcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICAgIGlnbm9yZURlcGxveTogW10uY29uY2F0KElHTk9SQUJMRV9GSUxFUywgSUdOT1JBQkxFX0ZJTEVTLm1hcChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSkpLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gIC8vICAgaWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgbmFtZTogJ1ZhbGhlaW06IERlZGljYXRlZCBTZXJ2ZXInLFxyXG4gIC8vICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gIC8vICAgcXVlcnlQYXRoOiAoKSA9PiB1bmRlZmluZWQsXHJcbiAgLy8gICBxdWVyeU1vZFBhdGg6IG1vZHNQYXRoLFxyXG4gIC8vICAgbG9nbzogJ2dhbWVhcnQuanBnJyxcclxuICAvLyAgIGV4ZWN1dGFibGU6ICgpID0+ICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgLy8gICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgLy8gICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgLy8gICAgICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIF0sXHJcbiAgLy8gICBlbnZpcm9ubWVudDoge1xyXG4gIC8vICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAvLyAgIH0sXHJcbiAgLy8gICBkZXRhaWxzOiB7XHJcbiAgLy8gICAgIG5leHVzUGFnZUlkOiBHQU1FX0lELFxyXG4gIC8vICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAvLyAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gIC8vICAgfSxcclxuICAvLyB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICAvL2NvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0LmFwaSk7XHJcbiAgICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgICBjb25zdCBkaXNjb3ZlcnkgPSB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICAgIFsnc2V0dGluZ3MnLCAnZ2FtZU1vZGUnLCAnZGlzY292ZXJlZCcsIEdBTUVfSURdLCB1bmRlZmluZWQpO1xyXG4gICAgaWYgKGRpc2NvdmVyeT8ucGF0aCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGNvbnRleHQuYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignVmFsaGVpbSB3YXMgbm90IGRpc2NvdmVyZWQnLCAnUGxlYXNlIHJlLWluc3RhbGwgdGhlIGdhbWUuJywgeyBhbGxvd1JlcG9ydDogZmFsc2UgfSk7XHJcbiAgICAgIHRocm93IG5ldyB1dGlsLlByb2Nlc3NDYW5jZWxlZCgnR2FtZSBwYXRoIG5vdCBmb3VuZCcpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGRpc2NvdmVyeS5wYXRoO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGlzU3VwcG9ydGVkID0gKGdhbWVJZDogc3RyaW5nKSA9PiAoZ2FtZUlkID09PSBHQU1FX0lEKTtcclxuICBjb25zdCBoYXNJbnN0cnVjdGlvbiA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByZWQ6IChpbnN0OiB0eXBlcy5JSW5zdHJ1Y3Rpb24pID0+IGJvb2xlYW4pID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbnMuZmluZChpbnN0ciA9PiAoaW5zdHIudHlwZSA9PT0gJ2NvcHknKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHByZWQoaW5zdHIpKSkgIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgY29uc3QgZmluZEluc3RyTWF0Y2ggPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kPzogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIG1vZCA9IChpbnB1dCkgPT4gaW5wdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLCAoaW5zdHIpID0+XHJcbiAgICAgIG1vZChpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT09IHBhdHRlcm4udG9Mb3dlckNhc2UoKSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdmJ1aWxkRGVwVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGdhbWVQYXRoID0gZ2V0R2FtZVBhdGgoKTtcclxuICAgIGlmIChnYW1lUGF0aCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcbiAgICBjb25zdCBidWlsZFNoYXJlQXNzZW1ibHkgPSBwYXRoLmpvaW4oZ2FtZVBhdGgsICdJblNsaW1WTUwnLCAnTW9kcycsICdDUi1CdWlsZFNoYXJlX1ZNTC5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmJ1aWxkLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICdpbnNsaW12bWwtbW9kJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0J1aWxkU2hhcmUgKEFkdmFuY2VkQnVpbGRpbmcpJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNScsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgYnVpbGRTaGFyZUFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21NZXNoZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgaWYgKGdldEdhbWVQYXRoKCkgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21NZXNoZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tTWVzaGVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTg0JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21UZXh0dXJlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBpZiAoZ2V0R2FtZVBhdGgoKSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbVRleHR1cmVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tVGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80OCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYmV0dGVyQ29udGluZW50c1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBpZiAoZ2V0R2FtZVBhdGgoKSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0JldHRlckNvbnRpbmVudHMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ2JldHRlci1jb250aW5lbnRzLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQmV0dGVyIENvbnRpbmVudHMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80NDYnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8vIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDEwMCwgJ3N0ZWFtY21kJywge30sICdTdGVhbUNNRCBEZWRpY2F0ZWQgU2VydmVyJywgKCkgPT4ge1xyXG4gIC8vICAgY29udGV4dC5hcGkuc2VsZWN0RGlyKHt9KVxyXG4gIC8vICAgICAudGhlbigoc2VsZWN0ZWRQYXRoOiBzdHJpbmcpID0+IHtcclxuICAvLyAgICAgICBpZiAoc2VsZWN0ZWRQYXRoKSB7XHJcbiAgLy8gICAgICAgICBjb25zdCBwcm9wczogSVNDTURQcm9wcyA9IHtcclxuICAvLyAgICAgICAgICAgZ2FtZUlkOiBHQU1FX0lEX1NFUlZFUixcclxuICAvLyAgICAgICAgICAgc3RlYW1BcHBJZDogK1NURUFNX0lELFxyXG4gIC8vICAgICAgICAgICBhcmd1bWVudHM6IFtcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAnZm9yY2VfaW5zdGFsbF9kaXInLCB2YWx1ZTogc2VsZWN0ZWRQYXRoIH0sXHJcbiAgLy8gICAgICAgICAgICAgeyBhcmd1bWVudDogJ3F1aXQnIH0sXHJcbiAgLy8gICAgICAgICAgIF0sXHJcbiAgLy8gICAgICAgICAgIGNhbGxiYWNrOiAoKGVyciwgZGF0YSkgPT4gbnVsbCksXHJcbiAgLy8gICAgICAgICB9O1xyXG4gIC8vICAgICAgICAgY29udGV4dC5hcGkuZXh0LnNjbWRTdGFydERlZGljYXRlZFNlcnZlcihwcm9wcyk7XHJcbiAgLy8gICAgICAgfVxyXG4gIC8vICAgICB9KVxyXG4gIC8vICAgICAuY2F0Y2goZXJyID0+IG51bGwpO1xyXG4gIC8vIH0sICgpID0+IGNvbnRleHQuYXBpLmV4dD8uc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyICE9PSB1bmRlZmluZWQpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyQWN0aW9uKCdtb2QtaWNvbnMnLCAxMTUsICdpbXBvcnQnLCB7fSwgJ0ltcG9ydCBGcm9tIHIybW9kbWFuJywgKCkgPT4ge1xyXG4gICAgbWlncmF0ZVIyVG9Wb3J0ZXgoY29udGV4dC5hcGkpO1xyXG4gIH0sICgpID0+IHtcclxuICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgIGNvbnN0IGFjdGl2ZUdhbWVJZCA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoc3RhdGUpO1xyXG4gICAgcmV0dXJuIHVzZXJIYXNSMkluc3RhbGxlZCgpXHJcbiAgICAgICYmIChnZXRHYW1lUGF0aCgpICE9PSB1bmRlZmluZWQpXHJcbiAgICAgICYmIChhY3RpdmVHYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBkZXBlbmRlbmN5VGVzdHMgPSBbIHZidWlsZERlcFRlc3QsIGN1c3RvbU1lc2hlc1Rlc3QsXHJcbiAgICBjdXN0b21UZXh0dXJlc1Rlc3QsIGJldHRlckNvbnRpbmVudHNUZXN0IF07XHJcblxyXG4gIGZvciAoY29uc3QgdGVzdEZ1bmMgb2YgZGVwZW5kZW5jeVRlc3RzKSB7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB0ZXN0RnVuYyk7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdtb2QtaW5zdGFsbGVkJywgdGVzdEZ1bmMpO1xyXG4gIH1cclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ211bHRpcGxlLWxpYi1tb2RzJywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnbW9kLWluc3RhbGxlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1iZXR0ZXItY29udGluZW50cycsIDIwLCB0ZXN0QmV0dGVyQ29udCwgaW5zdGFsbEJldHRlckNvbnQpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1jb25maWctbWFuYWdlcicsIDEwLCB0ZXN0Q29uZk1hbmFnZXIsIGluc3RhbGxDb25mTWFuYWdlcilcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTAzKGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA0KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA2KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA5KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTAxMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMTUoY29udGV4dC5hcGksIG9sZFZlcnNpb24pKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2luc2xpbXZtbC1tb2QtbG9hZGVyJywgMjAsIGlzU3VwcG9ydGVkLCBnZXRHYW1lUGF0aCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc1ZNTEluaSA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgSU5TTElNVk1MX0lERU5USUZJRVIsIHBhdGguYmFzZW5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoaGFzVk1MSW5pKTtcclxuICAgIH0sIHsgbmFtZTogJ0luU2xpbVZNTCBNb2QgTG9hZGVyJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2luc2xpbXZtbC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBnZXRHYW1lUGF0aCgpICE9PSB1bmRlZmluZWQgPyBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0luU2xpbVZNTCcsICdNb2RzJykgOiB1bmRlZmluZWQsIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIC8vIFVuZm9ydHVuYXRlbHkgdGhlcmUgYXJlIGN1cnJlbnRseSBubyBpZGVudGlmaWVycyB0byBkaWZmZXJlbnRpYXRlIGJldHdlZW5cclxuICAgICAgLy8gIEJlcEluRXggYW5kIEluU2xpbVZNTCBtb2RzIGFuZCB0aGVyZWZvcmUgY2Fubm90IGF1dG9tYXRpY2FsbHkgYXNzaWduXHJcbiAgICAgIC8vICB0aGlzIG1vZFR5cGUgYXV0b21hdGljYWxseS4gV2UgZG8ga25vdyB0aGF0IENSLUFkdmFuY2VkQnVpbGRlci5kbGwgaXMgYW4gSW5TbGltXHJcbiAgICAgIC8vICBtb2QsIGJ1dCB0aGF0J3MgYWJvdXQgaXQuXHJcbiAgICAgIGNvbnN0IHZtbFN1ZmZpeCA9ICdfdm1sLmRsbCc7XHJcbiAgICAgIGNvbnN0IG1vZCA9IChpbnB1dDogc3RyaW5nKSA9PiAoaW5wdXQubGVuZ3RoID4gdm1sU3VmZml4Lmxlbmd0aClcclxuICAgICAgICA/IHBhdGguYmFzZW5hbWUoaW5wdXQpLnNsaWNlKC12bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgIDogJyc7XHJcbiAgICAgIGNvbnN0IHRlc3RSZXMgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsICdjci1idWlsZHNoYXJlX3ZtbC5kbGwnLCBwYXRoLmJhc2VuYW1lKVxyXG4gICAgICAgIHx8IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ192bWwuZGxsJywgbW9kKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHRlc3RSZXMpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd2YnVpbGQtbW9kJywgMTAsIGlzU3VwcG9ydGVkLCAoKSA9PiBnZXRHYW1lUGF0aCgpICE9PSB1bmRlZmluZWQgPyBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0FkdmFuY2VkQnVpbGRlcicsICdCdWlsZHMnKSA6IHVuZGVmaW5lZCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IHJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgVkJVSUxEX0VYVCwgcGF0aC5leHRuYW1lKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdCdWlsZFNoYXJlIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd2YWxoZWltLWN1c3RvbS1tZXNoZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBnZXRHYW1lUGF0aCgpICE9PSB1bmRlZmluZWQgPyBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21NZXNoZXMnKSA6IHVuZGVmaW5lZCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1vZGlmaWVyID0gKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xyXG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGgudG9Mb3dlckNhc2UoKS5zcGxpdChwYXRoLnNlcCk7XHJcbiAgICAgICAgcmV0dXJuIChzZWdtZW50cy5pbmNsdWRlcygnY3VzdG9tbWVzaGVzJykpXHJcbiAgICAgICAgICA/IGZpbGVQYXRoXHJcbiAgICAgICAgICA6IHBhdGguZXh0bmFtZShmaWxlUGF0aCk7XHJcbiAgICAgIH07XHJcbiAgICAgIGNvbnN0IHN1cHBvcnRlZCA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgRkJYX0VYVCwgbW9kaWZpZXIpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBtb2RpZmllcik7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQ3VzdG9tTWVzaGVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IGdldEdhbWVQYXRoKCkgIT09IHVuZGVmaW5lZCA/IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbVRleHR1cmVzJykgOiB1bmRlZmluZWQsXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXh0dXJlUmd4OiBSZWdFeHAgPSBuZXcgUmVnRXhwKC9edGV4dHVyZV8uKi5wbmckLyk7XHJcbiAgICAgIGxldCBzdXBwb3J0ZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCBpbnN0ciBvZiBpbnN0cnVjdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBzZWdtZW50cyA9ICghIWluc3RyLnNvdXJjZSlcclxuICAgICAgICAgID8gaW5zdHIuc291cmNlLnRvTG93ZXJDYXNlKCkuc3BsaXQocGF0aC5zZXApXHJcbiAgICAgICAgICA6IFtdO1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcygnY3VzdG9tdGV4dHVyZXMnKSkge1xyXG4gICAgICAgICAgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICgoaW5zdHIudHlwZSA9PT0gJ2NvcHknKVxyXG4gICAgICAgICAgJiYgdGV4dHVyZVJneC50ZXN0KHBhdGguYmFzZW5hbWUoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpKSkge1xyXG4gICAgICAgICAgICBzdXBwb3J0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHN1cHBvcnRlZCk7XHJcbiAgICB9LCB7IG5hbWU6ICdDdXN0b21UZXh0dXJlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndW5zdHJpcHBlZC1hc3NlbWJsaWVzJywgMjAsIGlzU3VwcG9ydGVkLCBnZXRHYW1lUGF0aCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IHRlc3RQYXRoID0gcGF0aC5qb2luKCd1bnN0cmlwcGVkX21hbmFnZWQnLCAnbW9uby5wb3NpeC5kbGwnKTtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLFxyXG4gICAgICAgIChpbnN0cikgPT4gaW5zdHIuc291cmNlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModGVzdFBhdGgpKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHN1cHBvcnRlZCk7XHJcbiAgICB9LCB7IG5hbWU6ICdVbnN0cmlwcGVkIEFzc2VtYmxpZXMnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnYmVwaW5leC1yb290LW1vZCcsIDI1LCBpc1N1cHBvcnRlZCxcclxuICAoKSA9PiBnZXRHYW1lUGF0aCgpICE9PSB1bmRlZmluZWQgPyBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSA6IHVuZGVmaW5lZCxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBnZXRHYW1lUGF0aCgpICE9PSB1bmRlZmluZWQgPyBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ3ZvcnRleC13b3JsZHMnKSA6IHVuZGVmaW5lZCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc0JDRXh0ID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNCQ0V4dCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXR0ZXIgQ29udGluZW50cyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsLWNvbmYtbWFuJywgMjAsIGlzU3VwcG9ydGVkLFxyXG4gICAgKCkgPT4gZ2V0R2FtZVBhdGgoKSAhPT0gdW5kZWZpbmVkID8gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdCZXBJbkV4JykgOiB1bmRlZmluZWQsXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXN0UmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBDT05GX01BTkFHRVIsIHBhdGguYmFzZW5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdDb25maWd1cmF0aW9uIE1hbmFnZXInIH0pO1xyXG5cclxuICBjb250ZXh0Lm9uY2UoKCkgPT4ge1xyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnd2lsbC1kZXBsb3knLCBhc3luYyAocHJvZmlsZUlkKSA9PiB7XHJcbiAgICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICAgICAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlSWQpXHJcbiAgICAgICAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoZ2VuUHJvcHMoY29udGV4dC5hcGksIHByb2ZpbGVJZCkpKVxyXG4gICAgICAgIC5jYXRjaChlcnIgPT4gZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWRcclxuICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcclxuICAgICAgICAgIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCdkaWQtcHVyZ2UnLCBhc3luYyAocHJvZmlsZUlkKSA9PlxyXG4gICAgICBwYXlsb2FkRGVwbG95ZXIub25EaWRQdXJnZShjb250ZXh0LmFwaSwgcHJvZmlsZUlkKSk7XHJcblxyXG4gICAgY29udGV4dC5hcGkuZXZlbnRzLm9uKCdnYW1lbW9kZS1hY3RpdmF0ZWQnLFxyXG4gICAgICBhc3luYyAoZ2FtZU1vZGU6IHN0cmluZykgPT4gKGdhbWVNb2RlID09PSBHQU1FX0lEKVxyXG4gICAgICAgID8gY2hlY2tDb25maWdNYW5hZ2VyVXBkKGNvbnRleHQuYXBpLCB0cnVlKSA6IG51bGwpO1xyXG5cclxuICAgIGNvbnRleHQuYXBpLmV2ZW50cy5vbignY2hlY2stbW9kcy12ZXJzaW9uJyxcclxuICAgICAgKGdhbWVJZDogc3RyaW5nLCBtb2RzOiB0eXBlcy5JTW9kW10pID0+IChnYW1lSWQgPT09IEdBTUVfSUQpXHJcbiAgICAgICAgPyBjaGVja0NvbmZpZ01hbmFnZXJVcGQoY29udGV4dC5hcGkpIDogbnVsbCk7XHJcblxyXG4gICAgY29udGV4dC5hcGkuZXZlbnRzLm9uKCdkaWQtaW5zdGFsbC1tb2QnLCBhc3luYyAoZ2FtZUlkLCBhcmNoaXZlSWQsIG1vZElkKSA9PiB7XHJcbiAgICAgIGlmIChnYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFBvaW50IG9mIHRoaXMgZnVuY3Rpb25hbGl0eSBpcyB0byBzZXQgdGhlIHZlcnNpb24gaW5mb3JtYXRpb25cclxuICAgICAgLy8gIGZvciBtb2RzIHRoYXQgYXJlIGluc3RhbGxlZCBmcm9tIGFuIGV4dGVybmFsIHNpdGUuXHJcbiAgICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgY29uc3QgaW5zdGFsbFBhdGggPSBzZWxlY3RvcnMuaW5zdGFsbFBhdGhGb3JHYW1lKHN0YXRlLCBnYW1lSWQpO1xyXG4gICAgICBjb25zdCBtb2Q6IHR5cGVzLklNb2QgPSBzdGF0ZS5wZXJzaXN0ZW50Lm1vZHM/LltnYW1lSWRdPy5bbW9kSWRdO1xyXG4gICAgICBpZiAoKGluc3RhbGxQYXRoID09PSB1bmRlZmluZWQpXHJcbiAgICAgIHx8IChtb2Q/Lmluc3RhbGxhdGlvblBhdGggPT09IHVuZGVmaW5lZClcclxuICAgICAgfHwgKCEhbW9kLmF0dHJpYnV0ZXM/LnZlcnNpb24pKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IG1vZFBhdGggPSBwYXRoLmpvaW4oaW5zdGFsbFBhdGgsIG1vZC5pbnN0YWxsYXRpb25QYXRoKTtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBmaWxlRW50cmllczogSUVudHJ5W10gPSBhd2FpdCB3YWxrRGlyUGF0aChtb2RQYXRoKTtcclxuICAgICAgICBjb25zdCBtYW5pZmVzdEZpbGUgPSBmaWxlRW50cmllcy5maW5kKGVudHJ5ID0+IHBhdGguYmFzZW5hbWUoZW50cnkuZmlsZVBhdGgudG9Mb3dlckNhc2UoKSkgPT09ICdtYW5pZmVzdC5qc29uJyk7XHJcbiAgICAgICAgaWYgKG1hbmlmZXN0RmlsZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBtYW5pZmVzdERhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZUFzeW5jKG1hbmlmZXN0RmlsZS5maWxlUGF0aCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pO1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKG1hbmlmZXN0RGF0YSk7XHJcbiAgICAgICAgaWYgKGRhdGFbJ3ZlcnNpb25fbnVtYmVyJ10gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgY29udGV4dC5hcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoZ2FtZUlkLCBtb2RJZCwgJ3ZlcnNpb24nLCBkYXRhWyd2ZXJzaW9uX251bWJlciddKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAvLyBUaGlzIGlzIGEgUW9MIGZlYXR1cmUsIHdlIGRvbid0IGNhcmUgaWYgaXQgZmFpbHMuXHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbWFpbjtcclxuIl19