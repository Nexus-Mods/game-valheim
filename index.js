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
const path = __importStar(require("path"));
const vortex_api_1 = require("vortex-api");
const vortex_parse_ini_1 = __importStar(require("vortex-parse-ini"));
const payloadDeployer = __importStar(require("./payloadDeployer"));
const common_1 = require("./common");
const installers_1 = require("./installers");
const migrations_1 = require("./migrations");
const tests_1 = require("./tests");
const r2Vortex_1 = require("./r2Vortex");
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
    context.registerAction('mod-icons', 115, 'import', {}, 'Import From r2modman', () => {
        r2Vortex_1.migrateR2ToVortex(context.api);
    }, () => r2Vortex_1.userHasR2Installed() && getGamePath() !== '.');
    context.registerTest('vbuild-dep-test', 'gamemode-activated', vbuildDepTest);
    context.registerTest('vbuild-dep-test', 'mod-installed', vbuildDepTest);
    context.registerTest('textures-dep-test', 'gamemode-activated', customMeshesTest);
    context.registerTest('textures-dep-test', 'mod-installed', customMeshesTest);
    context.registerTest('meshes-dep-test', 'gamemode-activated', customTexturesTest);
    context.registerTest('meshes-dep-test', 'mod-installed', customTexturesTest);
    context.registerTest('multiple-lib-mods', 'gamemode-activated', () => tests_1.hasMultipleLibMods(context.api));
    context.registerTest('multiple-lib-mods', 'quick-launch', () => tests_1.hasMultipleLibMods(context.api));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDJDQUF3RDtBQUN4RCxxRUFBaUU7QUFDakUsbUVBQXFEO0FBRXJELHFDQUNvRTtBQUNwRSw2Q0FDdUY7QUFDdkYsNkNBQXNEO0FBQ3RELG1DQUFtRTtBQUVuRSx5Q0FBbUU7QUFFbkUsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQVMsU0FBUyxDQUFDLEtBQUs7SUFDdEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxHQUFHLE9BQU8sQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxRQUFRO0lBQ2YsT0FBTyxpQkFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxpQkFBUSxDQUFDLENBQUM7U0FDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVE7SUFDaEMsT0FBTyxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssaUJBQWlCLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekYsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDaEIsUUFBUSxFQUFFLE9BQU87WUFDakIsT0FBTyxFQUFFO2dCQUNQLEtBQUssRUFBRSxpQkFBUTtnQkFDZixVQUFVLEVBQUUsQ0FBQyxlQUFlLENBQUM7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2FBQ3hCO1NB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QUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM3QixDQUFDLENBQUEsQ0FBQyxDQUFDO1FBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQU8sU0FBUyxFQUFFLEVBQUUsZ0RBQ25ELE9BQUEsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUEsR0FBQSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBmcywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5pbXBvcnQgUGFyc2VyLCB7IEluaUZpbGUsIFdpbmFwaUZvcm1hdCB9IGZyb20gJ3ZvcnRleC1wYXJzZS1pbmknO1xyXG5pbXBvcnQgKiBhcyBwYXlsb2FkRGVwbG95ZXIgZnJvbSAnLi9wYXlsb2FkRGVwbG95ZXInO1xyXG5cclxuaW1wb3J0IHsgRkJYX0VYVCwgR0FNRV9JRCwgZ2VuUHJvcHMsIElHTk9SQUJMRV9GSUxFUywgSU5TTElNVk1MX0lERU5USUZJRVIsXHJcbiAgSVByb3BzLCBPQkpfRVhULCBQYWNrVHlwZSwgU1RFQU1fSUQsIFZCVUlMRF9FWFQgfSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IGluc3RhbGxDb3JlUmVtb3ZlciwgaW5zdGFsbEZ1bGxQYWNrLCBpbnN0YWxsSW5TbGltTW9kTG9hZGVyLCBpbnN0YWxsVkJ1aWxkTW9kLFxyXG4gIHRlc3RDb3JlUmVtb3ZlciwgdGVzdEZ1bGxQYWNrLCB0ZXN0SW5TbGltTW9kTG9hZGVyLCB0ZXN0VkJ1aWxkIH0gZnJvbSAnLi9pbnN0YWxsZXJzJztcclxuaW1wb3J0IHsgbWlncmF0ZTEwMywgbWlncmF0ZTEwNCB9IGZyb20gJy4vbWlncmF0aW9ucyc7XHJcbmltcG9ydCB7IGhhc011bHRpcGxlTGliTW9kcywgaXNEZXBlbmRlbmN5UmVxdWlyZWQgfSBmcm9tICcuL3Rlc3RzJztcclxuXHJcbmltcG9ydCB7IG1pZ3JhdGVSMlRvVm9ydGV4LCB1c2VySGFzUjJJbnN0YWxsZWQgfSBmcm9tICcuL3IyVm9ydGV4JztcclxuXHJcbmNvbnN0IFNUT1BfUEFUVEVSTlMgPSBbJ2NvbmZpZycsICdwbHVnaW5zJywgJ3BhdGNoZXJzJ107XHJcbmZ1bmN0aW9uIHRvV29yZEV4cChpbnB1dCkge1xyXG4gIHJldHVybiAnKF58LyknICsgaW5wdXQgKyAnKC98JCknO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaW5kR2FtZSgpOiBhbnkge1xyXG4gIHJldHVybiB1dGlsLkdhbWVTdG9yZUhlbHBlci5maW5kQnlBcHBJZChbU1RFQU1fSURdKVxyXG4gICAgLnRoZW4oZ2FtZSA9PiBnYW1lLmdhbWVQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVxdWlyZXNMYXVuY2hlcihnYW1lUGF0aCkge1xyXG4gIHJldHVybiBmcy5yZWFkZGlyQXN5bmMoZ2FtZVBhdGgpXHJcbiAgICAudGhlbihmaWxlcyA9PiAoZmlsZXMuZmluZChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSA9PT0gJ3N0ZWFtX2FwcGlkLnR4dCcpICE9PSB1bmRlZmluZWQpXHJcbiAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHtcclxuICAgICAgICBsYXVuY2hlcjogJ3N0ZWFtJyxcclxuICAgICAgICBhZGRJbmZvOiB7XHJcbiAgICAgICAgICBhcHBJZDogU1RFQU1fSUQsXHJcbiAgICAgICAgICBwYXJhbWV0ZXJzOiBbJy1mb3JjZS1nbGNvcmUnXSxcclxuICAgICAgICAgIGxhdW5jaFR5cGU6ICdnYW1lc3RvcmUnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pXHJcbiAgICAgIDogUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IFByb21pc2UucmVqZWN0KGVycikpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhwcm9wczogSVByb3BzKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgYXBpID0gcHJvcHMuYXBpO1xyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG4gIGNvbnN0IGV4cGVjdGVkRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9tYW5hZ2VkJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcbiAgY29uc3QgZnVsbFBhY2tDb3JMaWJPbGQgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAnQmVwSW5FeCcsICdjb3JlX2xpYicsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG4gIGNvbnN0IGZ1bGxQYWNrQ29yTGliTmV3ID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfY29ybGliJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcblxyXG4gIGNvbnN0IHJhaXNlTWlzc2luZ0Fzc2VtYmxpZXNEaWFsb2cgPSAoKSA9PiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdNaXNzaW5nIHVuc3RyaXBwZWQgYXNzZW1ibGllcycsIHtcclxuICAgICAgYmJjb2RlOiB0KCdWYWxoZWltXFwncyBhc3NlbWJsaWVzIGFyZSBkaXN0cmlidXRlZCBpbiBhbiBcIm9wdGltaXNlZFwiIHN0YXRlIHRvIHJlZHVjZSByZXF1aXJlZCAnXHJcbiAgICAgICsgJ2Rpc2sgc3BhY2UuIFRoaXMgdW5mb3J0dW5hdGVseSBtZWFucyB0aGF0IFZhbGhlaW1cXCdzIG1vZGRpbmcgY2FwYWJpbGl0aWVzIGFyZSBhbHNvIGFmZmVjdGVkLnt7YnJ9fXt7YnJ9fSdcclxuICAgICAgKyAnSW4gb3JkZXIgdG8gbW9kIFZhbGhlaW0sIHRoZSB1bm9wdGltaXNlZC91bnN0cmlwcGVkIGFzc2VtYmxpZXMgYXJlIHJlcXVpcmVkIC0gcGxlYXNlIGRvd25sb2FkIHRoZXNlICdcclxuICAgICAgKyAnZnJvbSBOZXh1cyBNb2RzLnt7YnJ9fXt7YnJ9fSBZb3UgY2FuIGNob29zZSB0aGUgVm9ydGV4L21vZCBtYW5hZ2VyIGRvd25sb2FkIG9yIG1hbnVhbCBkb3dubG9hZCAnXHJcbiAgICAgICsgJyhzaW1wbHkgZHJhZyBhbmQgZHJvcCB0aGUgYXJjaGl2ZSBpbnRvIHRoZSBtb2RzIGRyb3B6b25lIHRvIGFkZCBpdCB0byBWb3J0ZXgpLnt7YnJ9fXt7YnJ9fSdcclxuICAgICAgKyAnVm9ydGV4IHdpbGwgdGhlbiBiZSBhYmxlIHRvIGluc3RhbGwgdGhlIGFzc2VtYmxpZXMgd2hlcmUgdGhleSBhcmUgbmVlZGVkIHRvIGVuYWJsZSAnXHJcbiAgICAgICsgJ21vZGRpbmcsIGxlYXZpbmcgdGhlIG9yaWdpbmFsIG9uZXMgdW50b3VjaGVkLicsIHsgcmVwbGFjZTogeyBicjogJ1ticl1bL2JyXScgfSB9KSxcclxuICAgIH0sIFtcclxuICAgICAgeyBsYWJlbDogJ0NhbmNlbCcsIGFjdGlvbjogKCkgPT4gcmVqZWN0KG5ldyB1dGlsLlVzZXJDYW5jZWxlZCgpKSB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLFxyXG4gICAgICAgIGFjdGlvbjogKCkgPT4gdXRpbC5vcG4oJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzE1JylcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4gbnVsbClcclxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHJlc29sdmUoKSksXHJcbiAgICAgIH0sXHJcbiAgICBdKTtcclxuICB9KTtcclxuXHJcbiAgY29uc3QgYXNzaWduT3ZlcnJpZGVQYXRoID0gYXN5bmMgKG92ZXJyaWRlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICBjb25zdCBkb29yU3RvcENvbmZpZyA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCwgJ2Rvb3JzdG9wX2NvbmZpZy5pbmknKTtcclxuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBQYXJzZXIobmV3IFdpbmFwaUZvcm1hdCgpKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGluaURhdGE6IEluaUZpbGU8YW55PiA9IGF3YWl0IHBhcnNlci5yZWFkKGRvb3JTdG9wQ29uZmlnKTtcclxuICAgICAgaW5pRGF0YS5kYXRhWydVbml0eURvb3JzdG9wJ11bJ2RsbFNlYXJjaFBhdGhPdmVycmlkZSddID0gb3ZlcnJpZGVQYXRoO1xyXG4gICAgICBhd2FpdCBwYXJzZXIud3JpdGUoZG9vclN0b3BDb25maWcsIGluaURhdGEpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ2ZhaWxlZCB0byBtb2RpZnkgZG9vcnN0b3AgY29uZmlndXJhdGlvbicsIGVycik7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWRzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICBjb25zdCBoYXNDb3JlTGliVHlwZSA9IHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sXHJcbiAgICAgIFsnYXR0cmlidXRlcycsICdDb3JlTGliVHlwZSddLCB1bmRlZmluZWQpICE9PSB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvcHMucHJvZmlsZSxcclxuICAgICAgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gICAgcmV0dXJuIGhhc0NvcmVMaWJUeXBlICYmIGlzRW5hYmxlZDtcclxuICB9KTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZHMubGVuZ3RoID4gMCkge1xyXG4gICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGUgdXNlciBoYXMgc2V2ZXJhbCBpbnN0YWxsZWQsIHNlbGVjdCB0aGUgZmlyc3Qgb25lLlxyXG4gICAgY29uc3QgY29yZUxpYk1vZElkID0gY29yZUxpYk1vZElkc1swXTtcclxuXHJcbiAgICBjb25zdCBwYWNrVHlwZTogUGFja1R5cGUgPSBtb2RzW2NvcmVMaWJNb2RJZF0uYXR0cmlidXRlc1snQ29yZUxpYlR5cGUnXTtcclxuICAgIHN3aXRjaCAocGFja1R5cGUpIHtcclxuICAgICAgY2FzZSAnY29yZV9saWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgnQmVwSW5FeFxcXFxjb3JlX2xpYicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgY2FzZSAndW5zdHJpcHBlZF9jb3JsaWInOlxyXG4gICAgICAgIGFzc2lnbk92ZXJyaWRlUGF0aCgndW5zdHJpcHBlZF9jb3JsaWInKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgLy8gbm9wIC0gbGV0IHRoZSBmb3IgbG9vcCBiZWxvdyB0cnkgdG8gZmluZCB0aGUgcGFjay5cclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZvciAoY29uc3QgZmlsZVBhdGggb2YgW2Z1bGxQYWNrQ29yTGliTmV3LCBmdWxsUGFja0NvckxpYk9sZCwgZXhwZWN0ZWRGaWxlUGF0aF0pIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhmaWxlUGF0aCk7XHJcbiAgICAgIGNvbnN0IGRsbE92ZXJyaWRlUGF0aCA9IGZpbGVQYXRoLnJlcGxhY2UocHJvcHMuZGlzY292ZXJ5LnBhdGggKyBwYXRoLnNlcCwgJycpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UocGF0aC5zZXAgKyAnbW9uby5zZWN1cml0eS5kbGwnLCAnJyk7XHJcbiAgICAgIGF3YWl0IGFzc2lnbk92ZXJyaWRlUGF0aChkbGxPdmVycmlkZVBhdGgpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgLy8gbm9wXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gcmFpc2VNaXNzaW5nQXNzZW1ibGllc0RpYWxvZygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwcmVwYXJlRm9yTW9kZGluZyhjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCwgZGlzY292ZXJ5OiB0eXBlcy5JRGlzY292ZXJ5UmVzdWx0KSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IHByZXZQcm9mSWQ6IHN0cmluZyA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGU6IHR5cGVzLklQcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcmV2UHJvZklkKTtcclxuICBjb25zdCBtb2RUeXBlczogeyBbdHlwZUlkOiBzdHJpbmddOiBzdHJpbmcgfSA9IHNlbGVjdG9ycy5tb2RQYXRoc0ZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IGNyZWF0ZURpcmVjdG9yaWVzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgZm9yIChjb25zdCBtb2RUeXBlIG9mIE9iamVjdC5rZXlzKG1vZFR5cGVzKSkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMobW9kVHlwZXNbbW9kVHlwZV0pO1xyXG4gICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcbiAgcmV0dXJuIG5ldyBCbHVlYmlyZDx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiBjcmVhdGVEaXJlY3RvcmllcygpXHJcbiAgICAudGhlbigoKSA9PiBwYXlsb2FkRGVwbG95ZXIub25XaWxsRGVwbG95KGNvbnRleHQsIHByb2ZpbGU/LmlkKSlcclxuICAgIC50aGVuKCgpID0+IHJlc29sdmUoKSlcclxuICAgIC5jYXRjaChlcnIgPT4gcmVqZWN0KGVycikpKVxyXG4gIC50aGVuKCgpID0+IGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKHsgYXBpOiBjb250ZXh0LmFwaSwgc3RhdGUsIHByb2ZpbGUsIGRpc2NvdmVyeSB9KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vZHNQYXRoKGdhbWVQYXRoOiBzdHJpbmcpIHtcclxuICByZXR1cm4gcGF0aC5qb2luKGdhbWVQYXRoLCAnQmVwSW5FeCcsICdwbHVnaW5zJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1haW4oY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQpIHtcclxuICBjb250ZXh0LnJlZ2lzdGVyR2FtZSh7XHJcbiAgICBpZDogR0FNRV9JRCxcclxuICAgIG5hbWU6ICdWYWxoZWltJyxcclxuICAgIG1lcmdlTW9kczogdHJ1ZSxcclxuICAgIHF1ZXJ5UGF0aDogZmluZEdhbWUsXHJcbiAgICBxdWVyeU1vZFBhdGg6IG1vZHNQYXRoLFxyXG4gICAgbG9nbzogJ2dhbWVhcnQuanBnJyxcclxuICAgIGV4ZWN1dGFibGU6ICgpID0+ICd2YWxoZWltLmV4ZScsXHJcbiAgICByZXF1aXJlc0xhdW5jaGVyLFxyXG4gICAgc2V0dXA6IGRpc2NvdmVyeSA9PiBwcmVwYXJlRm9yTW9kZGluZyhjb250ZXh0LCBkaXNjb3ZlcnkpLFxyXG4gICAgcmVxdWlyZWRGaWxlczogW1xyXG4gICAgICAndmFsaGVpbS5leGUnLFxyXG4gICAgXSxcclxuICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgIFN0ZWFtQVBQSWQ6IFNURUFNX0lELFxyXG4gICAgfSxcclxuICAgIGRldGFpbHM6IHtcclxuICAgICAgc3RlYW1BcHBJZDogK1NURUFNX0lELFxyXG4gICAgICBzdG9wUGF0dGVybnM6IFNUT1BfUEFUVEVSTlMubWFwKHRvV29yZEV4cCksXHJcbiAgICAgIGlnbm9yZUNvbmZsaWN0czogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gICAgICBpZ25vcmVEZXBsb3k6IElHTk9SQUJMRV9GSUxFUyxcclxuICAgIH0sXHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGdldEdhbWVQYXRoID0gKCkgPT4ge1xyXG4gICAgY29uc3QgcHJvcHM6IElQcm9wcyA9IGdlblByb3BzKGNvbnRleHQpO1xyXG4gICAgcmV0dXJuIChwcm9wcz8uZGlzY292ZXJ5Py5wYXRoICE9PSB1bmRlZmluZWQpXHJcbiAgICAgID8gcHJvcHMuZGlzY292ZXJ5LnBhdGggOiAnLic7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaXNTdXBwb3J0ZWQgPSAoZ2FtZUlkOiBzdHJpbmcpID0+IChnYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIGNvbnN0IGhhc0luc3RydWN0aW9uID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlZDogKGluc3Q6IHR5cGVzLklJbnN0cnVjdGlvbikgPT4gYm9vbGVhbikgPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9ucy5maW5kKGluc3RyID0+IChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAmJiAocHJlZChpbnN0cikpKSAhPT0gdW5kZWZpbmVkO1xyXG5cclxuICBjb25zdCBmaW5kSW5zdHJNYXRjaCA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBhdHRlcm46IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBtb2Q/OiAoaW5wdXQ6IHN0cmluZykgPT4gc3RyaW5nKSA9PiB7XHJcbiAgICBpZiAobW9kID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgbW9kID0gKGlucHV0KSA9PiBpbnB1dDtcclxuICAgIH1cclxuICAgIHJldHVybiBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT5cclxuICAgICAgbW9kKGluc3RyLnNvdXJjZSkudG9Mb3dlckNhc2UoKSA9PT0gcGF0dGVybi50b0xvd2VyQ2FzZSgpKTtcclxuICB9O1xyXG5cclxuICBjb25zdCB2YnVpbGREZXBUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgZ2FtZVBhdGggPSBnZXRHYW1lUGF0aCgpO1xyXG4gICAgY29uc3QgYnVpbGRTaGFyZUFzc2VtYmx5ID0gcGF0aC5qb2luKGdhbWVQYXRoLCAnSW5TbGltVk1MJywgJ01vZHMnLCAnQ1ItQnVpbGRTaGFyZV9WTUwuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZidWlsZC1tb2QnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnaW5zbGltdm1sLW1vZCcsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdCdWlsZFNoYXJlIChBZHZhbmNlZEJ1aWxkaW5nKScsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzUnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIGJ1aWxkU2hhcmVBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgY3VzdG9tTWVzaGVzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQ3VzdG9tTWVzaGVzLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YWxoZWltLWN1c3RvbS1tZXNoZXMnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0N1c3RvbU1lc2hlcycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzE4NCcsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgY3VzdG9tVGV4dHVyZXNUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgYmFzZVBhdGggPSBtb2RzUGF0aChnZXRHYW1lUGF0aCgpKTtcclxuICAgIGNvbnN0IHJlcXVpcmVkQXNzZW1ibHkgPSBwYXRoLmpvaW4oYmFzZVBhdGgsICdDdXN0b21UZXh0dXJlcy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0N1c3RvbVRleHR1cmVzJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNDgnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJBY3Rpb24oJ21vZC1pY29ucycsIDExNSwgJ2ltcG9ydCcsIHt9LCAnSW1wb3J0IEZyb20gcjJtb2RtYW4nLCAoKSA9PiB7XHJcbiAgICBtaWdyYXRlUjJUb1ZvcnRleChjb250ZXh0LmFwaSk7XHJcbiAgfSwgKCkgPT4gdXNlckhhc1IySW5zdGFsbGVkKCkgJiYgZ2V0R2FtZVBhdGgoKSAhPT0gJy4nKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ3ZidWlsZC1kZXAtdGVzdCcsICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB2YnVpbGREZXBUZXN0KTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgndmJ1aWxkLWRlcC10ZXN0JywgJ21vZC1pbnN0YWxsZWQnLCB2YnVpbGREZXBUZXN0KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ3RleHR1cmVzLWRlcC10ZXN0JywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIGN1c3RvbU1lc2hlc1Rlc3QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCd0ZXh0dXJlcy1kZXAtdGVzdCcsICdtb2QtaW5zdGFsbGVkJywgY3VzdG9tTWVzaGVzVGVzdCk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdtZXNoZXMtZGVwLXRlc3QnLCAnZ2FtZW1vZGUtYWN0aXZhdGVkJywgY3VzdG9tVGV4dHVyZXNUZXN0KTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbWVzaGVzLWRlcC10ZXN0JywgJ21vZC1pbnN0YWxsZWQnLCBjdXN0b21UZXh0dXJlc1Rlc3QpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnZ2FtZW1vZGUtYWN0aXZhdGVkJyxcclxuICAgICgpID0+IGhhc011bHRpcGxlTGliTW9kcyhjb250ZXh0LmFwaSkpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdtdWx0aXBsZS1saWItbW9kcycsICdxdWljay1sYXVuY2gnLFxyXG4gICAgKCkgPT4gaGFzTXVsdGlwbGVMaWJNb2RzKGNvbnRleHQuYXBpKSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNChjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQub25jZSgoKSA9PiB7XHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCd3aWxsLWRlcGxveScsIGFzeW5jIChwcm9maWxlSWQpID0+IHtcclxuICAgICAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gICAgICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBwYXlsb2FkRGVwbG95ZXIub25XaWxsRGVwbG95KGNvbnRleHQsIHByb2ZpbGVJZClcclxuICAgICAgICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpKSlcclxuICAgICAgICAuY2F0Y2goZXJyID0+IGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkXHJcbiAgICAgICAgICA/IFByb21pc2UucmVzb2x2ZSgpXHJcbiAgICAgICAgICA6IFByb21pc2UucmVqZWN0KGVycikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnZGlkLXB1cmdlJywgYXN5bmMgKHByb2ZpbGVJZCkgPT5cclxuICAgICAgcGF5bG9hZERlcGxveWVyLm9uRGlkUHVyZ2UoY29udGV4dCwgcHJvZmlsZUlkKSk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBtYWluO1xyXG4iXX0=