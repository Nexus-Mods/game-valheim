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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
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
const electron_1 = require("electron");
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
const app = electron_1.remote !== undefined ? electron_1.remote.app : electron_1.app;
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
                    }
                }
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
            var _a;
            const downloader = new unstrippedAssembly_1.UnstrippedAssemblyDownloader(vortex_api_1.util.getVortexPath('temp'));
            const folderName = shortid_1.generate();
            try {
                if (((_a = props.profile) === null || _a === void 0 ? void 0 : _a.gameId) !== common_1.GAME_ID) {
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
                        yield common_1.removeDir(tempPath);
                        yield vortex_api_1.fs.removeAsync(tempPath).catch(err => err.code === 'ENOENT');
                    }
                    catch (err) {
                        vortex_api_1.log('error', 'failed to cleanup temporary files');
                    }
                    return resolve(undefined);
                })));
            }
            catch (err) {
                try {
                    const tempPath = path.join(vortex_api_1.util.getVortexPath('temp'), folderName);
                    yield vortex_api_1.fs.statAsync(tempPath);
                    yield common_1.removeDir(tempPath);
                }
                catch (err2) {
                    vortex_api_1.log('debug', 'unstripped assembly downloader cleanup failed', err2);
                }
                vortex_api_1.log('debug', 'unstripped assembly downloader failed', err);
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
                    if ((download === null || download === void 0 ? void 0 : download.localPath) !== undefined && common_1.guessModId(download.localPath) !== '15') {
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
        const props = common_1.genProps(context);
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
        return tests_1.isDependencyRequired(context.api, {
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
        return tests_1.isDependencyRequired(context.api, {
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
        return tests_1.isDependencyRequired(context.api, {
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
        return tests_1.isDependencyRequired(context.api, {
            dependentModType: 'better-continents-mod',
            masterModType: '',
            masterName: 'Better Continents',
            masterURL: 'https://www.nexusmods.com/valheim/mods/446',
            requiredFiles: [requiredAssembly],
        });
    };
    context.registerAction('mod-icons', 115, 'import', {}, 'Import From r2modman', () => {
        r2Vortex_1.migrateR2ToVortex(context.api);
    }, () => {
        const state = context.api.getState();
        const activeGameId = vortex_api_1.selectors.activeGameId(state);
        return r2Vortex_1.userHasR2Installed()
            && (getGamePath() !== '.')
            && (activeGameId === common_1.GAME_ID);
    });
    const dependencyTests = [vbuildDepTest, customMeshesTest,
        customTexturesTest, betterContinentsTest];
    for (const testFunc of dependencyTests) {
        context.registerTest(testFunc.name.toString(), 'gamemode-activated', testFunc);
        context.registerTest(testFunc.name.toString(), 'mod-installed', testFunc);
    }
    context.registerTest('multiple-lib-mods', 'gamemode-activated', () => tests_1.hasMultipleLibMods(context.api));
    context.registerTest('multiple-lib-mods', 'mod-installed', () => tests_1.hasMultipleLibMods(context.api));
    context.registerInstaller('valheim-better-continents', 20, installers_1.testBetterCont, installers_1.installBetterCont);
    context.registerInstaller('valheim-core-remover', 20, installers_1.testCoreRemover, installers_1.installCoreRemover);
    context.registerInstaller('valheim-inslimvm', 20, installers_1.testInSlimModLoader, installers_1.installInSlimModLoader);
    context.registerInstaller('valheim-vbuild', 20, installers_1.testVBuild, installers_1.installVBuildMod);
    context.registerInstaller('valheim-full-bep-pack', 10, installers_1.testFullPack, installers_1.installFullPack);
    context.registerMigration((oldVersion) => migrations_1.migrate103(context.api, oldVersion));
    context.registerMigration((oldVersion) => migrations_1.migrate104(context.api, oldVersion));
    context.registerMigration((oldVersion) => migrations_1.migrate106(context.api, oldVersion));
    context.registerMigration((oldVersion) => migrations_1.migrate109(context.api, oldVersion));
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
                .then(() => ensureUnstrippedAssemblies(common_1.genProps(context, profileId)))
                .catch(err => err instanceof vortex_api_1.util.UserCanceled
                ? Promise.resolve()
                : Promise.reject(err));
        }));
        context.api.onAsync('did-purge', (profileId) => __awaiter(this, void 0, void 0, function* () { return payloadDeployer.onDidPurge(context, profileId); }));
    });
    return true;
}
exports.default = main;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBc0U7QUFDdEUscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCxxQ0FBd0Q7QUFFeEQsNkRBQW9FO0FBRXBFLHFDQUlrQjtBQUNsQiw2Q0FFbUM7QUFDbkMsNkNBQThFO0FBQzlFLG1DQUFtRTtBQUVuRSx5Q0FBbUU7QUFFbkUsTUFBTSxHQUFHLEdBQUcsaUJBQU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLGlCQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxjQUFLLENBQUM7QUFFdEQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQVMsU0FBUyxDQUFDLEtBQUs7SUFDdEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxHQUFHLE9BQU8sQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxRQUFRO0lBQ2YsT0FBTyxpQkFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxpQkFBUSxDQUFDLENBQUM7U0FDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVE7SUFDaEMsT0FBTyxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssaUJBQWlCLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekYsQ0FBQyxDQUFDLE9BQU8sQ0FB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Z0JBQy9CLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQzFCO1lBQ0QsT0FBTyxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7aUJBQ3BELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxpQkFBUSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO2lCQUNwRSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksaUJBQUksQ0FBQyxZQUFZO2dCQUM1QyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTtnQkFDbkIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM3QixDQUFDLENBQUEsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQU8sU0FBUyxFQUFFLEVBQUUsZ0RBQ25ELE9BQUEsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUEsR0FBQSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgeyBhcHAgYXMgYXBwSW4sIHJlbW90ZSB9IGZyb20gJ2VsZWN0cm9uJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgYWN0aW9ucywgZnMsIGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5pbXBvcnQgUGFyc2VyLCB7IEluaUZpbGUsIFdpbmFwaUZvcm1hdCB9IGZyb20gJ3ZvcnRleC1wYXJzZS1pbmknO1xyXG5pbXBvcnQgKiBhcyBwYXlsb2FkRGVwbG95ZXIgZnJvbSAnLi9wYXlsb2FkRGVwbG95ZXInO1xyXG5cclxuaW1wb3J0IHsgZ2VuZXJhdGUsIGdlbmVyYXRlIGFzIHNob3J0aWQgfSBmcm9tICdzaG9ydGlkJztcclxuXHJcbmltcG9ydCB7IFVuc3RyaXBwZWRBc3NlbWJseURvd25sb2FkZXIgfSBmcm9tICcuL3Vuc3RyaXBwZWRBc3NlbWJseSc7XHJcblxyXG5pbXBvcnQge1xyXG4gIEJFVFRFUl9DT05UX0VYVCwgRkJYX0VYVCwgR0FNRV9JRCwgR0FNRV9JRF9TRVJWRVIsXHJcbiAgZ2VuUHJvcHMsIGd1ZXNzTW9kSWQsIElHTk9SQUJMRV9GSUxFUywgSU5TTElNVk1MX0lERU5USUZJRVIsXHJcbiAgSVByb3BzLCBJU0NNRFByb3BzLCBORVhVUywgT0JKX0VYVCwgUGFja1R5cGUsIHJlbW92ZURpciwgU1RFQU1fSUQsIFZCVUlMRF9FWFQsXHJcbn0gZnJvbSAnLi9jb21tb24nO1xyXG5pbXBvcnQgeyBpbnN0YWxsQmV0dGVyQ29udCwgaW5zdGFsbENvcmVSZW1vdmVyLCBpbnN0YWxsRnVsbFBhY2ssIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIsXHJcbiAgaW5zdGFsbFZCdWlsZE1vZCwgdGVzdEJldHRlckNvbnQsIHRlc3RDb3JlUmVtb3ZlciwgdGVzdEZ1bGxQYWNrLCB0ZXN0SW5TbGltTW9kTG9hZGVyLFxyXG4gIHRlc3RWQnVpbGQgfSBmcm9tICcuL2luc3RhbGxlcnMnO1xyXG5pbXBvcnQgeyBtaWdyYXRlMTAzLCBtaWdyYXRlMTA0LCBtaWdyYXRlMTA2LCBtaWdyYXRlMTA5IH0gZnJvbSAnLi9taWdyYXRpb25zJztcclxuaW1wb3J0IHsgaGFzTXVsdGlwbGVMaWJNb2RzLCBpc0RlcGVuZGVuY3lSZXF1aXJlZCB9IGZyb20gJy4vdGVzdHMnO1xyXG5cclxuaW1wb3J0IHsgbWlncmF0ZVIyVG9Wb3J0ZXgsIHVzZXJIYXNSMkluc3RhbGxlZCB9IGZyb20gJy4vcjJWb3J0ZXgnO1xyXG5cclxuY29uc3QgYXBwID0gcmVtb3RlICE9PSB1bmRlZmluZWQgPyByZW1vdGUuYXBwIDogYXBwSW47XHJcblxyXG5jb25zdCBTVE9QX1BBVFRFUk5TID0gWydjb25maWcnLCAncGx1Z2lucycsICdwYXRjaGVycyddO1xyXG5mdW5jdGlvbiB0b1dvcmRFeHAoaW5wdXQpIHtcclxuICByZXR1cm4gJyhefC8pJyArIGlucHV0ICsgJygvfCQpJztcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEdhbWUoKTogYW55IHtcclxuICByZXR1cm4gdXRpbC5HYW1lU3RvcmVIZWxwZXIuZmluZEJ5QXBwSWQoW1NURUFNX0lEXSlcclxuICAgIC50aGVuKGdhbWUgPT4gZ2FtZS5nYW1lUGF0aCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlcXVpcmVzTGF1bmNoZXIoZ2FtZVBhdGgpIHtcclxuICByZXR1cm4gZnMucmVhZGRpckFzeW5jKGdhbWVQYXRoKVxyXG4gICAgLnRoZW4oZmlsZXMgPT4gKGZpbGVzLmZpbmQoZmlsZSA9PiBmaWxlLnRvTG93ZXJDYXNlKCkgPT09ICdzdGVhbV9hcHBpZC50eHQnKSAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IFByb21pc2UucmVzb2x2ZSh7XHJcbiAgICAgICAgbGF1bmNoZXI6ICdzdGVhbScsXHJcbiAgICAgICAgYWRkSW5mbzoge1xyXG4gICAgICAgICAgYXBwSWQ6IFNURUFNX0lELFxyXG4gICAgICAgICAgcGFyYW1ldGVyczogWyctZm9yY2UtZ2xjb3JlJ10sXHJcbiAgICAgICAgICBsYXVuY2hUeXBlOiAnZ2FtZXN0b3JlJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9KVxyXG4gICAgICA6IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpKVxyXG4gICAgLmNhdGNoKGVyciA9PiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMocHJvcHM6IElQcm9wcyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IGFwaSA9IHByb3BzLmFwaTtcclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICBjb25zdCBleHBlY3RlZEZpbGVQYXRoID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG4gIGNvbnN0IGZ1bGxQYWNrQ29yTGliT2xkID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ0JlcEluRXgnLCAnY29yZV9saWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk5ldyA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX2NvcmxpYicsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG5cclxuICBjb25zdCB1cmwgPSBwYXRoLmpvaW4oTkVYVVMsICd2YWxoZWltJywgJ21vZHMnLCAnMTIwMicpICsgYD90YWI9ZmlsZXMmZmlsZV9pZD00ODk5Jm5tbT0xYDtcclxuICBjb25zdCByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nID0gKCkgPT4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnTWlzc2luZyB1bnN0cmlwcGVkIGFzc2VtYmxpZXMnLCB7XHJcbiAgICAgIGJiY29kZTogdCgnVmFsaGVpbVxcJ3MgYXNzZW1ibGllcyBhcmUgZGlzdHJpYnV0ZWQgaW4gYW4gXCJvcHRpbWlzZWRcIiBzdGF0ZSB0byByZWR1Y2UgcmVxdWlyZWQgJ1xyXG4gICAgICArICdkaXNrIHNwYWNlLiBUaGlzIHVuZm9ydHVuYXRlbHkgbWVhbnMgdGhhdCBWYWxoZWltXFwncyBtb2RkaW5nIGNhcGFiaWxpdGllcyBhcmUgYWxzbyBhZmZlY3RlZC57e2JyfX17e2JyfX0nXHJcbiAgICAgICsgJ0luIG9yZGVyIHRvIG1vZCBWYWxoZWltLCB0aGUgdW5vcHRpbWlzZWQvdW5zdHJpcHBlZCBhc3NlbWJsaWVzIGFyZSByZXF1aXJlZCAtIHBsZWFzZSBkb3dubG9hZCB0aGVzZSAnXHJcbiAgICAgICsgJ2Zyb20gTmV4dXMgTW9kcy57e2JyfX17e2JyfX0gWW91IGNhbiBjaG9vc2UgdGhlIFZvcnRleC9tb2QgbWFuYWdlciBkb3dubG9hZCBvciBtYW51YWwgZG93bmxvYWQgJ1xyXG4gICAgICArICcoc2ltcGx5IGRyYWcgYW5kIGRyb3AgdGhlIGFyY2hpdmUgaW50byB0aGUgbW9kcyBkcm9wem9uZSB0byBhZGQgaXQgdG8gVm9ydGV4KS57e2JyfX17e2JyfX0nXHJcbiAgICAgICsgJ1ZvcnRleCB3aWxsIHRoZW4gYmUgYWJsZSB0byBpbnN0YWxsIHRoZSBhc3NlbWJsaWVzIHdoZXJlIHRoZXkgYXJlIG5lZWRlZCB0byBlbmFibGUgJ1xyXG4gICAgICArICdtb2RkaW5nLCBsZWF2aW5nIHRoZSBvcmlnaW5hbCBvbmVzIHVudG91Y2hlZC4nLCB7IHJlcGxhY2U6IHsgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICB9LCBbXHJcbiAgICAgIHsgbGFiZWw6ICdDYW5jZWwnLCBhY3Rpb246ICgpID0+IHJlamVjdChuZXcgdXRpbC5Vc2VyQ2FuY2VsZWQoKSkgfSxcclxuICAgICAge1xyXG4gICAgICAgIGxhYmVsOiAnRG93bmxvYWQgVW5zdHJpcHBlZCBBc3NlbWJsaWVzJyxcclxuICAgICAgICBhY3Rpb246ICgpID0+IHV0aWwub3BuKHVybClcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4gbnVsbClcclxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHJlc29sdmUoKSksXHJcbiAgICAgIH0sXHJcbiAgICBdKTtcclxuICB9KTtcclxuXHJcbiAgY29uc3QgcmFpc2VGb3JjZURvd25sb2FkTm90aWYgPSAoKSA9PiBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICBtZXNzYWdlOiB0KCdHYW1lIHVwZGF0ZWQgLSBVcGRhdGVkIGFzc2VtYmxpZXMgcGFjayByZXF1aXJlZC4nKSxcclxuICAgIHR5cGU6ICdpbmZvJyxcclxuICAgIGlkOiAnZm9yY2VEb3dubG9hZE5vdGlmJyxcclxuICAgIG5vRGlzbWlzczogdHJ1ZSxcclxuICAgIGFsbG93U3VwcHJlc3M6IHRydWUsXHJcbiAgICBhY3Rpb25zOiBbXHJcbiAgICAgIHtcclxuICAgICAgICB0aXRsZTogJ01vcmUnLFxyXG4gICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ0Rvd25sb2FkIHVuc3RyaXBwZWQgYXNzZW1ibGllcycsIHtcclxuICAgICAgICAgIGJiY29kZTogdCgnVmFsaGVpbSBoYXMgYmVlbiB1cGRhdGVkIGFuZCB0byBiZSBhYmxlIHRvIG1vZCB0aGUgZ2FtZSB5b3Ugd2lsbCBuZWVkIHRvIGVuc3VyZSB5b3UgYXJlIHVzaW5nIHRoZSBsYXRlc3QgdW5zdHJpcHBlZCBVbml0eSBhc3NlbWJsaWVzIG9yIHRoZSBsYXRlc3QgXCJCZXBJbkV4IHBhY2tcIi4gJ1xyXG4gICAgICAgICAgICAgICAgICArICdWb3J0ZXggaGFzIGRldGVjdGVkIHRoYXQgeW91IGhhdmUgcHJldmlvdXNseSBpbnN0YWxsZWQgdW5zdHJpcHBlZCBVbml0eSBhc3NlbWJsaWVzIC8gYSBCZXBJbkV4IHBhY2ssIGJ1dCBjYW5ub3Qga25vdyBmb3Igc3VyZSB3aGV0aGVyIHRoZXNlIGZpbGVzIGFyZSB1cCB0byBkYXRlLiAnXHJcbiAgICAgICAgICAgICAgICAgICsgJ0lmIHlvdSBhcmUgdW5zdXJlLCBWb3J0ZXggY2FuIGRvd25sb2FkIGFuZCBpbnN0YWxsIHRoZSBsYXRlc3QgcmVxdWlyZWQgZmlsZXMgZm9yIHlvdS57e2xifX0nXHJcbiAgICAgICAgICAgICAgICAgICsgJ1BsZWFzZSBub3RlIHRoYXQgYWxsIG1vZHMgbXVzdCBhbHNvIGJlIHVwZGF0ZWQgaW4gb3JkZXIgZm9yIHRoZW0gdG8gZnVuY3Rpb24gd2l0aCB0aGUgbmV3IGdhbWUgdmVyc2lvbi4nLFxyXG4gICAgICAgICAgICAgICAgICB7IHJlcGxhY2U6IHsgbGI6ICdbYnJdWy9icl1bYnJdWy9icl0nLCBicjogJ1ticl1bL2JyXScgfSB9KSxcclxuICAgICAgICB9LCBbXHJcbiAgICAgICAgICB7IGxhYmVsOiAnQ2xvc2UnIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGxhYmVsOiAnRG93bmxvYWQgVW5zdHJpcHBlZCBBc3NlbWJsaWVzJyxcclxuICAgICAgICAgICAgYWN0aW9uOiAoKSA9PiBydW5Eb3dubG9hZGVyKCkuZmluYWxseSgoKSA9PiBkaXNtaXNzKCkpLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdKSxcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTmV2ZXIgU2hvdyBBZ2FpbicsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4ge1xyXG4gICAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc3VwcHJlc3NOb3RpZmljYXRpb24oJ2ZvcmNlRG93bmxvYWROb3RpZicsIHRydWUpKTtcclxuICAgICAgICAgIGRpc21pc3MoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIF0sXHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGFzc2lnbk92ZXJyaWRlUGF0aCA9IGFzeW5jIChvdmVycmlkZVBhdGg6IHN0cmluZykgPT4ge1xyXG4gICAgY29uc3QgZG9vclN0b3BDb25maWcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsICdkb29yc3RvcF9jb25maWcuaW5pJyk7XHJcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgUGFyc2VyKG5ldyBXaW5hcGlGb3JtYXQoKSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpbmlEYXRhOiBJbmlGaWxlPGFueT4gPSBhd2FpdCBwYXJzZXIucmVhZChkb29yU3RvcENvbmZpZyk7XHJcbiAgICAgIGluaURhdGEuZGF0YVsnVW5pdHlEb29yc3RvcCddWydkbGxTZWFyY2hQYXRoT3ZlcnJpZGUnXSA9IG92ZXJyaWRlUGF0aDtcclxuICAgICAgYXdhaXQgcGFyc2VyLndyaXRlKGRvb3JTdG9wQ29uZmlnLCBpbmlEYXRhKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdmYWlsZWQgdG8gbW9kaWZ5IGRvb3JzdG9wIGNvbmZpZ3VyYXRpb24nLCBlcnIpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHJ1bkRvd25sb2FkZXIgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBkb3dubG9hZGVyID0gbmV3IFVuc3RyaXBwZWRBc3NlbWJseURvd25sb2FkZXIodXRpbC5nZXRWb3J0ZXhQYXRoKCd0ZW1wJykpO1xyXG4gICAgY29uc3QgZm9sZGVyTmFtZSA9IGdlbmVyYXRlKCk7XHJcbiAgICB0cnkge1xyXG4gICAgICBpZiAocHJvcHMucHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAgICAgLy8gVGhpcyBpcyBhIHZhbGlkIHNjZW5hcmlvIHdoZW4gdGhlIHVzZXIgdHJpZXMgdG8gbWFuYWdlIFZhbGhlaW1cclxuICAgICAgICAvLyAgd2hlbiB0aGUgYWN0aXZlIGdhbWVNb2RlIGlzIHVuZGVmaW5lZC5cclxuICAgICAgICB0aHJvdyBuZXcgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQoJ1dyb25nIGdhbWVtb2RlJyk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3QgYXJjaGl2ZUZpbGVQYXRoID0gYXdhaXQgZG93bmxvYWRlci5kb3dubG9hZE5ld2VzdCgnZnVsbF9uYW1lJywgJ2Rlbmlrc29uLUJlcEluRXhQYWNrX1ZhbGhlaW0nKTtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB3ZSBjYW4ndCByZWFsbHkgdmFsaWRhdGUgdGhlIGRvd25sb2FkJ3MgaW50ZWdyaXR5OyBidXQgd2VcclxuICAgICAgLy8gIGNhbiBhdCB0aGUgdmVyeSBsZWFzdCBtYWtlIHN1cmUgaXQncyB0aGVyZSBhbmQgaXNuJ3QganVzdCBhbiBlbXB0eSBhcmNoaXZlLlxyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoYXJjaGl2ZUZpbGVQYXRoKTtcclxuICAgICAgY29uc3Qgc2V2ZW56aXAgPSBuZXcgdXRpbC5TZXZlblppcCgpO1xyXG4gICAgICBjb25zdCB0ZW1wUGF0aCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoYXJjaGl2ZUZpbGVQYXRoKSwgZm9sZGVyTmFtZSk7XHJcbiAgICAgIGF3YWl0IHNldmVuemlwLmV4dHJhY3RGdWxsKGFyY2hpdmVGaWxlUGF0aCwgdGVtcFBhdGgpO1xyXG4gICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZzLnJlYWRkaXJBc3luYyh0ZW1wUGF0aCk7XHJcbiAgICAgIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgdXRpbC5EYXRhSW52YWxpZCgnSW52YWxpZCBhcmNoaXZlJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEdpdmUgaXQgYSBzZWNvbmQgZm9yIHRoZSBkb3dubG9hZCB0byByZWdpc3RlciBpbiB0aGUgc3RhdGUuXHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XHJcbiAgICAgICAgYXBpLmV2ZW50cy5lbWl0KCdpbXBvcnQtZG93bmxvYWRzJywgWyBhcmNoaXZlRmlsZVBhdGggXSwgYXN5bmMgKGRsSWRzOiBzdHJpbmdbXSkgPT4ge1xyXG4gICAgICAgIGlmIChkbElkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QobmV3IHV0aWwuUHJvY2Vzc0NhbmNlbGVkKCdGYWlsZWQgdG8gaW1wb3J0IGFyY2hpdmUnKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGRsSWQgb2YgZGxJZHMpIHtcclxuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMyLCByZWoyKSA9PlxyXG4gICAgICAgICAgICBhcGkuZXZlbnRzLmVtaXQoJ3N0YXJ0LWluc3RhbGwtZG93bmxvYWQnLCBkbElkLCB0cnVlLCAoZXJyLCBtb2RJZCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlajIoZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RFbmFibGVkKHByb3BzLnByb2ZpbGUuaWQsIG1vZElkLCB0cnVlKSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXMyKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICB9KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zdXBwcmVzc05vdGlmaWNhdGlvbignZm9yY2VEb3dubG9hZE5vdGlmJywgdHJ1ZSkpO1xyXG4gICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldERlcGxveW1lbnROZWNlc3NhcnkoR0FNRV9JRCwgdHJ1ZSkpO1xyXG4gICAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aCgndW5zdHJpcHBlZF9jb3JsaWInKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgYXdhaXQgcmVtb3ZlRGlyKHRlbXBQYXRoKTtcclxuICAgICAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKHRlbXBQYXRoKS5jYXRjaChlcnIgPT4gZXJyLmNvZGUgPT09ICdFTk9FTlQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgIGxvZygnZXJyb3InLCAnZmFpbGVkIHRvIGNsZWFudXAgdGVtcG9yYXJ5IGZpbGVzJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXNvbHZlKHVuZGVmaW5lZCk7XHJcbiAgICAgIH0pKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHRlbXBQYXRoID0gcGF0aC5qb2luKHV0aWwuZ2V0Vm9ydGV4UGF0aCgndGVtcCcpLCBmb2xkZXJOYW1lKTtcclxuICAgICAgICBhd2FpdCBmcy5zdGF0QXN5bmModGVtcFBhdGgpO1xyXG4gICAgICAgIGF3YWl0IHJlbW92ZURpcih0ZW1wUGF0aCk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycjIpIHtcclxuICAgICAgICBsb2coJ2RlYnVnJywgJ3Vuc3RyaXBwZWQgYXNzZW1ibHkgZG93bmxvYWRlciBjbGVhbnVwIGZhaWxlZCcsIGVycjIpO1xyXG4gICAgICAgIC8vIENsZWFudXAgZmFpbGVkIG9yIGlzIHVubmVjZXNzYXJ5LlxyXG4gICAgICB9XHJcbiAgICAgIGxvZygnZGVidWcnLCAndW5zdHJpcHBlZCBhc3NlbWJseSBkb3dubG9hZGVyIGZhaWxlZCcsIGVycik7XHJcbiAgICAgIHJldHVybiByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nKCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWRzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICBjb25zdCBoYXNDb3JlTGliVHlwZSA9IHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sXHJcbiAgICAgIFsnYXR0cmlidXRlcycsICdDb3JlTGliVHlwZSddLCB1bmRlZmluZWQpICE9PSB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSxcclxuICAgICAgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIGhhc0NvcmVMaWJUeXBlICYmIGlzRW5hYmxlZDtcclxuICB9KTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZHMubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGUgdXNlciBoYXMgc2V2ZXJhbCBpbnN0YWxsZWQsIHNlbGVjdCB0aGUgZmlyc3Qgb25lLlxyXG4gICAgY29uc3QgY29yZUxpYk1vZElkID0gY29yZUxpYk1vZElkc1swXTtcclxuXHJcbiAgICBjb25zdCBwYWNrVHlwZTogUGFja1R5cGUgPSBtb2RzW2NvcmVMaWJNb2RJZF0uYXR0cmlidXRlc1snQ29yZUxpYlR5cGUnXTtcclxuICAgIHN3aXRjaCAocGFja1R5cGUpIHtcclxuICAgICAgY2FzZSAnY29yZV9saWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgnQmVwSW5FeFxcXFxjb3JlX2xpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBjYXNlICd1bnN0cmlwcGVkX2NvcmxpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIG5vcCAtIGxldCB0aGUgZm9yIGxvb3AgYmVsb3cgdHJ5IHRvIGZpbmQgdGhlIHBhY2suXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIFtmdWxsUGFja0NvckxpYk5ldywgZnVsbFBhY2tDb3JMaWJPbGRdKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoZmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBmaWxlUGF0aC5yZXBsYWNlKHByb3BzLmRpc2NvdmVyeS5wYXRoICsgcGF0aC5zZXAsICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHBhdGguc2VwICsgJ21vbm8uc2VjdXJpdHkuZGxsJywgJycpO1xyXG4gICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIC8vIG5vcFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIHZhbGlkIHZhcmlhbnQgb2YgdGhlIHVuc3RyaXBwZWQgYXNzZW1ibHkgbW9kcyBmb3VuZCBvbiBOZXh1cy5cclxuICBjb25zdCB1bnN0cmlwcGVkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycpO1xyXG4gIGlmICh1bnN0cmlwcGVkTW9kcy5sZW5ndGggPiAwKSB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgIGlmICh1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSwgWydtb2RTdGF0ZScsIG1vZElkLCAnZW5hYmxlZCddLCBmYWxzZSkpIHtcclxuICAgICAgICBjb25zdCBkbGlkID0gbW9kc1ttb2RJZF0uYXJjaGl2ZUlkO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkOiB0eXBlcy5JRG93bmxvYWQgPSB1dGlsLmdldFNhZmUoYXBpLmdldFN0YXRlKCksXHJcbiAgICAgICAgICBbJ3BlcnNpc3RlbnQnLCAnZG93bmxvYWRzJywgJ2ZpbGVzJywgZGxpZF0sIHVuZGVmaW5lZCk7XHJcbiAgICAgICAgaWYgKGRvd25sb2FkPy5sb2NhbFBhdGggIT09IHVuZGVmaW5lZCAmJiBndWVzc01vZElkKGRvd25sb2FkLmxvY2FsUGF0aCkgIT09ICcxNScpIHtcclxuICAgICAgICAgIC8vIFRoZSBOZXh1cyBNb2RzIHVuc3RyaXBwZWQgYXNzbWVibGllcyBtb2QgaXMgZW5hYmxlZCAtIGRvbid0IHJhaXNlIHRoZSBtaXNzaW5nXHJcbiAgICAgICAgICAvLyAgYXNzZW1ibGllcyBkaWFsb2cuXHJcbiAgICAgICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBleHBlY3RlZEZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBydW5Eb3dubG9hZGVyKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQpIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJldlByb2ZJZDogc3RyaW5nID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByZXZQcm9mSWQpO1xyXG4gIGNvbnN0IG1vZFR5cGVzOiB7IFt0eXBlSWQ6IHN0cmluZ106IHN0cmluZyB9ID0gc2VsZWN0b3JzLm1vZFBhdGhzRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgY3JlYXRlRGlyZWN0b3JpZXMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZFR5cGUgb2YgT2JqZWN0LmtleXMobW9kVHlwZXMpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhtb2RUeXBlc1ttb2RUeXBlXSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuICByZXR1cm4gbmV3IEJsdWViaXJkPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IGNyZWF0ZURpcmVjdG9yaWVzKClcclxuICAgIC50aGVuKCgpID0+IHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZT8uaWQpKVxyXG4gICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKVxyXG4gICAgLmNhdGNoKGVyciA9PiByZWplY3QoZXJyKSkpXHJcbiAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoeyBhcGk6IGNvbnRleHQuYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kc1BhdGgoZ2FtZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICAgIGlnbm9yZURlcGxveTogW10uY29uY2F0KElHTk9SQUJMRV9GSUxFUywgSUdOT1JBQkxFX0ZJTEVTLm1hcChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSkpLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gIC8vICAgaWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgbmFtZTogJ1ZhbGhlaW06IERlZGljYXRlZCBTZXJ2ZXInLFxyXG4gIC8vICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gIC8vICAgcXVlcnlQYXRoOiAoKSA9PiB1bmRlZmluZWQsXHJcbiAgLy8gICBxdWVyeU1vZFBhdGg6IG1vZHNQYXRoLFxyXG4gIC8vICAgbG9nbzogJ2dhbWVhcnQuanBnJyxcclxuICAvLyAgIGV4ZWN1dGFibGU6ICgpID0+ICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgLy8gICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgLy8gICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgLy8gICAgICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIF0sXHJcbiAgLy8gICBlbnZpcm9ubWVudDoge1xyXG4gIC8vICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAvLyAgIH0sXHJcbiAgLy8gICBkZXRhaWxzOiB7XHJcbiAgLy8gICAgIG5leHVzUGFnZUlkOiBHQU1FX0lELFxyXG4gIC8vICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAvLyAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gIC8vICAgfSxcclxuICAvLyB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCk7XHJcbiAgICByZXR1cm4gKHByb3BzPy5kaXNjb3Zlcnk/LnBhdGggIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBwcm9wcy5kaXNjb3ZlcnkucGF0aCA6ICcuJztcclxuICB9O1xyXG5cclxuICBjb25zdCBpc1N1cHBvcnRlZCA9IChnYW1lSWQ6IHN0cmluZykgPT4gKGdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgY29uc3QgaGFzSW5zdHJ1Y3Rpb24gPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVkOiAoaW5zdDogdHlwZXMuSUluc3RydWN0aW9uKSA9PiBib29sZWFuKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zLmZpbmQoaW5zdHIgPT4gKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIChwcmVkKGluc3RyKSkpICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gIGNvbnN0IGZpbmRJbnN0ck1hdGNoID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1vZD86IChpbnB1dDogc3RyaW5nKSA9PiBzdHJpbmcpID0+IHtcclxuICAgIGlmIChtb2QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBtb2QgPSAoaW5wdXQpID0+IGlucHV0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PlxyXG4gICAgICBtb2QoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpID09PSBwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHZidWlsZERlcFRlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBnYW1lUGF0aCA9IGdldEdhbWVQYXRoKCk7XHJcbiAgICBjb25zdCBidWlsZFNoYXJlQXNzZW1ibHkgPSBwYXRoLmpvaW4oZ2FtZVBhdGgsICdJblNsaW1WTUwnLCAnTW9kcycsICdDUi1CdWlsZFNoYXJlX1ZNTC5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmJ1aWxkLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICdpbnNsaW12bWwtbW9kJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0J1aWxkU2hhcmUgKEFkdmFuY2VkQnVpbGRpbmcpJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNScsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgYnVpbGRTaGFyZUFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21NZXNoZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21NZXNoZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tTWVzaGVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTg0JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21UZXh0dXJlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbVRleHR1cmVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tVGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80OCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYmV0dGVyQ29udGluZW50c1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0JldHRlckNvbnRpbmVudHMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ2JldHRlci1jb250aW5lbnRzLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQmV0dGVyIENvbnRpbmVudHMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80NDYnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8vIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDEwMCwgJ3N0ZWFtY21kJywge30sICdTdGVhbUNNRCBEZWRpY2F0ZWQgU2VydmVyJywgKCkgPT4ge1xyXG4gIC8vICAgY29udGV4dC5hcGkuc2VsZWN0RGlyKHt9KVxyXG4gIC8vICAgICAudGhlbigoc2VsZWN0ZWRQYXRoOiBzdHJpbmcpID0+IHtcclxuICAvLyAgICAgICBpZiAoc2VsZWN0ZWRQYXRoKSB7XHJcbiAgLy8gICAgICAgICBjb25zdCBwcm9wczogSVNDTURQcm9wcyA9IHtcclxuICAvLyAgICAgICAgICAgZ2FtZUlkOiBHQU1FX0lEX1NFUlZFUixcclxuICAvLyAgICAgICAgICAgc3RlYW1BcHBJZDogK1NURUFNX0lELFxyXG4gIC8vICAgICAgICAgICBhcmd1bWVudHM6IFtcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAnZm9yY2VfaW5zdGFsbF9kaXInLCB2YWx1ZTogc2VsZWN0ZWRQYXRoIH0sXHJcbiAgLy8gICAgICAgICAgICAgeyBhcmd1bWVudDogJ3F1aXQnIH0sXHJcbiAgLy8gICAgICAgICAgIF0sXHJcbiAgLy8gICAgICAgICAgIGNhbGxiYWNrOiAoKGVyciwgZGF0YSkgPT4gbnVsbCksXHJcbiAgLy8gICAgICAgICB9O1xyXG4gIC8vICAgICAgICAgY29udGV4dC5hcGkuZXh0LnNjbWRTdGFydERlZGljYXRlZFNlcnZlcihwcm9wcyk7XHJcbiAgLy8gICAgICAgfVxyXG4gIC8vICAgICB9KVxyXG4gIC8vICAgICAuY2F0Y2goZXJyID0+IG51bGwpO1xyXG4gIC8vIH0sICgpID0+IGNvbnRleHQuYXBpLmV4dD8uc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyICE9PSB1bmRlZmluZWQpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyQWN0aW9uKCdtb2QtaWNvbnMnLCAxMTUsICdpbXBvcnQnLCB7fSwgJ0ltcG9ydCBGcm9tIHIybW9kbWFuJywgKCkgPT4ge1xyXG4gICAgbWlncmF0ZVIyVG9Wb3J0ZXgoY29udGV4dC5hcGkpO1xyXG4gIH0sICgpID0+IHtcclxuICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgIGNvbnN0IGFjdGl2ZUdhbWVJZCA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoc3RhdGUpO1xyXG4gICAgcmV0dXJuIHVzZXJIYXNSMkluc3RhbGxlZCgpXHJcbiAgICAgICYmIChnZXRHYW1lUGF0aCgpICE9PSAnLicpXHJcbiAgICAgICYmIChhY3RpdmVHYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBkZXBlbmRlbmN5VGVzdHMgPSBbIHZidWlsZERlcFRlc3QsIGN1c3RvbU1lc2hlc1Rlc3QsXHJcbiAgICBjdXN0b21UZXh0dXJlc1Rlc3QsIGJldHRlckNvbnRpbmVudHNUZXN0IF07XHJcblxyXG4gIGZvciAoY29uc3QgdGVzdEZ1bmMgb2YgZGVwZW5kZW5jeVRlc3RzKSB7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB0ZXN0RnVuYyk7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdtb2QtaW5zdGFsbGVkJywgdGVzdEZ1bmMpO1xyXG4gIH1cclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ211bHRpcGxlLWxpYi1tb2RzJywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnbW9kLWluc3RhbGxlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1iZXR0ZXItY29udGluZW50cycsIDIwLCB0ZXN0QmV0dGVyQ29udCwgaW5zdGFsbEJldHRlckNvbnQpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNChjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNihjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwOShjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ3ZvcnRleC13b3JsZHMnKSxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc0JDRXh0ID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNCQ0V4dCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXR0ZXIgQ29udGluZW50cyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0Lm9uY2UoKCkgPT4ge1xyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnd2lsbC1kZXBsb3knLCBhc3luYyAocHJvZmlsZUlkKSA9PiB7XHJcbiAgICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICAgICAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlSWQpXHJcbiAgICAgICAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoZ2VuUHJvcHMoY29udGV4dCwgcHJvZmlsZUlkKSkpXHJcbiAgICAgICAgLmNhdGNoKGVyciA9PiBlcnIgaW5zdGFuY2VvZiB1dGlsLlVzZXJDYW5jZWxlZFxyXG4gICAgICAgICAgPyBQcm9taXNlLnJlc29sdmUoKVxyXG4gICAgICAgICAgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnRleHQuYXBpLm9uQXN5bmMoJ2RpZC1wdXJnZScsIGFzeW5jIChwcm9maWxlSWQpID0+XHJcbiAgICAgIHBheWxvYWREZXBsb3llci5vbkRpZFB1cmdlKGNvbnRleHQsIHByb2ZpbGVJZCkpO1xyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbWFpbjtcclxuIl19