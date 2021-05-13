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
                    return;
                case 'unstripped_corlib':
                    assignOverridePath('unstripped_corlib');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBc0U7QUFDdEUscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCw2REFBb0U7QUFFcEUscUNBSWtCO0FBQ2xCLDZDQUVtQztBQUNuQyw2Q0FBOEU7QUFDOUUsbUNBQW1FO0FBRW5FLHlDQUFtRTtBQUVuRSxNQUFNLEdBQUcsR0FBRyxpQkFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGNBQUssQ0FBQztBQUV0RCxNQUFNLGFBQWEsR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDeEQsU0FBUyxTQUFTLENBQUMsS0FBSztJQUN0QixPQUFPLE9BQU8sR0FBRyxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLFFBQVE7SUFDZixPQUFPLGlCQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLGlCQUFRLENBQUMsQ0FBQztTQUNoRCxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakMsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsUUFBUTtJQUNoQyxPQUFPLGVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDO1NBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxpQkFBaUIsQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUN6RixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZ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QUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgeyBhcHAgYXMgYXBwSW4sIHJlbW90ZSB9IGZyb20gJ2VsZWN0cm9uJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgYWN0aW9ucywgZnMsIGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5pbXBvcnQgUGFyc2VyLCB7IEluaUZpbGUsIFdpbmFwaUZvcm1hdCB9IGZyb20gJ3ZvcnRleC1wYXJzZS1pbmknO1xyXG5pbXBvcnQgKiBhcyBwYXlsb2FkRGVwbG95ZXIgZnJvbSAnLi9wYXlsb2FkRGVwbG95ZXInO1xyXG5cclxuaW1wb3J0IHsgVW5zdHJpcHBlZEFzc2VtYmx5RG93bmxvYWRlciB9IGZyb20gJy4vdW5zdHJpcHBlZEFzc2VtYmx5JztcclxuXHJcbmltcG9ydCB7XHJcbiAgQkVUVEVSX0NPTlRfRVhULCBGQlhfRVhULCBHQU1FX0lELCBHQU1FX0lEX1NFUlZFUixcclxuICBnZW5Qcm9wcywgZ3Vlc3NNb2RJZCwgSUdOT1JBQkxFX0ZJTEVTLCBJTlNMSU1WTUxfSURFTlRJRklFUixcclxuICBJUHJvcHMsIElTQ01EUHJvcHMsIE5FWFVTLCBPQkpfRVhULCBQYWNrVHlwZSwgU1RFQU1fSUQsIFZCVUlMRF9FWFQsXHJcbn0gZnJvbSAnLi9jb21tb24nO1xyXG5pbXBvcnQgeyBpbnN0YWxsQmV0dGVyQ29udCwgaW5zdGFsbENvcmVSZW1vdmVyLCBpbnN0YWxsRnVsbFBhY2ssIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIsXHJcbiAgaW5zdGFsbFZCdWlsZE1vZCwgdGVzdEJldHRlckNvbnQsIHRlc3RDb3JlUmVtb3ZlciwgdGVzdEZ1bGxQYWNrLCB0ZXN0SW5TbGltTW9kTG9hZGVyLFxyXG4gIHRlc3RWQnVpbGQgfSBmcm9tICcuL2luc3RhbGxlcnMnO1xyXG5pbXBvcnQgeyBtaWdyYXRlMTAzLCBtaWdyYXRlMTA0LCBtaWdyYXRlMTA2LCBtaWdyYXRlMTA5IH0gZnJvbSAnLi9taWdyYXRpb25zJztcclxuaW1wb3J0IHsgaGFzTXVsdGlwbGVMaWJNb2RzLCBpc0RlcGVuZGVuY3lSZXF1aXJlZCB9IGZyb20gJy4vdGVzdHMnO1xyXG5cclxuaW1wb3J0IHsgbWlncmF0ZVIyVG9Wb3J0ZXgsIHVzZXJIYXNSMkluc3RhbGxlZCB9IGZyb20gJy4vcjJWb3J0ZXgnO1xyXG5cclxuY29uc3QgYXBwID0gcmVtb3RlICE9PSB1bmRlZmluZWQgPyByZW1vdGUuYXBwIDogYXBwSW47XHJcblxyXG5jb25zdCBTVE9QX1BBVFRFUk5TID0gWydjb25maWcnLCAncGx1Z2lucycsICdwYXRjaGVycyddO1xyXG5mdW5jdGlvbiB0b1dvcmRFeHAoaW5wdXQpIHtcclxuICByZXR1cm4gJyhefC8pJyArIGlucHV0ICsgJygvfCQpJztcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEdhbWUoKTogYW55IHtcclxuICByZXR1cm4gdXRpbC5HYW1lU3RvcmVIZWxwZXIuZmluZEJ5QXBwSWQoW1NURUFNX0lEXSlcclxuICAgIC50aGVuKGdhbWUgPT4gZ2FtZS5nYW1lUGF0aCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlcXVpcmVzTGF1bmNoZXIoZ2FtZVBhdGgpIHtcclxuICByZXR1cm4gZnMucmVhZGRpckFzeW5jKGdhbWVQYXRoKVxyXG4gICAgLnRoZW4oZmlsZXMgPT4gKGZpbGVzLmZpbmQoZmlsZSA9PiBmaWxlLnRvTG93ZXJDYXNlKCkgPT09ICdzdGVhbV9hcHBpZC50eHQnKSAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IFByb21pc2UucmVzb2x2ZSh7XHJcbiAgICAgICAgbGF1bmNoZXI6ICdzdGVhbScsXHJcbiAgICAgICAgYWRkSW5mbzoge1xyXG4gICAgICAgICAgYXBwSWQ6IFNURUFNX0lELFxyXG4gICAgICAgICAgcGFyYW1ldGVyczogWyctZm9yY2UtZ2xjb3JlJ10sXHJcbiAgICAgICAgICBsYXVuY2hUeXBlOiAnZ2FtZXN0b3JlJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9KVxyXG4gICAgICA6IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpKVxyXG4gICAgLmNhdGNoKGVyciA9PiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMocHJvcHM6IElQcm9wcyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IGFwaSA9IHByb3BzLmFwaTtcclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICBjb25zdCBleHBlY3RlZEZpbGVQYXRoID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG4gIGNvbnN0IGZ1bGxQYWNrQ29yTGliT2xkID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ0JlcEluRXgnLCAnY29yZV9saWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk5ldyA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX2NvcmxpYicsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG5cclxuICBjb25zdCB1cmwgPSBwYXRoLmpvaW4oTkVYVVMsICd2YWxoZWltJywgJ21vZHMnLCAnMTIwMicpICsgYD90YWI9ZmlsZXMmZmlsZV9pZD00ODk5Jm5tbT0xYDtcclxuICBjb25zdCByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nID0gKCkgPT4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnTWlzc2luZyB1bnN0cmlwcGVkIGFzc2VtYmxpZXMnLCB7XHJcbiAgICAgIGJiY29kZTogdCgnVmFsaGVpbVxcJ3MgYXNzZW1ibGllcyBhcmUgZGlzdHJpYnV0ZWQgaW4gYW4gXCJvcHRpbWlzZWRcIiBzdGF0ZSB0byByZWR1Y2UgcmVxdWlyZWQgJ1xyXG4gICAgICArICdkaXNrIHNwYWNlLiBUaGlzIHVuZm9ydHVuYXRlbHkgbWVhbnMgdGhhdCBWYWxoZWltXFwncyBtb2RkaW5nIGNhcGFiaWxpdGllcyBhcmUgYWxzbyBhZmZlY3RlZC57e2JyfX17e2JyfX0nXHJcbiAgICAgICsgJ0luIG9yZGVyIHRvIG1vZCBWYWxoZWltLCB0aGUgdW5vcHRpbWlzZWQvdW5zdHJpcHBlZCBhc3NlbWJsaWVzIGFyZSByZXF1aXJlZCAtIHBsZWFzZSBkb3dubG9hZCB0aGVzZSAnXHJcbiAgICAgICsgJ2Zyb20gTmV4dXMgTW9kcy57e2JyfX17e2JyfX0gWW91IGNhbiBjaG9vc2UgdGhlIFZvcnRleC9tb2QgbWFuYWdlciBkb3dubG9hZCBvciBtYW51YWwgZG93bmxvYWQgJ1xyXG4gICAgICArICcoc2ltcGx5IGRyYWcgYW5kIGRyb3AgdGhlIGFyY2hpdmUgaW50byB0aGUgbW9kcyBkcm9wem9uZSB0byBhZGQgaXQgdG8gVm9ydGV4KS57e2JyfX17e2JyfX0nXHJcbiAgICAgICsgJ1ZvcnRleCB3aWxsIHRoZW4gYmUgYWJsZSB0byBpbnN0YWxsIHRoZSBhc3NlbWJsaWVzIHdoZXJlIHRoZXkgYXJlIG5lZWRlZCB0byBlbmFibGUgJ1xyXG4gICAgICArICdtb2RkaW5nLCBsZWF2aW5nIHRoZSBvcmlnaW5hbCBvbmVzIHVudG91Y2hlZC4nLCB7IHJlcGxhY2U6IHsgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICB9LCBbXHJcbiAgICAgIHsgbGFiZWw6ICdDYW5jZWwnLCBhY3Rpb246ICgpID0+IHJlamVjdChuZXcgdXRpbC5Vc2VyQ2FuY2VsZWQoKSkgfSxcclxuICAgICAge1xyXG4gICAgICAgIGxhYmVsOiAnRG93bmxvYWQgVW5zdHJpcHBlZCBBc3NlbWJsaWVzJyxcclxuICAgICAgICBhY3Rpb246ICgpID0+IHV0aWwub3BuKHVybClcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4gbnVsbClcclxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHJlc29sdmUoKSksXHJcbiAgICAgIH0sXHJcbiAgICBdKTtcclxuICB9KTtcclxuXHJcbiAgY29uc3QgYXNzaWduT3ZlcnJpZGVQYXRoID0gYXN5bmMgKG92ZXJyaWRlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICBjb25zdCBkb29yU3RvcENvbmZpZyA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCwgJ2Rvb3JzdG9wX2NvbmZpZy5pbmknKTtcclxuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBQYXJzZXIobmV3IFdpbmFwaUZvcm1hdCgpKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGluaURhdGE6IEluaUZpbGU8YW55PiA9IGF3YWl0IHBhcnNlci5yZWFkKGRvb3JTdG9wQ29uZmlnKTtcclxuICAgICAgaW5pRGF0YS5kYXRhWydVbml0eURvb3JzdG9wJ11bJ2RsbFNlYXJjaFBhdGhPdmVycmlkZSddID0gb3ZlcnJpZGVQYXRoO1xyXG4gICAgICBhd2FpdCBwYXJzZXIud3JpdGUoZG9vclN0b3BDb25maWcsIGluaURhdGEpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ2ZhaWxlZCB0byBtb2RpZnkgZG9vcnN0b3AgY29uZmlndXJhdGlvbicsIGVycik7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWRzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICBjb25zdCBoYXNDb3JlTGliVHlwZSA9IHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sXHJcbiAgICAgIFsnYXR0cmlidXRlcycsICdDb3JlTGliVHlwZSddLCB1bmRlZmluZWQpICE9PSB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSxcclxuICAgICAgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIGhhc0NvcmVMaWJUeXBlICYmIGlzRW5hYmxlZDtcclxuICB9KTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZHMubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGUgdXNlciBoYXMgc2V2ZXJhbCBpbnN0YWxsZWQsIHNlbGVjdCB0aGUgZmlyc3Qgb25lLlxyXG4gICAgY29uc3QgY29yZUxpYk1vZElkID0gY29yZUxpYk1vZElkc1swXTtcclxuXHJcbiAgICBjb25zdCBwYWNrVHlwZTogUGFja1R5cGUgPSBtb2RzW2NvcmVMaWJNb2RJZF0uYXR0cmlidXRlc1snQ29yZUxpYlR5cGUnXTtcclxuICAgIHN3aXRjaCAocGFja1R5cGUpIHtcclxuICAgICAgY2FzZSAnY29yZV9saWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgnQmVwSW5FeFxcXFxjb3JlX2xpYicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgY2FzZSAndW5zdHJpcHBlZF9jb3JsaWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgndW5zdHJpcHBlZF9jb3JsaWInKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgLy8gbm9wIC0gbGV0IHRoZSBmb3IgbG9vcCBiZWxvdyB0cnkgdG8gZmluZCB0aGUgcGFjay5cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgZmlsZVBhdGggb2YgW2Z1bGxQYWNrQ29yTGliTmV3LCBmdWxsUGFja0NvckxpYk9sZF0pIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhmaWxlUGF0aCk7XHJcbiAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgLy8gbm9wXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgdmFsaWQgdmFyaWFudCBvZiB0aGUgdW5zdHJpcHBlZCBhc3NlbWJseSBtb2RzIGZvdW5kIG9uIE5leHVzLlxyXG4gIGNvbnN0IHVuc3RyaXBwZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGlkID0+IG1vZHNbaWRdPy50eXBlID09PSAndW5zdHJpcHBlZC1hc3NlbWJsaWVzJyk7XHJcbiAgaWYgKHVuc3RyaXBwZWRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIGZvciAoY29uc3QgbW9kSWQgb2YgdW5zdHJpcHBlZE1vZHMpIHtcclxuICAgICAgaWYgKHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLCBbJ21vZFN0YXRlJywgbW9kSWQsICdlbmFibGVkJ10sIGZhbHNlKSkge1xyXG4gICAgICAgIGNvbnN0IGRsaWQgPSBtb2RzW21vZElkXS5hcmNoaXZlSWQ7XHJcbiAgICAgICAgY29uc3QgZG93bmxvYWQ6IHR5cGVzLklEb3dubG9hZCA9IHV0aWwuZ2V0U2FmZShhcGkuZ2V0U3RhdGUoKSxcclxuICAgICAgICAgIFsncGVyc2lzdGVudCcsICdkb3dubG9hZHMnLCAnZmlsZXMnLCBkbGlkXSwgdW5kZWZpbmVkKTtcclxuICAgICAgICBpZiAoZG93bmxvYWQubG9jYWxQYXRoICE9PSB1bmRlZmluZWQgJiYgZ3Vlc3NNb2RJZChkb3dubG9hZC5sb2NhbFBhdGgpICE9PSAnMTUnKSB7XHJcbiAgICAgICAgICAvLyBUaGUgTmV4dXMgTW9kcyB1bnN0cmlwcGVkIGFzc21lYmxpZXMgbW9kIGlzIGVuYWJsZWQgLSBkb24ndCByYWlzZSB0aGUgbWlzc2luZ1xyXG4gICAgICAgICAgLy8gIGFzc2VtYmxpZXMgZGlhbG9nLlxyXG4gICAgICAgICAgY29uc3QgZGxsT3ZlcnJpZGVQYXRoID0gZXhwZWN0ZWRGaWxlUGF0aC5yZXBsYWNlKHByb3BzLmRpc2NvdmVyeS5wYXRoICsgcGF0aC5zZXAsICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHBhdGguc2VwICsgJ21vbm8uc2VjdXJpdHkuZGxsJywgJycpO1xyXG4gICAgICAgICAgYXdhaXQgYXNzaWduT3ZlcnJpZGVQYXRoKGRsbE92ZXJyaWRlUGF0aCk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCBkb3dubG9hZGVyID0gbmV3IFVuc3RyaXBwZWRBc3NlbWJseURvd25sb2FkZXIodXRpbC5nZXRWb3J0ZXhQYXRoKCd0ZW1wJykpO1xyXG5cclxuICB0cnkge1xyXG4gICAgY29uc3QgYXJjaGl2ZUZpbGVQYXRoID0gYXdhaXQgZG93bmxvYWRlci5kb3dubG9hZE5ld2VzdCgnZnVsbF9uYW1lJywgJ2Rlbmlrc29uLUJlcEluRXhQYWNrX1ZhbGhlaW0nKTtcclxuICAgIC8vIEdpdmUgaXQgYSBzZWNvbmQgZm9yIHRoZSBkb3dubG9hZCB0byByZWdpc3RlciBpbiB0aGUgc3RhdGUuXHJcbiAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxyXG4gICAgICBhcGkuZXZlbnRzLmVtaXQoJ2ltcG9ydC1kb3dubG9hZHMnLCBbIGFyY2hpdmVGaWxlUGF0aCBdLCBhc3luYyAoZGxJZHM6IHN0cmluZ1tdKSA9PiB7XHJcbiAgICAgIGlmIChkbElkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyB1dGlsLlByb2Nlc3NDYW5jZWxlZCgnRmFpbGVkIHRvIGltcG9ydCBhcmNoaXZlJykpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGNvbnN0IGRsSWQgb2YgZGxJZHMpIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzMiwgcmVqMikgPT5cclxuICAgICAgICAgIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtaW5zdGFsbC1kb3dubG9hZCcsIGRsSWQsIHRydWUsIChlcnIsIG1vZElkKSA9PiB7XHJcbiAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWoyKGVycik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RFbmFibGVkKHByb3BzLnByb2ZpbGUuaWQsIG1vZElkLCB0cnVlKSk7XHJcbiAgICAgICAgICByZXR1cm4gcmVzMih1bmRlZmluZWQpO1xyXG4gICAgICAgIH0pKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0RGVwbG95bWVudE5lY2Vzc2FyeShHQU1FX0lELCB0cnVlKSk7XHJcbiAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aCgndW5zdHJpcHBlZF9jb3JsaWInKTtcclxuICAgICAgcmV0dXJuIHJlc29sdmUodW5kZWZpbmVkKTtcclxuICAgIH0pKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHJldHVybiByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nKCk7XHJcbiAgICAvLyBhcGkuc2hvd0RpYWxvZygnZXJyb3InLCAnTWlzc2luZyBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLCB7XHJcbiAgICAvLyAgIHRleHQ6ICdWb3J0ZXggd2FzIHVuYWJsZSB0byBhdXRvbWF0aWNhbGx5IGRvd25sb2FkIHRoZSByZXF1aXJlZCB1bnN0cmlwcGVkIGFzc2VtYmxpZXMuICdcclxuICAgIC8vICAgICAgICsgJ1RoZXNlIG11c3QgYmUgZG93bmxvYWRlZCBhbmQgbWFudWFsbHkgaW5zdGFsbGVkIHRocm91Z2ggVm9ydGV4IGJ5IGRyYWctYW5kLWRyb3BwaW5nIHRoZSAnXHJcbiAgICAvLyAgICAgICArICdkb3dubG9hZGVkIGFyY2hpdmUgaW5zaWRlIFZvcnRleFxcJ3MgbW9kcyBwYWdlLiBNb2RzIHdpbGwgbm90IGZ1bmN0aW9uIGNvcnJlY3RseSB3aXRob3V0IHRoaXMgcGFja2FnZS4nLFxyXG4gICAgLy8gfSwgW1xyXG4gICAgLy8gICB7IGxhYmVsOiAnQ2xvc2UnIH0sXHJcbiAgICAvLyAgIHtcclxuICAgIC8vICAgICBsYWJlbDogJ0Rvd25sb2FkIEJlcEluRXggUGFjaycsXHJcbiAgICAvLyAgICAgYWN0aW9uOiAoKSA9PiB1dGlsLm9wbignaHR0cHM6Ly92YWxoZWltLnRodW5kZXJzdG9yZS5pby9wYWNrYWdlL2Rlbmlrc29uL0JlcEluRXhQYWNrX1ZhbGhlaW0vJykuY2F0Y2goKCkgPT4gbnVsbCksXHJcbiAgICAvLyAgICAgZGVmYXVsdDogdHJ1ZSxcclxuICAgIC8vICAgfSxcclxuICAgIC8vIF0pO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCkge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcmV2UHJvZklkOiBzdHJpbmcgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJldlByb2ZJZCk7XHJcbiAgY29uc3QgbW9kVHlwZXM6IHsgW3R5cGVJZDogc3RyaW5nXTogc3RyaW5nIH0gPSBzZWxlY3RvcnMubW9kUGF0aHNGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBjcmVhdGVEaXJlY3RvcmllcyA9IGFzeW5jICgpID0+IHtcclxuICAgIGZvciAoY29uc3QgbW9kVHlwZSBvZiBPYmplY3Qua2V5cyhtb2RUeXBlcykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKG1vZFR5cGVzW21vZFR5cGVdKTtcclxuICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG4gIHJldHVybiBuZXcgQmx1ZWJpcmQ8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4gY3JlYXRlRGlyZWN0b3JpZXMoKVxyXG4gICAgLnRoZW4oKCkgPT4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlPy5pZCkpXHJcbiAgICAudGhlbigoKSA9PiByZXNvbHZlKCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IHJlamVjdChlcnIpKSlcclxuICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyh7IGFwaTogY29udGV4dC5hcGksIHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb2RzUGF0aChnYW1lUGF0aDogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIHBhdGguam9pbihnYW1lUGF0aCwgJ0JlcEluRXgnLCAncGx1Z2lucycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWluKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0KSB7XHJcbiAgY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gICAgaWQ6IEdBTUVfSUQsXHJcbiAgICBuYW1lOiAnVmFsaGVpbScsXHJcbiAgICBtZXJnZU1vZHM6IHRydWUsXHJcbiAgICBxdWVyeVBhdGg6IGZpbmRHYW1lLFxyXG4gICAgcXVlcnlNb2RQYXRoOiBtb2RzUGF0aCxcclxuICAgIGxvZ286ICdnYW1lYXJ0LmpwZycsXHJcbiAgICBleGVjdXRhYmxlOiAoKSA9PiAndmFsaGVpbS5leGUnLFxyXG4gICAgcmVxdWlyZXNMYXVuY2hlcixcclxuICAgIHNldHVwOiBkaXNjb3ZlcnkgPT4gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dCwgZGlzY292ZXJ5KSxcclxuICAgIHJlcXVpcmVkRmlsZXM6IFtcclxuICAgICAgJ3ZhbGhlaW0uZXhlJyxcclxuICAgIF0sXHJcbiAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAgIH0sXHJcbiAgICBkZXRhaWxzOiB7XHJcbiAgICAgIHN0ZWFtQXBwSWQ6ICtTVEVBTV9JRCxcclxuICAgICAgc3RvcFBhdHRlcm5zOiBTVE9QX1BBVFRFUk5TLm1hcCh0b1dvcmRFeHApLFxyXG4gICAgICBpZ25vcmVDb25mbGljdHM6IFtdLmNvbmNhdChJR05PUkFCTEVfRklMRVMsIElHTk9SQUJMRV9GSUxFUy5tYXAoZmlsZSA9PiBmaWxlLnRvTG93ZXJDYXNlKCkpKSxcclxuICAgICAgaWdub3JlRGVwbG95OiBbXS5jb25jYXQoSUdOT1JBQkxFX0ZJTEVTLCBJR05PUkFCTEVfRklMRVMubWFwKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpKSksXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICAvLyBjb250ZXh0LnJlZ2lzdGVyR2FtZSh7XHJcbiAgLy8gICBpZDogR0FNRV9JRF9TRVJWRVIsXHJcbiAgLy8gICBuYW1lOiAnVmFsaGVpbTogRGVkaWNhdGVkIFNlcnZlcicsXHJcbiAgLy8gICBtZXJnZU1vZHM6IHRydWUsXHJcbiAgLy8gICBxdWVyeVBhdGg6ICgpID0+IHVuZGVmaW5lZCxcclxuICAvLyAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgLy8gICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gIC8vICAgZXhlY3V0YWJsZTogKCkgPT4gJ3N0YXJ0X2hlYWRsZXNzX3NlcnZlci5iYXQnLFxyXG4gIC8vICAgcmVxdWlyZXNMYXVuY2hlcixcclxuICAvLyAgIHNldHVwOiBkaXNjb3ZlcnkgPT4gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dCwgZGlzY292ZXJ5KSxcclxuICAvLyAgIHJlcXVpcmVkRmlsZXM6IFtcclxuICAvLyAgICAgJ3N0YXJ0X2hlYWRsZXNzX3NlcnZlci5iYXQnLFxyXG4gIC8vICAgXSxcclxuICAvLyAgIGVudmlyb25tZW50OiB7XHJcbiAgLy8gICAgIFN0ZWFtQVBQSWQ6IFNURUFNX0lELFxyXG4gIC8vICAgfSxcclxuICAvLyAgIGRldGFpbHM6IHtcclxuICAvLyAgICAgbmV4dXNQYWdlSWQ6IEdBTUVfSUQsXHJcbiAgLy8gICAgIHN0ZWFtQXBwSWQ6ICtTVEVBTV9JRCxcclxuICAvLyAgICAgc3RvcFBhdHRlcm5zOiBTVE9QX1BBVFRFUk5TLm1hcCh0b1dvcmRFeHApLFxyXG4gIC8vICAgICBpZ25vcmVDb25mbGljdHM6IElHTk9SQUJMRV9GSUxFUyxcclxuICAvLyAgICAgaWdub3JlRGVwbG95OiBJR05PUkFCTEVfRklMRVMsXHJcbiAgLy8gICB9LFxyXG4gIC8vIH0pO1xyXG5cclxuICBjb25zdCBnZXRHYW1lUGF0aCA9ICgpID0+IHtcclxuICAgIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0KTtcclxuICAgIHJldHVybiAocHJvcHM/LmRpc2NvdmVyeT8ucGF0aCAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IHByb3BzLmRpc2NvdmVyeS5wYXRoIDogJy4nO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGlzU3VwcG9ydGVkID0gKGdhbWVJZDogc3RyaW5nKSA9PiAoZ2FtZUlkID09PSBHQU1FX0lEKTtcclxuICBjb25zdCBoYXNJbnN0cnVjdGlvbiA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByZWQ6IChpbnN0OiB0eXBlcy5JSW5zdHJ1Y3Rpb24pID0+IGJvb2xlYW4pID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbnMuZmluZChpbnN0ciA9PiAoaW5zdHIudHlwZSA9PT0gJ2NvcHknKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHByZWQoaW5zdHIpKSkgIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgY29uc3QgZmluZEluc3RyTWF0Y2ggPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kPzogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIG1vZCA9IChpbnB1dCkgPT4gaW5wdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLCAoaW5zdHIpID0+XHJcbiAgICAgIG1vZChpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT09IHBhdHRlcm4udG9Mb3dlckNhc2UoKSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdmJ1aWxkRGVwVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGdhbWVQYXRoID0gZ2V0R2FtZVBhdGgoKTtcclxuICAgIGNvbnN0IGJ1aWxkU2hhcmVBc3NlbWJseSA9IHBhdGguam9pbihnYW1lUGF0aCwgJ0luU2xpbVZNTCcsICdNb2RzJywgJ0NSLUJ1aWxkU2hhcmVfVk1MLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YnVpbGQtbW9kJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJ2luc2xpbXZtbC1tb2QnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQnVpbGRTaGFyZSAoQWR2YW5jZWRCdWlsZGluZyknLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy81JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyBidWlsZFNoYXJlQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGN1c3RvbU1lc2hlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbU1lc2hlcy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmFsaGVpbS1jdXN0b20tbWVzaGVzJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdDdXN0b21NZXNoZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy8xODQnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGN1c3RvbVRleHR1cmVzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQ3VzdG9tVGV4dHVyZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLXRleHR1cmVzJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdDdXN0b21UZXh0dXJlcycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzQ4JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBiZXR0ZXJDb250aW5lbnRzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQmV0dGVyQ29udGluZW50cy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAnYmV0dGVyLWNvbnRpbmVudHMtbW9kJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdCZXR0ZXIgQ29udGluZW50cycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzQ0NicsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3RlckFjdGlvbignbW9kLWljb25zJywgMTAwLCAnc3RlYW1jbWQnLCB7fSwgJ1N0ZWFtQ01EIERlZGljYXRlZCBTZXJ2ZXInLCAoKSA9PiB7XHJcbiAgLy8gICBjb250ZXh0LmFwaS5zZWxlY3REaXIoe30pXHJcbiAgLy8gICAgIC50aGVuKChzZWxlY3RlZFBhdGg6IHN0cmluZykgPT4ge1xyXG4gIC8vICAgICAgIGlmIChzZWxlY3RlZFBhdGgpIHtcclxuICAvLyAgICAgICAgIGNvbnN0IHByb3BzOiBJU0NNRFByb3BzID0ge1xyXG4gIC8vICAgICAgICAgICBnYW1lSWQ6IEdBTUVfSURfU0VSVkVSLFxyXG4gIC8vICAgICAgICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgLy8gICAgICAgICAgIGFyZ3VtZW50czogW1xyXG4gIC8vICAgICAgICAgICAgIHsgYXJndW1lbnQ6ICdmb3JjZV9pbnN0YWxsX2RpcicsIHZhbHVlOiBzZWxlY3RlZFBhdGggfSxcclxuICAvLyAgICAgICAgICAgICB7IGFyZ3VtZW50OiAncXVpdCcgfSxcclxuICAvLyAgICAgICAgICAgXSxcclxuICAvLyAgICAgICAgICAgY2FsbGJhY2s6ICgoZXJyLCBkYXRhKSA9PiBudWxsKSxcclxuICAvLyAgICAgICAgIH07XHJcbiAgLy8gICAgICAgICBjb250ZXh0LmFwaS5leHQuc2NtZFN0YXJ0RGVkaWNhdGVkU2VydmVyKHByb3BzKTtcclxuICAvLyAgICAgICB9XHJcbiAgLy8gICAgIH0pXHJcbiAgLy8gICAgIC5jYXRjaChlcnIgPT4gbnVsbCk7XHJcbiAgLy8gfSwgKCkgPT4gY29udGV4dC5hcGkuZXh0Py5zY21kU3RhcnREZWRpY2F0ZWRTZXJ2ZXIgIT09IHVuZGVmaW5lZCk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDExNSwgJ2ltcG9ydCcsIHt9LCAnSW1wb3J0IEZyb20gcjJtb2RtYW4nLCAoKSA9PiB7XHJcbiAgICBtaWdyYXRlUjJUb1ZvcnRleChjb250ZXh0LmFwaSk7XHJcbiAgfSwgKCkgPT4ge1xyXG4gICAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgY29uc3QgYWN0aXZlR2FtZUlkID0gc2VsZWN0b3JzLmFjdGl2ZUdhbWVJZChzdGF0ZSk7XHJcbiAgICByZXR1cm4gdXNlckhhc1IySW5zdGFsbGVkKClcclxuICAgICAgJiYgKGdldEdhbWVQYXRoKCkgIT09ICcuJylcclxuICAgICAgJiYgKGFjdGl2ZUdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGRlcGVuZGVuY3lUZXN0cyA9IFsgdmJ1aWxkRGVwVGVzdCwgY3VzdG9tTWVzaGVzVGVzdCxcclxuICAgIGN1c3RvbVRleHR1cmVzVGVzdCwgYmV0dGVyQ29udGluZW50c1Rlc3QgXTtcclxuXHJcbiAgZm9yIChjb25zdCB0ZXN0RnVuYyBvZiBkZXBlbmRlbmN5VGVzdHMpIHtcclxuICAgIGNvbnRleHQucmVnaXN0ZXJUZXN0KHRlc3RGdW5jLm5hbWUudG9TdHJpbmcoKSwgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIHRlc3RGdW5jKTtcclxuICAgIGNvbnRleHQucmVnaXN0ZXJUZXN0KHRlc3RGdW5jLm5hbWUudG9TdHJpbmcoKSwgJ21vZC1pbnN0YWxsZWQnLCB0ZXN0RnVuYyk7XHJcbiAgfVxyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnZ2FtZW1vZGUtYWN0aXZhdGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdtdWx0aXBsZS1saWItbW9kcycsICdtb2QtaW5zdGFsbGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWJldHRlci1jb250aW5lbnRzJywgMjAsIHRlc3RCZXR0ZXJDb250LCBpbnN0YWxsQmV0dGVyQ29udCk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1jb3JlLXJlbW92ZXInLCAyMCwgdGVzdENvcmVSZW1vdmVyLCBpbnN0YWxsQ29yZVJlbW92ZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0taW5zbGltdm0nLCAyMCwgdGVzdEluU2xpbU1vZExvYWRlciwgaW5zdGFsbEluU2xpbU1vZExvYWRlcik7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS12YnVpbGQnLCAyMCwgdGVzdFZCdWlsZCwgaW5zdGFsbFZCdWlsZE1vZCk7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1mdWxsLWJlcC1wYWNrJywgMTAsIHRlc3RGdWxsUGFjaywgaW5zdGFsbEZ1bGxQYWNrKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTAzKGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA0KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA2KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcbiAgY29udGV4dC5yZWdpc3Rlck1pZ3JhdGlvbigob2xkVmVyc2lvbjogc3RyaW5nKSA9PiBtaWdyYXRlMTA5KGNvbnRleHQuYXBpLCBvbGRWZXJzaW9uKSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdpbnNsaW12bWwtbW9kLWxvYWRlcicsIDIwLCBpc1N1cHBvcnRlZCwgZ2V0R2FtZVBhdGgsXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCBoYXNWTUxJbmkgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIElOU0xJTVZNTF9JREVOVElGSUVSLCBwYXRoLmJhc2VuYW1lKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKGhhc1ZNTEluaSk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kIExvYWRlcicgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdpbnNsaW12bWwtbW9kJywgMTAsIGlzU3VwcG9ydGVkLFxyXG4gICAgKCkgPT4gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdJblNsaW1WTUwnLCAnTW9kcycpLCAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICAvLyBVbmZvcnR1bmF0ZWx5IHRoZXJlIGFyZSBjdXJyZW50bHkgbm8gaWRlbnRpZmllcnMgdG8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuXHJcbiAgICAgIC8vICBCZXBJbkV4IGFuZCBJblNsaW1WTUwgbW9kcyBhbmQgdGhlcmVmb3JlIGNhbm5vdCBhdXRvbWF0aWNhbGx5IGFzc2lnblxyXG4gICAgICAvLyAgdGhpcyBtb2RUeXBlIGF1dG9tYXRpY2FsbHkuIFdlIGRvIGtub3cgdGhhdCBDUi1BZHZhbmNlZEJ1aWxkZXIuZGxsIGlzIGFuIEluU2xpbVxyXG4gICAgICAvLyAgbW9kLCBidXQgdGhhdCdzIGFib3V0IGl0LlxyXG4gICAgICBjb25zdCB2bWxTdWZmaXggPSAnX3ZtbC5kbGwnO1xyXG4gICAgICBjb25zdCBtb2QgPSAoaW5wdXQ6IHN0cmluZykgPT4gKGlucHV0Lmxlbmd0aCA+IHZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgPyBwYXRoLmJhc2VuYW1lKGlucHV0KS5zbGljZSgtdm1sU3VmZml4Lmxlbmd0aClcclxuICAgICAgICA6ICcnO1xyXG4gICAgICBjb25zdCB0ZXN0UmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnY3ItYnVpbGRzaGFyZV92bWwuZGxsJywgcGF0aC5iYXNlbmFtZSlcclxuICAgICAgICB8fCBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsICdfdm1sLmRsbCcsIG1vZCk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZSh0ZXN0UmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0luU2xpbVZNTCBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmJ1aWxkLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCwgKCkgPT4gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdBZHZhbmNlZEJ1aWxkZXInLCAnQnVpbGRzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCByZXMgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIFZCVUlMRF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShyZXMpO1xyXG4gICAgfSwgeyBuYW1lOiAnQnVpbGRTaGFyZSBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tbWVzaGVzJywgMTAsIGlzU3VwcG9ydGVkLFxyXG4gICAgKCkgPT4gcGF0aC5qb2luKG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpLCAnQ3VzdG9tTWVzaGVzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIEZCWF9FWFQsIHBhdGguZXh0bmFtZSlcclxuICAgICAgICB8fCBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIE9CSl9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQ3VzdG9tTWVzaGVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbVRleHR1cmVzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXh0dXJlUmd4OiBSZWdFeHAgPSBuZXcgUmVnRXhwKC9edGV4dHVyZV8uKi5wbmckLyk7XHJcbiAgICAgIGxldCBzdXBwb3J0ZWQgPSBmYWxzZTtcclxuICAgICAgZm9yIChjb25zdCBpbnN0ciBvZiBpbnN0cnVjdGlvbnMpIHtcclxuICAgICAgICBpZiAoKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICYmIHRleHR1cmVSZ3gudGVzdChwYXRoLmJhc2VuYW1lKGluc3RyLnNvdXJjZSkudG9Mb3dlckNhc2UoKSkpIHtcclxuICAgICAgICAgICAgc3VwcG9ydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQ3VzdG9tVGV4dHVyZXMgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycsIDIwLCBpc1N1cHBvcnRlZCwgZ2V0R2FtZVBhdGgsXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCB0ZXN0UGF0aCA9IHBhdGguam9pbigndW5zdHJpcHBlZF9tYW5hZ2VkJywgJ21vbm8ucG9zaXguZGxsJyk7XHJcbiAgICAgIGNvbnN0IHN1cHBvcnRlZCA9IGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucyxcclxuICAgICAgICAoaW5zdHIpID0+IGluc3RyLnNvdXJjZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHRlc3RQYXRoKSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnVW5zdHJpcHBlZCBBc3NlbWJsaWVzJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2JlcGluZXgtcm9vdC1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQmVwSW5FeCcpLFxyXG4gIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICBjb25zdCBtYXRjaGVyID0gKGZpbGVQYXRoOiBzdHJpbmcpID0+IHtcclxuICAgICAgY29uc3Qgc2VnbWVudHMgPSBmaWxlUGF0aC5zcGxpdChwYXRoLnNlcCk7XHJcbiAgICAgIGZvciAoY29uc3Qgc3RvcCBvZiBTVE9QX1BBVFRFUk5TKSB7XHJcbiAgICAgICAgaWYgKHNlZ21lbnRzLmluY2x1ZGVzKHN0b3ApKSB7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIGNvbnN0IHN1cHBvcnRlZCA9IGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PiBtYXRjaGVyKGluc3RyLnNvdXJjZSkpO1xyXG4gICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHN1cHBvcnRlZCk7XHJcbiAgICB9LCB7IG5hbWU6ICdCZXBJbkV4IFJvb3QgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2JldHRlci1jb250aW5lbnRzLW1vZCcsIDI1LCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAndm9ydGV4LXdvcmxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzQkNFeHQgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIEJFVFRFUl9DT05UX0VYVCwgcGF0aC5leHRuYW1lKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKGhhc0JDRXh0KTtcclxuICAgIH0sIHsgbmFtZTogJ0JldHRlciBDb250aW5lbnRzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQub25jZSgoKSA9PiB7XHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCd3aWxsLWRlcGxveScsIGFzeW5jIChwcm9maWxlSWQpID0+IHtcclxuICAgICAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gICAgICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBwYXlsb2FkRGVwbG95ZXIub25XaWxsRGVwbG95KGNvbnRleHQsIHByb2ZpbGVJZClcclxuICAgICAgICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpKSlcclxuICAgICAgICAuY2F0Y2goZXJyID0+IGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkXHJcbiAgICAgICAgICA/IFByb21pc2UucmVzb2x2ZSgpXHJcbiAgICAgICAgICA6IFByb21pc2UucmVqZWN0KGVycikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnZGlkLXB1cmdlJywgYXN5bmMgKHByb2ZpbGVJZCkgPT5cclxuICAgICAgcGF5bG9hZERlcGxveWVyLm9uRGlkUHVyZ2UoY29udGV4dCwgcHJvZmlsZUlkKSk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBtYWluO1xyXG4iXX0=