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
    context.registerModType('better-continents-mod', 25, isSupported, () => WORLDS_PATH, (instructions) => {
        const hasVMLIni = findInstrMatch(instructions, common_1.BETTER_CONT_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(hasVMLIni);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsdUNBQWdEO0FBQ2hELDJDQUE2QjtBQUM3QiwyQ0FBd0Q7QUFDeEQscUVBQWlFO0FBQ2pFLG1FQUFxRDtBQUVyRCxxQ0FDb0U7QUFDcEUsNkNBRXVGO0FBQ3ZGLDZDQUFzRDtBQUN0RCxtQ0FBbUU7QUFFbkUseUNBQW1FO0FBRW5FLE1BQU0sR0FBRyxHQUFHLGlCQUFNLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxpQkFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBSyxDQUFDO0FBQ3RELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDckQsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRXJELE1BQU0sYUFBYSxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUN4RCxTQUFTLFNBQVMsQ0FBQyxLQUFLO0lBQ3RCLE9BQU8sT0FBTyxHQUFHLEtBQUssR0FBRyxPQUFPLENBQUM7QUFDbkMsQ0FBQztBQUVELFNBQVMsUUFBUTtJQUNmLE9BQU8saUJBQUksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUMsaUJBQVEsQ0FBQyxDQUFDO1NBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNqQyxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxRQUFRO0lBQ2hDLE9BQU8sZUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUM7U0FDN0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMs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UUFDN0IsQ0FBQyxDQUFBLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFPLFNBQVMsRUFBRSxFQUFFLGdEQUNuRCxPQUFBLGVBQWUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFBLEdBQUEsQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsa0JBQWUsSUFBSSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcclxuaW1wb3J0IHsgYXBwIGFzIGFwcEluLCByZW1vdGUgfSBmcm9tICdlbGVjdHJvbic7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGZzLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCBQYXJzZXIsIHsgSW5pRmlsZSwgV2luYXBpRm9ybWF0IH0gZnJvbSAndm9ydGV4LXBhcnNlLWluaSc7XHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBCRVRURVJfQ09OVF9FWFQsIEZCWF9FWFQsIEdBTUVfSUQsIGdlblByb3BzLCBJR05PUkFCTEVfRklMRVMsIElOU0xJTVZNTF9JREVOVElGSUVSLFxyXG4gIElQcm9wcywgT0JKX0VYVCwgUGFja1R5cGUsIFNURUFNX0lELCBWQlVJTERfRVhUIH0gZnJvbSAnLi9jb21tb24nO1xyXG5pbXBvcnQgeyBpbnN0YWxsQmV0dGVyQ29udCwgaW5zdGFsbENvcmVSZW1vdmVyLCBpbnN0YWxsRnVsbFBhY2ssIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxWQnVpbGRNb2QsXHJcbiAgdGVzdEJldHRlckNvbnQsXHJcbiAgdGVzdENvcmVSZW1vdmVyLCB0ZXN0RnVsbFBhY2ssIHRlc3RJblNsaW1Nb2RMb2FkZXIsIHRlc3RWQnVpbGQgfSBmcm9tICcuL2luc3RhbGxlcnMnO1xyXG5pbXBvcnQgeyBtaWdyYXRlMTAzLCBtaWdyYXRlMTA0IH0gZnJvbSAnLi9taWdyYXRpb25zJztcclxuaW1wb3J0IHsgaGFzTXVsdGlwbGVMaWJNb2RzLCBpc0RlcGVuZGVuY3lSZXF1aXJlZCB9IGZyb20gJy4vdGVzdHMnO1xyXG5cclxuaW1wb3J0IHsgbWlncmF0ZVIyVG9Wb3J0ZXgsIHVzZXJIYXNSMkluc3RhbGxlZCB9IGZyb20gJy4vcjJWb3J0ZXgnO1xyXG5cclxuY29uc3QgYXBwID0gcmVtb3RlICE9PSB1bmRlZmluZWQgPyByZW1vdGUuYXBwIDogYXBwSW47XHJcbmNvbnN0IFdPUkxEU19QQVRIID0gcGF0aC5yZXNvbHZlKGFwcC5nZXRQYXRoKCdhcHBEYXRhJyksXHJcbiAgJy4uJywgJ0xvY2FsTG93JywgJ0lyb25HYXRlJywgJ1ZhbGhlaW0nLCAnd29ybGRzJyk7XHJcblxyXG5jb25zdCBTVE9QX1BBVFRFUk5TID0gWydjb25maWcnLCAncGx1Z2lucycsICdwYXRjaGVycyddO1xyXG5mdW5jdGlvbiB0b1dvcmRFeHAoaW5wdXQpIHtcclxuICByZXR1cm4gJyhefC8pJyArIGlucHV0ICsgJygvfCQpJztcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZEdhbWUoKTogYW55IHtcclxuICByZXR1cm4gdXRpbC5HYW1lU3RvcmVIZWxwZXIuZmluZEJ5QXBwSWQoW1NURUFNX0lEXSlcclxuICAgIC50aGVuKGdhbWUgPT4gZ2FtZS5nYW1lUGF0aCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlcXVpcmVzTGF1bmNoZXIoZ2FtZVBhdGgpIHtcclxuICByZXR1cm4gZnMucmVhZGRpckFzeW5jKGdhbWVQYXRoKVxyXG4gICAgLnRoZW4oZmlsZXMgPT4gKGZpbGVzLmZpbmQoZmlsZSA9PiBmaWxlLnRvTG93ZXJDYXNlKCkgPT09ICdzdGVhbV9hcHBpZC50eHQnKSAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IFByb21pc2UucmVzb2x2ZSh7XHJcbiAgICAgICAgbGF1bmNoZXI6ICdzdGVhbScsXHJcbiAgICAgICAgYWRkSW5mbzoge1xyXG4gICAgICAgICAgYXBwSWQ6IFNURUFNX0lELFxyXG4gICAgICAgICAgcGFyYW1ldGVyczogWyctZm9yY2UtZ2xjb3JlJ10sXHJcbiAgICAgICAgICBsYXVuY2hUeXBlOiAnZ2FtZXN0b3JlJyxcclxuICAgICAgICB9LFxyXG4gICAgICB9KVxyXG4gICAgICA6IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpKVxyXG4gICAgLmNhdGNoKGVyciA9PiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlVW5zdHJpcHBlZEFzc2VtYmxpZXMocHJvcHM6IElQcm9wcyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IGFwaSA9IHByb3BzLmFwaTtcclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICBjb25zdCBleHBlY3RlZEZpbGVQYXRoID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG4gIGNvbnN0IGZ1bGxQYWNrQ29yTGliT2xkID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ0JlcEluRXgnLCAnY29yZV9saWInLCAnbW9uby5zZWN1cml0eS5kbGwnKTtcclxuICBjb25zdCBmdWxsUGFja0NvckxpYk5ldyA9IHBhdGguam9pbihwcm9wcy5kaXNjb3ZlcnkucGF0aCxcclxuICAgICd1bnN0cmlwcGVkX2NvcmxpYicsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG5cclxuICBjb25zdCByYWlzZU1pc3NpbmdBc3NlbWJsaWVzRGlhbG9nID0gKCkgPT4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnTWlzc2luZyB1bnN0cmlwcGVkIGFzc2VtYmxpZXMnLCB7XHJcbiAgICAgIGJiY29kZTogdCgnVmFsaGVpbVxcJ3MgYXNzZW1ibGllcyBhcmUgZGlzdHJpYnV0ZWQgaW4gYW4gXCJvcHRpbWlzZWRcIiBzdGF0ZSB0byByZWR1Y2UgcmVxdWlyZWQgJ1xyXG4gICAgICArICdkaXNrIHNwYWNlLiBUaGlzIHVuZm9ydHVuYXRlbHkgbWVhbnMgdGhhdCBWYWxoZWltXFwncyBtb2RkaW5nIGNhcGFiaWxpdGllcyBhcmUgYWxzbyBhZmZlY3RlZC57e2JyfX17e2JyfX0nXHJcbiAgICAgICsgJ0luIG9yZGVyIHRvIG1vZCBWYWxoZWltLCB0aGUgdW5vcHRpbWlzZWQvdW5zdHJpcHBlZCBhc3NlbWJsaWVzIGFyZSByZXF1aXJlZCAtIHBsZWFzZSBkb3dubG9hZCB0aGVzZSAnXHJcbiAgICAgICsgJ2Zyb20gTmV4dXMgTW9kcy57e2JyfX17e2JyfX0gWW91IGNhbiBjaG9vc2UgdGhlIFZvcnRleC9tb2QgbWFuYWdlciBkb3dubG9hZCBvciBtYW51YWwgZG93bmxvYWQgJ1xyXG4gICAgICArICcoc2ltcGx5IGRyYWcgYW5kIGRyb3AgdGhlIGFyY2hpdmUgaW50byB0aGUgbW9kcyBkcm9wem9uZSB0byBhZGQgaXQgdG8gVm9ydGV4KS57e2JyfX17e2JyfX0nXHJcbiAgICAgICsgJ1ZvcnRleCB3aWxsIHRoZW4gYmUgYWJsZSB0byBpbnN0YWxsIHRoZSBhc3NlbWJsaWVzIHdoZXJlIHRoZXkgYXJlIG5lZWRlZCB0byBlbmFibGUgJ1xyXG4gICAgICArICdtb2RkaW5nLCBsZWF2aW5nIHRoZSBvcmlnaW5hbCBvbmVzIHVudG91Y2hlZC4nLCB7IHJlcGxhY2U6IHsgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICB9LCBbXHJcbiAgICAgIHsgbGFiZWw6ICdDYW5jZWwnLCBhY3Rpb246ICgpID0+IHJlamVjdChuZXcgdXRpbC5Vc2VyQ2FuY2VsZWQoKSkgfSxcclxuICAgICAge1xyXG4gICAgICAgIGxhYmVsOiAnRG93bmxvYWQgVW5zdHJpcHBlZCBBc3NlbWJsaWVzJyxcclxuICAgICAgICBhY3Rpb246ICgpID0+IHV0aWwub3BuKCdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy8xNScpXHJcbiAgICAgICAgICAuY2F0Y2goZXJyID0+IG51bGwpXHJcbiAgICAgICAgICAuZmluYWxseSgoKSA9PiByZXNvbHZlKCkpLFxyXG4gICAgICB9LFxyXG4gICAgXSk7XHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IGFzc2lnbk92ZXJyaWRlUGF0aCA9IGFzeW5jIChvdmVycmlkZVBhdGg6IHN0cmluZykgPT4ge1xyXG4gICAgY29uc3QgZG9vclN0b3BDb25maWcgPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsICdkb29yc3RvcF9jb25maWcuaW5pJyk7XHJcbiAgICBjb25zdCBwYXJzZXIgPSBuZXcgUGFyc2VyKG5ldyBXaW5hcGlGb3JtYXQoKSk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpbmlEYXRhOiBJbmlGaWxlPGFueT4gPSBhd2FpdCBwYXJzZXIucmVhZChkb29yU3RvcENvbmZpZyk7XHJcbiAgICAgIGluaURhdGEuZGF0YVsnVW5pdHlEb29yc3RvcCddWydkbGxTZWFyY2hQYXRoT3ZlcnJpZGUnXSA9IG92ZXJyaWRlUGF0aDtcclxuICAgICAgYXdhaXQgcGFyc2VyLndyaXRlKGRvb3JTdG9wQ29uZmlnLCBpbmlEYXRhKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdmYWlsZWQgdG8gbW9kaWZ5IGRvb3JzdG9wIGNvbmZpZ3VyYXRpb24nLCBlcnIpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHByb3BzLnN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgY29yZUxpYk1vZElkcyA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbHRlcihrZXkgPT4ge1xyXG4gICAgY29uc3QgaGFzQ29yZUxpYlR5cGUgPSB1dGlsLmdldFNhZmUobW9kc1trZXldLFxyXG4gICAgICBbJ2F0dHJpYnV0ZXMnLCAnQ29yZUxpYlR5cGUnXSwgdW5kZWZpbmVkKSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgaXNFbmFibGVkID0gdXRpbC5nZXRTYWZlKHByb3BzLnByb2ZpbGUsXHJcbiAgICAgIFsnbW9kU3RhdGUnLCBrZXksICdlbmFibGVkJ10sIGZhbHNlKTtcclxuICAgIHJldHVybiBoYXNDb3JlTGliVHlwZSAmJiBpc0VuYWJsZWQ7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChjb3JlTGliTW9kSWRzLmxlbmd0aCA+IDApIHtcclxuICAgIC8vIFdlIGRvbid0IGNhcmUgaWYgdGhlIHVzZXIgaGFzIHNldmVyYWwgaW5zdGFsbGVkLCBzZWxlY3QgdGhlIGZpcnN0IG9uZS5cclxuICAgIGNvbnN0IGNvcmVMaWJNb2RJZCA9IGNvcmVMaWJNb2RJZHNbMF07XHJcblxyXG4gICAgY29uc3QgcGFja1R5cGU6IFBhY2tUeXBlID0gbW9kc1tjb3JlTGliTW9kSWRdLmF0dHJpYnV0ZXNbJ0NvcmVMaWJUeXBlJ107XHJcbiAgICBzd2l0Y2ggKHBhY2tUeXBlKSB7XHJcbiAgICAgIGNhc2UgJ2NvcmVfbGliJzpcclxuICAgICAgICBhc3NpZ25PdmVycmlkZVBhdGgoJ0JlcEluRXhcXFxcY29yZV9saWInKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIGNhc2UgJ3Vuc3RyaXBwZWRfY29ybGliJzpcclxuICAgICAgICBhc3NpZ25PdmVycmlkZVBhdGgoJ3Vuc3RyaXBwZWRfY29ybGliJyk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIG5vcCAtIGxldCB0aGUgZm9yIGxvb3AgYmVsb3cgdHJ5IHRvIGZpbmQgdGhlIHBhY2suXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIFtmdWxsUGFja0NvckxpYk5ldywgZnVsbFBhY2tDb3JMaWJPbGQsIGV4cGVjdGVkRmlsZVBhdGhdKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoZmlsZVBhdGgpO1xyXG4gICAgICBjb25zdCBkbGxPdmVycmlkZVBhdGggPSBmaWxlUGF0aC5yZXBsYWNlKHByb3BzLmRpc2NvdmVyeS5wYXRoICsgcGF0aC5zZXAsICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHBhdGguc2VwICsgJ21vbm8uc2VjdXJpdHkuZGxsJywgJycpO1xyXG4gICAgICBhd2FpdCBhc3NpZ25PdmVycmlkZVBhdGgoZGxsT3ZlcnJpZGVQYXRoKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIC8vIG5vcFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJhaXNlTWlzc2luZ0Fzc2VtYmxpZXNEaWFsb2coKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCkge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcmV2UHJvZklkOiBzdHJpbmcgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJldlByb2ZJZCk7XHJcbiAgY29uc3QgbW9kVHlwZXM6IHsgW3R5cGVJZDogc3RyaW5nXTogc3RyaW5nIH0gPSBzZWxlY3RvcnMubW9kUGF0aHNGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBjcmVhdGVEaXJlY3RvcmllcyA9IGFzeW5jICgpID0+IHtcclxuICAgIGZvciAoY29uc3QgbW9kVHlwZSBvZiBPYmplY3Qua2V5cyhtb2RUeXBlcykpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKG1vZFR5cGVzW21vZFR5cGVdKTtcclxuICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG4gIHJldHVybiBuZXcgQmx1ZWJpcmQ8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4gY3JlYXRlRGlyZWN0b3JpZXMoKVxyXG4gICAgLnRoZW4oKCkgPT4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlPy5pZCkpXHJcbiAgICAudGhlbigoKSA9PiByZXNvbHZlKCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IHJlamVjdChlcnIpKSlcclxuICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyh7IGFwaTogY29udGV4dC5hcGksIHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb2RzUGF0aChnYW1lUGF0aDogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIHBhdGguam9pbihnYW1lUGF0aCwgJ0JlcEluRXgnLCAncGx1Z2lucycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWluKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0KSB7XHJcbiAgY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gICAgaWQ6IEdBTUVfSUQsXHJcbiAgICBuYW1lOiAnVmFsaGVpbScsXHJcbiAgICBtZXJnZU1vZHM6IHRydWUsXHJcbiAgICBxdWVyeVBhdGg6IGZpbmRHYW1lLFxyXG4gICAgcXVlcnlNb2RQYXRoOiBtb2RzUGF0aCxcclxuICAgIGxvZ286ICdnYW1lYXJ0LmpwZycsXHJcbiAgICBleGVjdXRhYmxlOiAoKSA9PiAndmFsaGVpbS5leGUnLFxyXG4gICAgcmVxdWlyZXNMYXVuY2hlcixcclxuICAgIHNldHVwOiBkaXNjb3ZlcnkgPT4gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dCwgZGlzY292ZXJ5KSxcclxuICAgIHJlcXVpcmVkRmlsZXM6IFtcclxuICAgICAgJ3ZhbGhlaW0uZXhlJyxcclxuICAgIF0sXHJcbiAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAgIH0sXHJcbiAgICBkZXRhaWxzOiB7XHJcbiAgICAgIHN0ZWFtQXBwSWQ6ICtTVEVBTV9JRCxcclxuICAgICAgc3RvcFBhdHRlcm5zOiBTVE9QX1BBVFRFUk5TLm1hcCh0b1dvcmRFeHApLFxyXG4gICAgICBpZ25vcmVDb25mbGljdHM6IElHTk9SQUJMRV9GSUxFUyxcclxuICAgICAgaWdub3JlRGVwbG95OiBJR05PUkFCTEVfRklMRVMsXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBnZXRHYW1lUGF0aCA9ICgpID0+IHtcclxuICAgIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0KTtcclxuICAgIHJldHVybiAocHJvcHM/LmRpc2NvdmVyeT8ucGF0aCAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IHByb3BzLmRpc2NvdmVyeS5wYXRoIDogJy4nO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGlzU3VwcG9ydGVkID0gKGdhbWVJZDogc3RyaW5nKSA9PiAoZ2FtZUlkID09PSBHQU1FX0lEKTtcclxuICBjb25zdCBoYXNJbnN0cnVjdGlvbiA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByZWQ6IChpbnN0OiB0eXBlcy5JSW5zdHJ1Y3Rpb24pID0+IGJvb2xlYW4pID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbnMuZmluZChpbnN0ciA9PiAoaW5zdHIudHlwZSA9PT0gJ2NvcHknKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHByZWQoaW5zdHIpKSkgIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgY29uc3QgZmluZEluc3RyTWF0Y2ggPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kPzogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIG1vZCA9IChpbnB1dCkgPT4gaW5wdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLCAoaW5zdHIpID0+XHJcbiAgICAgIG1vZChpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT09IHBhdHRlcm4udG9Mb3dlckNhc2UoKSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdmJ1aWxkRGVwVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGdhbWVQYXRoID0gZ2V0R2FtZVBhdGgoKTtcclxuICAgIGNvbnN0IGJ1aWxkU2hhcmVBc3NlbWJseSA9IHBhdGguam9pbihnYW1lUGF0aCwgJ0luU2xpbVZNTCcsICdNb2RzJywgJ0NSLUJ1aWxkU2hhcmVfVk1MLmRsbCcpO1xyXG4gICAgcmV0dXJuIGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICAgIGRlcGVuZGVudE1vZFR5cGU6ICd2YnVpbGQtbW9kJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJ2luc2xpbXZtbC1tb2QnLFxyXG4gICAgICBtYXN0ZXJOYW1lOiAnQnVpbGRTaGFyZSAoQWR2YW5jZWRCdWlsZGluZyknLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy81JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyBidWlsZFNoYXJlQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGN1c3RvbU1lc2hlc1Rlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IG1vZHNQYXRoKGdldEdhbWVQYXRoKCkpO1xyXG4gICAgY29uc3QgcmVxdWlyZWRBc3NlbWJseSA9IHBhdGguam9pbihiYXNlUGF0aCwgJ0N1c3RvbU1lc2hlcy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmFsaGVpbS1jdXN0b20tbWVzaGVzJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdDdXN0b21NZXNoZXMnLFxyXG4gICAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy8xODQnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIHJlcXVpcmVkQXNzZW1ibHkgXSxcclxuICAgIH0pO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGN1c3RvbVRleHR1cmVzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQ3VzdG9tVGV4dHVyZXMuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZhbGhlaW0tY3VzdG9tLXRleHR1cmVzJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdDdXN0b21UZXh0dXJlcycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzQ4JyxcclxuICAgICAgcmVxdWlyZWRGaWxlczogWyByZXF1aXJlZEFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb25zdCBiZXR0ZXJDb250aW5lbnRzVGVzdCA9ICgpID0+IHtcclxuICAgIGNvbnN0IGJhc2VQYXRoID0gbW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSk7XHJcbiAgICBjb25zdCByZXF1aXJlZEFzc2VtYmx5ID0gcGF0aC5qb2luKGJhc2VQYXRoLCAnQmV0dGVyQ29udGluZW50cy5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAnYmV0dGVyLWNvbnRpbmVudHMtbW9kJyxcclxuICAgICAgbWFzdGVyTW9kVHlwZTogJycsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdCZXR0ZXIgQ29udGluZW50cycsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzQ0NicsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgcmVxdWlyZWRBc3NlbWJseSBdLFxyXG4gICAgfSk7XHJcbiAgfTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3RlckFjdGlvbignbW9kLWljb25zJywgMTE1LCAnaW1wb3J0Jywge30sICdJbXBvcnQgRnJvbSByMm1vZG1hbicsICgpID0+IHtcclxuICAgIG1pZ3JhdGVSMlRvVm9ydGV4KGNvbnRleHQuYXBpKTtcclxuICB9LCAoKSA9PiB1c2VySGFzUjJJbnN0YWxsZWQoKSAmJiBnZXRHYW1lUGF0aCgpICE9PSAnLicpO1xyXG5cclxuICBjb25zdCBkZXBlbmRlbmN5VGVzdHMgPSBbIHZidWlsZERlcFRlc3QsIGN1c3RvbU1lc2hlc1Rlc3QsXHJcbiAgICBjdXN0b21UZXh0dXJlc1Rlc3QsIGJldHRlckNvbnRpbmVudHNUZXN0IF07XHJcblxyXG4gIGZvciAoY29uc3QgdGVzdEZ1bmMgb2YgZGVwZW5kZW5jeVRlc3RzKSB7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdnYW1lbW9kZS1hY3RpdmF0ZWQnLCB0ZXN0RnVuYyk7XHJcbiAgICBjb250ZXh0LnJlZ2lzdGVyVGVzdCh0ZXN0RnVuYy5uYW1lLnRvU3RyaW5nKCksICdtb2QtaW5zdGFsbGVkJywgdGVzdEZ1bmMpO1xyXG4gIH1cclxuXHJcbiAgY29udGV4dC5yZWdpc3RlclRlc3QoJ211bHRpcGxlLWxpYi1tb2RzJywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnbXVsdGlwbGUtbGliLW1vZHMnLCAnbW9kLWluc3RhbGxlZCcsXHJcbiAgICAoKSA9PiBoYXNNdWx0aXBsZUxpYk1vZHMoY29udGV4dC5hcGkpKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1iZXR0ZXItY29udGluZW50cycsIDIwLCB0ZXN0QmV0dGVyQ29udCwgaW5zdGFsbEJldHRlckNvbnQpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tY29yZS1yZW1vdmVyJywgMjAsIHRlc3RDb3JlUmVtb3ZlciwgaW5zdGFsbENvcmVSZW1vdmVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWluc2xpbXZtJywgMjAsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tdmJ1aWxkJywgMjAsIHRlc3RWQnVpbGQsIGluc3RhbGxWQnVpbGRNb2QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJJbnN0YWxsZXIoJ3ZhbGhlaW0tZnVsbC1iZXAtcGFjaycsIDEwLCB0ZXN0RnVsbFBhY2ssIGluc3RhbGxGdWxsUGFjayk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwMyhjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJNaWdyYXRpb24oKG9sZFZlcnNpb246IHN0cmluZykgPT4gbWlncmF0ZTEwNChjb250ZXh0LmFwaSwgb2xkVmVyc2lvbikpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZC1sb2FkZXInLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBJTlNMSU1WTUxfSURFTlRJRklFUiwgcGF0aC5iYXNlbmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCBMb2FkZXInIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnaW5zbGltdm1sLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnSW5TbGltVk1MJywgJ01vZHMnKSwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgLy8gVW5mb3J0dW5hdGVseSB0aGVyZSBhcmUgY3VycmVudGx5IG5vIGlkZW50aWZpZXJzIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlblxyXG4gICAgICAvLyAgQmVwSW5FeCBhbmQgSW5TbGltVk1MIG1vZHMgYW5kIHRoZXJlZm9yZSBjYW5ub3QgYXV0b21hdGljYWxseSBhc3NpZ25cclxuICAgICAgLy8gIHRoaXMgbW9kVHlwZSBhdXRvbWF0aWNhbGx5LiBXZSBkbyBrbm93IHRoYXQgQ1ItQWR2YW5jZWRCdWlsZGVyLmRsbCBpcyBhbiBJblNsaW1cclxuICAgICAgLy8gIG1vZCwgYnV0IHRoYXQncyBhYm91dCBpdC5cclxuICAgICAgY29uc3Qgdm1sU3VmZml4ID0gJ192bWwuZGxsJztcclxuICAgICAgY29uc3QgbW9kID0gKGlucHV0OiBzdHJpbmcpID0+IChpbnB1dC5sZW5ndGggPiB2bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgID8gcGF0aC5iYXNlbmFtZShpbnB1dCkuc2xpY2UoLXZtbFN1ZmZpeC5sZW5ndGgpXHJcbiAgICAgICAgOiAnJztcclxuICAgICAgY29uc3QgdGVzdFJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ2NyLWJ1aWxkc2hhcmVfdm1sLmRsbCcsIHBhdGguYmFzZW5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCAnX3ZtbC5kbGwnLCBtb2QpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUodGVzdFJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdJblNsaW1WTUwgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZidWlsZC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsICgpID0+IHBhdGguam9pbihnZXRHYW1lUGF0aCgpLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgcmVzID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBWQlVJTERfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUocmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0J1aWxkU2hhcmUgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ3ZhbGhlaW0tY3VzdG9tLW1lc2hlcycsIDEwLCBpc1N1cHBvcnRlZCxcclxuICAgICgpID0+IHBhdGguam9pbihtb2RzUGF0aChnZXRHYW1lUGF0aCgpKSwgJ0N1c3RvbU1lc2hlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBGQlhfRVhULCBwYXRoLmV4dG5hbWUpXHJcbiAgICAgICAgfHwgZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBPQkpfRVhULCBwYXRoLmV4dG5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbU1lc2hlcyBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmFsaGVpbS1jdXN0b20tdGV4dHVyZXMnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4obW9kc1BhdGgoZ2V0R2FtZVBhdGgoKSksICdDdXN0b21UZXh0dXJlcycpLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGV4dHVyZVJneDogUmVnRXhwID0gbmV3IFJlZ0V4cCgvXnRleHR1cmVfLioucG5nJC8pO1xyXG4gICAgICBsZXQgc3VwcG9ydGVkID0gZmFsc2U7XHJcbiAgICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgICAgaWYgKChpbnN0ci50eXBlID09PSAnY29weScpXHJcbiAgICAgICAgICAmJiB0ZXh0dXJlUmd4LnRlc3QocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0N1c3RvbVRleHR1cmVzIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXR0ZXItY29udGluZW50cy1tb2QnLCAyNSwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBXT1JMRFNfUEFUSCwgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgaGFzVk1MSW5pID0gZmluZEluc3RyTWF0Y2goaW5zdHJ1Y3Rpb25zLCBCRVRURVJfQ09OVF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShoYXNWTUxJbmkpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmV0dGVyIENvbnRpbmVudHMgTW9kJyB9KTtcclxuXHJcbiAgY29udGV4dC5vbmNlKCgpID0+IHtcclxuICAgIGNvbnRleHQuYXBpLm9uQXN5bmMoJ3dpbGwtZGVwbG95JywgYXN5bmMgKHByb2ZpbGVJZCkgPT4ge1xyXG4gICAgICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgICAgIGlmIChwcm9maWxlPy5nYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZUlkKVxyXG4gICAgICAgIC50aGVuKCgpID0+IGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKGdlblByb3BzKGNvbnRleHQsIHByb2ZpbGVJZCkpKVxyXG4gICAgICAgIC5jYXRjaChlcnIgPT4gZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWRcclxuICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcclxuICAgICAgICAgIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCdkaWQtcHVyZ2UnLCBhc3luYyAocHJvZmlsZUlkKSA9PlxyXG4gICAgICBwYXlsb2FkRGVwbG95ZXIub25EaWRQdXJnZShjb250ZXh0LCBwcm9maWxlSWQpKTtcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IG1haW47XHJcbiJdfQ==