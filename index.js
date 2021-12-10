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
const STOP_PATTERNS = ['config', 'plugins', 'patchers'];
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
        const url = path.join(common_1.NEXUS, 'valheim', 'mods', '1202') + `?tab=files&file_id=4899&nmm=1`;
        const raiseMissingAssembliesDialog = () => new Promise((resolve, reject) => {
            api.showDialog('info', 'Missing unstripped assemblies', {
                bbcode: t('Valheim\'s assemblies are distributed in an "optimised" state to reduce required '
                    + 'disk space. This unfortunately means that Valheim\'s modding capabilities are also affected.{{br}}{{br}}'
                    + 'In order to mod Valheim, the unoptimised/unstripped assemblies are required - please download these '
                    + 'from Nexus Mods.{{br}}{{br}} You can choose the Vortex/mod manager download or manual download '
                    + '(simply drag and drop the archive into the mods dropzone to add it to Vortex).{{br}}{{br}}'
                    + 'Vortex will then be able to install the assemblies where they are needed to enable '
                    + 'modding, leaving the original ones untouched.', { replace: { br: '[br][/br]' } }),
            }, [
                { label: 'Cancel', action: () => reject(new vortex_api_1.util.UserCanceled()) },
                {
                    label: 'Download Unstripped Assemblies',
                    action: () => vortex_api_1.util.opn(url)
                        .catch(err => null)
                        .finally(() => resolve()),
                },
            ]);
        });
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
                    for (const dlId of dlIds) {
                        yield new Promise((res2, rej2) => api.events.emit('start-install-download', dlId, true, (err, modId) => {
                            if (err) {
                                return rej2(err);
                            }
                            api.store.dispatch(vortex_api_1.actions.setModEnabled(props.profile.id, modId, true));
                            return res2(undefined);
                        }));
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
                return raiseMissingAssembliesDialog();
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
    return path.join(gamePath, 'BepInEx', 'plugins');
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
        var _a;
        const props = (0, common_1.genProps)(context.api);
        return (((_a = props === null || props === void 0 ? void 0 : props.discovery) === null || _a === void 0 ? void 0 : _a.path) !== undefined)
            ? props.discovery.path : '.';
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
    context.registerAction('mod-icons', 100, 'steamcmd', {}, 'SteamCMD Dedicated Server', () => {
        (0, migrations_1.migrate1013)(context.api, '1.0.12');
    }, () => true);
    context.registerAction('mod-icons', 115, 'import', {}, 'Import From r2modman', () => {
        (0, r2Vortex_1.migrateR2ToVortex)(context.api);
    }, () => {
        const state = context.api.getState();
        const activeGameId = vortex_api_1.selectors.activeGameId(state);
        return (0, r2Vortex_1.userHasR2Installed)()
            && (getGamePath() !== '.')
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
    context.registerMigration((oldVersion) => (0, migrations_1.migrate103)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate104)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate106)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate109)(context.api, oldVersion));
    context.registerMigration((oldVersion) => (0, migrations_1.migrate1013)(context.api, oldVersion));
    context.registerModType('inslimvml-mod-loader', 20, isSupported, getGamePath, (instructions) => {
        const hasVMLIni = findInstrMatch(instructions, common_1.INSLIMVML_IDENTIFIER, path.basename);
        return bluebird_1.default.Promise.Promise.resolve(hasVMLIni);
    }, { name: 'InSlimVML Mod Loader' });
    context.registerModType('inslimvml-mod', 10, isSupported, () => path.join(getGamePath(), 'InSlimVML', 'Mods'), (instructions) => {
        const vmlSuffix = '_vml.dll';
        const mod = (input) => (input.length > vmlSuffix.length)
            ? path.basename(input).slice(-vmlSuffix.length)
            : '';
        const testRes = findInstrMatch(instructions, 'cr-buildshare_vml.dll', path.basename)
            || findInstrMatch(instructions, '_vml.dll', mod);
        return bluebird_1.default.Promise.Promise.resolve(testRes);
    }, { name: 'InSlimVML Mod' });
    context.registerModType('vbuild-mod', 10, isSupported, () => path.join(getGamePath(), 'AdvancedBuilder', 'Builds'), (instructions) => {
        const res = findInstrMatch(instructions, common_1.VBUILD_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(res);
    }, { name: 'BuildShare Mod' });
    context.registerModType('valheim-custom-meshes', 10, isSupported, () => path.join(modsPath(getGamePath()), 'CustomMeshes'), (instructions) => {
        const supported = findInstrMatch(instructions, common_1.FBX_EXT, path.extname)
            || findInstrMatch(instructions, common_1.OBJ_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'CustomMeshes Mod' });
    context.registerModType('valheim-custom-textures', 10, isSupported, () => path.join(modsPath(getGamePath()), 'CustomTextures'), (instructions) => {
        const textureRgx = new RegExp(/^texture_.*.png$/);
        let supported = false;
        for (const instr of instructions) {
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
    context.registerModType('bepinex-root-mod', 25, isSupported, () => path.join(getGamePath(), 'BepInEx'), (instructions) => {
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
    context.registerModType('better-continents-mod', 25, isSupported, () => path.join(getGamePath(), 'vortex-worlds'), (instructions) => {
        const hasBCExt = findInstrMatch(instructions, common_1.BETTER_CONT_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(hasBCExt);
    }, { name: 'Better Continents Mod' });
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
    });
    return true;
}
exports.default = main;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDJDQUFzRTtBQUN0RSxxRUFBaUU7QUFDakUsbUVBQXFEO0FBRXJELHFDQUFtQztBQUVuQyw2REFBb0U7QUFFcEUscUNBSWtCO0FBQ2xCLDZDQUVtQztBQUNuQyw2Q0FBMkY7QUFDM0YsbUNBQW1FO0FBRW5FLHlDQUFtRTtBQUVuRSx5REFBa0Y7QUFFbEYsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQVMsU0FBUyxDQUFDLEtBQUs7SUFDdEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxHQUFHLE9BQU8sQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxRQUFRO0lBQ2YsT0FBTyxpQkFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxpQkFBUSxDQUFDLENBQUM7U0FDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVE7SUFDaEMsT0FBTyxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssaUJBQWlCLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekYsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDaEIsUUFBUSxFQUFFLE9BQU87WUFDakIsT0FBTyxFQUFFO2dCQUNQLEtBQUssRUFBRSxpQkFBUTtnQkFDZixVQUFVLEVBQUUsQ0FBQyxlQUFlLENBQUM7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2FBQ3hCO1NBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzlCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQsU0FBZSwwQkFBMEIsQ0FBQyxLQUFhOztRQUNyRCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7UUFDeEIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUNyRCxvQkFBb0IsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQzdDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksRUFDdEQsU0FBUyxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQzlDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksRUFDdEQsbUJBQW1CLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUU1QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQUssRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLCtCQUErQixDQUFDO1FBQzFGLE1BQU0sNEJBQTRCLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDL0UsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsK0JBQStCLEVBQUU7Z0JBQ3RELE1BQU0sRUFBRSxDQUFDLENBQUMsbUZBQW1GO3NCQUMzRiwwR0FBMEc7c0JBQzFHLHNHQUFzRztzQkFDdEcsaUdBQWlHO3NCQUNqRyw0RkFBNEY7c0JBQzVGLHFGQUFxRjtzQkFDckYsK0NBQStDLEVBQUUsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUUsQ0FBQzthQUNyRixFQUFFO2dCQUNELEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksaUJBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFO2dCQUNsRTtvQkFDRSxLQUFLLEVBQUUsZ0NBQWdDO29CQUN2QyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsaUJBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO3lCQUN4QixLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7eUJBQ2xCLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztpQkFDNUI7YUFDRixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sdUJBQXVCLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDO1lBQ3pELE9BQU8sRUFBRSxDQUFDLENBQUMsa0RBQWtELENBQUM7WUFDOUQsSUFBSSxFQUFFLE1BQU07WUFDWixFQUFFLEVBQUUsb0JBQW9CO1lBQ3hCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsYUFBYSxFQUFFLElBQUk7WUFDbkIsT0FBTyxFQUFFO2dCQUNQO29CQUNFLEtBQUssRUFBRSxNQUFNO29CQUNiLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsZ0NBQWdDLEVBQUU7d0JBQzVFLE1BQU0sRUFBRSxDQUFDLENBQUMscUtBQXFLOzhCQUNySyxvS0FBb0s7OEJBQ3BLLDZGQUE2Rjs4QkFDN0YseUdBQXlHLEVBQzNHLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLG9CQUFvQixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDO3FCQUNwRSxFQUFFO3dCQUNELEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRTt3QkFDbEI7NEJBQ0UsS0FBSyxFQUFFLGdDQUFnQzs0QkFDdkMsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLGFBQWEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQzt5QkFDdkQ7cUJBQ0YsQ0FBQztpQkFDSDtnQkFDRDtvQkFDRSxLQUFLLEVBQUUsa0JBQWtCO29CQUN6QixNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTt3QkFDbEIsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsb0JBQU8sQ0FBQyxvQkFBb0IsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUM3RSxPQUFPLEVBQUUsQ0FBQztvQkFDWixDQUFDO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLENBQU8sWUFBb0IsRUFBRSxFQUFFO1lBQ3hELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUM5RSxNQUFNLE1BQU0sR0FBRyxJQUFJLDBCQUFNLENBQUMsSUFBSSwrQkFBWSxFQUFFLENBQUMsQ0FBQztZQUM5QyxJQUFJO2dCQUNGLE1BQU0sT0FBTyxHQUFpQixNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2hFLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsdUJBQXVCLENBQUMsR0FBRyxZQUFZLENBQUM7Z0JBQ3RFLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDN0M7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixHQUFHLENBQUMscUJBQXFCLENBQUMseUNBQXlDLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDM0U7UUFDSCxDQUFDLENBQUEsQ0FBQztRQUVGLE1BQU0sYUFBYSxHQUFHLEdBQVMsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxJQUFJLGlEQUE0QixDQUFDLGlCQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDaEYsTUFBTSxVQUFVLEdBQUcsSUFBQSxrQkFBUSxHQUFFLENBQUM7WUFDOUIsSUFBSTtnQkFDRixNQUFNLGNBQWMsR0FBRyxzQkFBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDOUQsSUFBSSxjQUFjLEtBQUssZ0JBQU8sRUFBRTtvQkFHOUIsTUFBTSxJQUFJLGlCQUFJLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUM7aUJBQ2xEO2dCQUNELE1BQU0sZUFBZSxHQUFHLE1BQU0sVUFBVSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsOEJBQThCLENBQUMsQ0FBQztnQkFHckcsTUFBTSxlQUFFLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUNwQyxNQUFNLFFBQVEsR0FBRyxJQUFJLGlCQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ3JDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDdEUsTUFBTSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDdEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUN0QixNQUFNLElBQUksaUJBQUksQ0FBQyxXQUFXLENBQUMsaUJBQWlCLENBQUMsQ0FBQztpQkFDL0M7Z0JBR0QsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUNwQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFFLGVBQWUsQ0FBRSxFQUFFLENBQU8sS0FBZSxFQUFFLEVBQUU7b0JBQ25GLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7d0JBQ3RCLE9BQU8sTUFBTSxDQUFDLElBQUksaUJBQUksQ0FBQyxlQUFlLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO3FCQUNyRTtvQkFFRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTt3QkFDeEIsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUMvQixHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFOzRCQUNyRSxJQUFJLEdBQUcsRUFBRTtnQ0FDUCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzs2QkFDbEI7NEJBQ0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsb0JBQU8sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7NEJBQ3pFLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO3dCQUN6QixDQUFDLENBQUMsQ0FBQyxDQUFDO3FCQUNMO29CQUVELEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFPLENBQUMsb0JBQW9CLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDN0UsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsb0JBQU8sQ0FBQyxzQkFBc0IsQ0FBQyxnQkFBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2xFLE1BQU0sa0JBQWtCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztvQkFDOUMsSUFBSTt3QkFDRixNQUFNLElBQUEsa0JBQVMsRUFBQyxRQUFRLENBQUMsQ0FBQzt3QkFDMUIsTUFBTSxlQUFFLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7cUJBQ3BFO29CQUFDLE9BQU8sR0FBRyxFQUFFO3dCQUNaLElBQUEsZ0JBQUcsRUFBQyxPQUFPLEVBQUUsbUNBQW1DLENBQUMsQ0FBQztxQkFDbkQ7b0JBQ0QsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzVCLENBQUMsQ0FBQSxDQUFDLENBQUMsQ0FBQzthQUNMO1lBQUMsT0FBTyxHQUFHLEVBQUU7Z0JBQ1osSUFBSTtvQkFDRixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO29CQUNuRSxNQUFNLGVBQUUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzdCLE1BQU0sSUFBQSxrQkFBUyxFQUFDLFFBQVEsQ0FBQyxDQUFDO2lCQUMzQjtnQkFBQyxPQUFPLElBQUksRUFBRTtvQkFDYixJQUFBLGdCQUFHLEVBQUMsT0FBTyxFQUFFLCtDQUErQyxFQUFFLElBQUksQ0FBQyxDQUFDO2lCQUVyRTtnQkFDRCxJQUFBLGdCQUFHLEVBQUMsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUMzRCxPQUFPLDRCQUE0QixFQUFFLENBQUM7YUFDdkM7UUFDSCxDQUFDLENBQUEsQ0FBQztRQUVGLE1BQU0sSUFBSSxHQUNSLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRSxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNuRCxNQUFNLGNBQWMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQzNDLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLFNBQVMsQ0FBQztZQUMxRCxNQUFNLFNBQVMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUMxQyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FBTyxjQUFjLElBQUksU0FBUyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUU1QixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEMsTUFBTSxRQUFRLEdBQWEsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUN4RSxRQUFRLFFBQVEsRUFBRTtnQkFDaEIsS0FBSyxVQUFVO29CQUNiLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ3hDLHVCQUF1QixFQUFFLENBQUM7b0JBQzFCLE9BQU87Z0JBQ1QsS0FBSyxtQkFBbUI7b0JBQ3RCLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ3hDLHVCQUF1QixFQUFFLENBQUM7b0JBQzFCLE9BQU87Z0JBQ1QsUUFBUTthQUVUO1NBQ0Y7UUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLENBQUMsRUFBRTtZQUM3RCxJQUFJO2dCQUNGLE1BQU0sZUFBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztxQkFDNUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzdFLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQzFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQzFCLE9BQU87YUFDUjtZQUFDLE9BQU8sR0FBRyxFQUFFO2FBRWI7U0FDRjtRQUdELE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQUMsT0FBQSxDQUFBLE1BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQywwQ0FBRSxJQUFJLE1BQUssdUJBQXVCLENBQUEsRUFBQSxDQUFDLENBQUM7UUFDbEcsSUFBSSxjQUFjLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM3QixLQUFLLE1BQU0sS0FBSyxJQUFJLGNBQWMsRUFBRTtnQkFDbEMsSUFBSSxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsVUFBVSxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsRUFBRTtvQkFDdEUsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQztvQkFDbkMsTUFBTSxRQUFRLEdBQW9CLGlCQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFDM0QsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztvQkFDekQsSUFBSSxDQUFBLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRSxTQUFTLE1BQUssU0FBUyxJQUFJLElBQUEsbUJBQVUsRUFBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssSUFBSSxFQUFFO3dCQUdoRixNQUFNLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7NkJBQ2xELE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLG1CQUFtQixFQUFFLEVBQUUsQ0FBQyxDQUFDO3dCQUMvRSxNQUFNLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDO3dCQUMxQyxPQUFPO3FCQUNSO2lCQUNGO2FBQ0Y7U0FDRjtRQUVELE9BQU8sYUFBYSxFQUFFLENBQUM7SUFDekIsQ0FBQztDQUFBO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxPQUFnQyxFQUFFLFNBQWlDO0lBQzVGLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDckMsTUFBTSxVQUFVLEdBQVcsc0JBQVMsQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLEVBQUUsZ0JBQU8sQ0FBQyxDQUFDO0lBQzlFLE1BQU0sT0FBTyxHQUFtQixzQkFBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDekUsTUFBTSxRQUFRLEdBQWlDLHNCQUFTLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxnQkFBTyxDQUFDLENBQUM7SUFDekYsTUFBTSxpQkFBaUIsR0FBRyxHQUFTLEVBQUU7UUFDbkMsS0FBSyxNQUFNLE9BQU8sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzNDLElBQUk7Z0JBQ0YsTUFBTSxlQUFFLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDcEQ7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDNUI7U0FDRjtJQUNILENBQUMsQ0FBQSxDQUFDO0lBQ0YsT0FBTyxJQUFJLGtCQUFRLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRTtTQUUvRCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLEVBQUUsQ0FBQyxDQUFDO1NBQzlELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUNyQixLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztTQUM1QixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsMEJBQTBCLENBQUMsRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUMzRixDQUFDO0FBRUQsU0FBUyxRQUFRLENBQUMsUUFBZ0I7SUFDaEMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELFNBQVMsSUFBSSxDQUFDLE9BQWdDO0lBQzVDLE9BQU8sQ0FBQyxZQUFZLENBQUM7UUFDbkIsRUFBRSxFQUFFLGdCQUFPO1FBQ1gsSUFBSSxFQUFFLFNBQVM7UUFDZixTQUFTLEVBQUUsSUFBSTtRQUNmLFNBQVMsRUFBRSxRQUFRO1FBQ25CLFlBQVksRUFBRSxRQUFRO1FBQ3RCLElBQUksRUFBRSxhQUFhO1FBQ25CLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxhQUFhO1FBQy9CLGdCQUFnQjtRQUNoQixLQUFLLEVBQUUsU0FBUyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDO1FBQ3pELGFBQWEsRUFBRTtZQUNiLGFBQWE7U0FDZDtRQUNELFdBQVcsRUFBRTtZQUNYLFVBQVUsRUFBRSxpQkFBUTtTQUNyQjtRQUNELE9BQU8sRUFBRTtZQUNQLFVBQVUsRUFBRSxDQUFDLGlCQUFRO1lBQ3JCLFlBQVksRUFBRSxhQUFhLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztZQUMxQyxlQUFlLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyx3QkFBZSxFQUFFLHdCQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDNUYsWUFBWSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsd0JBQWUsRUFBRSx3QkFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1NBQzFGO0tBQ0YsQ0FBQyxDQUFDO0lBMkJILE1BQU0sV0FBVyxHQUFHLEdBQUcsRUFBRTs7UUFDdkIsTUFBTSxLQUFLLEdBQVcsSUFBQSxpQkFBUSxFQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1QyxPQUFPLENBQUMsQ0FBQSxNQUFBLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxTQUFTLDBDQUFFLElBQUksTUFBSyxTQUFTLENBQUM7WUFDM0MsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDakMsQ0FBQyxDQUFDO0lBRUYsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFjLEVBQUUsRUFBRSxDQUFDLENBQUMsTUFBTSxLQUFLLGdCQUFPLENBQUMsQ0FBQztJQUM3RCxNQUFNLGNBQWMsR0FBRyxDQUFDLFlBQWtDLEVBQ2xDLElBQTJDLEVBQUUsRUFBRSxDQUM3QyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQztXQUN2QixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDO0lBRWxGLE1BQU0sY0FBYyxHQUFHLENBQUMsWUFBa0MsRUFDbEMsT0FBZSxFQUNmLEdBQStCLEVBQUUsRUFBRTtRQUN6RCxJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUU7WUFDckIsR0FBRyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUM7U0FDeEI7UUFDRCxPQUFPLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUM1QyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsRUFBRSxLQUFLLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELENBQUMsQ0FBQztJQUVGLE1BQU0sYUFBYSxHQUFHLEdBQUcsRUFBRTtRQUN6QixNQUFNLFFBQVEsR0FBRyxXQUFXLEVBQUUsQ0FBQztRQUMvQixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztRQUM3RixPQUFPLElBQUEsNEJBQW9CLEVBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUN2QyxnQkFBZ0IsRUFBRSxZQUFZO1lBQzlCLGFBQWEsRUFBRSxlQUFlO1lBQzlCLFVBQVUsRUFBRSwrQkFBK0I7WUFDM0MsU0FBUyxFQUFFLDBDQUEwQztZQUNyRCxhQUFhLEVBQUUsQ0FBRSxrQkFBa0IsQ0FBRTtTQUN0QyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLGdCQUFnQixHQUFHLEdBQUcsRUFBRTtRQUM1QixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUN6QyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDakUsT0FBTyxJQUFBLDRCQUFvQixFQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7WUFDdkMsZ0JBQWdCLEVBQUUsdUJBQXVCO1lBQ3pDLGFBQWEsRUFBRSxFQUFFO1lBQ2pCLFVBQVUsRUFBRSxjQUFjO1lBQzFCLFNBQVMsRUFBRSw0Q0FBNEM7WUFDdkQsYUFBYSxFQUFFLENBQUUsZ0JBQWdCLENBQUU7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsTUFBTSxrQkFBa0IsR0FBRyxHQUFHLEVBQUU7UUFDOUIsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDekMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1FBQ25FLE9BQU8sSUFBQSw0QkFBb0IsRUFBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ3ZDLGdCQUFnQixFQUFFLHlCQUF5QjtZQUMzQyxhQUFhLEVBQUUsRUFBRTtZQUNqQixVQUFVLEVBQUUsZ0JBQWdCO1lBQzVCLFNBQVMsRUFBRSwyQ0FBMkM7WUFDdEQsYUFBYSxFQUFFLENBQUUsZ0JBQWdCLENBQUU7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLEVBQUU7UUFDaEMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDekMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3JFLE9BQU8sSUFBQSw0QkFBb0IsRUFBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ3ZDLGdCQUFnQixFQUFFLHVCQUF1QjtZQUN6QyxhQUFhLEVBQUUsRUFBRTtZQUNqQixVQUFVLEVBQUUsbUJBQW1CO1lBQy9CLFNBQVMsRUFBRSw0Q0FBNEM7WUFDdkQsYUFBYSxFQUFFLENBQUUsZ0JBQWdCLENBQUU7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsMkJBQTJCLEVBQUUsR0FBRyxFQUFFO1FBQ3pGLElBQUEsd0JBQVcsRUFBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3JDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQW9CZixPQUFPLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7UUFDbEYsSUFBQSw0QkFBaUIsRUFBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDakMsQ0FBQyxFQUFFLEdBQUcsRUFBRTtRQUNOLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDckMsTUFBTSxZQUFZLEdBQUcsc0JBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkQsT0FBTyxJQUFBLDZCQUFrQixHQUFFO2VBQ3RCLENBQUMsV0FBVyxFQUFFLEtBQUssR0FBRyxDQUFDO2VBQ3ZCLENBQUMsWUFBWSxLQUFLLGdCQUFPLENBQUMsQ0FBQztJQUNsQyxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sZUFBZSxHQUFHLENBQUUsYUFBYSxFQUFFLGdCQUFnQjtRQUN2RCxrQkFBa0IsRUFBRSxvQkFBb0IsQ0FBRSxDQUFDO0lBRTdDLEtBQUssTUFBTSxRQUFRLElBQUksZUFBZSxFQUFFO1FBQ3RDLE9BQU8sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMvRSxPQUFPLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0tBQzNFO0lBRUQsT0FBTyxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxvQkFBb0IsRUFDNUQsR0FBRyxFQUFFLENBQUMsSUFBQSwwQkFBa0IsRUFBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN6QyxPQUFPLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFLGVBQWUsRUFDdkQsR0FBRyxFQUFFLENBQUMsSUFBQSwwQkFBa0IsRUFBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUV6QyxPQUFPLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLEVBQUUsRUFBRSxFQUFFLDJCQUFjLEVBQUUsOEJBQWlCLENBQUMsQ0FBQztJQUM5RixPQUFPLENBQUMsaUJBQWlCLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxFQUFFLDRCQUFlLEVBQUUsK0JBQWtCLENBQUMsQ0FBQztJQUMzRixPQUFPLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLGdDQUFtQixFQUFFLG1DQUFzQixDQUFDLENBQUM7SUFDL0YsT0FBTyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFLEVBQUUsRUFBRSx1QkFBVSxFQUFFLDZCQUFnQixDQUFDLENBQUM7SUFDOUUsT0FBTyxDQUFDLGlCQUFpQixDQUFDLHVCQUF1QixFQUFFLEVBQUUsRUFBRSx5QkFBWSxFQUFFLDRCQUFlLENBQUMsQ0FBQztJQUV0RixPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxVQUFrQixFQUFFLEVBQUUsQ0FBQyxJQUFBLHVCQUFVLEVBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFVBQWtCLEVBQUUsRUFBRSxDQUFDLElBQUEsdUJBQVUsRUFBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDdkYsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsVUFBa0IsRUFBRSxFQUFFLENBQUMsSUFBQSx1QkFBVSxFQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN2RixPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxVQUFrQixFQUFFLEVBQUUsQ0FBQyxJQUFBLHVCQUFVLEVBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ3ZGLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFVBQWtCLEVBQUUsRUFBRSxDQUFDLElBQUEsd0JBQVcsRUFBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFeEYsT0FBTyxDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFDMUUsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSw2QkFBb0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDcEYsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUM7SUFFdkMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFDdEQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFLMUYsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDO1FBQzdCLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUM5RCxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQy9DLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDUCxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLHVCQUF1QixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUM7ZUFDL0UsY0FBYyxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDbkQsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBRWhDLE9BQU8sQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxRQUFRLENBQUMsRUFDaEgsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxtQkFBVSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRSxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUVqQyxPQUFPLENBQUMsZUFBZSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQzlELEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsY0FBYyxDQUFDLEVBQ3hELENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDO2VBQ2hFLGNBQWMsQ0FBQyxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDekQsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7SUFFbkMsT0FBTyxDQUFDLGVBQWUsQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUNoRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLEVBQzFELENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sVUFBVSxHQUFXLElBQUksTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDMUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLEtBQUssTUFBTSxLQUFLLElBQUksWUFBWSxFQUFFO1lBQ2hDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQzttQkFDdEIsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFO2dCQUM3RCxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO2FBQ1Q7U0FDRjtRQUNELE9BQU8sa0JBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNyRCxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO0lBRXJDLE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQzNFLENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNuRSxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUMzQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM1RCxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztJQUV4QyxPQUFPLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFDdEcsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7WUFDbkMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUMsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLEVBQUU7Z0JBQ2hDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDM0IsT0FBTyxJQUFJLENBQUM7aUJBQ2I7YUFDRjtZQUNELE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQyxDQUFDO1FBQ0YsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ2pGLE9BQU8sa0JBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuRCxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0lBRW5DLE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFDOUQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxlQUFlLENBQUMsRUFDL0MsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSx3QkFBZSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3RSxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztJQUV4QyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBTyxTQUFTLEVBQUUsRUFBRTtZQUNyRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sT0FBTyxHQUFHLHNCQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLE1BQU0sTUFBSyxnQkFBTyxFQUFFO2dCQUMvQixPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUMxQjtZQUNELE9BQU8sZUFBZSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDO2lCQUNwRCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsMEJBQTBCLENBQUMsSUFBQSxpQkFBUSxFQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztpQkFDeEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLGlCQUFJLENBQUMsWUFBWTtnQkFDNUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7Z0JBQ25CLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0IsQ0FBQyxDQUFBLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFPLFNBQVMsRUFBRSxFQUFFLGdEQUNuRCxPQUFBLGVBQWUsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQztRQUV0RCxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsb0JBQW9CLEVBQ3hDLENBQU8sUUFBZ0IsRUFBRSxFQUFFO1lBQUMsT0FBQSxDQUFDLFFBQVEsS0FBSyxnQkFBTyxDQUFDO2dCQUNoRCxDQUFDLENBQUMsSUFBQSx3Q0FBcUIsRUFBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUE7VUFBQSxDQUFDLENBQUM7UUFFdkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLG9CQUFvQixFQUN4QyxDQUFDLE1BQWMsRUFBRSxJQUFrQixFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxnQkFBTyxDQUFDO1lBQzFELENBQUMsQ0FBQyxJQUFBLHdDQUFxQixFQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCBQYXJzZXIsIHsgSW5pRmlsZSwgV2luYXBpRm9ybWF0IH0gZnJvbSAndm9ydGV4LXBhcnNlLWluaSc7XHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBnZW5lcmF0ZSB9IGZyb20gJ3Nob3J0aWQnO1xyXG5cclxuaW1wb3J0IHsgVW5zdHJpcHBlZEFzc2VtYmx5RG93bmxvYWRlciB9IGZyb20gJy4vdW5zdHJpcHBlZEFzc2VtYmx5JztcclxuXHJcbmltcG9ydCB7XHJcbiAgQkVUVEVSX0NPTlRfRVhULCBGQlhfRVhULCBHQU1FX0lELCBHQU1FX0lEX1NFUlZFUixcclxuICBnZW5Qcm9wcywgZ3Vlc3NNb2RJZCwgSUdOT1JBQkxFX0ZJTEVTLCBJTlNMSU1WTUxfSURFTlRJRklFUixcclxuICBJUHJvcHMsIElTQ01EUHJvcHMsIE5FWFVTLCBPQkpfRVhULCBQYWNrVHlwZSwgcmVtb3ZlRGlyLCBTVEVBTV9JRCwgVkJVSUxEX0VYVCxcclxufSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IGluc3RhbGxCZXR0ZXJDb250LCBpbnN0YWxsQ29yZVJlbW92ZXIsIGluc3RhbGxGdWxsUGFjaywgaW5zdGFsbEluU2xpbU1vZExvYWRlcixcclxuICBpbnN0YWxsVkJ1aWxkTW9kLCB0ZXN0QmV0dGVyQ29udCwgdGVzdENvcmVSZW1vdmVyLCB0ZXN0RnVsbFBhY2ssIHRlc3RJblNsaW1Nb2RMb2FkZXIsXHJcbiAgdGVzdFZCdWlsZCB9IGZyb20gJy4vaW5zdGFsbGVycyc7XHJcbmltcG9ydCB7IG1pZ3JhdGUxMDEzLCBtaWdyYXRlMTAzLCBtaWdyYXRlMTA0LCBtaWdyYXRlMTA2LCBtaWdyYXRlMTA5IH0gZnJvbSAnLi9taWdyYXRpb25zJztcclxuaW1wb3J0IHsgaGFzTXVsdGlwbGVMaWJNb2RzLCBpc0RlcGVuZGVuY3lSZXF1aXJlZCB9IGZyb20gJy4vdGVzdHMnO1xyXG5cclxuaW1wb3J0IHsgbWlncmF0ZVIyVG9Wb3J0ZXgsIHVzZXJIYXNSMkluc3RhbGxlZCB9IGZyb20gJy4vcjJWb3J0ZXgnO1xyXG5cclxuaW1wb3J0IHsgY2hlY2tDb25maWdNYW5hZ2VyVXBkLCBkb3dubG9hZENvbmZpZ01hbmFnZXIgfSBmcm9tICcuL2dpdGh1YkRvd25sb2FkZXInO1xyXG5cclxuY29uc3QgU1RPUF9QQVRURVJOUyA9IFsnY29uZmlnJywgJ3BsdWdpbnMnLCAncGF0Y2hlcnMnXTtcclxuZnVuY3Rpb24gdG9Xb3JkRXhwKGlucHV0KSB7XHJcbiAgcmV0dXJuICcoXnwvKScgKyBpbnB1dCArICcoL3wkKSc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRHYW1lKCk6IGFueSB7XHJcbiAgcmV0dXJuIHV0aWwuR2FtZVN0b3JlSGVscGVyLmZpbmRCeUFwcElkKFtTVEVBTV9JRF0pXHJcbiAgICAudGhlbihnYW1lID0+IGdhbWUuZ2FtZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXF1aXJlc0xhdW5jaGVyKGdhbWVQYXRoKSB7XHJcbiAgcmV0dXJuIGZzLnJlYWRkaXJBc3luYyhnYW1lUGF0aClcclxuICAgIC50aGVuKGZpbGVzID0+IChmaWxlcy5maW5kKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpID09PSAnc3RlYW1fYXBwaWQudHh0JykgIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBQcm9taXNlLnJlc29sdmUoe1xyXG4gICAgICAgIGxhdW5jaGVyOiAnc3RlYW0nLFxyXG4gICAgICAgIGFkZEluZm86IHtcclxuICAgICAgICAgIGFwcElkOiBTVEVBTV9JRCxcclxuICAgICAgICAgIHBhcmFtZXRlcnM6IFsnLWZvcmNlLWdsY29yZSddLFxyXG4gICAgICAgICAgbGF1bmNoVHlwZTogJ2dhbWVzdG9yZScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSlcclxuICAgICAgOiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKSlcclxuICAgIC5jYXRjaChlcnIgPT4gUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKHByb3BzOiBJUHJvcHMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCBhcGkgPSBwcm9wcy5hcGk7XHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcbiAgY29uc3QgZXhwZWN0ZWRGaWxlUGF0aCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX21hbmFnZWQnLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk9sZCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICdCZXBJbkV4JywgJ2NvcmVfbGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJOZXcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9jb3JsaWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuXHJcbiAgY29uc3QgdXJsID0gcGF0aC5qb2luKE5FWFVTLCAndmFsaGVpbScsICdtb2RzJywgJzEyMDInKSArIGA/dGFiPWZpbGVzJmZpbGVfaWQ9NDg5OSZubW09MWA7XHJcbiAgY29uc3QgcmFpc2VNaXNzaW5nQXNzZW1ibGllc0RpYWxvZyA9ICgpID0+IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ01pc3NpbmcgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW1cXCdzIGFzc2VtYmxpZXMgYXJlIGRpc3RyaWJ1dGVkIGluIGFuIFwib3B0aW1pc2VkXCIgc3RhdGUgdG8gcmVkdWNlIHJlcXVpcmVkICdcclxuICAgICAgKyAnZGlzayBzcGFjZS4gVGhpcyB1bmZvcnR1bmF0ZWx5IG1lYW5zIHRoYXQgVmFsaGVpbVxcJ3MgbW9kZGluZyBjYXBhYmlsaXRpZXMgYXJlIGFsc28gYWZmZWN0ZWQue3ticn19e3ticn19J1xyXG4gICAgICArICdJbiBvcmRlciB0byBtb2QgVmFsaGVpbSwgdGhlIHVub3B0aW1pc2VkL3Vuc3RyaXBwZWQgYXNzZW1ibGllcyBhcmUgcmVxdWlyZWQgLSBwbGVhc2UgZG93bmxvYWQgdGhlc2UgJ1xyXG4gICAgICArICdmcm9tIE5leHVzIE1vZHMue3ticn19e3ticn19IFlvdSBjYW4gY2hvb3NlIHRoZSBWb3J0ZXgvbW9kIG1hbmFnZXIgZG93bmxvYWQgb3IgbWFudWFsIGRvd25sb2FkICdcclxuICAgICAgKyAnKHNpbXBseSBkcmFnIGFuZCBkcm9wIHRoZSBhcmNoaXZlIGludG8gdGhlIG1vZHMgZHJvcHpvbmUgdG8gYWRkIGl0IHRvIFZvcnRleCkue3ticn19e3ticn19J1xyXG4gICAgICArICdWb3J0ZXggd2lsbCB0aGVuIGJlIGFibGUgdG8gaW5zdGFsbCB0aGUgYXNzZW1ibGllcyB3aGVyZSB0aGV5IGFyZSBuZWVkZWQgdG8gZW5hYmxlICdcclxuICAgICAgKyAnbW9kZGluZywgbGVhdmluZyB0aGUgb3JpZ2luYWwgb25lcyB1bnRvdWNoZWQuJywgeyByZXBsYWNlOiB7IGJyOiAnW2JyXVsvYnJdJyB9IH0pLFxyXG4gICAgfSwgW1xyXG4gICAgICB7IGxhYmVsOiAnQ2FuY2VsJywgYWN0aW9uOiAoKSA9PiByZWplY3QobmV3IHV0aWwuVXNlckNhbmNlbGVkKCkpIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB1dGlsLm9wbih1cmwpXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IG51bGwpXHJcbiAgICAgICAgICAuZmluYWxseSgoKSA9PiByZXNvbHZlKCkpLFxyXG4gICAgICB9LFxyXG4gICAgXSk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmID0gKCkgPT4gYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgbWVzc2FnZTogdCgnR2FtZSB1cGRhdGVkIC0gVXBkYXRlZCBhc3NlbWJsaWVzIHBhY2sgcmVxdWlyZWQuJyksXHJcbiAgICB0eXBlOiAnaW5mbycsXHJcbiAgICBpZDogJ2ZvcmNlRG93bmxvYWROb3RpZicsXHJcbiAgICBub0Rpc21pc3M6IHRydWUsXHJcbiAgICBhbGxvd1N1cHByZXNzOiB0cnVlLFxyXG4gICAgYWN0aW9uczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdGl0bGU6ICdNb3JlJyxcclxuICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdEb3dubG9hZCB1bnN0cmlwcGVkIGFzc2VtYmxpZXMnLCB7XHJcbiAgICAgICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW0gaGFzIGJlZW4gdXBkYXRlZCBhbmQgdG8gYmUgYWJsZSB0byBtb2QgdGhlIGdhbWUgeW91IHdpbGwgbmVlZCB0byBlbnN1cmUgeW91IGFyZSB1c2luZyB0aGUgbGF0ZXN0IHVuc3RyaXBwZWQgVW5pdHkgYXNzZW1ibGllcyBvciB0aGUgbGF0ZXN0IFwiQmVwSW5FeCBwYWNrXCIuICdcclxuICAgICAgICAgICAgICAgICAgKyAnVm9ydGV4IGhhcyBkZXRlY3RlZCB0aGF0IHlvdSBoYXZlIHByZXZpb3VzbHkgaW5zdGFsbGVkIHVuc3RyaXBwZWQgVW5pdHkgYXNzZW1ibGllcyAvIGEgQmVwSW5FeCBwYWNrLCBidXQgY2Fubm90IGtub3cgZm9yIHN1cmUgd2hldGhlciB0aGVzZSBmaWxlcyBhcmUgdXAgdG8gZGF0ZS4gJ1xyXG4gICAgICAgICAgICAgICAgICArICdJZiB5b3UgYXJlIHVuc3VyZSwgVm9ydGV4IGNhbiBkb3dubG9hZCBhbmQgaW5zdGFsbCB0aGUgbGF0ZXN0IHJlcXVpcmVkIGZpbGVzIGZvciB5b3Uue3tsYn19J1xyXG4gICAgICAgICAgICAgICAgICArICdQbGVhc2Ugbm90ZSB0aGF0IGFsbCBtb2RzIG11c3QgYWxzbyBiZSB1cGRhdGVkIGluIG9yZGVyIGZvciB0aGVtIHRvIGZ1bmN0aW9uIHdpdGggdGhlIG5ldyBnYW1lIHZlcnNpb24uJyxcclxuICAgICAgICAgICAgICAgICAgeyByZXBsYWNlOiB7IGxiOiAnW2JyXVsvYnJdW2JyXVsvYnJdJywgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICAgICAgfSwgW1xyXG4gICAgICAgICAgeyBsYWJlbDogJ0Nsb3NlJyB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgICAgIGFjdGlvbjogKCkgPT4gcnVuRG93bmxvYWRlcigpLmZpbmFsbHkoKCkgPT4gZGlzbWlzcygpKSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSksXHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICB0aXRsZTogJ05ldmVyIFNob3cgQWdhaW4nLFxyXG4gICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IHtcclxuICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnN1cHByZXNzTm90aWZpY2F0aW9uKCdmb3JjZURvd25sb2FkTm90aWYnLCB0cnVlKSk7XHJcbiAgICAgICAgICBkaXNtaXNzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIF0sXHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGFzc2lnbk92ZXJyaWRlUGF0aCA9IGFzeW5jIChvdmVycmlkZVBhdGg6IHN0cmluZykgPT4ge1xyXG4gICAgY29uc3QgZG9vclN0b3BDb25maWcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsICdkb29yc3RvcF9jb25maWcuaW5pJyk7XHJcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgUGFyc2VyKG5ldyBXaW5hcGlGb3JtYXQoKSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpbmlEYXRhOiBJbmlGaWxlPGFueT4gPSBhd2FpdCBwYXJzZXIucmVhZChkb29yU3RvcENvbmZpZyk7XHJcbiAgICAgIGluaURhdGEuZGF0YVsnVW5pdHlEb29yc3RvcCddWydkbGxTZWFyY2hQYXRoT3ZlcnJpZGUnXSA9IG92ZXJyaWRlUGF0aDtcclxuICAgICAgYXdhaXQgcGFyc2VyLndyaXRlKGRvb3JTdG9wQ29uZmlnLCBpbmlEYXRhKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdmYWlsZWQgdG8gbW9kaWZ5IGRvb3JzdG9wIGNvbmZpZ3VyYXRpb24nLCBlcnIpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJ1bkRvd25sb2FkZXIgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBkb3dubG9hZGVyID0gbmV3IFVuc3RyaXBwZWRBc3NlbWJseURvd25sb2FkZXIodXRpbC5nZXRWb3J0ZXhQYXRoKCd0ZW1wJykpO1xyXG4gICAgY29uc3QgZm9sZGVyTmFtZSA9IGdlbmVyYXRlKCk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBhY3RpdmVHYW1lTW9kZSA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoYXBpLmdldFN0YXRlKCkpO1xyXG4gICAgICBpZiAoYWN0aXZlR2FtZU1vZGUgIT09IEdBTUVfSUQpIHtcclxuICAgICAgICAvLyBUaGlzIGlzIGEgdmFsaWQgc2NlbmFyaW8gd2hlbiB0aGUgdXNlciB0cmllcyB0byBtYW5hZ2UgVmFsaGVpbVxyXG4gICAgICAgIC8vICB3aGVuIHRoZSBhY3RpdmUgZ2FtZU1vZGUgaXMgdW5kZWZpbmVkLlxyXG4gICAgICAgIHRocm93IG5ldyB1dGlsLlByb2Nlc3NDYW5jZWxlZCgnV3JvbmcgZ2FtZW1vZGUnKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBhcmNoaXZlRmlsZVBhdGggPSBhd2FpdCBkb3dubG9hZGVyLmRvd25sb2FkTmV3ZXN0KCdmdWxsX25hbWUnLCAnZGVuaWtzb24tQmVwSW5FeFBhY2tfVmFsaGVpbScpO1xyXG4gICAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHJlYWxseSB2YWxpZGF0ZSB0aGUgZG93bmxvYWQncyBpbnRlZ3JpdHk7IGJ1dCB3ZVxyXG4gICAgICAvLyAgY2FuIGF0IHRoZSB2ZXJ5IGxlYXN0IG1ha2Ugc3VyZSBpdCdzIHRoZXJlIGFuZCBpc24ndCBqdXN0IGFuIGVtcHR5IGFyY2hpdmUuXHJcbiAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhhcmNoaXZlRmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBzZXZlbnppcCA9IG5ldyB1dGlsLlNldmVuWmlwKCk7XHJcbiAgICAgIGNvbnN0IHRlbXBQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZShhcmNoaXZlRmlsZVBhdGgpLCBmb2xkZXJOYW1lKTtcclxuICAgICAgYXdhaXQgc2V2ZW56aXAuZXh0cmFjdEZ1bGwoYXJjaGl2ZUZpbGVQYXRoLCB0ZW1wUGF0aCk7XHJcbiAgICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgZnMucmVhZGRpckFzeW5jKHRlbXBQYXRoKTtcclxuICAgICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHRocm93IG5ldyB1dGlsLkRhdGFJbnZhbGlkKCdJbnZhbGlkIGFyY2hpdmUnKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gR2l2ZSBpdCBhIHNlY29uZCBmb3IgdGhlIGRvd25sb2FkIHRvIHJlZ2lzdGVyIGluIHRoZSBzdGF0ZS5cclxuICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cclxuICAgICAgICBhcGkuZXZlbnRzLmVtaXQoJ2ltcG9ydC1kb3dubG9hZHMnLCBbIGFyY2hpdmVGaWxlUGF0aCBdLCBhc3luYyAoZGxJZHM6IHN0cmluZ1tdKSA9PiB7XHJcbiAgICAgICAgaWYgKGRsSWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQoJ0ZhaWxlZCB0byBpbXBvcnQgYXJjaGl2ZScpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgZGxJZCBvZiBkbElkcykge1xyXG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlczIsIHJlajIpID0+XHJcbiAgICAgICAgICAgIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtaW5zdGFsbC1kb3dubG9hZCcsIGRsSWQsIHRydWUsIChlcnIsIG1vZElkKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVqMihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldE1vZEVuYWJsZWQocHJvcHMucHJvZmlsZS5pZCwgbW9kSWQsIHRydWUpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlczIodW5kZWZpbmVkKTtcclxuICAgICAgICAgIH0pKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnN1cHByZXNzTm90aWZpY2F0aW9uKCdmb3JjZURvd25sb2FkTm90aWYnLCB0cnVlKSk7XHJcbiAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0RGVwbG95bWVudE5lY2Vzc2FyeShHQU1FX0lELCB0cnVlKSk7XHJcbiAgICAgICAgYXdhaXQgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBhd2FpdCByZW1vdmVEaXIodGVtcFBhdGgpO1xyXG4gICAgICAgICAgYXdhaXQgZnMucmVtb3ZlQXN5bmModGVtcFBhdGgpLmNhdGNoKGVyciA9PiBlcnIuY29kZSA9PT0gJ0VOT0VOVCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgbG9nKCdlcnJvcicsICdmYWlsZWQgdG8gY2xlYW51cCB0ZW1wb3JhcnkgZmlsZXMnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodW5kZWZpbmVkKTtcclxuICAgICAgfSkpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgdGVtcFBhdGggPSBwYXRoLmpvaW4odXRpbC5nZXRWb3J0ZXhQYXRoKCd0ZW1wJyksIGZvbGRlck5hbWUpO1xyXG4gICAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyh0ZW1wUGF0aCk7XHJcbiAgICAgICAgYXdhaXQgcmVtb3ZlRGlyKHRlbXBQYXRoKTtcclxuICAgICAgfSBjYXRjaCAoZXJyMikge1xyXG4gICAgICAgIGxvZygnZGVidWcnLCAndW5zdHJpcHBlZCBhc3NlbWJseSBkb3dubG9hZGVyIGNsZWFudXAgZmFpbGVkJywgZXJyMik7XHJcbiAgICAgICAgLy8gQ2xlYW51cCBmYWlsZWQgb3IgaXMgdW5uZWNlc3NhcnkuXHJcbiAgICAgIH1cclxuICAgICAgbG9nKCdkZWJ1ZycsICd1bnN0cmlwcGVkIGFzc2VtYmx5IGRvd25sb2FkZXIgZmFpbGVkJywgZXJyKTtcclxuICAgICAgcmV0dXJuIHJhaXNlTWlzc2luZ0Fzc2VtYmxpZXNEaWFsb2coKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShwcm9wcy5zdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IGNvcmVMaWJNb2RJZHMgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoa2V5ID0+IHtcclxuICAgIGNvbnN0IGhhc0NvcmVMaWJUeXBlID0gdXRpbC5nZXRTYWZlKG1vZHNba2V5XSxcclxuICAgICAgWydhdHRyaWJ1dGVzJywgJ0NvcmVMaWJUeXBlJ10sIHVuZGVmaW5lZCkgIT09IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IGlzRW5hYmxlZCA9IHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLFxyXG4gICAgICBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSk7XHJcbiAgICByZXR1cm4gaGFzQ29yZUxpYlR5cGUgJiYgaXNFbmFibGVkO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoY29yZUxpYk1vZElkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAvLyBXZSBkb24ndCBjYXJlIGlmIHRoZSB1c2VyIGhhcyBzZXZlcmFsIGluc3RhbGxlZCwgc2VsZWN0IHRoZSBmaXJzdCBvbmUuXHJcbiAgICBjb25zdCBjb3JlTGliTW9kSWQgPSBjb3JlTGliTW9kSWRzWzBdO1xyXG5cclxuICAgIGNvbnN0IHBhY2tUeXBlOiBQYWNrVHlwZSA9IG1vZHNbY29yZUxpYk1vZElkXS5hdHRyaWJ1dGVzWydDb3JlTGliVHlwZSddO1xyXG4gICAgc3dpdGNoIChwYWNrVHlwZSkge1xyXG4gICAgICBjYXNlICdjb3JlX2xpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCdCZXBJbkV4XFxcXGNvcmVfbGliJyk7XHJcbiAgICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGNhc2UgJ3Vuc3RyaXBwZWRfY29ybGliJzpcclxuICAgICAgICBhc3NpZ25PdmVycmlkZVBhdGgoJ3Vuc3RyaXBwZWRfY29ybGliJyk7XHJcbiAgICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgLy8gbm9wIC0gbGV0IHRoZSBmb3IgbG9vcCBiZWxvdyB0cnkgdG8gZmluZCB0aGUgcGFjay5cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgZmlsZVBhdGggb2YgW2Z1bGxQYWNrQ29yTGliTmV3LCBmdWxsUGFja0NvckxpYk9sZF0pIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhmaWxlUGF0aCk7XHJcbiAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICByYWlzZUZvcmNlRG93bmxvYWROb3RpZigpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgLy8gbm9wXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgdmFsaWQgdmFyaWFudCBvZiB0aGUgdW5zdHJpcHBlZCBhc3NlbWJseSBtb2RzIGZvdW5kIG9uIE5leHVzLlxyXG4gIGNvbnN0IHVuc3RyaXBwZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGlkID0+IG1vZHNbaWRdPy50eXBlID09PSAndW5zdHJpcHBlZC1hc3NlbWJsaWVzJyk7XHJcbiAgaWYgKHVuc3RyaXBwZWRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIGZvciAoY29uc3QgbW9kSWQgb2YgdW5zdHJpcHBlZE1vZHMpIHtcclxuICAgICAgaWYgKHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLCBbJ21vZFN0YXRlJywgbW9kSWQsICdlbmFibGVkJ10sIGZhbHNlKSkge1xyXG4gICAgICAgIGNvbnN0IGRsaWQgPSBtb2RzW21vZElkXS5hcmNoaXZlSWQ7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWQ6IHR5cGVzLklEb3dubG9hZCA9IHV0aWwuZ2V0U2FmZShhcGkuZ2V0U3RhdGUoKSxcclxuICAgICAgICAgIFsncGVyc2lzdGVudCcsICdkb3dubG9hZHMnLCAnZmlsZXMnLCBkbGlkXSwgdW5kZWZpbmVkKTtcclxuICAgICAgICBpZiAoZG93bmxvYWQ/LmxvY2FsUGF0aCAhPT0gdW5kZWZpbmVkICYmIGd1ZXNzTW9kSWQoZG93bmxvYWQubG9jYWxQYXRoKSAhPT0gJzE1Jykge1xyXG4gICAgICAgICAgLy8gVGhlIE5leHVzIE1vZHMgdW5zdHJpcHBlZCBhc3NtZWJsaWVzIG1vZCBpcyBlbmFibGVkIC0gZG9uJ3QgcmFpc2UgdGhlIG1pc3NpbmdcclxuICAgICAgICAgIC8vICBhc3NlbWJsaWVzIGRpYWxvZy5cclxuICAgICAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGV4cGVjdGVkRmlsZVBhdGgucmVwbGFjZShwcm9wcy5kaXNjb3ZlcnkucGF0aCArIHBhdGguc2VwLCAnJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShwYXRoLnNlcCArICdtb25vLnNlY3VyaXR5LmRsbCcsICcnKTtcclxuICAgICAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJ1bkRvd25sb2FkZXIoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCkge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcmV2UHJvZklkOiBzdHJpbmcgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJldlByb2ZJZCk7XHJcbiAgY29uc3QgbW9kVHlwZXM6IHsgW3R5cGVJZDogc3RyaW5nXTogc3RyaW5nIH0gPSBzZWxlY3RvcnMubW9kUGF0aHNGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBjcmVhdGVEaXJlY3RvcmllcyA9IGFzeW5jICgpID0+IHtcclxuICAgIGZvciAoY29uc3QgbW9kVHlwZSBvZiBPYmplY3Qua2V5cyhtb2RUeXBlcykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKG1vZFR5cGVzW21vZFR5cGVdKTtcclxuICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG4gIHJldHVybiBuZXcgQmx1ZWJpcmQ8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4gY3JlYXRlRGlyZWN0b3JpZXMoKVxyXG5cclxuICAgIC50aGVuKCgpID0+IHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZT8uaWQpKVxyXG4gICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKVxyXG4gICAgLmNhdGNoKGVyciA9PiByZWplY3QoZXJyKSkpXHJcbiAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoeyBhcGk6IGNvbnRleHQuYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kc1BhdGgoZ2FtZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICAgIGlnbm9yZURlcGxveTogW10uY29uY2F0KElHTk9SQUJMRV9GSUxFUywgSUdOT1JBQkxFX0ZJTEVTLm1hcChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSkpLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gIC8vICAgaWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgbmFtZTogJ1ZhbGhlaW06IERlZGljYXRlZCBTZXJ2ZXInLFxyXG4gIC8vICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gIC8vICAgcXVlcnlQYXRoOiAoKSA9PiB1bmRlZmluZWQsXHJcbiAgLy8gICBxdWVyeU1vZFBhdGg6IG1vZHNQYXRoLFxyXG4gIC8vICAgbG9nbzogJ2dhbWVhcnQuanBnJyxcclxuICAvLyAgIGV4ZWN1dGFibGU6ICgpID0+ICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgLy8gICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgLy8gICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgLy8gICAgICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIF0sXHJcbiAgLy8gICBlbnZpcm9ubWVudDoge1xyXG4gIC8vICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAvLyAgIH0sXHJcbiAgLy8gICBkZXRhaWxzOiB7XHJcbiAgLy8gICAgIG5leHVzUGFnZUlkOiBHQU1FX0lELFxyXG4gIC8vICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAvLyAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gIC8vICAgfSxcclxuICAvLyB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dC5hcGkpO1xyXG4gICAgcmV0dXJuIChwcm9wcz8uZGlzY292ZXJ5Py5wYXRoICE9PSB1bmRlZmluZWQpXHJcbiAgICAgID8gcHJvcHMuZGlzY292ZXJ5LnBhdGggOiAnLic7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaXNTdXBwb3J0ZWQgPSAoZ2FtZUlkOiBzdHJpbmcpID0+IChnYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIGNvbnN0IGhhc0luc3RydWN0aW9uID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlZDogKGluc3Q6IHR5cGVzLklJbnN0cnVjdGlvbikgPT4gYm9vbGVhbikgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9ucy5maW5kKGluc3RyID0+IChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiAocHJlZChpbnN0cikpKSAhPT0gdW5kZWZpbmVkO1xyXG5cclxuICBjb25zdCBmaW5kSW5zdHJNYXRjaCA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm46IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBtb2Q/OiAoaW5wdXQ6IHN0cmluZykgPT4gc3RyaW5nKSA9PiB7XHJcbiAgICBpZiAobW9kID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgbW9kID0gKGlucHV0KSA9PiBpbnB1dDtcclxuICAgIH1cclxuICAgIHJldHVybiBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT5cclxuICAgICAgbW9kKGluc3RyLnNvdXJjZSkudG9Mb3dlckNhc2UoKSA9PT0gcGF0dGVybi50b0xvd2VyQ2FzZSgpKTtcclxuICB9O1xyXG5cclxuICBjb25zdCB2YnVpbGREZXBUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgZ2FtZVBhdGggPSBnZXRHYW1lUGF0aCgpO1xyXG4gICAgY29uc3QgYnVpbGRTaGFyZUFzc2VtYmx5ID0gcGF0aC5qb2luKGdhbWVQYXRoLCAnSW5TbGltVk1MJywgJ01vZHMnLCAnQ1ItQnVpbGRTaGFyZV9WTUwuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZidWlsZC1tb2QnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnaW5zbGltdm1sLW1vZCcsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdCdWlsZFNoYXJlIChBZHZhbmNlZEJ1aWxkaW5nKScsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzUnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIGJ1aWxkU2hhcmVBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgY3VzdG9tTWVzaGVzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQ3VzdG9tTWVzaGVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS1tZXNoZXMnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0N1c3RvbU1lc2hlcycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzE4NCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgY3VzdG9tVGV4dHVyZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21UZXh0dXJlcy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0N1c3RvbVRleHR1cmVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNDgnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGJldHRlckNvbnRpbmVudHNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdCZXR0ZXJDb250aW5lbnRzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICdiZXR0ZXItY29udGluZW50cy1tb2QnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0JldHRlciBDb250aW5lbnRzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNDQ2JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyQWN0aW9uKCdtb2QtaWNvbnMnLCAxMDAsICdzdGVhbWNtZCcsIHt9LCAnU3RlYW1DTUQgRGVkaWNhdGVkIFNlcnZlcicsICgpID0+IHtcclxuICAgIG1pZ3JhdGUxMDEzKGNvbnRleHQuYXBpLCAnMS4wLjEyJyk7XHJcbiAgfSwgKCkgPT4gdHJ1ZSk7XHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckFjdGlvbignbW9kLWljb25zJywgMTAwLCAnc3RlYW1jbWQnLCB7fSwgJ1N0ZWFtQ01EIERlZGljYXRlZCBTZXJ2ZXInLCAoKSA9PiB7XHJcbiAgLy8gICBjb250ZXh0LmFwaS5zZWxlY3REaXIoe30pXHJcbiAgLy8gICAgIC50aGVuKChzZWxlY3RlZFBhdGg6IHN0cmluZykgPT4ge1xyXG4gIC8vICAgICAgIGlmIChzZWxlY3RlZFBhdGgpIHtcclxuICAvLyAgICAgICAgIGNvbnN0IHByb3BzOiBJU0NNRFByb3BzID0ge1xyXG4gIC8vICAgICAgICAgICBnYW1lSWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgICAgICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgICAgICAgIGFyZ3VtZW50czogW1xyXG4gIC8vICAgICAgICAgICAgIHsgYXJndW1lbnQ6ICdmb3JjZV9pbnN0YWxsX2RpcicsIHZhbHVlOiBzZWxlY3RlZFBhdGggfSxcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAncXVpdCcgfSxcclxuICAvLyAgICAgICAgICAgXSxcclxuICAvLyAgICAgICAgICAgY2FsbGJhY2s6ICgoZXJyLCBkYXRhKSA9PiBudWxsKSxcclxuICAvLyAgICAgICAgIH07XHJcbiAgLy8gICAgICAgICBjb250ZXh0LmFwaS5leHQuc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyKHByb3BzKTtcclxuICAvLyAgICAgICB9XHJcbiAgLy8gICAgIH0pXHJcbiAgLy8gICAgIC5jYXRjaChlcnIgPT4gbnVsbCk7XHJcbiAgLy8gfSwgKCkgPT4gY29udGV4dC5hcGkuZXh0Py5zY21kU3RhcnREZWRpY2F0ZWRTZXJ2ZXIgIT09IHVuZGVmaW5lZCk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDExNSwgJ2ltcG9ydCcsIHt9LCAnSW1wb3J0IEZyb20gcjJtb2RtYW4nLCAoKSA9PiB7XHJcbiAgICBtaWdyYXRlUjJUb1ZvcnRleChjb250ZXh0LmFwaSk7XHJcbiAgfSwgKCkgPT4ge1xyXG4gICAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgY29uc3QgYWN0aXZlR2FtZUlkID0gc2VsZWN0b3JzLmFjdGl2ZUdhbWVJZChzdGF0ZSk7XHJcbiAgICByZXR1cm4gdXNlckhhc1IySW5zdGFsbGVkKClcclxuICAgICAgJiYgKGdldEdhbWVQYXRoKCkgIT09ICcuJylcclxuICAgICAgJiYgKGFjdGl2ZUdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGRlcGVuZGVuY3lUZXN0cyA9IFsgdmJ1aWxkRGVwVGVzdCwgY3VzdG9tTWVzaGVzVGVzdCxcclxuICAgIGN1c3RvbVRleHR1cmVzVGVzdCwgYmV0dGVyQ29udGluZW50c1Rlc3QgXTtcclxuXHJcbiAgZm9yIChjb25zdCB0ZXN0RnVuYyBvZiBkZXBlbmRlbmN5VGVzdHMpIHtcclxuICAgIGNvbnRleHQucmVnaXN0ZXJUZXN0KHRlc3RGdW5jLm5hbWUudG9TdHJpbmcoKSwgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIHRlc3RGdW5jKTtcclxuICAgIGNvbnRleHQucmVnaXN0ZXJUZXN0KHRlc3RGdW5jLm5hbWUudG9TdHJpbmcoKSwgJ21vZC1pbnN0YWxsZWQnLCB0ZXN0RnVuYyk7XHJcbiAgfVxyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnZ2FtZW1vZGUtYWN0aXZhdGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdtdWx0aXBsZS1saWItbW9kcycsICdtb2QtaW5zdGFsbGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWJldHRlci1jb250aW5lbnRzJywgMjAsIHRlc3RCZXR0ZXJDb250LCBpbnN0YWxsQmV0dGVyQ29udCk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1jb3JlLXJlbW92ZXInLCAyMCwgdGVzdENvcmVSZW1vdmVyLCBpbnN0YWxsQ29yZVJlbW92ZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0taW5zbGltdm0nLCAyMCwgdGVzdEluU2xpbU1vZExvYWRlciwgaW5zdGFsbEluU2xpbU1vZExvYWRlcik7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS12YnVpbGQnLCAyMCwgdGVzdFZCdWlsZCwgaW5zdGFsbFZCdWlsZE1vZCk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1mdWxsLWJlcC1wYWNrJywgMTAsIHRlc3RGdWxsUGFjaywgaW5zdGFsbEZ1bGxQYWNrKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTAzKGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA0KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA2KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA5KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTAxMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ3ZvcnRleC13b3JsZHMnKSxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc0JDRXh0ID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNCQ0V4dCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXR0ZXIgQ29udGluZW50cyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0Lm9uY2UoKCkgPT4ge1xyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnd2lsbC1kZXBsb3knLCBhc3luYyAocHJvZmlsZUlkKSA9PiB7XHJcbiAgICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICAgICAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlSWQpXHJcbiAgICAgICAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoZ2VuUHJvcHMoY29udGV4dC5hcGksIHByb2ZpbGVJZCkpKVxyXG4gICAgICAgIC5jYXRjaChlcnIgPT4gZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWRcclxuICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcclxuICAgICAgICAgIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCdkaWQtcHVyZ2UnLCBhc3luYyAocHJvZmlsZUlkKSA9PlxyXG4gICAgICBwYXlsb2FkRGVwbG95ZXIub25EaWRQdXJnZShjb250ZXh0LmFwaSwgcHJvZmlsZUlkKSk7XHJcblxyXG4gICAgY29udGV4dC5hcGkuZXZlbnRzLm9uKCdnYW1lbW9kZS1hY3RpdmF0ZWQnLFxyXG4gICAgICBhc3luYyAoZ2FtZU1vZGU6IHN0cmluZykgPT4gKGdhbWVNb2RlID09PSBHQU1FX0lEKVxyXG4gICAgICAgID8gY2hlY2tDb25maWdNYW5hZ2VyVXBkKGNvbnRleHQuYXBpLCB0cnVlKSA6IG51bGwpO1xyXG5cclxuICAgIGNvbnRleHQuYXBpLmV2ZW50cy5vbignY2hlY2stbW9kcy12ZXJzaW9uJyxcclxuICAgICAgKGdhbWVJZDogc3RyaW5nLCBtb2RzOiB0eXBlcy5JTW9kW10pID0+IChnYW1lSWQgPT09IEdBTUVfSUQpXHJcbiAgICAgICAgPyBjaGVja0NvbmZpZ01hbmFnZXJVcGQoY29udGV4dC5hcGkpIDogbnVsbCk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBtYWluO1xyXG4iXX0=