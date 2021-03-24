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
const common_1 = require("./common");
const installers_1 = require("./installers");
const migrations_1 = require("./migrations");
const tests_1 = require("./tests");
const r2Vortex_1 = require("./r2Vortex");
const app = electron_1.remote !== undefined ? electron_1.remote.app : electron_1.app;
const WORLDS_PATH = path.resolve(app.getPath('appData'), '..', 'LocalLow', 'IronGate', 'Valheim', 'worlds');
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
                    action: () => vortex_api_1.util.opn('https://www.nexusmods.com/valheim/mods/15')
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
        for (const filePath of [fullPackCorLibNew, fullPackCorLibOld, expectedFilePath]) {
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
        return raiseMissingAssembliesDialog();
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
            ignoreConflicts: common_1.IGNORABLE_FILES,
            ignoreDeploy: common_1.IGNORABLE_FILES,
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
    }, () => r2Vortex_1.userHasR2Installed() && getGamePath() !== '.');
    const dependencyTests = [vbuildDepTest, customMeshesTest,
        customTexturesTest];
    for (const testFunc of dependencyTests) {
        context.registerTest(testFunc.name.toString(), 'gamemode-activated', testFunc);
        context.registerTest(testFunc.name.toString(), 'mod-installed', testFunc);
    }
    context.registerTest('multiple-lib-mods', 'gamemode-activated', () => tests_1.hasMultipleLibMods(context.api));
    context.registerTest('multiple-lib-mods', 'mod-installed', () => tests_1.hasMultipleLibMods(context.api));
    context.registerInstaller('valheim-core-remover', 20, installers_1.testCoreRemover, installers_1.installCoreRemover);
    context.registerInstaller('valheim-inslimvm', 20, installers_1.testInSlimModLoader, installers_1.installInSlimModLoader);
    context.registerInstaller('valheim-vbuild', 20, installers_1.testVBuild, installers_1.installVBuildMod);
    context.registerInstaller('valheim-full-bep-pack', 10, installers_1.testFullPack, installers_1.installFullPack);
    context.registerMigration((oldVersion) => migrations_1.migrate103(context.api, oldVersion));
    context.registerMigration((oldVersion) => migrations_1.migrate104(context.api, oldVersion));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBNkQ7QUFDN0QscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCxxQ0FDb0U7QUFDcEUsNkNBRXVGO0FBQ3ZGLDZDQUFzRDtBQUN0RCxtQ0FBbUU7QUFFbkUseUNBQW1FO0FBRW5FLE1BQU0sR0FBRyxHQUFHLGlCQUFNLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxpQkFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBSyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDckQsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRXJELE1BQU0sYUFBYSxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUN4RCxTQUFTLFNBQVMsQ0FBQyxLQUFLO0lBQ3RCLE9BQU8sT0FBTyxHQUFHLEtBQUssR0FBRyxPQUFPLENBQUM7QUFDbkMsQ0FBQztBQUVELFNBQVMsUUFBUTtJQUNmLE9BQU8saUJBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUMsaUJBQVEsQ0FBQyxDQUFDO1NBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxRQUFRO0lBQ2hDLE9BQU8sZUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUM7U0FDN0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxLQUFLLGlCQUFpQixDQUFDLEtBQUssU0FBUyxDQUFDO1FBQ3pGLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1lBQ2hCLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLE9BQU8sRUFBRTtnQkFDUCxLQUFLLEVBQUUsaUJBQVE7Z0JBQ2YsVUFBVSxFQUFFLENBQUMsZUFBZSxDQUFDO2dCQUM3QixVQUFVLEVBQUUsV0FBVzthQUN4QjtTQUNGLENBQUM7UUFDRixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUM5QixLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkMsQ0FBQztBQUVELFNBQWUsMEJBQTBCLENBQUMsS0FBYTs7UUFDckQsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztRQUN0QixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO1FBQ3hCLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksRUFDckQsb0JBQW9CLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUM3QyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQ3RELFNBQVMsRUFBRSxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUM5QyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQ3RELG1CQUFtQixFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFFNUMsTUFBTSw0QkFBNEIsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUMvRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSwrQkFBK0IsRUFBRTtnQkFDdEQsTUFBTSxFQUFFLENBQUMsQ0FBQyxtRkFBbUY7c0JBQzNGLDBHQUEwRztzQkFDMUcsc0dBQXNHO3NCQUN0RyxpR0FBaUc7c0JBQ2pHLDRGQUE0RjtzQkFDNUYscUZBQXFGO3NCQUNyRiwrQ0FBK0MsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDO2FBQ3JGLEVBQUU7Z0JBQ0QsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUU7Z0JBQ2xFO29CQUNFLEtBQUssRUFBRSxnQ0FBZ0M7b0JBQ3ZDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxpQkFBSSxDQUFDLEdBQUcsQ0FBQywyQ0FBMkMsQ0FBQzt5QkFDaEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO3lCQUNsQixPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7aUJBQzVCO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLENBQU8sWUFBb0IsRUFBRSxFQUFFO1lBQ3hELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUM5RSxNQUFNLE1BQU0sR0FBRyxJQUFJLDBCQUFNLENBQUMsSUFBSSwrQkFBWSxFQUFFLENBQUMsQ0FBQztZQUM5QyxJQUFJO2dCQUNGLE1BQU0sT0FBTyxHQUFpQixNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2hFLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsdUJBQXVCLENBQUMsR0FBRyxZQUFZLENBQUM7Z0JBQ3RFLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDN0M7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixHQUFHLENBQUMscUJBQXFCLENBQUMseUNBQXlDLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDM0U7UUFDSCxDQUFDLENBQUEsQ0FBQztRQUVGLE1BQU0sSUFBSSxHQUNSLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRSxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNuRCxNQUFNLGNBQWMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQzNDLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLFNBQVMsQ0FBQztZQUMxRCxNQUFNLFNBQVMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUMxQyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FBTyxjQUFjLElBQUksU0FBUyxDQUFDO1FBQ3JDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxhQUFhLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUU1QixNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEMsTUFBTSxRQUFRLEdBQWEsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUN4RSxRQUFRLFFBQVEsRUFBRTtnQkFDaEIsS0FBSyxVQUFVO29CQUNiLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ3hDLE9BQU87Z0JBQ1QsS0FBSyxtQkFBbUI7b0JBQ3RCLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQ3hDLE9BQU87Z0JBQ1QsUUFBUTthQUVUO1NBQ0Y7UUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUMsRUFBRTtZQUMvRSxJQUFJO2dCQUNGLE1BQU0sZUFBRSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDN0IsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztxQkFDNUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsbUJBQW1CLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzdFLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQzFDLE9BQU87YUFDUjtZQUFDLE9BQU8sR0FBRyxFQUFFO2FBRWI7U0FDRjtRQUVELE9BQU8sNEJBQTRCLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0NBQUE7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE9BQWdDLEVBQUUsU0FBaUM7SUFDNUYsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNyQyxNQUFNLFVBQVUsR0FBVyxzQkFBUyxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSxnQkFBTyxDQUFDLENBQUM7SUFDOUUsTUFBTSxPQUFPLEdBQW1CLHNCQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN6RSxNQUFNLFFBQVEsR0FBaUMsc0JBQVMsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLGdCQUFPLENBQUMsQ0FBQztJQUN6RixNQUFNLGlCQUFpQixHQUFHLEdBQVMsRUFBRTtRQUNuQyxLQUFLLE1BQU0sT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDM0MsSUFBSTtnQkFDRixNQUFNLGVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUNwRDtZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM1QjtTQUNGO0lBQ0gsQ0FBQyxDQUFBLENBQUM7SUFDRixPQUFPLElBQUksa0JBQVEsQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixFQUFFO1NBQy9ELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsRUFBRSxDQUFDLENBQUM7U0FDOUQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ3JCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQzVCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzNGLENBQUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxRQUFnQjtJQUNoQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUNuRCxDQUFDO0FBRUQsU0FBUyxJQUFJLENBQUMsT0FBZ0M7SUFDNUMsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUNuQixFQUFFLEVBQUUsZ0JBQU87UUFDWCxJQUFJLEVBQUUsU0FBUztRQUNmLFNBQVMsRUFBRSxJQUFJO1FBQ2YsU0FBUyxFQUFFLFFBQVE7UUFDbkIsWUFBWSxFQUFFLFFBQVE7UUFDdEIsSUFBSSxFQUFFLGFBQWE7UUFDbkIsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLGFBQWE7UUFDL0IsZ0JBQWdCO1FBQ2hCLEtBQUssRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7UUFDekQsYUFBYSxFQUFFO1lBQ2IsYUFBYTtTQUNkO1FBQ0QsV0FBVyxFQUFFO1lBQ1gsVUFBVSxFQUFFLGlCQUFRO1NBQ3JCO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsVUFBVSxFQUFFLENBQUMsaUJBQVE7WUFDckIsWUFBWSxFQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQzFDLGVBQWUsRUFBRSx3QkFBZTtZQUNoQyxZQUFZLEVBQUUsd0JBQWU7U0FDOUI7S0FDRixDQUFDLENBQUM7SUFFSCxNQUFNLFdBQVcsR0FBRyxHQUFHLEVBQUU7O1FBQ3ZCLE1BQU0sS0FBSyxHQUFXLGlCQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDeEMsT0FBTyxDQUFDLE9BQUEsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLFNBQVMsMENBQUUsSUFBSSxNQUFLLFNBQVMsQ0FBQztZQUMzQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUNqQyxDQUFDLENBQUM7SUFFRixNQUFNLFdBQVcsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxNQUFNLEtBQUssZ0JBQU8sQ0FBQyxDQUFDO0lBQzdELE1BQU0sY0FBYyxHQUFHLENBQUMsWUFBa0MsRUFDbEMsSUFBMkMsRUFBRSxFQUFFLENBQzdDLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDO1dBQ3ZCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUM7SUFFbEYsTUFBTSxjQUFjLEdBQUcsQ0FBQyxZQUFrQyxFQUNsQyxPQUFlLEVBQ2YsR0FBK0IsRUFBRSxFQUFFO1FBQ3pELElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRTtZQUNyQixHQUFHLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQztTQUN4QjtRQUNELE9BQU8sY0FBYyxDQUFDLFlBQVksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQzVDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsV0FBVyxFQUFFLEtBQUssT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDL0QsQ0FBQyxDQUFDO0lBRUYsTUFBTSxhQUFhLEdBQUcsR0FBRyxFQUFFO1FBQ3pCLE1BQU0sUUFBUSxHQUFHLFdBQVcsRUFBRSxDQUFDO1FBQy9CLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBQzdGLE9BQU8sNEJBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUN2QyxnQkFBZ0IsRUFBRSxZQUFZO1lBQzlCLGFBQWEsRUFBRSxlQUFlO1lBQzlCLFVBQVUsRUFBRSwrQkFBK0I7WUFDM0MsU0FBUyxFQUFFLDBDQUEwQztZQUNyRCxhQUFhLEVBQUUsQ0FBRSxrQkFBa0IsQ0FBRTtTQUN0QyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLGdCQUFnQixHQUFHLEdBQUcsRUFBRTtRQUM1QixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUN6QyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDakUsT0FBTyw0QkFBb0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ3ZDLGdCQUFnQixFQUFFLHVCQUF1QjtZQUN6QyxhQUFhLEVBQUUsRUFBRTtZQUNqQixVQUFVLEVBQUUsY0FBYztZQUMxQixTQUFTLEVBQUUsNENBQTRDO1lBQ3ZELGFBQWEsRUFBRSxDQUFFLGdCQUFnQixDQUFFO1NBQ3BDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQztJQUVGLE1BQU0sa0JBQWtCLEdBQUcsR0FBRyxFQUFFO1FBQzlCLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUNuRSxPQUFPLDRCQUFvQixDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7WUFDdkMsZ0JBQWdCLEVBQUUseUJBQXlCO1lBQzNDLGFBQWEsRUFBRSxFQUFFO1lBQ2pCLFVBQVUsRUFBRSxnQkFBZ0I7WUFDNUIsU0FBUyxFQUFFLDJDQUEyQztZQUN0RCxhQUFhLEVBQUUsQ0FBRSxnQkFBZ0IsQ0FBRTtTQUNwQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLG9CQUFvQixHQUFHLEdBQUcsRUFBRTtRQUNoQyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUN6QyxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLHNCQUFzQixDQUFDLENBQUM7UUFDckUsT0FBTyw0QkFBb0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ3ZDLGdCQUFnQixFQUFFLHVCQUF1QjtZQUN6QyxhQUFhLEVBQUUsRUFBRTtZQUNqQixVQUFVLEVBQUUsbUJBQW1CO1lBQy9CLFNBQVMsRUFBRSw0Q0FBNEM7WUFDdkQsYUFBYSxFQUFFLENBQUUsZ0JBQWdCLENBQUU7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsT0FBTyxDQUFDLGNBQWMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsc0JBQXNCLEVBQUUsR0FBRyxFQUFFO1FBQ2xGLDRCQUFpQixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsNkJBQWtCLEVBQUUsSUFBSSxXQUFXLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQztJQUV4RCxNQUFNLGVBQWUsR0FBRyxDQUFFLGFBQWEsRUFBRSxnQkFBZ0I7UUFDdkQsa0JBQWtCLENBQUUsQ0FBQztJQUV2QixLQUFLLE1BQU0sUUFBUSxJQUFJLGVBQWUsRUFBRTtRQUN0QyxPQUFPLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0UsT0FBTyxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztLQUMzRTtJQUVELE9BQU8sQ0FBQyxZQUFZLENBQUMsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQzVELEdBQUcsRUFBRSxDQUFDLDBCQUFrQixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLE9BQU8sQ0FBQyxZQUFZLENBQUMsbUJBQW1CLEVBQUUsZUFBZSxFQUN2RCxHQUFHLEVBQUUsQ0FBQywwQkFBa0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUd6QyxPQUFPLENBQUMsaUJBQWlCLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxFQUFFLDRCQUFlLEVBQUUsK0JBQWtCLENBQUMsQ0FBQztJQUMzRixPQUFPLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLGdDQUFtQixFQUFFLG1DQUFzQixDQUFDLENBQUM7SUFDL0YsT0FBTyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFLEVBQUUsRUFBRSx1QkFBVSxFQUFFLDZCQUFnQixDQUFDLENBQUM7SUFDOUUsT0FBTyxDQUFDLGlCQUFpQixDQUFDLHVCQUF1QixFQUFFLEVBQUUsRUFBRSx5QkFBWSxFQUFFLDRCQUFlLENBQUMsQ0FBQztJQUV0RixPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxVQUFrQixFQUFFLEVBQUUsQ0FBQyx1QkFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN2RixPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxVQUFrQixFQUFFLEVBQUUsQ0FBQyx1QkFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUV2RixPQUFPLENBQUMsZUFBZSxDQUFDLHNCQUFzQixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUMxRSxDQUFDLFlBQWtDLEVBQUUsRUFBRTtRQUNyQyxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLDZCQUFvQixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNwRixPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztJQUV2QyxPQUFPLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUN0RCxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLFdBQVcsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLFlBQWtDLEVBQUUsRUFBRTtRQUsxRixNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUM7UUFDN0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFhLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQzlELENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7WUFDL0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNQLE1BQU0sT0FBTyxHQUFHLGNBQWMsQ0FBQyxZQUFZLEVBQUUsdUJBQXVCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQztlQUMvRSxjQUFjLENBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNuRCxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbkQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7SUFFaEMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxFQUNoSCxDQUFDLFlBQWtDLEVBQUUsRUFBRTtRQUNyQyxNQUFNLEdBQUcsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLG1CQUFVLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25FLE9BQU8sa0JBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMvQyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO0lBRWpDLE9BQU8sQ0FBQyxlQUFlLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFDOUQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBRSxjQUFjLENBQUMsRUFDeEQsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxnQkFBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7ZUFDaEUsY0FBYyxDQUFDLFlBQVksRUFBRSxnQkFBTyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN6RCxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztJQUVuQyxPQUFPLENBQUMsZUFBZSxDQUFDLHlCQUF5QixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQ2hFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsRUFDMUQsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxVQUFVLEdBQVcsSUFBSSxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUMxRCxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7UUFDdEIsS0FBSyxNQUFNLEtBQUssSUFBSSxZQUFZLEVBQUU7WUFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDO21CQUN0QixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQUU7Z0JBQzdELFNBQVMsR0FBRyxJQUFJLENBQUM7Z0JBQ2pCLE1BQU07YUFDVDtTQUNGO1FBQ0QsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxDQUFDLENBQUM7SUFFckMsT0FBTyxDQUFDLGVBQWUsQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFDM0UsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ25FLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxZQUFZLEVBQzNDLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQzVELE9BQU8sa0JBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNyRCxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsdUJBQXVCLEVBQUUsQ0FBQyxDQUFDO0lBRXhDLE9BQU8sQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFLFNBQVMsQ0FBQyxFQUN0RyxDQUFDLFlBQWtDLEVBQUUsRUFBRTtRQUNyQyxNQUFNLE9BQU8sR0FBRyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtZQUNuQyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMxQyxLQUFLLE1BQU0sSUFBSSxJQUFJLGFBQWEsRUFBRTtnQkFDaEMsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUMzQixPQUFPLElBQUksQ0FBQztpQkFDYjthQUNGO1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUM7UUFDRixNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDakYsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ25ELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7SUFRbkMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQU8sU0FBUyxFQUFFLEVBQUU7WUFDckQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxNQUFNLE9BQU8sR0FBRyxzQkFBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDeEQsSUFBSSxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxNQUFNLE1BQUssZ0JBQU8sRUFBRTtnQkFDL0IsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDMUI7WUFDRCxPQUFPLGVBQWUsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQztpQkFDcEQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLDBCQUEwQixDQUFDLGlCQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7aUJBQ3BFLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxpQkFBSSxDQUFDLFlBQVk7Z0JBQzVDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFO2dCQUNuQixDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzdCLENBQUMsQ0FBQSxDQUFDLENBQUM7UUFFSCxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBTyxTQUFTLEVBQUUsRUFBRSxnREFDbkQsT0FBQSxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQztJQWdEcEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgeyBhcHAgYXMgYXBwSW4sIHJlbW90ZSB9IGZyb20gJ2VsZWN0cm9uJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZnMsIGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5pbXBvcnQgUGFyc2VyLCB7IEluaUZpbGUsIFdpbmFwaUZvcm1hdCB9IGZyb20gJ3ZvcnRleC1wYXJzZS1pbmknO1xyXG5pbXBvcnQgKiBhcyBwYXlsb2FkRGVwbG95ZXIgZnJvbSAnLi9wYXlsb2FkRGVwbG95ZXInO1xyXG5cclxuaW1wb3J0IHsgQkVUVEVSX0NPTlRfRVhULCBGQlhfRVhULCBHQU1FX0lELCBnZW5Qcm9wcywgSUdOT1JBQkxFX0ZJTEVTLCBJTlNMSU1WTUxfSURFTlRJRklFUixcclxuICBJUHJvcHMsIE9CSl9FWFQsIFBhY2tUeXBlLCBTVEVBTV9JRCwgVkJVSUxEX0VYVCB9IGZyb20gJy4vY29tbW9uJztcclxuaW1wb3J0IHsgaW5zdGFsbEJldHRlckNvbnQsIGluc3RhbGxDb3JlUmVtb3ZlciwgaW5zdGFsbEZ1bGxQYWNrLCBpbnN0YWxsSW5TbGltTW9kTG9hZGVyLCBpbnN0YWxsVkJ1aWxkTW9kLFxyXG4gIHRlc3RCZXR0ZXJDb250LFxyXG4gIHRlc3RDb3JlUmVtb3ZlciwgdGVzdEZ1bGxQYWNrLCB0ZXN0SW5TbGltTW9kTG9hZGVyLCB0ZXN0VkJ1aWxkIH0gZnJvbSAnLi9pbnN0YWxsZXJzJztcclxuaW1wb3J0IHsgbWlncmF0ZTEwMywgbWlncmF0ZTEwNCB9IGZyb20gJy4vbWlncmF0aW9ucyc7XHJcbmltcG9ydCB7IGhhc011bHRpcGxlTGliTW9kcywgaXNEZXBlbmRlbmN5UmVxdWlyZWQgfSBmcm9tICcuL3Rlc3RzJztcclxuXHJcbmltcG9ydCB7IG1pZ3JhdGVSMlRvVm9ydGV4LCB1c2VySGFzUjJJbnN0YWxsZWQgfSBmcm9tICcuL3IyVm9ydGV4JztcclxuXHJcbmNvbnN0IGFwcCA9IHJlbW90ZSAhPT0gdW5kZWZpbmVkID8gcmVtb3RlLmFwcCA6IGFwcEluO1xyXG5jb25zdCBXT1JMRFNfUEFUSCA9IHBhdGgucmVzb2x2ZShhcHAuZ2V0UGF0aCgnYXBwRGF0YScpLFxyXG4gICcuLicsICdMb2NhbExvdycsICdJcm9uR2F0ZScsICdWYWxoZWltJywgJ3dvcmxkcycpO1xyXG5cclxuY29uc3QgU1RPUF9QQVRURVJOUyA9IFsnY29uZmlnJywgJ3BsdWdpbnMnLCAncGF0Y2hlcnMnXTtcclxuZnVuY3Rpb24gdG9Xb3JkRXhwKGlucHV0KSB7XHJcbiAgcmV0dXJuICcoXnwvKScgKyBpbnB1dCArICcoL3wkKSc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRHYW1lKCk6IGFueSB7XHJcbiAgcmV0dXJuIHV0aWwuR2FtZVN0b3JlSGVscGVyLmZpbmRCeUFwcElkKFtTVEVBTV9JRF0pXHJcbiAgICAudGhlbihnYW1lID0+IGdhbWUuZ2FtZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXF1aXJlc0xhdW5jaGVyKGdhbWVQYXRoKSB7XHJcbiAgcmV0dXJuIGZzLnJlYWRkaXJBc3luYyhnYW1lUGF0aClcclxuICAgIC50aGVuKGZpbGVzID0+IChmaWxlcy5maW5kKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpID09PSAnc3RlYW1fYXBwaWQudHh0JykgIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBQcm9taXNlLnJlc29sdmUoe1xyXG4gICAgICAgIGxhdW5jaGVyOiAnc3RlYW0nLFxyXG4gICAgICAgIGFkZEluZm86IHtcclxuICAgICAgICAgIGFwcElkOiBTVEVBTV9JRCxcclxuICAgICAgICAgIHBhcmFtZXRlcnM6IFsnLWZvcmNlLWdsY29yZSddLFxyXG4gICAgICAgICAgbGF1bmNoVHlwZTogJ2dhbWVzdG9yZScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSlcclxuICAgICAgOiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKSlcclxuICAgIC5jYXRjaChlcnIgPT4gUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKHByb3BzOiBJUHJvcHMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCBhcGkgPSBwcm9wcy5hcGk7XHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcbiAgY29uc3QgZXhwZWN0ZWRGaWxlUGF0aCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX21hbmFnZWQnLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk9sZCA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICdCZXBJbkV4JywgJ2NvcmVfbGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJOZXcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9jb3JsaWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuXHJcbiAgY29uc3QgcmFpc2VNaXNzaW5nQXNzZW1ibGllc0RpYWxvZyA9ICgpID0+IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ01pc3NpbmcgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW1cXCdzIGFzc2VtYmxpZXMgYXJlIGRpc3RyaWJ1dGVkIGluIGFuIFwib3B0aW1pc2VkXCIgc3RhdGUgdG8gcmVkdWNlIHJlcXVpcmVkICdcclxuICAgICAgKyAnZGlzayBzcGFjZS4gVGhpcyB1bmZvcnR1bmF0ZWx5IG1lYW5zIHRoYXQgVmFsaGVpbVxcJ3MgbW9kZGluZyBjYXBhYmlsaXRpZXMgYXJlIGFsc28gYWZmZWN0ZWQue3ticn19e3ticn19J1xyXG4gICAgICArICdJbiBvcmRlciB0byBtb2QgVmFsaGVpbSwgdGhlIHVub3B0aW1pc2VkL3Vuc3RyaXBwZWQgYXNzZW1ibGllcyBhcmUgcmVxdWlyZWQgLSBwbGVhc2UgZG93bmxvYWQgdGhlc2UgJ1xyXG4gICAgICArICdmcm9tIE5leHVzIE1vZHMue3ticn19e3ticn19IFlvdSBjYW4gY2hvb3NlIHRoZSBWb3J0ZXgvbW9kIG1hbmFnZXIgZG93bmxvYWQgb3IgbWFudWFsIGRvd25sb2FkICdcclxuICAgICAgKyAnKHNpbXBseSBkcmFnIGFuZCBkcm9wIHRoZSBhcmNoaXZlIGludG8gdGhlIG1vZHMgZHJvcHpvbmUgdG8gYWRkIGl0IHRvIFZvcnRleCkue3ticn19e3ticn19J1xyXG4gICAgICArICdWb3J0ZXggd2lsbCB0aGVuIGJlIGFibGUgdG8gaW5zdGFsbCB0aGUgYXNzZW1ibGllcyB3aGVyZSB0aGV5IGFyZSBuZWVkZWQgdG8gZW5hYmxlICdcclxuICAgICAgKyAnbW9kZGluZywgbGVhdmluZyB0aGUgb3JpZ2luYWwgb25lcyB1bnRvdWNoZWQuJywgeyByZXBsYWNlOiB7IGJyOiAnW2JyXVsvYnJdJyB9IH0pLFxyXG4gICAgfSwgW1xyXG4gICAgICB7IGxhYmVsOiAnQ2FuY2VsJywgYWN0aW9uOiAoKSA9PiByZWplY3QobmV3IHV0aWwuVXNlckNhbmNlbGVkKCkpIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB1dGlsLm9wbignaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTUnKVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiBudWxsKVxyXG4gICAgICAgICAgLmZpbmFsbHkoKCkgPT4gcmVzb2x2ZSgpKSxcclxuICAgICAgfSxcclxuICAgIF0pO1xyXG4gIH0pO1xyXG5cclxuICBjb25zdCBhc3NpZ25PdmVycmlkZVBhdGggPSBhc3luYyAob3ZlcnJpZGVQYXRoOiBzdHJpbmcpID0+IHtcclxuICAgIGNvbnN0IGRvb3JTdG9wQ29uZmlnID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLCAnZG9vcnN0b3BfY29uZmlnLmluaScpO1xyXG4gICAgY29uc3QgcGFyc2VyID0gbmV3IFBhcnNlcihuZXcgV2luYXBpRm9ybWF0KCkpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaW5pRGF0YTogSW5pRmlsZTxhbnk+ID0gYXdhaXQgcGFyc2VyLnJlYWQoZG9vclN0b3BDb25maWcpO1xyXG4gICAgICBpbmlEYXRhLmRhdGFbJ1VuaXR5RG9vcnN0b3AnXVsnZGxsU2VhcmNoUGF0aE92ZXJyaWRlJ10gPSBvdmVycmlkZVBhdGg7XHJcbiAgICAgIGF3YWl0IHBhcnNlci53cml0ZShkb29yU3RvcENvbmZpZywgaW5pRGF0YSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignZmFpbGVkIHRvIG1vZGlmeSBkb29yc3RvcCBjb25maWd1cmF0aW9uJywgZXJyKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShwcm9wcy5zdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IGNvcmVMaWJNb2RJZHMgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoa2V5ID0+IHtcclxuICAgIGNvbnN0IGhhc0NvcmVMaWJUeXBlID0gdXRpbC5nZXRTYWZlKG1vZHNba2V5XSxcclxuICAgICAgWydhdHRyaWJ1dGVzJywgJ0NvcmVMaWJUeXBlJ10sIHVuZGVmaW5lZCkgIT09IHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IGlzRW5hYmxlZCA9IHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLFxyXG4gICAgICBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSk7XHJcbiAgICByZXR1cm4gaGFzQ29yZUxpYlR5cGUgJiYgaXNFbmFibGVkO1xyXG4gIH0pO1xyXG5cclxuICBpZiAoY29yZUxpYk1vZElkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAvLyBXZSBkb24ndCBjYXJlIGlmIHRoZSB1c2VyIGhhcyBzZXZlcmFsIGluc3RhbGxlZCwgc2VsZWN0IHRoZSBmaXJzdCBvbmUuXHJcbiAgICBjb25zdCBjb3JlTGliTW9kSWQgPSBjb3JlTGliTW9kSWRzWzBdO1xyXG5cclxuICAgIGNvbnN0IHBhY2tUeXBlOiBQYWNrVHlwZSA9IG1vZHNbY29yZUxpYk1vZElkXS5hdHRyaWJ1dGVzWydDb3JlTGliVHlwZSddO1xyXG4gICAgc3dpdGNoIChwYWNrVHlwZSkge1xyXG4gICAgICBjYXNlICdjb3JlX2xpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCdCZXBJbkV4XFxcXGNvcmVfbGliJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBjYXNlICd1bnN0cmlwcGVkX2NvcmxpYic6XHJcbiAgICAgICAgYXNzaWduT3ZlcnJpZGVQYXRoKCd1bnN0cmlwcGVkX2NvcmxpYicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICAvLyBub3AgLSBsZXQgdGhlIGZvciBsb29wIGJlbG93IHRyeSB0byBmaW5kIHRoZSBwYWNrLlxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBbZnVsbFBhY2tDb3JMaWJOZXcsIGZ1bGxQYWNrQ29yTGliT2xkLCBleHBlY3RlZEZpbGVQYXRoXSkge1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgZnMuc3RhdEFzeW5jKGZpbGVQYXRoKTtcclxuICAgICAgY29uc3QgZGxsT3ZlcnJpZGVQYXRoID0gZmlsZVBhdGgucmVwbGFjZShwcm9wcy5kaXNjb3ZlcnkucGF0aCArIHBhdGguc2VwLCAnJylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShwYXRoLnNlcCArICdtb25vLnNlY3VyaXR5LmRsbCcsICcnKTtcclxuICAgICAgYXdhaXQgYXNzaWduT3ZlcnJpZGVQYXRoKGRsbE92ZXJyaWRlUGF0aCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAvLyBub3BcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQpIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJldlByb2ZJZDogc3RyaW5nID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByZXZQcm9mSWQpO1xyXG4gIGNvbnN0IG1vZFR5cGVzOiB7IFt0eXBlSWQ6IHN0cmluZ106IHN0cmluZyB9ID0gc2VsZWN0b3JzLm1vZFBhdGhzRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgY3JlYXRlRGlyZWN0b3JpZXMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBmb3IgKGNvbnN0IG1vZFR5cGUgb2YgT2JqZWN0LmtleXMobW9kVHlwZXMpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhtb2RUeXBlc1ttb2RUeXBlXSk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuICByZXR1cm4gbmV3IEJsdWViaXJkPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IGNyZWF0ZURpcmVjdG9yaWVzKClcclxuICAgIC50aGVuKCgpID0+IHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZT8uaWQpKVxyXG4gICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKVxyXG4gICAgLmNhdGNoKGVyciA9PiByZWplY3QoZXJyKSkpXHJcbiAgLnRoZW4oKCkgPT4gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMoeyBhcGk6IGNvbnRleHQuYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kc1BhdGgoZ2FtZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCk7XHJcbiAgICByZXR1cm4gKHByb3BzPy5kaXNjb3Zlcnk/LnBhdGggIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBwcm9wcy5kaXNjb3ZlcnkucGF0aCA6ICcuJztcclxuICB9O1xyXG5cclxuICBjb25zdCBpc1N1cHBvcnRlZCA9IChnYW1lSWQ6IHN0cmluZykgPT4gKGdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgY29uc3QgaGFzSW5zdHJ1Y3Rpb24gPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVkOiAoaW5zdDogdHlwZXMuSUluc3RydWN0aW9uKSA9PiBib29sZWFuKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zLmZpbmQoaW5zdHIgPT4gKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIChwcmVkKGluc3RyKSkpICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gIGNvbnN0IGZpbmRJbnN0ck1hdGNoID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1vZD86IChpbnB1dDogc3RyaW5nKSA9PiBzdHJpbmcpID0+IHtcclxuICAgIGlmIChtb2QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBtb2QgPSAoaW5wdXQpID0+IGlucHV0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PlxyXG4gICAgICBtb2QoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpID09PSBwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IHZidWlsZERlcFRlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBnYW1lUGF0aCA9IGdldEdhbWVQYXRoKCk7XHJcbiAgICBjb25zdCBidWlsZFNoYXJlQXNzZW1ibHkgPSBwYXRoLmpvaW4oZ2FtZVBhdGgsICdJblNsaW1WTUwnLCAnTW9kcycsICdDUi1CdWlsZFNoYXJlX1ZNTC5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmJ1aWxkLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICdpbnNsaW12bWwtbW9kJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0J1aWxkU2hhcmUgKEFkdmFuY2VkQnVpbGRpbmcpJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNScsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgYnVpbGRTaGFyZUFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21NZXNoZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21NZXNoZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tTWVzaGVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTg0JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBjdXN0b21UZXh0dXJlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbVRleHR1cmVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS10ZXh0dXJlcycsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQ3VzdG9tVGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80OCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgYmV0dGVyQ29udGluZW50c1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0JldHRlckNvbnRpbmVudHMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ2JldHRlci1jb250aW5lbnRzLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICcnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQmV0dGVyIENvbnRpbmVudHMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy80NDYnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDExNSwgJ2ltcG9ydCcsIHt9LCAnSW1wb3J0IEZyb20gcjJtb2RtYW4nLCAoKSA9PiB7XHJcbiAgICBtaWdyYXRlUjJUb1ZvcnRleChjb250ZXh0LmFwaSk7XHJcbiAgfSwgKCkgPT4gdXNlckhhc1IySW5zdGFsbGVkKCkgJiYgZ2V0R2FtZVBhdGgoKSAhPT0gJy4nKTtcclxuXHJcbiAgY29uc3QgZGVwZW5kZW5jeVRlc3RzID0gWyB2YnVpbGREZXBUZXN0LCBjdXN0b21NZXNoZXNUZXN0LFxyXG4gICAgY3VzdG9tVGV4dHVyZXNUZXN0IF07XHJcblxyXG4gIGZvciAoY29uc3QgdGVzdEZ1bmMgb2YgZGVwZW5kZW5jeVRlc3RzKSB7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB0ZXN0RnVuYyk7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdtb2QtaW5zdGFsbGVkJywgdGVzdEZ1bmMpO1xyXG4gIH1cclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ211bHRpcGxlLWxpYi1tb2RzJywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnbW9kLWluc3RhbGxlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuXHJcbiAgLy8gY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1iZXR0ZXItY29udGluZW50cycsIDIwLCB0ZXN0QmV0dGVyQ29udCwgaW5zdGFsbEJldHRlckNvbnQpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNChjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIC8vIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgLy8gICAoKSA9PiBXT1JMRFNfUEFUSCwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAvLyAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgLy8gICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gIC8vICAgfSwgeyBuYW1lOiAnQmV0dGVyIENvbnRpbmVudHMgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5vbmNlKCgpID0+IHtcclxuICAgIGNvbnRleHQuYXBpLm9uQXN5bmMoJ3dpbGwtZGVwbG95JywgYXN5bmMgKHByb2ZpbGVJZCkgPT4ge1xyXG4gICAgICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgICAgIGlmIChwcm9maWxlPy5nYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZUlkKVxyXG4gICAgICAgIC50aGVuKCgpID0+IGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKGdlblByb3BzKGNvbnRleHQsIHByb2ZpbGVJZCkpKVxyXG4gICAgICAgIC5jYXRjaChlcnIgPT4gZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWRcclxuICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcclxuICAgICAgICAgIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCdkaWQtcHVyZ2UnLCBhc3luYyAocHJvZmlsZUlkKSA9PlxyXG4gICAgICBwYXlsb2FkRGVwbG95ZXIub25EaWRQdXJnZShjb250ZXh0LCBwcm9maWxlSWQpKTtcclxuXHJcbiAgICAvLyBjb250ZXh0LmFwaS5vbkFzeW5jKCdhZGRlZC1maWxlcycsIGFzeW5jIChwcm9maWxlSWQsIGZpbGVzKSA9PiB7XHJcbiAgICAvLyAgIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpO1xyXG4gICAgLy8gICBpZiAocHJvcHMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gICAgIHJldHVybjtcclxuICAgIC8vICAgfVxyXG4gICAgLy8gICBjb25zdCBzdGF0ZSA9IHByb3BzLnN0YXRlO1xyXG4gICAgLy8gICBjb25zdCBnYW1lID0gdXRpbC5nZXRHYW1lKEdBTUVfSUQpO1xyXG4gICAgLy8gICBjb25zdCBkaXNjb3ZlcnkgPSBwcm9wcy5kaXNjb3Zlcnk7XHJcbiAgICAvLyAgIGNvbnN0IG1vZFBhdGhzID0gZ2FtZS5nZXRNb2RQYXRocyhkaXNjb3ZlcnkucGF0aCk7XHJcbiAgICAvLyAgIGNvbnN0IGluc3RhbGxQYXRoID0gc2VsZWN0b3JzLmluc3RhbGxQYXRoRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgICAvLyAgIGNvbnN0IG1hbmlmZXN0OiB0eXBlcy5JRGVwbG95bWVudE1hbmlmZXN0ID0gYXdhaXQgdXRpbC5nZXRNYW5pZmVzdChjb250ZXh0LmFwaSwgJ2JldHRlci1jb250aW5lbnRzLW1vZCcsIEdBTUVfSUQpO1xyXG4gICAgLy8gICBjb25zdCBhZGRGaWxlVG9Nb2QgPSBhc3luYyAoZW50cnksIG1vZElkKSA9PiB7XHJcbiAgICAvLyAgICAgY29uc3QgbW9kOiB0eXBlcy5JTW9kID0gdXRpbC5nZXRTYWZlKHN0YXRlLnBlcnNpc3RlbnQubW9kcywgW0dBTUVfSUQsIG1vZElkXSwgdW5kZWZpbmVkKTtcclxuICAgIC8vICAgICAgIGlmIChtb2Q/LnR5cGUgIT09ICdiZXR0ZXItY29udGluZW50cy1tb2QnKSB7XHJcbiAgICAvLyAgICAgICAgIC8vIFdlIG9ubHkgd2FudCB0byBwaWNrdXAgdGhlIC5vbGQgZmlsZXMgZ2VuZXJhdGVkIGJ5IHRoZSBnYW1lXHJcbiAgICAvLyAgICAgICAgIC8vICBhcyBwYXJ0IG9mIGl0cyBcIndvcmxkc1wiIHN5bmMgd2hpY2ggaXMgd2h5IHdlIG9ubHkgY2FyZSBmb3JcclxuICAgIC8vICAgICAgICAgLy8gICdiZXR0ZXItY29udGluZW50cy1tb2QnIG1vZHR5cGUuXHJcbiAgICAvLyAgICAgICAgIHJldHVybjtcclxuICAgIC8vICAgICAgIH1cclxuXHJcbiAgICAvLyAgICAgICBjb25zdCByZWxQYXRoID0gcGF0aC5yZWxhdGl2ZShtb2RQYXRoc1ttb2QudHlwZV0sIGVudHJ5LmZpbGVQYXRoKTtcclxuICAgIC8vICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBwYXRoLmpvaW4oaW5zdGFsbFBhdGgsIG1vZC5pZCwgcmVsUGF0aCk7XHJcbiAgICAvLyAgICAgICAvLyBjb3B5IHRoZSBuZXcgZmlsZSBiYWNrIGludG8gdGhlIGNvcnJlc3BvbmRpbmcgbW9kLCB0aGVuIGRlbGV0ZSBpdC4gVGhhdCB3YXksIHZvcnRleCB3aWxsXHJcbiAgICAvLyAgICAgICAvLyBjcmVhdGUgYSBsaW5rIHRvIGl0IHdpdGggdGhlIGNvcnJlY3QgZGVwbG95bWVudCBtZXRob2QgYW5kIG5vdCBhc2sgdGhlIHVzZXIgYW55IHF1ZXN0aW9uc1xyXG4gICAgLy8gICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyQXN5bmMocGF0aC5kaXJuYW1lKHRhcmdldFBhdGgpKTtcclxuICAgIC8vICAgICAgIHRyeSB7XHJcbiAgICAvLyAgICAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhlbnRyeS5maWxlUGF0aCwgdGFyZ2V0UGF0aCk7XHJcbiAgICAvLyAgICAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKGVudHJ5LmZpbGVQYXRoKTtcclxuICAgIC8vICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgLy8gICAgICAgICBsb2coJ2Vycm9yJywgJ2ZhaWxlZCB0byBwZXJzaXN0IG5ld2x5IGFkZGVkIGZpbGUnLCBlcnIpO1xyXG4gICAgLy8gICAgICAgICByZXR1cm47XHJcbiAgICAvLyAgICAgICB9XHJcbiAgICAvLyAgIH1cclxuICAgIC8vICAgZm9yIChjb25zdCBlbnRyeSBvZiBmaWxlcykge1xyXG4gICAgLy8gICAgIGlmIChlbnRyeS5jYW5kaWRhdGVzPy5sZW5ndGggPT09IDEpIHtcclxuICAgIC8vICAgICAgIGF3YWl0IGFkZEZpbGVUb01vZChlbnRyeSwgZW50cnkuY2FuZGlkYXRlc1swXSk7XHJcbiAgICAvLyAgICAgICBjb250aW51ZTtcclxuICAgIC8vICAgICB9IGVsc2Uge1xyXG4gICAgLy8gICAgICAgY29uc3QgY2FuZGlkYXRlID0gbWFuaWZlc3QuZmlsZXMuZmluZChtYW5GaWxlID0+IHBhdGguYmFzZW5hbWUobWFuRmlsZS5yZWxQYXRoKSA9PT0gcGF0aC5iYXNlbmFtZShlbnRyeS5maWxlUGF0aCwgJy5vbGQnKSk/LnNvdXJjZTtcclxuICAgIC8vICAgICAgIGlmIChjYW5kaWRhdGUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gICAgICAgICBhd2FpdCBhZGRGaWxlVG9Nb2QoZW50cnksIGNhbmRpZGF0ZSk7XHJcbiAgICAvLyAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgLy8gICAgICAgfVxyXG4gICAgLy8gICAgIH1cclxuICAgIC8vICAgfVxyXG4gICAgLy8gfSk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBtYWluO1xyXG4iXX0=