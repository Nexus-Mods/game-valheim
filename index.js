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
            const downloader = new unstrippedAssembly_1.UnstrippedAssemblyDownloader(vortex_api_1.util.getVortexPath('temp'));
            try {
                const archiveFilePath = yield downloader.downloadNewest('full_name', 'denikson-BepInExPack_Valheim');
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
                    return resolve(undefined);
                })));
            }
            catch (err) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBc0U7QUFDdEUscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCw2REFBb0U7QUFFcEUscUNBSWtCO0FBQ2xCLDZDQUVtQztBQUNuQyw2Q0FBOEU7QUFDOUUsbUNBQW1FO0FBRW5FLHlDQUFtRTtBQUVuRSxNQUFNLEdBQUcsR0FBRyxpQkFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGNBQUssQ0FBQztBQUV0RCxNQUFNLGFBQWEsR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDeEQsU0FBUyxTQUFTLENBQUMsS0FBSztJQUN0QixPQUFPLE9BQU8sR0FBRyxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLFFBQVE7SUFDZixPQUFPLGlCQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLGlCQUFRLENBQUMsQ0FBQztTQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsUUFBUTtJQUNoQyxPQUFPLGVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1NBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUN6RixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUNoQixRQUFRLEVBQUUsT0FBTztZQUNqQixPQUFPLEVBQUU7Z0JBQ1AsS0FBSyxFQUFFLGlCQUFRO2dCQUNmLFVBQVUsRUFBRSxDQUFDLGVBQWUsQ0FBQztnQkFDN0IsVUFBVSxFQUFFLFdBQVc7YUFDeEI7U0FDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDOUIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLENBQUM7QUFFRCxTQUFlLDBCQUEwQixDQUFDLEtBQWE7O1FBQ3JELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUM7UUFDdEIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztRQUN4QixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQ3JELG9CQUFvQixFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDN0MsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUN0RCxTQUFTLEVBQUUsVUFBVSxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDOUMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUN0RCxtQkFBbUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRTVDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsK0JBQStCLENBQUM7UUFDMUYsTUFBTSw0QkFBNEIsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUMvRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSwrQkFBK0IsRUFBRTtnQkFDdEQsTUFBTSxFQUFFLENBQUMsQ0FBQyxtRkFBbUY7c0JBQzNGLDBHQUEwRztzQkFDMUcsc0dBQXNHO3NCQUN0RyxpR0FBaUc7c0JBQ2pHLDRGQUE0RjtzQkFDNUYscUZBQXFGO3NCQUNyRiwrQ0FBK0MsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDO2FBQ3JGLEVBQUU7Z0JBQ0QsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUU7Z0JBQ2xFO29CQUNFLEtBQUssRUFBRSxnQ0FBZ0M7b0JBQ3ZDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxpQkFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUM7eUJBQ3hCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQzt5QkFDbEIsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO2lCQUM1QjthQUNGLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7WUFDekQsT0FBTyxFQUFFLENBQUMsQ0FBQyxrREFBa0QsQ0FBQztZQUM5RCxJQUFJLEVBQUUsTUFBTTtZQUNaLEVBQUUsRUFBRSxvQkFBb0I7WUFDeEIsU0FBUyxFQUFFLElBQUk7WUFDZixhQUFhLEVBQUUsSUFBSTtZQUNuQixPQUFPLEVBQUU7Z0JBQ1A7b0JBQ0UsS0FBSyxFQUFFLE1BQU07b0JBQ2IsTUFBTSxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxnQ0FBZ0MsRUFBRTt3QkFDNUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxxS0FBcUs7OEJBQ3JLLG9LQUFvSzs4QkFDcEssNkZBQTZGOzhCQUM3Rix5R0FBeUcsRUFDM0csRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxFQUFFLENBQUM7cUJBQ3BFLEVBQUU7d0JBQ0QsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO3dCQUNsQjs0QkFDRSxLQUFLLEVBQUUsZ0NBQWdDOzRCQUN2QyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO3lCQUN2RDtxQkFDRixDQUFDO2lCQUNIO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLENBQU8sWUFBb0IsRUFBRSxFQUFFO1lBQ3hELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUM5RSxNQUFNLE1BQU0sR0FBRyxJQUFJLDBCQUFNLENBQUMsSUFBSSwrQkFBWSxFQUFFLENBQUMsQ0FBQztZQUM5QyxJQUFJO2dCQUNGLE1BQU0sT0FBTyxHQUFpQixNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2hFLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsdUJBQXVCLENBQUMsR0FBRyxZQUFZLENBQUM7Z0JBQ3RFLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDN0M7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixHQUFHLENBQUMscUJBQXFCLENBQUMseUNBQXlDLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDM0U7UUFDSCxDQUFDLENBQUEsQ0FBQztRQUVGLE1BQU0sYUFBYSxHQUFHLEdBQVMsRUFBRTtZQUMvQixNQUFNLFVBQVUsR0FBRyxJQUFJLGlEQUE0QixDQUFDLGlCQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDaEYsSUFBSTtnQkFDRixNQUFNLGVBQWUsR0FBRyxNQUFNLFVBQVUsQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLDhCQUE4QixDQUFDLENBQUM7Z0JBRXJHLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FDcEMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBRSxlQUFlLENBQUUsRUFBRSxDQUFPLEtBQWUsRUFBRSxFQUFFO29CQUNuRixJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO3dCQUN0QixPQUFPLE1BQU0sQ0FBQyxJQUFJLGlCQUFJLENBQUMsZUFBZSxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztxQkFDckU7b0JBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7d0JBQ3hCLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FDL0IsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsRUFBRTs0QkFDckUsSUFBSSxHQUFHLEVBQUU7Z0NBQ1AsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7NkJBQ2xCOzRCQUNELEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFPLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUN6RSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDekIsQ0FBQyxDQUFDLENBQUMsQ0FBQztxQkFDTDtvQkFFRCxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxvQkFBTyxDQUFDLHNCQUFzQixDQUFDLGdCQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDbEUsTUFBTSxrQkFBa0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO29CQUM5QyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDNUIsQ0FBQyxDQUFBLENBQUMsQ0FBQyxDQUFDO2FBQ0w7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixPQUFPLDRCQUE0QixFQUFFLENBQUM7YUFDdkM7UUFDSCxDQUFDLENBQUEsQ0FBQztRQUVGLE1BQU0sSUFBSSxHQUNSLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRSxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNuRCxNQUFNLGNBQWMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQzNDLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLFNBQVMsQ0FBQztZQUMxRCxNQUFNLFNBQVMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUMxQyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FBTyxjQUFjLElBQUksU0FBUyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUU1QixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEMsTUFBTSxRQUFRLEdBQWEsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUN4RSxRQUFRLFFBQVEsRUFBRTtnQkFDaEIsS0FBSyxVQUFVO29CQUNiLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ3hDLHVCQUF1QixFQUFFLENBQUM7b0JBQzFCLE9BQU87Z0JBQ1QsS0FBSyxtQkFBbUI7b0JBQ3RCLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ3hDLHVCQUF1QixFQUFFLENBQUM7b0JBQzFCLE9BQU87Z0JBQ1QsUUFBUTthQUVUO1NBQ0Y7UUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLENBQUMsRUFBRTtZQUM3RCxJQUFJO2dCQUNGLE1BQU0sZUFBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztxQkFDNUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzdFLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQzFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQzFCLE9BQU87YUFDUjtZQUFDLE9BQU8sR0FBRyxFQUFFO2FBRWI7U0FDRjtRQUdELE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQUMsT0FBQSxPQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsMENBQUUsSUFBSSxNQUFLLHVCQUF1QixDQUFBLEVBQUEsQ0FBQyxDQUFDO1FBQ2xHLElBQUksY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDN0IsS0FBSyxNQUFNLEtBQUssSUFBSSxjQUFjLEVBQUU7Z0JBQ2xDLElBQUksaUJBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLEVBQUU7b0JBQ3RFLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUM7b0JBQ25DLE1BQU0sUUFBUSxHQUFvQixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQzNELENBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ3pELElBQUksQ0FBQSxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUUsU0FBUyxNQUFLLFNBQVMsSUFBSSxtQkFBVSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxJQUFJLEVBQUU7d0JBR2hGLE1BQU0sZUFBZSxHQUFHLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQzs2QkFDbEQsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQy9FLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxDQUFDLENBQUM7d0JBQzFDLE9BQU87cUJBQ1I7aUJBQ0Y7YUFDRjtTQUNGO1FBRUQsT0FBTyxhQUFhLEVBQUUsQ0FBQztJQUN6QixDQUFDO0NBQUE7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE9BQWdDLEVBQUUsU0FBaUM7SUFDNUYsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNyQyxNQUFNLFVBQVUsR0FBVyxzQkFBUyxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSxnQkFBTyxDQUFDLENBQUM7SUFDOUUsTUFBTSxPQUFPLEdBQW1CLHNCQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN6RSxNQUFNLFFBQVEsR0FBaUMsc0JBQVMsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLGdCQUFPLENBQUMsQ0FBQztJQUN6RixNQUFNLGlCQUFpQixHQUFHLEdBQVMsRUFBRTtRQUNuQyxLQUFLLE1BQU0sT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDM0MsSUFBSTtnQkFDRixNQUFNLGVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNwRDtZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM1QjtTQUNGO0lBQ0gsQ0FBQyxDQUFBLENBQUM7SUFDRixPQUFPLElBQUksa0JBQVEsQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixFQUFFO1NBQy9ELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsRUFBRSxDQUFDLENBQUM7U0FDOUQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ3JCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQzVCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzNGLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxRQUFnQjtJQUNoQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQsU0FBUyxJQUFJLENBQUMsT0FBZ0M7SUFDNUMsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUNuQixFQUFFLEVBQUUsZ0JBQU87UUFDWCxJQUFJLEVBQUUsU0FBUztRQUNmLFNBQVMsRUFBRSxJQUFJO1FBQ2YsU0FBUyxFQUFFLFFBQVE7UUFDbkIsWUFBWSxFQUFFLFFBQVE7UUFDdEIsSUFBSSxFQUFFLGFBQWE7UUFDbkIsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLGFBQWE7UUFDL0IsZ0JBQWdCO1FBQ2hCLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7UUFDekQsYUFBYSxFQUFFO1lBQ2IsYUFBYTtTQUNkO1FBQ0QsV0FBVyxFQUFFO1lBQ1gsVUFBVSxFQUFFLGlCQUFRO1NBQ3JCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFLENBQUMsaUJBQVE7WUFDckIsWUFBWSxFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQzFDLGVBQWUsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLHdCQUFlLEVBQUUsd0JBQWUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUM1RixZQUFZLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyx3QkFBZSxFQUFFLHdCQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7U0FDMUY7S0FDRixDQUFDLENBQUM7SUEyQkgsTUFBTSxXQUFXLEdBQUcsR0FBRyxFQUFFOztRQUN2QixNQUFNLEtBQUssR0FBVyxpQkFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hDLE9BQU8sQ0FBQyxPQUFBLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxTQUFTLDBDQUFFLElBQUksTUFBSyxTQUFTLENBQUM7WUFDM0MsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDakMsQ0FBQyxDQUFDO0lBRUYsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFjLEVBQUUsRUFBRSxDQUFDLENBQUMsTUFBTSxLQUFLLGdCQUFPLENBQUMsQ0FBQztJQUM3RCxNQUFNLGNBQWMsR0FBRyxDQUFDLFlBQWtDLEVBQ2xDLElBQTJDLEVBQUUsRUFBRSxDQUM3QyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQztXQUN2QixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDO0lBRWxGLE1BQU0sY0FBYyxHQUFHLENBQUMsWUFBa0MsRUFDbEMsT0FBZSxFQUNmLEdBQStCLEVBQUUsRUFBRTtRQUN6RCxJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUU7WUFDckIsR0FBRyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUM7U0FDeEI7UUFDRCxPQUFPLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUM1QyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsRUFBRSxLQUFLLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELENBQUMsQ0FBQztJQUVGLE1BQU0sYUFBYSxHQUFHLEdBQUcsRUFBRTtRQUN6QixNQUFNLFFBQVEsR0FBRyxXQUFXLEVBQUUsQ0FBQztRQUMvQixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztRQUM3RixPQUFPLDRCQUFvQixDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7WUFDdkMsZ0JBQWdCLEVBQUUsWUFBWTtZQUM5QixhQUFhLEVBQUUsZUFBZTtZQUM5QixVQUFVLEVBQUUsK0JBQStCO1lBQzNDLFNBQVMsRUFBRSwwQ0FBMEM7WUFDckQsYUFBYSxFQUFFLENBQUUsa0JBQWtCLENBQUU7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLEVBQUU7UUFDNUIsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDekMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sNEJBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUN2QyxnQkFBZ0IsRUFBRSx1QkFBdUI7WUFDekMsYUFBYSxFQUFFLEVBQUU7WUFDakIsVUFBVSxFQUFFLGNBQWM7WUFDMUIsU0FBUyxFQUFFLDRDQUE0QztZQUN2RCxhQUFhLEVBQUUsQ0FBRSxnQkFBZ0IsQ0FBRTtTQUNwQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLGtCQUFrQixHQUFHLEdBQUcsRUFBRTtRQUM5QixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUN6QyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLG9CQUFvQixDQUFDLENBQUM7UUFDbkUsT0FBTyw0QkFBb0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ3ZDLGdCQUFnQixFQUFFLHlCQUF5QjtZQUMzQyxhQUFhLEVBQUUsRUFBRTtZQUNqQixVQUFVLEVBQUUsZ0JBQWdCO1lBQzVCLFNBQVMsRUFBRSwyQ0FBMkM7WUFDdEQsYUFBYSxFQUFFLENBQUUsZ0JBQWdCLENBQUU7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLEVBQUU7UUFDaEMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7UUFDekMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3JFLE9BQU8sNEJBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUN2QyxnQkFBZ0IsRUFBRSx1QkFBdUI7WUFDekMsYUFBYSxFQUFFLEVBQUU7WUFDakIsVUFBVSxFQUFFLG1CQUFtQjtZQUMvQixTQUFTLEVBQUUsNENBQTRDO1lBQ3ZELGFBQWEsRUFBRSxDQUFFLGdCQUFnQixDQUFFO1NBQ3BDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQztJQXFCRixPQUFPLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7UUFDbEYsNEJBQWlCLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pDLENBQUMsRUFBRSxHQUFHLEVBQUU7UUFDTixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sWUFBWSxHQUFHLHNCQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25ELE9BQU8sNkJBQWtCLEVBQUU7ZUFDdEIsQ0FBQyxXQUFXLEVBQUUsS0FBSyxHQUFHLENBQUM7ZUFDdkIsQ0FBQyxZQUFZLEtBQUssZ0JBQU8sQ0FBQyxDQUFDO0lBQ2xDLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxlQUFlLEdBQUcsQ0FBRSxhQUFhLEVBQUUsZ0JBQWdCO1FBQ3ZELGtCQUFrQixFQUFFLG9CQUFvQixDQUFFLENBQUM7SUFFN0MsS0FBSyxNQUFNLFFBQVEsSUFBSSxlQUFlLEVBQUU7UUFDdEMsT0FBTyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLG9CQUFvQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQy9FLE9BQU8sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7S0FDM0U7SUFFRCxPQUFPLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFLG9CQUFvQixFQUM1RCxHQUFHLEVBQUUsQ0FBQywwQkFBa0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN6QyxPQUFPLENBQUMsWUFBWSxDQUFDLG1CQUFtQixFQUFFLGVBQWUsRUFDdkQsR0FBRyxFQUFFLENBQUMsMEJBQWtCLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFekMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLDJCQUEyQixFQUFFLEVBQUUsRUFBRSwyQkFBYyxFQUFFLDhCQUFpQixDQUFDLENBQUM7SUFDOUYsT0FBTyxDQUFDLGlCQUFpQixDQUFDLHNCQUFzQixFQUFFLEVBQUUsRUFBRSw0QkFBZSxFQUFFLCtCQUFrQixDQUFDLENBQUM7SUFDM0YsT0FBTyxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBRSxnQ0FBbUIsRUFBRSxtQ0FBc0IsQ0FBQyxDQUFDO0lBQy9GLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLEVBQUUsdUJBQVUsRUFBRSw2QkFBZ0IsQ0FBQyxDQUFDO0lBQzlFLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLEVBQUUseUJBQVksRUFBRSw0QkFBZSxDQUFDLENBQUM7SUFFdEYsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsVUFBa0IsRUFBRSxFQUFFLENBQUMsdUJBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDdkYsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsVUFBa0IsRUFBRSxFQUFFLENBQUMsdUJBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDdkYsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsVUFBa0IsRUFBRSxFQUFFLENBQUMsdUJBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDdkYsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsVUFBa0IsRUFBRSxFQUFFLENBQUMsdUJBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFdkYsT0FBTyxDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFDMUUsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSw2QkFBb0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDcEYsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUM7SUFFdkMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFDdEQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFLMUYsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDO1FBQzdCLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUM5RCxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQy9DLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDUCxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLHVCQUF1QixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUM7ZUFDL0UsY0FBYyxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDbkQsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBRWhDLE9BQU8sQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxRQUFRLENBQUMsRUFDaEgsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxtQkFBVSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRSxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUVqQyxPQUFPLENBQUMsZUFBZSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQzlELEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsY0FBYyxDQUFDLEVBQ3hELENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDO2VBQ2hFLGNBQWMsQ0FBQyxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDekQsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7SUFFbkMsT0FBTyxDQUFDLGVBQWUsQ0FBQyx5QkFBeUIsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUNoRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLEVBQzFELENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sVUFBVSxHQUFXLElBQUksTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDMUQsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLEtBQUssTUFBTSxLQUFLLElBQUksWUFBWSxFQUFFO1lBQ2hDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQzttQkFDdEIsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFO2dCQUM3RCxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixNQUFNO2FBQ1Q7U0FDRjtRQUNELE9BQU8sa0JBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNyRCxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO0lBRXJDLE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQzNFLENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNuRSxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUMzQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM1RCxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztJQUV4QyxPQUFPLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFDdEcsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFnQixFQUFFLEVBQUU7WUFDbkMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUMsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLEVBQUU7Z0JBQ2hDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDM0IsT0FBTyxJQUFJLENBQUM7aUJBQ2I7YUFDRjtZQUNELE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQyxDQUFDO1FBQ0YsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ2pGLE9BQU8sa0JBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuRCxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO0lBRW5DLE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFDOUQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxlQUFlLENBQUMsRUFDL0MsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSx3QkFBZSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3RSxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQztJQUV4QyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBTyxTQUFTLEVBQUUsRUFBRTtZQUNyRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sT0FBTyxHQUFHLHNCQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLE1BQU0sTUFBSyxnQkFBTyxFQUFFO2dCQUMvQixPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUMxQjtZQUNELE9BQU8sZUFBZSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDO2lCQUNwRCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsMEJBQTBCLENBQUMsaUJBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztpQkFDcEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLGlCQUFJLENBQUMsWUFBWTtnQkFDNUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7Z0JBQ25CLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0IsQ0FBQyxDQUFBLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFPLFNBQVMsRUFBRSxFQUFFLGdEQUNuRCxPQUFBLGVBQWUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFBLEdBQUEsQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsa0JBQWUsSUFBSSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcclxuaW1wb3J0IHsgYXBwIGFzIGFwcEluLCByZW1vdGUgfSBmcm9tICdlbGVjdHJvbic7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGFjdGlvbnMsIGZzLCBsb2csIHNlbGVjdG9ycywgdHlwZXMsIHV0aWwgfSBmcm9tICd2b3J0ZXgtYXBpJztcclxuaW1wb3J0IFBhcnNlciwgeyBJbmlGaWxlLCBXaW5hcGlGb3JtYXQgfSBmcm9tICd2b3J0ZXgtcGFyc2UtaW5pJztcclxuaW1wb3J0ICogYXMgcGF5bG9hZERlcGxveWVyIGZyb20gJy4vcGF5bG9hZERlcGxveWVyJztcclxuXHJcbmltcG9ydCB7IFVuc3RyaXBwZWRBc3NlbWJseURvd25sb2FkZXIgfSBmcm9tICcuL3Vuc3RyaXBwZWRBc3NlbWJseSc7XHJcblxyXG5pbXBvcnQge1xyXG4gIEJFVFRFUl9DT05UX0VYVCwgRkJYX0VYVCwgR0FNRV9JRCwgR0FNRV9JRF9TRVJWRVIsXHJcbiAgZ2VuUHJvcHMsIGd1ZXNzTW9kSWQsIElHTk9SQUJMRV9GSUxFUywgSU5TTElNVk1MX0lERU5USUZJRVIsXHJcbiAgSVByb3BzLCBJU0NNRFByb3BzLCBORVhVUywgT0JKX0VYVCwgUGFja1R5cGUsIFNURUFNX0lELCBWQlVJTERfRVhULFxyXG59IGZyb20gJy4vY29tbW9uJztcclxuaW1wb3J0IHsgaW5zdGFsbEJldHRlckNvbnQsIGluc3RhbGxDb3JlUmVtb3ZlciwgaW5zdGFsbEZ1bGxQYWNrLCBpbnN0YWxsSW5TbGltTW9kTG9hZGVyLFxyXG4gIGluc3RhbGxWQnVpbGRNb2QsIHRlc3RCZXR0ZXJDb250LCB0ZXN0Q29yZVJlbW92ZXIsIHRlc3RGdWxsUGFjaywgdGVzdEluU2xpbU1vZExvYWRlcixcclxuICB0ZXN0VkJ1aWxkIH0gZnJvbSAnLi9pbnN0YWxsZXJzJztcclxuaW1wb3J0IHsgbWlncmF0ZTEwMywgbWlncmF0ZTEwNCwgbWlncmF0ZTEwNiwgbWlncmF0ZTEwOSB9IGZyb20gJy4vbWlncmF0aW9ucyc7XHJcbmltcG9ydCB7IGhhc011bHRpcGxlTGliTW9kcywgaXNEZXBlbmRlbmN5UmVxdWlyZWQgfSBmcm9tICcuL3Rlc3RzJztcclxuXHJcbmltcG9ydCB7IG1pZ3JhdGVSMlRvVm9ydGV4LCB1c2VySGFzUjJJbnN0YWxsZWQgfSBmcm9tICcuL3IyVm9ydGV4JztcclxuXHJcbmNvbnN0IGFwcCA9IHJlbW90ZSAhPT0gdW5kZWZpbmVkID8gcmVtb3RlLmFwcCA6IGFwcEluO1xyXG5cclxuY29uc3QgU1RPUF9QQVRURVJOUyA9IFsnY29uZmlnJywgJ3BsdWdpbnMnLCAncGF0Y2hlcnMnXTtcclxuZnVuY3Rpb24gdG9Xb3JkRXhwKGlucHV0KSB7XHJcbiAgcmV0dXJuICcoXnwvKScgKyBpbnB1dCArICcoL3wkKSc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRHYW1lKCk6IGFueSB7XHJcbiAgcmV0dXJuIHV0aWwuR2FtZVN0b3JlSGVscGVyLmZpbmRCeUFwcElkKFtTVEVBTV9JRF0pXHJcbiAgICAudGhlbihnYW1lID0+IGdhbWUuZ2FtZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXF1aXJlc0xhdW5jaGVyKGdhbWVQYXRoKSB7XHJcbiAgcmV0dXJuIGZzLnJlYWRkaXJBc3luYyhnYW1lUGF0aClcclxuICAgIC50aGVuKGZpbGVzID0+IChmaWxlcy5maW5kKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpID09PSAnc3RlYW1fYXBwaWQudHh0JykgIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBQcm9taXNlLnJlc29sdmUoe1xyXG4gICAgICAgIGxhdW5jaGVyOiAnc3RlYW0nLFxyXG4gICAgICAgIGFkZEluZm86IHtcclxuICAgICAgICAgIGFwcElkOiBTVEVBTV9JRCxcclxuICAgICAgICAgIHBhcmFtZXRlcnM6IFsnLWZvcmNlLWdsY29yZSddLFxyXG4gICAgICAgICAgbGF1bmNoVHlwZTogJ2dhbWVzdG9yZScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSlcclxuICAgICAgOiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKSlcclxuICAgIC5jYXRjaChlcnIgPT4gUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKHByb3BzOiBJUHJvcHMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCBhcGkgPSBwcm9wcy5hcGk7XHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcbiAgY29uc3QgZXhwZWN0ZWRGaWxlUGF0aCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX21hbmFnZWQnLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk9sZCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICdCZXBJbkV4JywgJ2NvcmVfbGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJOZXcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9jb3JsaWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuXHJcbiAgY29uc3QgdXJsID0gcGF0aC5qb2luKE5FWFVTLCAndmFsaGVpbScsICdtb2RzJywgJzEyMDInKSArIGA/dGFiPWZpbGVzJmZpbGVfaWQ9NDg5OSZubW09MWA7XHJcbiAgY29uc3QgcmFpc2VNaXNzaW5nQXNzZW1ibGllc0RpYWxvZyA9ICgpID0+IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ01pc3NpbmcgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW1cXCdzIGFzc2VtYmxpZXMgYXJlIGRpc3RyaWJ1dGVkIGluIGFuIFwib3B0aW1pc2VkXCIgc3RhdGUgdG8gcmVkdWNlIHJlcXVpcmVkICdcclxuICAgICAgKyAnZGlzayBzcGFjZS4gVGhpcyB1bmZvcnR1bmF0ZWx5IG1lYW5zIHRoYXQgVmFsaGVpbVxcJ3MgbW9kZGluZyBjYXBhYmlsaXRpZXMgYXJlIGFsc28gYWZmZWN0ZWQue3ticn19e3ticn19J1xyXG4gICAgICArICdJbiBvcmRlciB0byBtb2QgVmFsaGVpbSwgdGhlIHVub3B0aW1pc2VkL3Vuc3RyaXBwZWQgYXNzZW1ibGllcyBhcmUgcmVxdWlyZWQgLSBwbGVhc2UgZG93bmxvYWQgdGhlc2UgJ1xyXG4gICAgICArICdmcm9tIE5leHVzIE1vZHMue3ticn19e3ticn19IFlvdSBjYW4gY2hvb3NlIHRoZSBWb3J0ZXgvbW9kIG1hbmFnZXIgZG93bmxvYWQgb3IgbWFudWFsIGRvd25sb2FkICdcclxuICAgICAgKyAnKHNpbXBseSBkcmFnIGFuZCBkcm9wIHRoZSBhcmNoaXZlIGludG8gdGhlIG1vZHMgZHJvcHpvbmUgdG8gYWRkIGl0IHRvIFZvcnRleCkue3ticn19e3ticn19J1xyXG4gICAgICArICdWb3J0ZXggd2lsbCB0aGVuIGJlIGFibGUgdG8gaW5zdGFsbCB0aGUgYXNzZW1ibGllcyB3aGVyZSB0aGV5IGFyZSBuZWVkZWQgdG8gZW5hYmxlICdcclxuICAgICAgKyAnbW9kZGluZywgbGVhdmluZyB0aGUgb3JpZ2luYWwgb25lcyB1bnRvdWNoZWQuJywgeyByZXBsYWNlOiB7IGJyOiAnW2JyXVsvYnJdJyB9IH0pLFxyXG4gICAgfSwgW1xyXG4gICAgICB7IGxhYmVsOiAnQ2FuY2VsJywgYWN0aW9uOiAoKSA9PiByZWplY3QobmV3IHV0aWwuVXNlckNhbmNlbGVkKCkpIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB1dGlsLm9wbih1cmwpXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IG51bGwpXHJcbiAgICAgICAgICAuZmluYWxseSgoKSA9PiByZXNvbHZlKCkpLFxyXG4gICAgICB9LFxyXG4gICAgXSk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmID0gKCkgPT4gYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgbWVzc2FnZTogdCgnR2FtZSB1cGRhdGVkIC0gVXBkYXRlZCBhc3NlbWJsaWVzIHBhY2sgcmVxdWlyZWQuJyksXHJcbiAgICB0eXBlOiAnaW5mbycsXHJcbiAgICBpZDogJ2ZvcmNlRG93bmxvYWROb3RpZicsXHJcbiAgICBub0Rpc21pc3M6IHRydWUsXHJcbiAgICBhbGxvd1N1cHByZXNzOiB0cnVlLFxyXG4gICAgYWN0aW9uczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdGl0bGU6ICdNb3JlJyxcclxuICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdEb3dubG9hZCB1bnN0cmlwcGVkIGFzc2VtYmxpZXMnLCB7XHJcbiAgICAgICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW0gaGFzIGJlZW4gdXBkYXRlZCBhbmQgdG8gYmUgYWJsZSB0byBtb2QgdGhlIGdhbWUgeW91IHdpbGwgbmVlZCB0byBlbnN1cmUgeW91IGFyZSB1c2luZyB0aGUgbGF0ZXN0IHVuc3RyaXBwZWQgVW5pdHkgYXNzZW1ibGllcyBvciB0aGUgbGF0ZXN0IFwiQmVwSW5FeCBwYWNrXCIuICdcclxuICAgICAgICAgICAgICAgICAgKyAnVm9ydGV4IGhhcyBkZXRlY3RlZCB0aGF0IHlvdSBoYXZlIHByZXZpb3VzbHkgaW5zdGFsbGVkIHVuc3RyaXBwZWQgVW5pdHkgYXNzZW1ibGllcyAvIGEgQmVwSW5FeCBwYWNrLCBidXQgY2Fubm90IGtub3cgZm9yIHN1cmUgd2hldGhlciB0aGVzZSBmaWxlcyBhcmUgdXAgdG8gZGF0ZS4gJ1xyXG4gICAgICAgICAgICAgICAgICArICdJZiB5b3UgYXJlIHVuc3VyZSwgVm9ydGV4IGNhbiBkb3dubG9hZCBhbmQgaW5zdGFsbCB0aGUgbGF0ZXN0IHJlcXVpcmVkIGZpbGVzIGZvciB5b3Uue3tsYn19J1xyXG4gICAgICAgICAgICAgICAgICArICdQbGVhc2Ugbm90ZSB0aGF0IGFsbCBtb2RzIG11c3QgYWxzbyBiZSB1cGRhdGVkIGluIG9yZGVyIGZvciB0aGVtIHRvIGZ1bmN0aW9uIHdpdGggdGhlIG5ldyBnYW1lIHZlcnNpb24uJyxcclxuICAgICAgICAgICAgICAgICAgeyByZXBsYWNlOiB7IGxiOiAnW2JyXVsvYnJdW2JyXVsvYnJdJywgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICAgICAgfSwgW1xyXG4gICAgICAgICAgeyBsYWJlbDogJ0Nsb3NlJyB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgICAgIGFjdGlvbjogKCkgPT4gcnVuRG93bmxvYWRlcigpLmZpbmFsbHkoKCkgPT4gZGlzbWlzcygpKSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSksXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBhc3NpZ25PdmVycmlkZVBhdGggPSBhc3luYyAob3ZlcnJpZGVQYXRoOiBzdHJpbmcpID0+IHtcclxuICAgIGNvbnN0IGRvb3JTdG9wQ29uZmlnID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLCAnZG9vcnN0b3BfY29uZmlnLmluaScpO1xyXG4gICAgY29uc3QgcGFyc2VyID0gbmV3IFBhcnNlcihuZXcgV2luYXBpRm9ybWF0KCkpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaW5pRGF0YTogSW5pRmlsZTxhbnk+ID0gYXdhaXQgcGFyc2VyLnJlYWQoZG9vclN0b3BDb25maWcpO1xyXG4gICAgICBpbmlEYXRhLmRhdGFbJ1VuaXR5RG9vcnN0b3AnXVsnZGxsU2VhcmNoUGF0aE92ZXJyaWRlJ10gPSBvdmVycmlkZVBhdGg7XHJcbiAgICAgIGF3YWl0IHBhcnNlci53cml0ZShkb29yU3RvcENvbmZpZywgaW5pRGF0YSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignZmFpbGVkIHRvIG1vZGlmeSBkb29yc3RvcCBjb25maWd1cmF0aW9uJywgZXJyKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBydW5Eb3dubG9hZGVyID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3QgZG93bmxvYWRlciA9IG5ldyBVbnN0cmlwcGVkQXNzZW1ibHlEb3dubG9hZGVyKHV0aWwuZ2V0Vm9ydGV4UGF0aCgndGVtcCcpKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGFyY2hpdmVGaWxlUGF0aCA9IGF3YWl0IGRvd25sb2FkZXIuZG93bmxvYWROZXdlc3QoJ2Z1bGxfbmFtZScsICdkZW5pa3Nvbi1CZXBJbkV4UGFja19WYWxoZWltJyk7XHJcbiAgICAgIC8vIEdpdmUgaXQgYSBzZWNvbmQgZm9yIHRoZSBkb3dubG9hZCB0byByZWdpc3RlciBpbiB0aGUgc3RhdGUuXHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XHJcbiAgICAgICAgYXBpLmV2ZW50cy5lbWl0KCdpbXBvcnQtZG93bmxvYWRzJywgWyBhcmNoaXZlRmlsZVBhdGggXSwgYXN5bmMgKGRsSWRzOiBzdHJpbmdbXSkgPT4ge1xyXG4gICAgICAgIGlmIChkbElkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QobmV3IHV0aWwuUHJvY2Vzc0NhbmNlbGVkKCdGYWlsZWQgdG8gaW1wb3J0IGFyY2hpdmUnKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGRsSWQgb2YgZGxJZHMpIHtcclxuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMyLCByZWoyKSA9PlxyXG4gICAgICAgICAgICBhcGkuZXZlbnRzLmVtaXQoJ3N0YXJ0LWluc3RhbGwtZG93bmxvYWQnLCBkbElkLCB0cnVlLCAoZXJyLCBtb2RJZCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlajIoZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RFbmFibGVkKHByb3BzLnByb2ZpbGUuaWQsIG1vZElkLCB0cnVlKSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXMyKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICB9KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXREZXBsb3ltZW50TmVjZXNzYXJ5KEdBTUVfSUQsIHRydWUpKTtcclxuICAgICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoJ3Vuc3RyaXBwZWRfY29ybGliJyk7XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodW5kZWZpbmVkKTtcclxuICAgICAgfSkpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHJldHVybiByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nKCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWRzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICBjb25zdCBoYXNDb3JlTGliVHlwZSA9IHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sXHJcbiAgICAgIFsnYXR0cmlidXRlcycsICdDb3JlTGliVHlwZSddLCB1bmRlZmluZWQpICE9PSB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSxcclxuICAgICAgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIGhhc0NvcmVMaWJUeXBlICYmIGlzRW5hYmxlZDtcclxuICB9KTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZHMubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGUgdXNlciBoYXMgc2V2ZXJhbCBpbnN0YWxsZWQsIHNlbGVjdCB0aGUgZmlyc3Qgb25lLlxyXG4gICAgY29uc3QgY29yZUxpYk1vZElkID0gY29yZUxpYk1vZElkc1swXTtcclxuXHJcbiAgICBjb25zdCBwYWNrVHlwZTogUGFja1R5cGUgPSBtb2RzW2NvcmVMaWJNb2RJZF0uYXR0cmlidXRlc1snQ29yZUxpYlR5cGUnXTtcclxuICAgIHN3aXRjaCAocGFja1R5cGUpIHtcclxuICAgICAgY2FzZSAnY29yZV9saWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgnQmVwSW5FeFxcXFxjb3JlX2xpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBjYXNlICd1bnN0cmlwcGVkX2NvcmxpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIG5vcCAtIGxldCB0aGUgZm9yIGxvb3AgYmVsb3cgdHJ5IHRvIGZpbmQgdGhlIHBhY2suXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIFtmdWxsUGFja0NvckxpYk5ldywgZnVsbFBhY2tDb3JMaWJPbGRdKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoZmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBmaWxlUGF0aC5yZXBsYWNlKHByb3BzLmRpc2NvdmVyeS5wYXRoICsgcGF0aC5zZXAsICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHBhdGguc2VwICsgJ21vbm8uc2VjdXJpdHkuZGxsJywgJycpO1xyXG4gICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIC8vIG5vcFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIHZhbGlkIHZhcmlhbnQgb2YgdGhlIHVuc3RyaXBwZWQgYXNzZW1ibHkgbW9kcyBmb3VuZCBvbiBOZXh1cy5cclxuICBjb25zdCB1bnN0cmlwcGVkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycpO1xyXG4gIGlmICh1bnN0cmlwcGVkTW9kcy5sZW5ndGggPiAwKSB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgIGlmICh1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSwgWydtb2RTdGF0ZScsIG1vZElkLCAnZW5hYmxlZCddLCBmYWxzZSkpIHtcclxuICAgICAgICBjb25zdCBkbGlkID0gbW9kc1ttb2RJZF0uYXJjaGl2ZUlkO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkOiB0eXBlcy5JRG93bmxvYWQgPSB1dGlsLmdldFNhZmUoYXBpLmdldFN0YXRlKCksXHJcbiAgICAgICAgICBbJ3BlcnNpc3RlbnQnLCAnZG93bmxvYWRzJywgJ2ZpbGVzJywgZGxpZF0sIHVuZGVmaW5lZCk7XHJcbiAgICAgICAgaWYgKGRvd25sb2FkPy5sb2NhbFBhdGggIT09IHVuZGVmaW5lZCAmJiBndWVzc01vZElkKGRvd25sb2FkLmxvY2FsUGF0aCkgIT09ICcxNScpIHtcclxuICAgICAgICAgIC8vIFRoZSBOZXh1cyBNb2RzIHVuc3RyaXBwZWQgYXNzbWVibGllcyBtb2QgaXMgZW5hYmxlZCAtIGRvbid0IHJhaXNlIHRoZSBtaXNzaW5nXHJcbiAgICAgICAgICAvLyAgYXNzZW1ibGllcyBkaWFsb2cuXHJcbiAgICAgICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBleHBlY3RlZEZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBydW5Eb3dubG9hZGVyKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQpIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJldlByb2ZJZDogc3RyaW5nID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByZXZQcm9mSWQpO1xyXG4gIGNvbnN0IG1vZFR5cGVzOiB7IFt0eXBlSWQ6IHN0cmluZ106IHN0cmluZyB9ID0gc2VsZWN0b3JzLm1vZFBhdGhzRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgY3JlYXRlRGlyZWN0b3JpZXMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZFR5cGUgb2YgT2JqZWN0LmtleXMobW9kVHlwZXMpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhtb2RUeXBlc1ttb2RUeXBlXSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuICByZXR1cm4gbmV3IEJsdWViaXJkPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IGNyZWF0ZURpcmVjdG9yaWVzKClcclxuICAgIC50aGVuKCgpID0+IHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZT8uaWQpKVxyXG4gICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKVxyXG4gICAgLmNhdGNoKGVyciA9PiByZWplY3QoZXJyKSkpXHJcbiAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoeyBhcGk6IGNvbnRleHQuYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kc1BhdGgoZ2FtZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICAgIGlnbm9yZURlcGxveTogW10uY29uY2F0KElHTk9SQUJMRV9GSUxFUywgSUdOT1JBQkxFX0ZJTEVTLm1hcChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSkpLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gIC8vICAgaWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgbmFtZTogJ1ZhbGhlaW06IERlZGljYXRlZCBTZXJ2ZXInLFxyXG4gIC8vICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gIC8vICAgcXVlcnlQYXRoOiAoKSA9PiB1bmRlZmluZWQsXHJcbiAgLy8gICBxdWVyeU1vZFBhdGg6IG1vZHNQYXRoLFxyXG4gIC8vICAgbG9nbzogJ2dhbWVhcnQuanBnJyxcclxuICAvLyAgIGV4ZWN1dGFibGU6ICgpID0+ICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgLy8gICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgLy8gICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgLy8gICAgICdzdGFydF9oZWFkbGVzc19zZXJ2ZXIuYmF0JyxcclxuICAvLyAgIF0sXHJcbiAgLy8gICBlbnZpcm9ubWVudDoge1xyXG4gIC8vICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAvLyAgIH0sXHJcbiAgLy8gICBkZXRhaWxzOiB7XHJcbiAgLy8gICAgIG5leHVzUGFnZUlkOiBHQU1FX0lELFxyXG4gIC8vICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAvLyAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gIC8vICAgfSxcclxuICAvLyB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCk7XHJcbiAgICByZXR1cm4gKHByb3BzPy5kaXNjb3Zlcnk/LnBhdGggIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBwcm9wcy5kaXNjb3ZlcnkucGF0aCA6ICcuJztcclxuICB9O1xyXG5cclxuICBjb25zdCBpc1N1cHBvcnRlZCA9IChnYW1lSWQ6IHN0cmluZykgPT4gKGdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgY29uc3QgaGFzSW5zdHJ1Y3Rpb24gPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVkOiAoaW5zdDogdHlwZXMuSUluc3RydWN0aW9uKSA9PiBib29sZWFuKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zLmZpbmQoaW5zdHIgPT4gKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIChwcmVkKGluc3RyKSkpICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gIGNvbnN0IGZpbmRJbnN0ck1hdGNoID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1vZD86IChpbnB1dDogc3RyaW5nKSA9PiBzdHJpbmcpID0+IHtcclxuICAgIGlmIChtb2QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBtb2QgPSAoaW5wdXQpID0+IGlucHV0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PlxyXG4gICAgICBtb2QoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpID09PSBwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHZidWlsZERlcFRlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBnYW1lUGF0aCA9IGdldEdhbWVQYXRoKCk7XHJcbiAgICBjb25zdCBidWlsZFNoYXJlQXNzZW1ibHkgPSBwYXRoLmpvaW4oZ2FtZVBhdGgsICdJblNsaW1WTUwnLCAnTW9kcycsICdDUi1CdWlsZFNoYXJlX1ZNTC5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmJ1aWxkLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICdpbnNsaW12bWwtbW9kJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0J1aWxkU2hhcmUgKEFkdmFuY2VkQnVpbGRpbmcpJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNScsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgYnVpbGRTaGFyZUFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21NZXNoZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21NZXNoZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tTWVzaGVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTg0JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21UZXh0dXJlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbVRleHR1cmVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tVGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80OCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYmV0dGVyQ29udGluZW50c1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0JldHRlckNvbnRpbmVudHMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ2JldHRlci1jb250aW5lbnRzLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQmV0dGVyIENvbnRpbmVudHMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80NDYnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIC8vIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDEwMCwgJ3N0ZWFtY21kJywge30sICdTdGVhbUNNRCBEZWRpY2F0ZWQgU2VydmVyJywgKCkgPT4ge1xyXG4gIC8vICAgY29udGV4dC5hcGkuc2VsZWN0RGlyKHt9KVxyXG4gIC8vICAgICAudGhlbigoc2VsZWN0ZWRQYXRoOiBzdHJpbmcpID0+IHtcclxuICAvLyAgICAgICBpZiAoc2VsZWN0ZWRQYXRoKSB7XHJcbiAgLy8gICAgICAgICBjb25zdCBwcm9wczogSVNDTURQcm9wcyA9IHtcclxuICAvLyAgICAgICAgICAgZ2FtZUlkOiBHQU1FX0lEX1NFUlZFUixcclxuICAvLyAgICAgICAgICAgc3RlYW1BcHBJZDogK1NURUFNX0lELFxyXG4gIC8vICAgICAgICAgICBhcmd1bWVudHM6IFtcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAnZm9yY2VfaW5zdGFsbF9kaXInLCB2YWx1ZTogc2VsZWN0ZWRQYXRoIH0sXHJcbiAgLy8gICAgICAgICAgICAgeyBhcmd1bWVudDogJ3F1aXQnIH0sXHJcbiAgLy8gICAgICAgICAgIF0sXHJcbiAgLy8gICAgICAgICAgIGNhbGxiYWNrOiAoKGVyciwgZGF0YSkgPT4gbnVsbCksXHJcbiAgLy8gICAgICAgICB9O1xyXG4gIC8vICAgICAgICAgY29udGV4dC5hcGkuZXh0LnNjbWRTdGFydERlZGljYXRlZFNlcnZlcihwcm9wcyk7XHJcbiAgLy8gICAgICAgfVxyXG4gIC8vICAgICB9KVxyXG4gIC8vICAgICAuY2F0Y2goZXJyID0+IG51bGwpO1xyXG4gIC8vIH0sICgpID0+IGNvbnRleHQuYXBpLmV4dD8uc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyICE9PSB1bmRlZmluZWQpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyQWN0aW9uKCdtb2QtaWNvbnMnLCAxMTUsICdpbXBvcnQnLCB7fSwgJ0ltcG9ydCBGcm9tIHIybW9kbWFuJywgKCkgPT4ge1xyXG4gICAgbWlncmF0ZVIyVG9Wb3J0ZXgoY29udGV4dC5hcGkpO1xyXG4gIH0sICgpID0+IHtcclxuICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgIGNvbnN0IGFjdGl2ZUdhbWVJZCA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoc3RhdGUpO1xyXG4gICAgcmV0dXJuIHVzZXJIYXNSMkluc3RhbGxlZCgpXHJcbiAgICAgICYmIChnZXRHYW1lUGF0aCgpICE9PSAnLicpXHJcbiAgICAgICYmIChhY3RpdmVHYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBkZXBlbmRlbmN5VGVzdHMgPSBbIHZidWlsZERlcFRlc3QsIGN1c3RvbU1lc2hlc1Rlc3QsXHJcbiAgICBjdXN0b21UZXh0dXJlc1Rlc3QsIGJldHRlckNvbnRpbmVudHNUZXN0IF07XHJcblxyXG4gIGZvciAoY29uc3QgdGVzdEZ1bmMgb2YgZGVwZW5kZW5jeVRlc3RzKSB7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB0ZXN0RnVuYyk7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdtb2QtaW5zdGFsbGVkJywgdGVzdEZ1bmMpO1xyXG4gIH1cclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ211bHRpcGxlLWxpYi1tb2RzJywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnbW9kLWluc3RhbGxlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1iZXR0ZXItY29udGluZW50cycsIDIwLCB0ZXN0QmV0dGVyQ29udCwgaW5zdGFsbEJldHRlckNvbnQpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNChjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNihjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwOShjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ3ZvcnRleC13b3JsZHMnKSxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc0JDRXh0ID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNCQ0V4dCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXR0ZXIgQ29udGluZW50cyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0Lm9uY2UoKCkgPT4ge1xyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnd2lsbC1kZXBsb3knLCBhc3luYyAocHJvZmlsZUlkKSA9PiB7XHJcbiAgICAgIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICAgICAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlSWQpXHJcbiAgICAgICAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoZ2VuUHJvcHMoY29udGV4dCwgcHJvZmlsZUlkKSkpXHJcbiAgICAgICAgLmNhdGNoKGVyciA9PiBlcnIgaW5zdGFuY2VvZiB1dGlsLlVzZXJDYW5jZWxlZFxyXG4gICAgICAgICAgPyBQcm9taXNlLnJlc29sdmUoKVxyXG4gICAgICAgICAgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnRleHQuYXBpLm9uQXN5bmMoJ2RpZC1wdXJnZScsIGFzeW5jIChwcm9maWxlSWQpID0+XHJcbiAgICAgIHBheWxvYWREZXBsb3llci5vbkRpZFB1cmdlKGNvbnRleHQsIHByb2ZpbGVJZCkpO1xyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbWFpbjtcclxuIl19