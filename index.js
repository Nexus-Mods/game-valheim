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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBc0U7QUFDdEUscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCxxQ0FBd0Q7QUFFeEQsNkRBQW9FO0FBRXBFLHFDQUlrQjtBQUNsQiw2Q0FFbUM7QUFDbkMsNkNBQThFO0FBQzlFLG1DQUFtRTtBQUVuRSx5Q0FBbUU7QUFFbkUsTUFBTSxHQUFHLEdBQUcsaUJBQU0sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLGlCQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxjQUFLLENBQUM7QUFFdEQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQVMsU0FBUyxDQUFDLEtBQUs7SUFDdEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxHQUFHLE9BQU8sQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxRQUFRO0lBQ2YsT0FBTyxpQkFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxpQkFBUSxDQUFDLENBQUM7U0FDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVE7SUFDaEMsT0FBTyxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssaUJBQWlCLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekYsQ0FBQyxDQUFDLE9BQU8sQ0FB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LENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzdCLENBQUMsQ0FBQSxDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBTyxTQUFTLEVBQUUsRUFBRSxnREFDbkQsT0FBQSxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQztJQUNwRCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELGtCQUFlLElBQUksQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCbHVlYmlyZCBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCB7IGFwcCBhcyBhcHBJbiwgcmVtb3RlIH0gZnJvbSAnZWxlY3Ryb24nO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCBQYXJzZXIsIHsgSW5pRmlsZSwgV2luYXBpRm9ybWF0IH0gZnJvbSAndm9ydGV4LXBhcnNlLWluaSc7XHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBnZW5lcmF0ZSwgZ2VuZXJhdGUgYXMgc2hvcnRpZCB9IGZyb20gJ3Nob3J0aWQnO1xyXG5cclxuaW1wb3J0IHsgVW5zdHJpcHBlZEFzc2VtYmx5RG93bmxvYWRlciB9IGZyb20gJy4vdW5zdHJpcHBlZEFzc2VtYmx5JztcclxuXHJcbmltcG9ydCB7XHJcbiAgQkVUVEVSX0NPTlRfRVhULCBGQlhfRVhULCBHQU1FX0lELCBHQU1FX0lEX1NFUlZFUixcclxuICBnZW5Qcm9wcywgZ3Vlc3NNb2RJZCwgSUdOT1JBQkxFX0ZJTEVTLCBJTlNMSU1WTUxfSURFTlRJRklFUixcclxuICBJUHJvcHMsIElTQ01EUHJvcHMsIE5FWFVTLCBPQkpfRVhULCBQYWNrVHlwZSwgcmVtb3ZlRGlyLCBTVEVBTV9JRCwgVkJVSUxEX0VYVCxcclxufSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IGluc3RhbGxCZXR0ZXJDb250LCBpbnN0YWxsQ29yZVJlbW92ZXIsIGluc3RhbGxGdWxsUGFjaywgaW5zdGFsbEluU2xpbU1vZExvYWRlcixcclxuICBpbnN0YWxsVkJ1aWxkTW9kLCB0ZXN0QmV0dGVyQ29udCwgdGVzdENvcmVSZW1vdmVyLCB0ZXN0RnVsbFBhY2ssIHRlc3RJblNsaW1Nb2RMb2FkZXIsXHJcbiAgdGVzdFZCdWlsZCB9IGZyb20gJy4vaW5zdGFsbGVycyc7XHJcbmltcG9ydCB7IG1pZ3JhdGUxMDMsIG1pZ3JhdGUxMDQsIG1pZ3JhdGUxMDYsIG1pZ3JhdGUxMDkgfSBmcm9tICcuL21pZ3JhdGlvbnMnO1xyXG5pbXBvcnQgeyBoYXNNdWx0aXBsZUxpYk1vZHMsIGlzRGVwZW5kZW5jeVJlcXVpcmVkIH0gZnJvbSAnLi90ZXN0cyc7XHJcblxyXG5pbXBvcnQgeyBtaWdyYXRlUjJUb1ZvcnRleCwgdXNlckhhc1IySW5zdGFsbGVkIH0gZnJvbSAnLi9yMlZvcnRleCc7XHJcblxyXG5jb25zdCBhcHAgPSByZW1vdGUgIT09IHVuZGVmaW5lZCA/IHJlbW90ZS5hcHAgOiBhcHBJbjtcclxuXHJcbmNvbnN0IFNUT1BfUEFUVEVSTlMgPSBbJ2NvbmZpZycsICdwbHVnaW5zJywgJ3BhdGNoZXJzJ107XHJcbmZ1bmN0aW9uIHRvV29yZEV4cChpbnB1dCkge1xyXG4gIHJldHVybiAnKF58LyknICsgaW5wdXQgKyAnKC98JCknO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaW5kR2FtZSgpOiBhbnkge1xyXG4gIHJldHVybiB1dGlsLkdhbWVTdG9yZUhlbHBlci5maW5kQnlBcHBJZChbU1RFQU1fSURdKVxyXG4gICAgLnRoZW4oZ2FtZSA9PiBnYW1lLmdhbWVQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVxdWlyZXNMYXVuY2hlcihnYW1lUGF0aCkge1xyXG4gIHJldHVybiBmcy5yZWFkZGlyQXN5bmMoZ2FtZVBhdGgpXHJcbiAgICAudGhlbihmaWxlcyA9PiAoZmlsZXMuZmluZChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSA9PT0gJ3N0ZWFtX2FwcGlkLnR4dCcpICE9PSB1bmRlZmluZWQpXHJcbiAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHtcclxuICAgICAgICBsYXVuY2hlcjogJ3N0ZWFtJyxcclxuICAgICAgICBhZGRJbmZvOiB7XHJcbiAgICAgICAgICBhcHBJZDogU1RFQU1fSUQsXHJcbiAgICAgICAgICBwYXJhbWV0ZXJzOiBbJy1mb3JjZS1nbGNvcmUnXSxcclxuICAgICAgICAgIGxhdW5jaFR5cGU6ICdnYW1lc3RvcmUnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pXHJcbiAgICAgIDogUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IFByb21pc2UucmVqZWN0KGVycikpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhwcm9wczogSVByb3BzKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgYXBpID0gcHJvcHMuYXBpO1xyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG4gIGNvbnN0IGV4cGVjdGVkRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9tYW5hZ2VkJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJPbGQgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAnQmVwSW5FeCcsICdjb3JlX2xpYicsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG4gIGNvbnN0IGZ1bGxQYWNrQ29yTGliTmV3ID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfY29ybGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcblxyXG4gIGNvbnN0IHVybCA9IHBhdGguam9pbihORVhVUywgJ3ZhbGhlaW0nLCAnbW9kcycsICcxMjAyJykgKyBgP3RhYj1maWxlcyZmaWxlX2lkPTQ4OTkmbm1tPTFgO1xyXG4gIGNvbnN0IHJhaXNlTWlzc2luZ0Fzc2VtYmxpZXNEaWFsb2cgPSAoKSA9PiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdNaXNzaW5nIHVuc3RyaXBwZWQgYXNzZW1ibGllcycsIHtcclxuICAgICAgYmJjb2RlOiB0KCdWYWxoZWltXFwncyBhc3NlbWJsaWVzIGFyZSBkaXN0cmlidXRlZCBpbiBhbiBcIm9wdGltaXNlZFwiIHN0YXRlIHRvIHJlZHVjZSByZXF1aXJlZCAnXHJcbiAgICAgICsgJ2Rpc2sgc3BhY2UuIFRoaXMgdW5mb3J0dW5hdGVseSBtZWFucyB0aGF0IFZhbGhlaW1cXCdzIG1vZGRpbmcgY2FwYWJpbGl0aWVzIGFyZSBhbHNvIGFmZmVjdGVkLnt7YnJ9fXt7YnJ9fSdcclxuICAgICAgKyAnSW4gb3JkZXIgdG8gbW9kIFZhbGhlaW0sIHRoZSB1bm9wdGltaXNlZC91bnN0cmlwcGVkIGFzc2VtYmxpZXMgYXJlIHJlcXVpcmVkIC0gcGxlYXNlIGRvd25sb2FkIHRoZXNlICdcclxuICAgICAgKyAnZnJvbSBOZXh1cyBNb2RzLnt7YnJ9fXt7YnJ9fSBZb3UgY2FuIGNob29zZSB0aGUgVm9ydGV4L21vZCBtYW5hZ2VyIGRvd25sb2FkIG9yIG1hbnVhbCBkb3dubG9hZCAnXHJcbiAgICAgICsgJyhzaW1wbHkgZHJhZyBhbmQgZHJvcCB0aGUgYXJjaGl2ZSBpbnRvIHRoZSBtb2RzIGRyb3B6b25lIHRvIGFkZCBpdCB0byBWb3J0ZXgpLnt7YnJ9fXt7YnJ9fSdcclxuICAgICAgKyAnVm9ydGV4IHdpbGwgdGhlbiBiZSBhYmxlIHRvIGluc3RhbGwgdGhlIGFzc2VtYmxpZXMgd2hlcmUgdGhleSBhcmUgbmVlZGVkIHRvIGVuYWJsZSAnXHJcbiAgICAgICsgJ21vZGRpbmcsIGxlYXZpbmcgdGhlIG9yaWdpbmFsIG9uZXMgdW50b3VjaGVkLicsIHsgcmVwbGFjZTogeyBicjogJ1ticl1bL2JyXScgfSB9KSxcclxuICAgIH0sIFtcclxuICAgICAgeyBsYWJlbDogJ0NhbmNlbCcsIGFjdGlvbjogKCkgPT4gcmVqZWN0KG5ldyB1dGlsLlVzZXJDYW5jZWxlZCgpKSB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLFxyXG4gICAgICAgIGFjdGlvbjogKCkgPT4gdXRpbC5vcG4odXJsKVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiBudWxsKVxyXG4gICAgICAgICAgLmZpbmFsbHkoKCkgPT4gcmVzb2x2ZSgpKSxcclxuICAgICAgfSxcclxuICAgIF0pO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCByYWlzZUZvcmNlRG93bmxvYWROb3RpZiA9ICgpID0+IGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgIG1lc3NhZ2U6IHQoJ0dhbWUgdXBkYXRlZCAtIFVwZGF0ZWQgYXNzZW1ibGllcyBwYWNrIHJlcXVpcmVkLicpLFxyXG4gICAgdHlwZTogJ2luZm8nLFxyXG4gICAgaWQ6ICdmb3JjZURvd25sb2FkTm90aWYnLFxyXG4gICAgbm9EaXNtaXNzOiB0cnVlLFxyXG4gICAgYWxsb3dTdXBwcmVzczogdHJ1ZSxcclxuICAgIGFjdGlvbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTW9yZScsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4gYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnRG93bmxvYWQgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICAgICAgYmJjb2RlOiB0KCdWYWxoZWltIGhhcyBiZWVuIHVwZGF0ZWQgYW5kIHRvIGJlIGFibGUgdG8gbW9kIHRoZSBnYW1lIHlvdSB3aWxsIG5lZWQgdG8gZW5zdXJlIHlvdSBhcmUgdXNpbmcgdGhlIGxhdGVzdCB1bnN0cmlwcGVkIFVuaXR5IGFzc2VtYmxpZXMgb3IgdGhlIGxhdGVzdCBcIkJlcEluRXggcGFja1wiLiAnXHJcbiAgICAgICAgICAgICAgICAgICsgJ1ZvcnRleCBoYXMgZGV0ZWN0ZWQgdGhhdCB5b3UgaGF2ZSBwcmV2aW91c2x5IGluc3RhbGxlZCB1bnN0cmlwcGVkIFVuaXR5IGFzc2VtYmxpZXMgLyBhIEJlcEluRXggcGFjaywgYnV0IGNhbm5vdCBrbm93IGZvciBzdXJlIHdoZXRoZXIgdGhlc2UgZmlsZXMgYXJlIHVwIHRvIGRhdGUuICdcclxuICAgICAgICAgICAgICAgICAgKyAnSWYgeW91IGFyZSB1bnN1cmUsIFZvcnRleCBjYW4gZG93bmxvYWQgYW5kIGluc3RhbGwgdGhlIGxhdGVzdCByZXF1aXJlZCBmaWxlcyBmb3IgeW91Lnt7bGJ9fSdcclxuICAgICAgICAgICAgICAgICAgKyAnUGxlYXNlIG5vdGUgdGhhdCBhbGwgbW9kcyBtdXN0IGFsc28gYmUgdXBkYXRlZCBpbiBvcmRlciBmb3IgdGhlbSB0byBmdW5jdGlvbiB3aXRoIHRoZSBuZXcgZ2FtZSB2ZXJzaW9uLicsXHJcbiAgICAgICAgICAgICAgICAgIHsgcmVwbGFjZTogeyBsYjogJ1ticl1bL2JyXVticl1bL2JyXScsIGJyOiAnW2JyXVsvYnJdJyB9IH0pLFxyXG4gICAgICAgIH0sIFtcclxuICAgICAgICAgIHsgbGFiZWw6ICdDbG9zZScgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLFxyXG4gICAgICAgICAgICBhY3Rpb246ICgpID0+IHJ1bkRvd25sb2FkZXIoKS5maW5hbGx5KCgpID0+IGRpc21pc3MoKSksXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0pLFxyXG4gICAgICB9LFxyXG4gICAgXSxcclxuICB9KTtcclxuXHJcbiAgY29uc3QgYXNzaWduT3ZlcnJpZGVQYXRoID0gYXN5bmMgKG92ZXJyaWRlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICBjb25zdCBkb29yU3RvcENvbmZpZyA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCwgJ2Rvb3JzdG9wX2NvbmZpZy5pbmknKTtcclxuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBQYXJzZXIobmV3IFdpbmFwaUZvcm1hdCgpKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGluaURhdGE6IEluaUZpbGU8YW55PiA9IGF3YWl0IHBhcnNlci5yZWFkKGRvb3JTdG9wQ29uZmlnKTtcclxuICAgICAgaW5pRGF0YS5kYXRhWydVbml0eURvb3JzdG9wJ11bJ2RsbFNlYXJjaFBhdGhPdmVycmlkZSddID0gb3ZlcnJpZGVQYXRoO1xyXG4gICAgICBhd2FpdCBwYXJzZXIud3JpdGUoZG9vclN0b3BDb25maWcsIGluaURhdGEpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ2ZhaWxlZCB0byBtb2RpZnkgZG9vcnN0b3AgY29uZmlndXJhdGlvbicsIGVycik7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgcnVuRG93bmxvYWRlciA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IGRvd25sb2FkZXIgPSBuZXcgVW5zdHJpcHBlZEFzc2VtYmx5RG93bmxvYWRlcih1dGlsLmdldFZvcnRleFBhdGgoJ3RlbXAnKSk7XHJcbiAgICBjb25zdCBmb2xkZXJOYW1lID0gZ2VuZXJhdGUoKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGlmIChwcm9wcy5wcm9maWxlPy5nYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgICAgICAvLyBUaGlzIGlzIGEgdmFsaWQgc2NlbmFyaW8gd2hlbiB0aGUgdXNlciB0cmllcyB0byBtYW5hZ2UgVmFsaGVpbVxyXG4gICAgICAgIC8vICB3aGVuIHRoZSBhY3RpdmUgZ2FtZU1vZGUgaXMgdW5kZWZpbmVkLlxyXG4gICAgICAgIHRocm93IG5ldyB1dGlsLlByb2Nlc3NDYW5jZWxlZCgnV3JvbmcgZ2FtZW1vZGUnKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBhcmNoaXZlRmlsZVBhdGggPSBhd2FpdCBkb3dubG9hZGVyLmRvd25sb2FkTmV3ZXN0KCdmdWxsX25hbWUnLCAnZGVuaWtzb24tQmVwSW5FeFBhY2tfVmFsaGVpbScpO1xyXG4gICAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHJlYWxseSB2YWxpZGF0ZSB0aGUgZG93bmxvYWQncyBpbnRlZ3JpdHk7IGJ1dCB3ZVxyXG4gICAgICAvLyAgY2FuIGF0IHRoZSB2ZXJ5IGxlYXN0IG1ha2Ugc3VyZSBpdCdzIHRoZXJlIGFuZCBpc24ndCBqdXN0IGFuIGVtcHR5IGFyY2hpdmUuXHJcbiAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhhcmNoaXZlRmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBzZXZlbnppcCA9IG5ldyB1dGlsLlNldmVuWmlwKCk7XHJcbiAgICAgIGNvbnN0IHRlbXBQYXRoID0gcGF0aC5qb2luKHBhdGguZGlybmFtZShhcmNoaXZlRmlsZVBhdGgpLCBmb2xkZXJOYW1lKTtcclxuICAgICAgYXdhaXQgc2V2ZW56aXAuZXh0cmFjdEZ1bGwoYXJjaGl2ZUZpbGVQYXRoLCB0ZW1wUGF0aCk7XHJcbiAgICAgIGNvbnN0IGZpbGVzID0gYXdhaXQgZnMucmVhZGRpckFzeW5jKHRlbXBQYXRoKTtcclxuICAgICAgaWYgKGZpbGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHRocm93IG5ldyB1dGlsLkRhdGFJbnZhbGlkKCdJbnZhbGlkIGFyY2hpdmUnKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gR2l2ZSBpdCBhIHNlY29uZCBmb3IgdGhlIGRvd25sb2FkIHRvIHJlZ2lzdGVyIGluIHRoZSBzdGF0ZS5cclxuICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cclxuICAgICAgICBhcGkuZXZlbnRzLmVtaXQoJ2ltcG9ydC1kb3dubG9hZHMnLCBbIGFyY2hpdmVGaWxlUGF0aCBdLCBhc3luYyAoZGxJZHM6IHN0cmluZ1tdKSA9PiB7XHJcbiAgICAgICAgaWYgKGRsSWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQoJ0ZhaWxlZCB0byBpbXBvcnQgYXJjaGl2ZScpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgZGxJZCBvZiBkbElkcykge1xyXG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlczIsIHJlajIpID0+XHJcbiAgICAgICAgICAgIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtaW5zdGFsbC1kb3dubG9hZCcsIGRsSWQsIHRydWUsIChlcnIsIG1vZElkKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVqMihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldE1vZEVuYWJsZWQocHJvcHMucHJvZmlsZS5pZCwgbW9kSWQsIHRydWUpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlczIodW5kZWZpbmVkKTtcclxuICAgICAgICAgIH0pKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldERlcGxveW1lbnROZWNlc3NhcnkoR0FNRV9JRCwgdHJ1ZSkpO1xyXG4gICAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aCgndW5zdHJpcHBlZF9jb3JsaWInKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgYXdhaXQgcmVtb3ZlRGlyKHRlbXBQYXRoKTtcclxuICAgICAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKHRlbXBQYXRoKS5jYXRjaChlcnIgPT4gZXJyLmNvZGUgPT09ICdFTk9FTlQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgIGxvZygnZXJyb3InLCAnZmFpbGVkIHRvIGNsZWFudXAgdGVtcG9yYXJ5IGZpbGVzJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiByZXNvbHZlKHVuZGVmaW5lZCk7XHJcbiAgICAgIH0pKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHRlbXBQYXRoID0gcGF0aC5qb2luKHV0aWwuZ2V0Vm9ydGV4UGF0aCgndGVtcCcpLCBmb2xkZXJOYW1lKTtcclxuICAgICAgICBhd2FpdCBmcy5zdGF0QXN5bmModGVtcFBhdGgpO1xyXG4gICAgICAgIGF3YWl0IHJlbW92ZURpcih0ZW1wUGF0aCk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycjIpIHtcclxuICAgICAgICBsb2coJ2RlYnVnJywgJ3Vuc3RyaXBwZWQgYXNzZW1ibHkgZG93bmxvYWRlciBjbGVhbnVwIGZhaWxlZCcsIGVycjIpO1xyXG4gICAgICAgIC8vIENsZWFudXAgZmFpbGVkIG9yIGlzIHVubmVjZXNzYXJ5LlxyXG4gICAgICB9XHJcbiAgICAgIGxvZygnZGVidWcnLCAndW5zdHJpcHBlZCBhc3NlbWJseSBkb3dubG9hZGVyIGZhaWxlZCcsIGVycik7XHJcbiAgICAgIHJldHVybiByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nKCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWRzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICBjb25zdCBoYXNDb3JlTGliVHlwZSA9IHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sXHJcbiAgICAgIFsnYXR0cmlidXRlcycsICdDb3JlTGliVHlwZSddLCB1bmRlZmluZWQpICE9PSB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSxcclxuICAgICAgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIGhhc0NvcmVMaWJUeXBlICYmIGlzRW5hYmxlZDtcclxuICB9KTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZHMubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGUgdXNlciBoYXMgc2V2ZXJhbCBpbnN0YWxsZWQsIHNlbGVjdCB0aGUgZmlyc3Qgb25lLlxyXG4gICAgY29uc3QgY29yZUxpYk1vZElkID0gY29yZUxpYk1vZElkc1swXTtcclxuXHJcbiAgICBjb25zdCBwYWNrVHlwZTogUGFja1R5cGUgPSBtb2RzW2NvcmVMaWJNb2RJZF0uYXR0cmlidXRlc1snQ29yZUxpYlR5cGUnXTtcclxuICAgIHN3aXRjaCAocGFja1R5cGUpIHtcclxuICAgICAgY2FzZSAnY29yZV9saWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgnQmVwSW5FeFxcXFxjb3JlX2xpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBjYXNlICd1bnN0cmlwcGVkX2NvcmxpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIG5vcCAtIGxldCB0aGUgZm9yIGxvb3AgYmVsb3cgdHJ5IHRvIGZpbmQgdGhlIHBhY2suXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIFtmdWxsUGFja0NvckxpYk5ldywgZnVsbFBhY2tDb3JMaWJPbGRdKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoZmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBmaWxlUGF0aC5yZXBsYWNlKHByb3BzLmRpc2NvdmVyeS5wYXRoICsgcGF0aC5zZXAsICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHBhdGguc2VwICsgJ21vbm8uc2VjdXJpdHkuZGxsJywgJycpO1xyXG4gICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIC8vIG5vcFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIHZhbGlkIHZhcmlhbnQgb2YgdGhlIHVuc3RyaXBwZWQgYXNzZW1ibHkgbW9kcyBmb3VuZCBvbiBOZXh1cy5cclxuICBjb25zdCB1bnN0cmlwcGVkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycpO1xyXG4gIGlmICh1bnN0cmlwcGVkTW9kcy5sZW5ndGggPiAwKSB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgIGlmICh1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSwgWydtb2RTdGF0ZScsIG1vZElkLCAnZW5hYmxlZCddLCBmYWxzZSkpIHtcclxuICAgICAgICBjb25zdCBkbGlkID0gbW9kc1ttb2RJZF0uYXJjaGl2ZUlkO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkOiB0eXBlcy5JRG93bmxvYWQgPSB1dGlsLmdldFNhZmUoYXBpLmdldFN0YXRlKCksXHJcbiAgICAgICAgICBbJ3BlcnNpc3RlbnQnLCAnZG93bmxvYWRzJywgJ2ZpbGVzJywgZGxpZF0sIHVuZGVmaW5lZCk7XHJcbiAgICAgICAgaWYgKGRvd25sb2FkPy5sb2NhbFBhdGggIT09IHVuZGVmaW5lZCAmJiBndWVzc01vZElkKGRvd25sb2FkLmxvY2FsUGF0aCkgIT09ICcxNScpIHtcclxuICAgICAgICAgIC8vIFRoZSBOZXh1cyBNb2RzIHVuc3RyaXBwZWQgYXNzbWVibGllcyBtb2QgaXMgZW5hYmxlZCAtIGRvbid0IHJhaXNlIHRoZSBtaXNzaW5nXHJcbiAgICAgICAgICAvLyAgYXNzZW1ibGllcyBkaWFsb2cuXHJcbiAgICAgICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBleHBlY3RlZEZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBydW5Eb3dubG9hZGVyKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQpIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJldlByb2ZJZDogc3RyaW5nID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByZXZQcm9mSWQpO1xyXG4gIGNvbnN0IG1vZFR5cGVzOiB7IFt0eXBlSWQ6IHN0cmluZ106IHN0cmluZyB9ID0gc2VsZWN0b3JzLm1vZFBhdGhzRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgY3JlYXRlRGlyZWN0b3JpZXMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZFR5cGUgb2YgT2JqZWN0LmtleXMobW9kVHlwZXMpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhtb2RUeXBlc1ttb2RUeXBlXSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuICByZXR1cm4gbmV3IEJsdWViaXJkPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IGNyZWF0ZURpcmVjdG9yaWVzKClcclxuICAgIC50aGVuKCgpID0+IHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZT8uaWQpKVxyXG4gICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKVxyXG4gICAgLmNhdGNoKGVyciA9PiByZWplY3QoZXJyKSkpXHJcbiAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoeyBhcGk6IGNvbnRleHQuYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kc1BhdGgoZ2FtZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICAgIGlnbm9yZURlcGxveTogW10uY29uY2F0KElHTk9SQUJMRV9GSUxFUywgSUdOT1JBQkxFX0ZJTEVTLm1hcChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSkpLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gIC8vICAgaWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgbmFtZTogJ1ZhbGhlaW06IERlZGljYXRlZCBTZXJ2ZXInLFxyXG4gIC8vICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gIC8vICAgcXVlcnlQYXRoOiAoKSA9PiB1bmRlZmluZWQsXHJcbiAgLy8gICBxdWVyeU1vZFBhdGg6IG1vZHNQYXRoLFxyXG4gIC8vICAgbG9nbzogJ2dhbWVhcnQuanBnJyxcclxuICAvLyAgIGV4ZWN1dGFibGU6ICgpID0+ICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgLy8gICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgLy8gICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgLy8gICAgICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIF0sXHJcbiAgLy8gICBlbnZpcm9ubWVudDoge1xyXG4gIC8vICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAvLyAgIH0sXHJcbiAgLy8gICBkZXRhaWxzOiB7XHJcbiAgLy8gICAgIG5leHVzUGFnZUlkOiBHQU1FX0lELFxyXG4gIC8vICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAvLyAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gIC8vICAgfSxcclxuICAvLyB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCk7XHJcbiAgICByZXR1cm4gKHByb3BzPy5kaXNjb3Zlcnk/LnBhdGggIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBwcm9wcy5kaXNjb3ZlcnkucGF0aCA6ICcuJztcclxuICB9O1xyXG5cclxuICBjb25zdCBpc1N1cHBvcnRlZCA9IChnYW1lSWQ6IHN0cmluZykgPT4gKGdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgY29uc3QgaGFzSW5zdHJ1Y3Rpb24gPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVkOiAoaW5zdDogdHlwZXMuSUluc3RydWN0aW9uKSA9PiBib29sZWFuKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zLmZpbmQoaW5zdHIgPT4gKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIChwcmVkKGluc3RyKSkpICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gIGNvbnN0IGZpbmRJbnN0ck1hdGNoID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1vZD86IChpbnB1dDogc3RyaW5nKSA9PiBzdHJpbmcpID0+IHtcclxuICAgIGlmIChtb2QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBtb2QgPSAoaW5wdXQpID0+IGlucHV0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PlxyXG4gICAgICBtb2QoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpID09PSBwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHZidWlsZERlcFRlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBnYW1lUGF0aCA9IGdldEdhbWVQYXRoKCk7XHJcbiAgICBjb25zdCBidWlsZFNoYXJlQXNzZW1ibHkgPSBwYXRoLmpvaW4oZ2FtZVBhdGgsICdJblNsaW1WTUwnLCAnTW9kcycsICdDUi1CdWlsZFNoYXJlX1ZNTC5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmJ1aWxkLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICdpbnNsaW12bWwtbW9kJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0J1aWxkU2hhcmUgKEFkdmFuY2VkQnVpbGRpbmcpJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNScsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgYnVpbGRTaGFyZUFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21NZXNoZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21NZXNoZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tTWVzaGVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTg0JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21UZXh0dXJlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbVRleHR1cmVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tVGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80OCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYmV0dGVyQ29udGluZW50c1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0JldHRlckNvbnRpbmVudHMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ2JldHRlci1jb250aW5lbnRzLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQmV0dGVyIENvbnRpbmVudHMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80NDYnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8vIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDEwMCwgJ3N0ZWFtY21kJywge30sICdTdGVhbUNNRCBEZWRpY2F0ZWQgU2VydmVyJywgKCkgPT4ge1xyXG4gIC8vICAgY29udGV4dC5hcGkuc2VsZWN0RGlyKHt9KVxyXG4gIC8vICAgICAudGhlbigoc2VsZWN0ZWRQYXRoOiBzdHJpbmcpID0+IHtcclxuICAvLyAgICAgICBpZiAoc2VsZWN0ZWRQYXRoKSB7XHJcbiAgLy8gICAgICAgICBjb25zdCBwcm9wczogSVNDTURQcm9wcyA9IHtcclxuICAvLyAgICAgICAgICAgZ2FtZUlkOiBHQU1FX0lEX1NFUlZFUixcclxuICAvLyAgICAgICAgICAgc3RlYW1BcHBJZDogK1NURUFNX0lELFxyXG4gIC8vICAgICAgICAgICBhcmd1bWVudHM6IFtcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAnZm9yY2VfaW5zdGFsbF9kaXInLCB2YWx1ZTogc2VsZWN0ZWRQYXRoIH0sXHJcbiAgLy8gICAgICAgICAgICAgeyBhcmd1bWVudDogJ3F1aXQnIH0sXHJcbiAgLy8gICAgICAgICAgIF0sXHJcbiAgLy8gICAgICAgICAgIGNhbGxiYWNrOiAoKGVyciwgZGF0YSkgPT4gbnVsbCksXHJcbiAgLy8gICAgICAgICB9O1xyXG4gIC8vICAgICAgICAgY29udGV4dC5hcGkuZXh0LnNjbWRTdGFydERlZGljYXRlZFNlcnZlcihwcm9wcyk7XHJcbiAgLy8gICAgICAgfVxyXG4gIC8vICAgICB9KVxyXG4gIC8vICAgICAuY2F0Y2goZXJyID0+IG51bGwpO1xyXG4gIC8vIH0sICgpID0+IGNvbnRleHQuYXBpLmV4dD8uc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyICE9PSB1bmRlZmluZWQpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyQWN0aW9uKCdtb2QtaWNvbnMnLCAxMTUsICdpbXBvcnQnLCB7fSwgJ0ltcG9ydCBGcm9tIHIybW9kbWFuJywgKCkgPT4ge1xyXG4gICAgbWlncmF0ZVIyVG9Wb3J0ZXgoY29udGV4dC5hcGkpO1xyXG4gIH0sICgpID0+IHtcclxuICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgIGNvbnN0IGFjdGl2ZUdhbWVJZCA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoc3RhdGUpO1xyXG4gICAgcmV0dXJuIHVzZXJIYXNSMkluc3RhbGxlZCgpXHJcbiAgICAgICYmIChnZXRHYW1lUGF0aCgpICE9PSAnLicpXHJcbiAgICAgICYmIChhY3RpdmVHYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBkZXBlbmRlbmN5VGVzdHMgPSBbIHZidWlsZERlcFRlc3QsIGN1c3RvbU1lc2hlc1Rlc3QsXHJcbiAgICBjdXN0b21UZXh0dXJlc1Rlc3QsIGJldHRlckNvbnRpbmVudHNUZXN0IF07XHJcblxyXG4gIGZvciAoY29uc3QgdGVzdEZ1bmMgb2YgZGVwZW5kZW5jeVRlc3RzKSB7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB0ZXN0RnVuYyk7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdtb2QtaW5zdGFsbGVkJywgdGVzdEZ1bmMpO1xyXG4gIH1cclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ211bHRpcGxlLWxpYi1tb2RzJywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnbW9kLWluc3RhbGxlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1iZXR0ZXItY29udGluZW50cycsIDIwLCB0ZXN0QmV0dGVyQ29udCwgaW5zdGFsbEJldHRlckNvbnQpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNChjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNihjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwOShjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ3ZvcnRleC13b3JsZHMnKSxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc0JDRXh0ID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNCQ0V4dCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXR0ZXIgQ29udGluZW50cyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0Lm9uY2UoKCkgPT4ge1xyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnd2lsbC1kZXBsb3knLCBhc3luYyAocHJvZmlsZUlkKSA9PiB7XHJcbiAgICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICAgICAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlSWQpXHJcbiAgICAgICAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoZ2VuUHJvcHMoY29udGV4dCwgcHJvZmlsZUlkKSkpXHJcbiAgICAgICAgLmNhdGNoKGVyciA9PiBlcnIgaW5zdGFuY2VvZiB1dGlsLlVzZXJDYW5jZWxlZFxyXG4gICAgICAgICAgPyBQcm9taXNlLnJlc29sdmUoKVxyXG4gICAgICAgICAgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnRleHQuYXBpLm9uQXN5bmMoJ2RpZC1wdXJnZScsIGFzeW5jIChwcm9maWxlSWQpID0+XHJcbiAgICAgIHBheWxvYWREZXBsb3llci5vbkRpZFB1cmdlKGNvbnRleHQsIHByb2ZpbGVJZCkpO1xyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbWFpbjtcclxuIl19