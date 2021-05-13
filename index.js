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
                    if (download.localPath !== undefined && common_1.guessModId(download.localPath) !== '15') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBc0U7QUFDdEUscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCw2REFBb0U7QUFFcEUscUNBSWtCO0FBQ2xCLDZDQUVtQztBQUNuQyw2Q0FBOEU7QUFDOUUsbUNBQW1FO0FBRW5FLHlDQUFtRTtBQUduRSxNQUFNLEdBQUcsR0FBRyxpQkFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGNBQUssQ0FBQztBQUV0RCxNQUFNLGFBQWEsR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDeEQsU0FBUyxTQUFTLENBQUMsS0FBSztJQUN0QixPQUFPLE9BQU8sR0FBRyxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLFFBQVE7SUFDZixPQUFPLGlCQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLGlCQUFRLENBQUMsQ0FBQztTQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsUUFBUTtJQUNoQyxPQUFPLGVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1NBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUN6RixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZ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InNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCbHVlYmlyZCBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCB7IGFwcCBhcyBhcHBJbiwgcmVtb3RlIH0gZnJvbSAnZWxlY3Ryb24nO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCBQYXJzZXIsIHsgSW5pRmlsZSwgV2luYXBpRm9ybWF0IH0gZnJvbSAndm9ydGV4LXBhcnNlLWluaSc7XHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBVbnN0cmlwcGVkQXNzZW1ibHlEb3dubG9hZGVyIH0gZnJvbSAnLi91bnN0cmlwcGVkQXNzZW1ibHknO1xyXG5cclxuaW1wb3J0IHtcclxuICBCRVRURVJfQ09OVF9FWFQsIEZCWF9FWFQsIEdBTUVfSUQsIEdBTUVfSURfU0VSVkVSLFxyXG4gIGdlblByb3BzLCBndWVzc01vZElkLCBJR05PUkFCTEVfRklMRVMsIElOU0xJTVZNTF9JREVOVElGSUVSLFxyXG4gIElQcm9wcywgSVNDTURQcm9wcywgTkVYVVMsIE9CSl9FWFQsIFBhY2tUeXBlLCBTVEVBTV9JRCwgVkJVSUxEX0VYVCxcclxufSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IGluc3RhbGxCZXR0ZXJDb250LCBpbnN0YWxsQ29yZVJlbW92ZXIsIGluc3RhbGxGdWxsUGFjaywgaW5zdGFsbEluU2xpbU1vZExvYWRlcixcclxuICBpbnN0YWxsVkJ1aWxkTW9kLCB0ZXN0QmV0dGVyQ29udCwgdGVzdENvcmVSZW1vdmVyLCB0ZXN0RnVsbFBhY2ssIHRlc3RJblNsaW1Nb2RMb2FkZXIsXHJcbiAgdGVzdFZCdWlsZCB9IGZyb20gJy4vaW5zdGFsbGVycyc7XHJcbmltcG9ydCB7IG1pZ3JhdGUxMDMsIG1pZ3JhdGUxMDQsIG1pZ3JhdGUxMDYsIG1pZ3JhdGUxMDkgfSBmcm9tICcuL21pZ3JhdGlvbnMnO1xyXG5pbXBvcnQgeyBoYXNNdWx0aXBsZUxpYk1vZHMsIGlzRGVwZW5kZW5jeVJlcXVpcmVkIH0gZnJvbSAnLi90ZXN0cyc7XHJcblxyXG5pbXBvcnQgeyBtaWdyYXRlUjJUb1ZvcnRleCwgdXNlckhhc1IySW5zdGFsbGVkIH0gZnJvbSAnLi9yMlZvcnRleCc7XHJcbmltcG9ydCB7IHRyeVN0YXRlbWVudCB9IGZyb20gJ2JhYmVsLXR5cGVzJztcclxuXHJcbmNvbnN0IGFwcCA9IHJlbW90ZSAhPT0gdW5kZWZpbmVkID8gcmVtb3RlLmFwcCA6IGFwcEluO1xyXG5cclxuY29uc3QgU1RPUF9QQVRURVJOUyA9IFsnY29uZmlnJywgJ3BsdWdpbnMnLCAncGF0Y2hlcnMnXTtcclxuZnVuY3Rpb24gdG9Xb3JkRXhwKGlucHV0KSB7XHJcbiAgcmV0dXJuICcoXnwvKScgKyBpbnB1dCArICcoL3wkKSc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRHYW1lKCk6IGFueSB7XHJcbiAgcmV0dXJuIHV0aWwuR2FtZVN0b3JlSGVscGVyLmZpbmRCeUFwcElkKFtTVEVBTV9JRF0pXHJcbiAgICAudGhlbihnYW1lID0+IGdhbWUuZ2FtZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXF1aXJlc0xhdW5jaGVyKGdhbWVQYXRoKSB7XHJcbiAgcmV0dXJuIGZzLnJlYWRkaXJBc3luYyhnYW1lUGF0aClcclxuICAgIC50aGVuKGZpbGVzID0+IChmaWxlcy5maW5kKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpID09PSAnc3RlYW1fYXBwaWQudHh0JykgIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBQcm9taXNlLnJlc29sdmUoe1xyXG4gICAgICAgIGxhdW5jaGVyOiAnc3RlYW0nLFxyXG4gICAgICAgIGFkZEluZm86IHtcclxuICAgICAgICAgIGFwcElkOiBTVEVBTV9JRCxcclxuICAgICAgICAgIHBhcmFtZXRlcnM6IFsnLWZvcmNlLWdsY29yZSddLFxyXG4gICAgICAgICAgbGF1bmNoVHlwZTogJ2dhbWVzdG9yZScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSlcclxuICAgICAgOiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKSlcclxuICAgIC5jYXRjaChlcnIgPT4gUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKHByb3BzOiBJUHJvcHMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCBhcGkgPSBwcm9wcy5hcGk7XHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcbiAgY29uc3QgZXhwZWN0ZWRGaWxlUGF0aCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX21hbmFnZWQnLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk9sZCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICdCZXBJbkV4JywgJ2NvcmVfbGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJOZXcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9jb3JsaWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuXHJcbiAgY29uc3QgdXJsID0gcGF0aC5qb2luKE5FWFVTLCAndmFsaGVpbScsICdtb2RzJywgJzEyMDInKSArIGA/dGFiPWZpbGVzJmZpbGVfaWQ9NDg5OSZubW09MWA7XHJcbiAgY29uc3QgcmFpc2VNaXNzaW5nQXNzZW1ibGllc0RpYWxvZyA9ICgpID0+IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ01pc3NpbmcgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW1cXCdzIGFzc2VtYmxpZXMgYXJlIGRpc3RyaWJ1dGVkIGluIGFuIFwib3B0aW1pc2VkXCIgc3RhdGUgdG8gcmVkdWNlIHJlcXVpcmVkICdcclxuICAgICAgKyAnZGlzayBzcGFjZS4gVGhpcyB1bmZvcnR1bmF0ZWx5IG1lYW5zIHRoYXQgVmFsaGVpbVxcJ3MgbW9kZGluZyBjYXBhYmlsaXRpZXMgYXJlIGFsc28gYWZmZWN0ZWQue3ticn19e3ticn19J1xyXG4gICAgICArICdJbiBvcmRlciB0byBtb2QgVmFsaGVpbSwgdGhlIHVub3B0aW1pc2VkL3Vuc3RyaXBwZWQgYXNzZW1ibGllcyBhcmUgcmVxdWlyZWQgLSBwbGVhc2UgZG93bmxvYWQgdGhlc2UgJ1xyXG4gICAgICArICdmcm9tIE5leHVzIE1vZHMue3ticn19e3ticn19IFlvdSBjYW4gY2hvb3NlIHRoZSBWb3J0ZXgvbW9kIG1hbmFnZXIgZG93bmxvYWQgb3IgbWFudWFsIGRvd25sb2FkICdcclxuICAgICAgKyAnKHNpbXBseSBkcmFnIGFuZCBkcm9wIHRoZSBhcmNoaXZlIGludG8gdGhlIG1vZHMgZHJvcHpvbmUgdG8gYWRkIGl0IHRvIFZvcnRleCkue3ticn19e3ticn19J1xyXG4gICAgICArICdWb3J0ZXggd2lsbCB0aGVuIGJlIGFibGUgdG8gaW5zdGFsbCB0aGUgYXNzZW1ibGllcyB3aGVyZSB0aGV5IGFyZSBuZWVkZWQgdG8gZW5hYmxlICdcclxuICAgICAgKyAnbW9kZGluZywgbGVhdmluZyB0aGUgb3JpZ2luYWwgb25lcyB1bnRvdWNoZWQuJywgeyByZXBsYWNlOiB7IGJyOiAnW2JyXVsvYnJdJyB9IH0pLFxyXG4gICAgfSwgW1xyXG4gICAgICB7IGxhYmVsOiAnQ2FuY2VsJywgYWN0aW9uOiAoKSA9PiByZWplY3QobmV3IHV0aWwuVXNlckNhbmNlbGVkKCkpIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB1dGlsLm9wbih1cmwpXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IG51bGwpXHJcbiAgICAgICAgICAuZmluYWxseSgoKSA9PiByZXNvbHZlKCkpLFxyXG4gICAgICB9LFxyXG4gICAgXSk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmID0gKCkgPT4gYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgbWVzc2FnZTogdCgnR2FtZSB1cGRhdGVkIC0gVXBkYXRlZCBhc3NlbWJsaWVzIHBhY2sgcmVxdWlyZWQuJyksXHJcbiAgICB0eXBlOiAnaW5mbycsXHJcbiAgICBpZDogJ2ZvcmNlRG93bmxvYWROb3RpZicsXHJcbiAgICBub0Rpc21pc3M6IHRydWUsXHJcbiAgICBhbGxvd1N1cHByZXNzOiB0cnVlLFxyXG4gICAgYWN0aW9uczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdGl0bGU6ICdNb3JlJyxcclxuICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdEb3dubG9hZCB1bnN0cmlwcGVkIGFzc2VtYmxpZXMnLCB7XHJcbiAgICAgICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW0gaGFzIGJlZW4gdXBkYXRlZCBhbmQgdG8gYmUgYWJsZSB0byBtb2QgdGhlIGdhbWUgeW91IHdpbGwgbmVlZCB0byBlbnN1cmUgeW91IGFyZSB1c2luZyB0aGUgbGF0ZXN0IHVuc3RyaXBwZWQgVW5pdHkgYXNzZW1ibGllcyBvciB0aGUgbGF0ZXN0IFwiQmVwSW5FeCBwYWNrXCIuICdcclxuICAgICAgICAgICAgICAgICAgKyAnVm9ydGV4IGhhcyBkZXRlY3RlZCB0aGF0IHlvdSBoYXZlIHByZXZpb3VzbHkgaW5zdGFsbGVkIHVuc3RyaXBwZWQgVW5pdHkgYXNzZW1ibGllcyAvIGEgQmVwSW5FeCBwYWNrLCBidXQgY2Fubm90IGtub3cgZm9yIHN1cmUgd2hldGhlciB0aGVzZSBmaWxlcyBhcmUgdXAgdG8gZGF0ZS4gJ1xyXG4gICAgICAgICAgICAgICAgICArICdJZiB5b3UgYXJlIHVuc3VyZSwgVm9ydGV4IGNhbiBkb3dubG9hZCBhbmQgaW5zdGFsbCB0aGUgbGF0ZXN0IHJlcXVpcmVkIGZpbGVzIGZvciB5b3Uue3tsYn19J1xyXG4gICAgICAgICAgICAgICAgICArICdQbGVhc2Ugbm90ZSB0aGF0IGFsbCBtb2RzIG11c3QgYWxzbyBiZSB1cGRhdGVkIGluIG9yZGVyIGZvciB0aGVtIHRvIGZ1bmN0aW9uIHdpdGggdGhlIG5ldyBnYW1lIHZlcnNpb24uJyxcclxuICAgICAgICAgICAgICAgICAgeyByZXBsYWNlOiB7IGxiOiAnW2JyXVsvYnJdW2JyXVsvYnJdJywgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICAgICAgfSwgW1xyXG4gICAgICAgICAgeyBsYWJlbDogJ0Nsb3NlJyB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgICAgIGFjdGlvbjogKCkgPT4gcnVuRG93bmxvYWRlcigpLmZpbmFsbHkoKCkgPT4gZGlzbWlzcygpKSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSksXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBhc3NpZ25PdmVycmlkZVBhdGggPSBhc3luYyAob3ZlcnJpZGVQYXRoOiBzdHJpbmcpID0+IHtcclxuICAgIGNvbnN0IGRvb3JTdG9wQ29uZmlnID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLCAnZG9vcnN0b3BfY29uZmlnLmluaScpO1xyXG4gICAgY29uc3QgcGFyc2VyID0gbmV3IFBhcnNlcihuZXcgV2luYXBpRm9ybWF0KCkpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaW5pRGF0YTogSW5pRmlsZTxhbnk+ID0gYXdhaXQgcGFyc2VyLnJlYWQoZG9vclN0b3BDb25maWcpO1xyXG4gICAgICBpbmlEYXRhLmRhdGFbJ1VuaXR5RG9vcnN0b3AnXVsnZGxsU2VhcmNoUGF0aE92ZXJyaWRlJ10gPSBvdmVycmlkZVBhdGg7XHJcbiAgICAgIGF3YWl0IHBhcnNlci53cml0ZShkb29yU3RvcENvbmZpZywgaW5pRGF0YSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignZmFpbGVkIHRvIG1vZGlmeSBkb29yc3RvcCBjb25maWd1cmF0aW9uJywgZXJyKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBydW5Eb3dubG9hZGVyID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3QgZG93bmxvYWRlciA9IG5ldyBVbnN0cmlwcGVkQXNzZW1ibHlEb3dubG9hZGVyKHV0aWwuZ2V0Vm9ydGV4UGF0aCgndGVtcCcpKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGFyY2hpdmVGaWxlUGF0aCA9IGF3YWl0IGRvd25sb2FkZXIuZG93bmxvYWROZXdlc3QoJ2Z1bGxfbmFtZScsICdkZW5pa3Nvbi1CZXBJbkV4UGFja19WYWxoZWltJyk7XHJcbiAgICAgIC8vIEdpdmUgaXQgYSBzZWNvbmQgZm9yIHRoZSBkb3dubG9hZCB0byByZWdpc3RlciBpbiB0aGUgc3RhdGUuXHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+XHJcbiAgICAgICAgYXBpLmV2ZW50cy5lbWl0KCdpbXBvcnQtZG93bmxvYWRzJywgWyBhcmNoaXZlRmlsZVBhdGggXSwgYXN5bmMgKGRsSWRzOiBzdHJpbmdbXSkgPT4ge1xyXG4gICAgICAgIGlmIChkbElkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QobmV3IHV0aWwuUHJvY2Vzc0NhbmNlbGVkKCdGYWlsZWQgdG8gaW1wb3J0IGFyY2hpdmUnKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGRsSWQgb2YgZGxJZHMpIHtcclxuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMyLCByZWoyKSA9PlxyXG4gICAgICAgICAgICBhcGkuZXZlbnRzLmVtaXQoJ3N0YXJ0LWluc3RhbGwtZG93bmxvYWQnLCBkbElkLCB0cnVlLCAoZXJyLCBtb2RJZCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlajIoZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RFbmFibGVkKHByb3BzLnByb2ZpbGUuaWQsIG1vZElkLCB0cnVlKSk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXMyKHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICB9KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXREZXBsb3ltZW50TmVjZXNzYXJ5KEdBTUVfSUQsIHRydWUpKTtcclxuICAgICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoJ3Vuc3RyaXBwZWRfY29ybGliJyk7XHJcbiAgICAgICAgcmV0dXJuIHJlc29sdmUodW5kZWZpbmVkKTtcclxuICAgICAgfSkpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHJldHVybiByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nKCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWRzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICBjb25zdCBoYXNDb3JlTGliVHlwZSA9IHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sXHJcbiAgICAgIFsnYXR0cmlidXRlcycsICdDb3JlTGliVHlwZSddLCB1bmRlZmluZWQpICE9PSB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSxcclxuICAgICAgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIGhhc0NvcmVMaWJUeXBlICYmIGlzRW5hYmxlZDtcclxuICB9KTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZHMubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGUgdXNlciBoYXMgc2V2ZXJhbCBpbnN0YWxsZWQsIHNlbGVjdCB0aGUgZmlyc3Qgb25lLlxyXG4gICAgY29uc3QgY29yZUxpYk1vZElkID0gY29yZUxpYk1vZElkc1swXTtcclxuXHJcbiAgICBjb25zdCBwYWNrVHlwZTogUGFja1R5cGUgPSBtb2RzW2NvcmVMaWJNb2RJZF0uYXR0cmlidXRlc1snQ29yZUxpYlR5cGUnXTtcclxuICAgIHN3aXRjaCAocGFja1R5cGUpIHtcclxuICAgICAgY2FzZSAnY29yZV9saWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgnQmVwSW5FeFxcXFxjb3JlX2xpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBjYXNlICd1bnN0cmlwcGVkX2NvcmxpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHJhaXNlRm9yY2VEb3dubG9hZE5vdGlmKCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIG5vcCAtIGxldCB0aGUgZm9yIGxvb3AgYmVsb3cgdHJ5IHRvIGZpbmQgdGhlIHBhY2suXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIFtmdWxsUGFja0NvckxpYk5ldywgZnVsbFBhY2tDb3JMaWJPbGRdKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoZmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBmaWxlUGF0aC5yZXBsYWNlKHByb3BzLmRpc2NvdmVyeS5wYXRoICsgcGF0aC5zZXAsICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHBhdGguc2VwICsgJ21vbm8uc2VjdXJpdHkuZGxsJywgJycpO1xyXG4gICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgcmFpc2VGb3JjZURvd25sb2FkTm90aWYoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIC8vIG5vcFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIHZhbGlkIHZhcmlhbnQgb2YgdGhlIHVuc3RyaXBwZWQgYXNzZW1ibHkgbW9kcyBmb3VuZCBvbiBOZXh1cy5cclxuICBjb25zdCB1bnN0cmlwcGVkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycpO1xyXG4gIGlmICh1bnN0cmlwcGVkTW9kcy5sZW5ndGggPiAwKSB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgIGlmICh1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSwgWydtb2RTdGF0ZScsIG1vZElkLCAnZW5hYmxlZCddLCBmYWxzZSkpIHtcclxuICAgICAgICBjb25zdCBkbGlkID0gbW9kc1ttb2RJZF0uYXJjaGl2ZUlkO1xyXG4gICAgICAgIGNvbnN0IGRvd25sb2FkOiB0eXBlcy5JRG93bmxvYWQgPSB1dGlsLmdldFNhZmUoYXBpLmdldFN0YXRlKCksXHJcbiAgICAgICAgICBbJ3BlcnNpc3RlbnQnLCAnZG93bmxvYWRzJywgJ2ZpbGVzJywgZGxpZF0sIHVuZGVmaW5lZCk7XHJcbiAgICAgICAgaWYgKGRvd25sb2FkLmxvY2FsUGF0aCAhPT0gdW5kZWZpbmVkICYmIGd1ZXNzTW9kSWQoZG93bmxvYWQubG9jYWxQYXRoKSAhPT0gJzE1Jykge1xyXG4gICAgICAgICAgLy8gVGhlIE5leHVzIE1vZHMgdW5zdHJpcHBlZCBhc3NtZWJsaWVzIG1vZCBpcyBlbmFibGVkIC0gZG9uJ3QgcmFpc2UgdGhlIG1pc3NpbmdcclxuICAgICAgICAgIC8vICBhc3NlbWJsaWVzIGRpYWxvZy5cclxuICAgICAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGV4cGVjdGVkRmlsZVBhdGgucmVwbGFjZShwcm9wcy5kaXNjb3ZlcnkucGF0aCArIHBhdGguc2VwLCAnJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShwYXRoLnNlcCArICdtb25vLnNlY3VyaXR5LmRsbCcsICcnKTtcclxuICAgICAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJ1bkRvd25sb2FkZXIoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCkge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcmV2UHJvZklkOiBzdHJpbmcgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJldlByb2ZJZCk7XHJcbiAgY29uc3QgbW9kVHlwZXM6IHsgW3R5cGVJZDogc3RyaW5nXTogc3RyaW5nIH0gPSBzZWxlY3RvcnMubW9kUGF0aHNGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBjcmVhdGVEaXJlY3RvcmllcyA9IGFzeW5jICgpID0+IHtcclxuICAgIGZvciAoY29uc3QgbW9kVHlwZSBvZiBPYmplY3Qua2V5cyhtb2RUeXBlcykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKG1vZFR5cGVzW21vZFR5cGVdKTtcclxuICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG4gIHJldHVybiBuZXcgQmx1ZWJpcmQ8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4gY3JlYXRlRGlyZWN0b3JpZXMoKVxyXG4gICAgLnRoZW4oKCkgPT4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlPy5pZCkpXHJcbiAgICAudGhlbigoKSA9PiByZXNvbHZlKCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IHJlamVjdChlcnIpKSlcclxuICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyh7IGFwaTogY29udGV4dC5hcGksIHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb2RzUGF0aChnYW1lUGF0aDogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIHBhdGguam9pbihnYW1lUGF0aCwgJ0JlcEluRXgnLCAncGx1Z2lucycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWluKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0KSB7XHJcbiAgY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gICAgaWQ6IEdBTUVfSUQsXHJcbiAgICBuYW1lOiAnVmFsaGVpbScsXHJcbiAgICBtZXJnZU1vZHM6IHRydWUsXHJcbiAgICBxdWVyeVBhdGg6IGZpbmRHYW1lLFxyXG4gICAgcXVlcnlNb2RQYXRoOiBtb2RzUGF0aCxcclxuICAgIGxvZ286ICdnYW1lYXJ0LmpwZycsXHJcbiAgICBleGVjdXRhYmxlOiAoKSA9PiAndmFsaGVpbS5leGUnLFxyXG4gICAgcmVxdWlyZXNMYXVuY2hlcixcclxuICAgIHNldHVwOiBkaXNjb3ZlcnkgPT4gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dCwgZGlzY292ZXJ5KSxcclxuICAgIHJlcXVpcmVkRmlsZXM6IFtcclxuICAgICAgJ3ZhbGhlaW0uZXhlJyxcclxuICAgIF0sXHJcbiAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAgIH0sXHJcbiAgICBkZXRhaWxzOiB7XHJcbiAgICAgIHN0ZWFtQXBwSWQ6ICtTVEVBTV9JRCxcclxuICAgICAgc3RvcFBhdHRlcm5zOiBTVE9QX1BBVFRFUk5TLm1hcCh0b1dvcmRFeHApLFxyXG4gICAgICBpZ25vcmVDb25mbGljdHM6IFtdLmNvbmNhdChJR05PUkFCTEVfRklMRVMsIElHTk9SQUJMRV9GSUxFUy5tYXAoZmlsZSA9PiBmaWxlLnRvTG93ZXJDYXNlKCkpKSxcclxuICAgICAgaWdub3JlRGVwbG95OiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICAvLyBjb250ZXh0LnJlZ2lzdGVyR2FtZSh7XHJcbiAgLy8gICBpZDogR0FNRV9JRF9TRVJWRVIsXHJcbiAgLy8gICBuYW1lOiAnVmFsaGVpbTogRGVkaWNhdGVkIFNlcnZlcicsXHJcbiAgLy8gICBtZXJnZU1vZHM6IHRydWUsXHJcbiAgLy8gICBxdWVyeVBhdGg6ICgpID0+IHVuZGVmaW5lZCxcclxuICAvLyAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgLy8gICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gIC8vICAgZXhlY3V0YWJsZTogKCkgPT4gJ3N0YXJ0X2hlYWRsZXNzX3NlcnZlci5iYXQnLFxyXG4gIC8vICAgcmVxdWlyZXNMYXVuY2hlcixcclxuICAvLyAgIHNldHVwOiBkaXNjb3ZlcnkgPT4gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dCwgZGlzY292ZXJ5KSxcclxuICAvLyAgIHJlcXVpcmVkRmlsZXM6IFtcclxuICAvLyAgICAgJ3N0YXJ0X2hlYWRsZXNzX3NlcnZlci5iYXQnLFxyXG4gIC8vICAgXSxcclxuICAvLyAgIGVudmlyb25tZW50OiB7XHJcbiAgLy8gICAgIFN0ZWFtQVBQSWQ6IFNURUFNX0lELFxyXG4gIC8vICAgfSxcclxuICAvLyAgIGRldGFpbHM6IHtcclxuICAvLyAgICAgbmV4dXNQYWdlSWQ6IEdBTUVfSUQsXHJcbiAgLy8gICAgIHN0ZWFtQXBwSWQ6ICtTVEVBTV9JRCxcclxuICAvLyAgICAgc3RvcFBhdHRlcm5zOiBTVE9QX1BBVFRFUk5TLm1hcCh0b1dvcmRFeHApLFxyXG4gIC8vICAgICBpZ25vcmVDb25mbGljdHM6IElHTk9SQUJMRV9GSUxFUyxcclxuICAvLyAgICAgaWdub3JlRGVwbG95OiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICB9LFxyXG4gIC8vIH0pO1xyXG5cclxuICBjb25zdCBnZXRHYW1lUGF0aCA9ICgpID0+IHtcclxuICAgIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0KTtcclxuICAgIHJldHVybiAocHJvcHM/LmRpc2NvdmVyeT8ucGF0aCAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IHByb3BzLmRpc2NvdmVyeS5wYXRoIDogJy4nO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGlzU3VwcG9ydGVkID0gKGdhbWVJZDogc3RyaW5nKSA9PiAoZ2FtZUlkID09PSBHQU1FX0lEKTtcclxuICBjb25zdCBoYXNJbnN0cnVjdGlvbiA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByZWQ6IChpbnN0OiB0eXBlcy5JSW5zdHJ1Y3Rpb24pID0+IGJvb2xlYW4pID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbnMuZmluZChpbnN0ciA9PiAoaW5zdHIudHlwZSA9PT0gJ2NvcHknKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHByZWQoaW5zdHIpKSkgIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgY29uc3QgZmluZEluc3RyTWF0Y2ggPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kPzogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIG1vZCA9IChpbnB1dCkgPT4gaW5wdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLCAoaW5zdHIpID0+XHJcbiAgICAgIG1vZChpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT09IHBhdHRlcm4udG9Mb3dlckNhc2UoKSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdmJ1aWxkRGVwVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGdhbWVQYXRoID0gZ2V0R2FtZVBhdGgoKTtcclxuICAgIGNvbnN0IGJ1aWxkU2hhcmVBc3NlbWJseSA9IHBhdGguam9pbihnYW1lUGF0aCwgJ0luU2xpbVZNTCcsICdNb2RzJywgJ0NSLUJ1aWxkU2hhcmVfVk1MLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YnVpbGQtbW9kJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJ2luc2xpbXZtbC1tb2QnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQnVpbGRTaGFyZSAoQWR2YW5jZWRCdWlsZGluZyknLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy81JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyBidWlsZFNoYXJlQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGN1c3RvbU1lc2hlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbU1lc2hlcy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmFsaGVpbS1jdXN0b20tbWVzaGVzJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdDdXN0b21NZXNoZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy8xODQnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGN1c3RvbVRleHR1cmVzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQ3VzdG9tVGV4dHVyZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLXRleHR1cmVzJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdDdXN0b21UZXh0dXJlcycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzQ4JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBiZXR0ZXJDb250aW5lbnRzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQmV0dGVyQ29udGluZW50cy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAnYmV0dGVyLWNvbnRpbmVudHMtbW9kJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdCZXR0ZXIgQ29udGluZW50cycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzQ0NicsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckFjdGlvbignbW9kLWljb25zJywgMTAwLCAnc3RlYW1jbWQnLCB7fSwgJ1N0ZWFtQ01EIERlZGljYXRlZCBTZXJ2ZXInLCAoKSA9PiB7XHJcbiAgLy8gICBjb250ZXh0LmFwaS5zZWxlY3REaXIoe30pXHJcbiAgLy8gICAgIC50aGVuKChzZWxlY3RlZFBhdGg6IHN0cmluZykgPT4ge1xyXG4gIC8vICAgICAgIGlmIChzZWxlY3RlZFBhdGgpIHtcclxuICAvLyAgICAgICAgIGNvbnN0IHByb3BzOiBJU0NNRFByb3BzID0ge1xyXG4gIC8vICAgICAgICAgICBnYW1lSWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgICAgICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgICAgICAgIGFyZ3VtZW50czogW1xyXG4gIC8vICAgICAgICAgICAgIHsgYXJndW1lbnQ6ICdmb3JjZV9pbnN0YWxsX2RpcicsIHZhbHVlOiBzZWxlY3RlZFBhdGggfSxcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAncXVpdCcgfSxcclxuICAvLyAgICAgICAgICAgXSxcclxuICAvLyAgICAgICAgICAgY2FsbGJhY2s6ICgoZXJyLCBkYXRhKSA9PiBudWxsKSxcclxuICAvLyAgICAgICAgIH07XHJcbiAgLy8gICAgICAgICBjb250ZXh0LmFwaS5leHQuc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyKHByb3BzKTtcclxuICAvLyAgICAgICB9XHJcbiAgLy8gICAgIH0pXHJcbiAgLy8gICAgIC5jYXRjaChlcnIgPT4gbnVsbCk7XHJcbiAgLy8gfSwgKCkgPT4gY29udGV4dC5hcGkuZXh0Py5zY21kU3RhcnREZWRpY2F0ZWRTZXJ2ZXIgIT09IHVuZGVmaW5lZCk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDExNSwgJ2ltcG9ydCcsIHt9LCAnSW1wb3J0IEZyb20gcjJtb2RtYW4nLCAoKSA9PiB7XHJcbiAgICBtaWdyYXRlUjJUb1ZvcnRleChjb250ZXh0LmFwaSk7XHJcbiAgfSwgKCkgPT4ge1xyXG4gICAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgY29uc3QgYWN0aXZlR2FtZUlkID0gc2VsZWN0b3JzLmFjdGl2ZUdhbWVJZChzdGF0ZSk7XHJcbiAgICByZXR1cm4gdXNlckhhc1IySW5zdGFsbGVkKClcclxuICAgICAgJiYgKGdldEdhbWVQYXRoKCkgIT09ICcuJylcclxuICAgICAgJiYgKGFjdGl2ZUdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGRlcGVuZGVuY3lUZXN0cyA9IFsgdmJ1aWxkRGVwVGVzdCwgY3VzdG9tTWVzaGVzVGVzdCxcclxuICAgIGN1c3RvbVRleHR1cmVzVGVzdCwgYmV0dGVyQ29udGluZW50c1Rlc3QgXTtcclxuXHJcbiAgZm9yIChjb25zdCB0ZXN0RnVuYyBvZiBkZXBlbmRlbmN5VGVzdHMpIHtcclxuICAgIGNvbnRleHQucmVnaXN0ZXJUZXN0KHRlc3RGdW5jLm5hbWUudG9TdHJpbmcoKSwgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIHRlc3RGdW5jKTtcclxuICAgIGNvbnRleHQucmVnaXN0ZXJUZXN0KHRlc3RGdW5jLm5hbWUudG9TdHJpbmcoKSwgJ21vZC1pbnN0YWxsZWQnLCB0ZXN0RnVuYyk7XHJcbiAgfVxyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnZ2FtZW1vZGUtYWN0aXZhdGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdtdWx0aXBsZS1saWItbW9kcycsICdtb2QtaW5zdGFsbGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWJldHRlci1jb250aW5lbnRzJywgMjAsIHRlc3RCZXR0ZXJDb250LCBpbnN0YWxsQmV0dGVyQ29udCk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1jb3JlLXJlbW92ZXInLCAyMCwgdGVzdENvcmVSZW1vdmVyLCBpbnN0YWxsQ29yZVJlbW92ZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0taW5zbGltdm0nLCAyMCwgdGVzdEluU2xpbU1vZExvYWRlciwgaW5zdGFsbEluU2xpbU1vZExvYWRlcik7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS12YnVpbGQnLCAyMCwgdGVzdFZCdWlsZCwgaW5zdGFsbFZCdWlsZE1vZCk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1mdWxsLWJlcC1wYWNrJywgMTAsIHRlc3RGdWxsUGFjaywgaW5zdGFsbEZ1bGxQYWNrKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTAzKGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA0KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA2KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA5KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdpbnNsaW12bWwtbW9kLWxvYWRlcicsIDIwLCBpc1N1cHBvcnRlZCwgZ2V0R2FtZVBhdGgsXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCBoYXNWTUxJbmkgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIElOU0xJTVZNTF9JREVOVElGSUVSLCBwYXRoLmJhc2VuYW1lKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKGhhc1ZNTEluaSk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kIExvYWRlcicgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdpbnNsaW12bWwtbW9kJywgMTAsIGlzU3VwcG9ydGVkLFxyXG4gICAgKCkgPT4gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdJblNsaW1WTUwnLCAnTW9kcycpLCAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICAvLyBVbmZvcnR1bmF0ZWx5IHRoZXJlIGFyZSBjdXJyZW50bHkgbm8gaWRlbnRpZmllcnMgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuXHJcbiAgICAgIC8vICBCZXBJbkV4IGFuZCBJblNsaW1WTUwgbW9kcyBhbmQgdGhlcmVmb3JlIGNhbm5vdCBhdXRvbWF0aWNhbGx5IGFzc2lnblxyXG4gICAgICAvLyAgdGhpcyBtb2RUeXBlIGF1dG9tYXRpY2FsbHkuIFdlIGRvIGtub3cgdGhhdCBDUi1BZHZhbmNlZEJ1aWxkZXIuZGxsIGlzIGFuIEluU2xpbVxyXG4gICAgICAvLyAgbW9kLCBidXQgdGhhdCdzIGFib3V0IGl0LlxyXG4gICAgICBjb25zdCB2bWxTdWZmaXggPSAnX3ZtbC5kbGwnO1xyXG4gICAgICBjb25zdCBtb2QgPSAoaW5wdXQ6IHN0cmluZykgPT4gKGlucHV0Lmxlbmd0aCA+IHZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgPyBwYXRoLmJhc2VuYW1lKGlucHV0KS5zbGljZSgtdm1sU3VmZml4Lmxlbmd0aClcclxuICAgICAgICA6ICcnO1xyXG4gICAgICBjb25zdCB0ZXN0UmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnY3ItYnVpbGRzaGFyZV92bWwuZGxsJywgcGF0aC5iYXNlbmFtZSlcclxuICAgICAgICB8fCBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsICdfdm1sLmRsbCcsIG1vZCk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZSh0ZXN0UmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0luU2xpbVZNTCBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmJ1aWxkLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCwgKCkgPT4gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdBZHZhbmNlZEJ1aWxkZXInLCAnQnVpbGRzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCByZXMgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIFZCVUlMRF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShyZXMpO1xyXG4gICAgfSwgeyBuYW1lOiAnQnVpbGRTaGFyZSBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tbWVzaGVzJywgMTAsIGlzU3VwcG9ydGVkLFxyXG4gICAgKCkgPT4gcGF0aC5qb2luKG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpLCAnQ3VzdG9tTWVzaGVzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIEZCWF9FWFQsIHBhdGguZXh0bmFtZSlcclxuICAgICAgICB8fCBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIE9CSl9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQ3VzdG9tTWVzaGVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbVRleHR1cmVzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXh0dXJlUmd4OiBSZWdFeHAgPSBuZXcgUmVnRXhwKC9edGV4dHVyZV8uKi5wbmckLyk7XHJcbiAgICAgIGxldCBzdXBwb3J0ZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCBpbnN0ciBvZiBpbnN0cnVjdGlvbnMpIHtcclxuICAgICAgICBpZiAoKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICYmIHRleHR1cmVSZ3gudGVzdChwYXRoLmJhc2VuYW1lKGluc3RyLnNvdXJjZSkudG9Mb3dlckNhc2UoKSkpIHtcclxuICAgICAgICAgICAgc3VwcG9ydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQ3VzdG9tVGV4dHVyZXMgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycsIDIwLCBpc1N1cHBvcnRlZCwgZ2V0R2FtZVBhdGgsXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXN0UGF0aCA9IHBhdGguam9pbigndW5zdHJpcHBlZF9tYW5hZ2VkJywgJ21vbm8ucG9zaXguZGxsJyk7XHJcbiAgICAgIGNvbnN0IHN1cHBvcnRlZCA9IGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucyxcclxuICAgICAgICAoaW5zdHIpID0+IGluc3RyLnNvdXJjZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHRlc3RQYXRoKSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnVW5zdHJpcHBlZCBBc3NlbWJsaWVzJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2JlcGluZXgtcm9vdC1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQmVwSW5FeCcpLFxyXG4gIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICBjb25zdCBtYXRjaGVyID0gKGZpbGVQYXRoOiBzdHJpbmcpID0+IHtcclxuICAgICAgY29uc3Qgc2VnbWVudHMgPSBmaWxlUGF0aC5zcGxpdChwYXRoLnNlcCk7XHJcbiAgICAgIGZvciAoY29uc3Qgc3RvcCBvZiBTVE9QX1BBVFRFUk5TKSB7XHJcbiAgICAgICAgaWYgKHNlZ21lbnRzLmluY2x1ZGVzKHN0b3ApKSB7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIGNvbnN0IHN1cHBvcnRlZCA9IGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PiBtYXRjaGVyKGluc3RyLnNvdXJjZSkpO1xyXG4gICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHN1cHBvcnRlZCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXBJbkV4IFJvb3QgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2JldHRlci1jb250aW5lbnRzLW1vZCcsIDI1LCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAndm9ydGV4LXdvcmxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzQkNFeHQgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIEJFVFRFUl9DT05UX0VYVCwgcGF0aC5leHRuYW1lKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKGhhc0JDRXh0KTtcclxuICAgIH0sIHsgbmFtZTogJ0JldHRlciBDb250aW5lbnRzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQub25jZSgoKSA9PiB7XHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCd3aWxsLWRlcGxveScsIGFzeW5jIChwcm9maWxlSWQpID0+IHtcclxuICAgICAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gICAgICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBwYXlsb2FkRGVwbG95ZXIub25XaWxsRGVwbG95KGNvbnRleHQsIHByb2ZpbGVJZClcclxuICAgICAgICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpKSlcclxuICAgICAgICAuY2F0Y2goZXJyID0+IGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkXHJcbiAgICAgICAgICA/IFByb21pc2UucmVzb2x2ZSgpXHJcbiAgICAgICAgICA6IFByb21pc2UucmVqZWN0KGVycikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnZGlkLXB1cmdlJywgYXN5bmMgKHByb2ZpbGVJZCkgPT5cclxuICAgICAgcGF5bG9hZERlcGxveWVyLm9uRGlkUHVyZ2UoY29udGV4dCwgcHJvZmlsZUlkKSk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBtYWluO1xyXG4iXX0=