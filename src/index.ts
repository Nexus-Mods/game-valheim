/* eslint-disable */
import Bluebird from 'bluebird';
import * as path from 'path';
import { actions, fs, log, selectors, types, util } from 'vortex-api';
import Parser, { IniFile, WinapiFormat } from 'vortex-parse-ini';
import * as payloadDeployer from './payloadDeployer';

import { createAction } from 'redux-act';

import UpdateDialog from './views/UpdateDialog';

import { generate } from 'shortid';

import { UnstrippedAssemblyDownloader } from './unstrippedAssembly';

import {
  BETTER_CONT_EXT, CONF_MANAGER, FBX_EXT, GAME_ID,
  genProps, guessModId, IGNORABLE_FILES, INSLIMVML_IDENTIFIER,
  IProps, NAMESPACE, OBJ_EXT, PackType, removeDir, STEAM_ID, VBUILD_EXT, walkDirPath,
} from './common';
import { installBetterCont, installCoreRemover, installFullPack, installInSlimModLoader,
         installVBuildMod, testBetterCont, testCoreRemover, testFullPack, testInSlimModLoader,
         testVBuild, testConfManager, installConfManager } from './installers';

// Migrations are broken.
// import { migrate1013, migrate1015, migrate110, migrate103, migrate104, migrate106, migrate109 } from './migrations';
import { hasMultipleLibMods, isDependencyRequired } from './tests';

import { migrateR2ToVortex, userHasR2Installed } from './r2Vortex';

import { getReleaseMap } from './githubDownloader';
import { IEntry } from 'turbowalk';
import { IReleaseMap } from './types';

// actions
const setShowUpdateDialog = createAction('VAL_SHOW_UPDATE_DIALOG', show => show);

// reducer
const reducer: types.IReducerSpec = {
  reducers: {
    [setShowUpdateDialog as any]: (state, payload) => util.setSafe(state, ['showUpdateDialog'], payload),
  },
  defaults: {
    showUpdateDialog: false,
  },
};

const STOP_PATTERNS = ['plugins', 'patchers'];
function toWordExp(input) {
  return '(^|/)' + input + '(/|$)';
}

function findGame(): any {
  return util.GameStoreHelper.findByAppId([STEAM_ID])
    .then(game => game.gamePath);
}

function requiresLauncher(gamePath) {
  return fs.readdirAsync(gamePath)
    .then(files => (files.find(file => file.toLowerCase() === 'steam_appid.txt') !== undefined)
      ? Promise.resolve({
        launcher: 'steam',
        addInfo: {
          appId: STEAM_ID,
          parameters: ['-force-glcore'],
          launchType: 'gamestore',
        },
      })
      : Promise.resolve(undefined))
    .catch(err => Promise.reject(err));
}

async function ensureUnstrippedAssemblies(props: IProps): Promise<void> {
  const api = props.api;
  const t = api.translate;
  const expectedFilePath = path.join(props.discovery.path,
                                     'unstripped_managed', 'mono.security.dll');
  const fullPackCorLibOld = path.join(props.discovery.path,
                                      'BepInEx', 'core_lib', 'mono.security.dll');
  const fullPackCorLibNew = path.join(props.discovery.path,
                                      'unstripped_corlib', 'mono.security.dll');

  const raiseForceDownloadNotif = () => api.sendNotification({
    message: t('Game updated - Updated assemblies pack required.', { ns: NAMESPACE }),
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
                  + 'Please note that all mods must also be updated in order for them to function with the new game version.',
                    { ns: NAMESPACE, replace: { lb: '[br][/br][br][/br]', br: '[br][/br]' } }),
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
          api.store.dispatch(actions.suppressNotification('forceDownloadNotif', true));
          dismiss();
        },
      },
    ],
  });

  const assignOverridePath = async (overridePath: string) => {
    const doorStopConfig = path.join(props.discovery.path, 'doorstop_config.ini');
    const parser = new Parser(new WinapiFormat());
    try {
      const iniData: IniFile<any> = await parser.read(doorStopConfig);
      iniData.data['UnityDoorstop']['dllSearchPathOverride'] = overridePath;
      await parser.write(doorStopConfig, iniData);
    } catch (err) {
      api.showErrorNotification('failed to modify doorstop configuration', err);
    }
  };

  const archiveExists = (archive: string) => {
    const downloads: { [arcId: string]: types.IDownload } = util.getSafe(api.getState(), ['persistent', 'downloads', 'files'], {});
    const download = Object.values(downloads).find(dl => dl.localPath === archive);
    if (download !== undefined) {
      return true;
    }
    return false;
  }

  const runDownloader = async () => {
    const downloader = new UnstrippedAssemblyDownloader(util.getVortexPath('temp'));
    const folderName = generate();
    try {
      const activeGameMode = selectors.activeGameId(api.getState());
      if (activeGameMode !== GAME_ID) {
        // This is a valid scenario when the user tries to manage Valheim
        //  when the active gameMode is undefined.
        throw new util.ProcessCanceled('Wrong gamemode');
      }
      const archiveFilePath = await downloader.downloadNewest('full_name', 'denikson-BepInExPack_Valheim', archiveExists);
      // Unfortunately we can't really validate the download's integrity; but we
      //  can at the very least make sure it's there and isn't just an empty archive.
      await fs.statAsync(archiveFilePath);
      const sevenzip = new util.SevenZip();
      const tempPath = path.join(path.dirname(archiveFilePath), folderName);
      await sevenzip.extractFull(archiveFilePath, tempPath);
      const files = await fs.readdirAsync(tempPath);
      if (files.length === 0) {
        throw new util.DataInvalid('Invalid archive');
      }

      // Give it a second for the download to register in the state.
      await new Promise((resolve, reject) =>
        api.events.emit('import-downloads', [ archiveFilePath ], async (dlIds: string[]) => {
          if (dlIds.length === 0) {
            return reject(new util.ProcessCanceled('Failed to import archive'));
          }

          try {
            for (const dlId of dlIds) {
              await new Promise((res2, rej2) =>
                api.events.emit('start-install-download', dlId, true, (err, modId) => {
                  if (err) {
                    return rej2(err);
                  }
                  api.store.dispatch(actions.setModEnabled(props.profile.id, modId, true));
                  return res2(undefined);
                }));
            }
          } catch (err) {
            return reject(err);
          }

          api.store.dispatch(actions.suppressNotification('forceDownloadNotif', true));
          api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true));
          await assignOverridePath('unstripped_corlib');
          try {
            await removeDir(tempPath);
            await fs.removeAsync(tempPath).catch(err => err.code === 'ENOENT');
          } catch (err) {
            log('error', 'failed to cleanup temporary files');
          }
          return resolve(undefined);
        }));
    } catch (err) {
      try {
        const tempPath = path.join(util.getVortexPath('temp'), folderName);
        await fs.statAsync(tempPath);
        await removeDir(tempPath);
      } catch (err2) {
        log('debug', 'unstripped assembly downloader cleanup failed', err2);
        // Cleanup failed or is unnecessary.
      }
      log('debug', 'unstripped assembly downloader failed', err);
      if (err instanceof util.ProcessCanceled) {
        return Promise.resolve();
      }
    }
  };

  const mods: { [modId: string]: types.IMod } =
    util.getSafe(props.state, ['persistent', 'mods', GAME_ID], {});
  const coreLibModIds = Object.keys(mods).filter(key => {
    const hasCoreLibType = util.getSafe(mods[key],
                                        ['attributes', 'CoreLibType'], undefined) !== undefined;
    const isEnabled = util.getSafe(props.profile,
                                   ['modState', key, 'enabled'], false);
    return hasCoreLibType && isEnabled;
  });

  if (coreLibModIds.length > 0) {
    // We don't care if the user has several installed, select the first one.
    const coreLibModId = coreLibModIds[0];

    const packType: PackType = mods[coreLibModId].attributes['CoreLibType'];
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
        // nop - let the for loop below try to find the pack.
    }
  }

  for (const filePath of [fullPackCorLibNew, fullPackCorLibOld]) {
    try {
      await fs.statAsync(filePath);
      const dllOverridePath = filePath.replace(props.discovery.path + path.sep, '')
                                      .replace(path.sep + 'mono.security.dll', '');
      await assignOverridePath(dllOverridePath);
      raiseForceDownloadNotif();
      return;
    } catch (err) {
      // nop
    }
  }

  // Check if we have a valid variant of the unstripped assembly mods found on Nexus.
  const unstrippedMods = Object.keys(mods).filter(id => mods[id]?.type === 'unstripped-assemblies');
  if (unstrippedMods.length > 0) {
    for (const modId of unstrippedMods) {
      if (util.getSafe(props.profile, ['modState', modId, 'enabled'], false)) {
        const dlid = mods[modId].archiveId;
        const download: types.IDownload = util.getSafe(api.getState(),
                                                       ['persistent', 'downloads', 'files', dlid], undefined);
        if (download?.localPath !== undefined && guessModId(download.localPath) !== '15') {
          // The Nexus Mods unstripped assmeblies mod is enabled - don't raise the missing
          //  assemblies dialog.
          const dllOverridePath = expectedFilePath
            .replace(props.discovery.path + path.sep, '')
            .replace(path.sep + 'mono.security.dll', '');
          await assignOverridePath(dllOverridePath);
          return;
        }
      }
    }
  }

  return runDownloader();
}

function prepareForModding(context: types.IExtensionContext, discovery: types.IDiscoveryResult) {
  const state = context.api.getState();
  const prevProfId: string = selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile: types.IProfile = selectors.profileById(state, prevProfId);
  const modTypes: { [typeId: string]: string } = selectors.modPathsForGame(state, GAME_ID);
  const createDirectories = async () => {
    for (const modType of Object.keys(modTypes)) {
      try {
        await fs.ensureDirWritableAsync(modTypes[modType]);
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
  return new Bluebird<void>((resolve, reject) => createDirectories()
    .then(() => payloadDeployer.onWillDeploy(context, profile?.id))
    .then(() => resolve())
    .catch(err => reject(err)))
    .then(() => ensureUnstrippedAssemblies({ api: context.api, state, profile, discovery }));
}

function modsPath(gamePath: string) {
  return gamePath !== undefined ? path.join(gamePath, 'BepInEx', 'plugins') : '.';
}

function main(context: types.IExtensionContext) {
  context.registerReducer(['session', 'valheim'], reducer);
  let releaseMap: IReleaseMap = {};
  context.registerGame({
    id: GAME_ID,
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
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
      stopPatterns: STOP_PATTERNS.map(toWordExp),
      ignoreConflicts: [].concat(IGNORABLE_FILES, IGNORABLE_FILES.map(file => file.toLowerCase())),
      ignoreDeploy: [].concat(IGNORABLE_FILES, IGNORABLE_FILES.map(file => file.toLowerCase())),
    },
  });

  const getGamePath = () => {
    const state = context.api.getState();
    return state.settings.gameMode.discovered?.[GAME_ID]?.path;
  };

  const isValheimActive = (api: types.IExtensionApi) => {
    const activeGameId = selectors.activeGameId(api.getState());
    return (activeGameId === GAME_ID);
  }

  const isSupported = (gameId: string) => (gameId === GAME_ID);
  const hasInstruction = (instructions: types.IInstruction[],
                          pred: (inst: types.IInstruction) => boolean) =>
                            instructions.find(instr => (instr.type === 'copy')
                                                    && (pred(instr))) !== undefined;

  const findInstrMatch = (instructions: types.IInstruction[],
                          pattern: string,
                          mod?: (input: string) => string) => {
    if (mod === undefined) {
      mod = (input) => input;
    }
    return hasInstruction(instructions, (instr) =>
      mod(instr.source).toLowerCase() === pattern.toLowerCase());
  };

  const vbuildDepTest = () => {
    const gamePath = getGamePath();
    if (gamePath === undefined) {
      return undefined;
    }
    const buildShareAssembly = path.join(modsPath(gamePath), 'BuildShareV2.dll');
    return isDependencyRequired(context.api, {
      dependentModType: 'vbuild-mod',
      masterModType: '',
      masterName: 'BuildShare (AdvancedBuilding)',
      masterURL: 'https://www.nexusmods.com/valheim/mods/5',
      requiredFiles: [ buildShareAssembly ],
    });
  };

  const customMeshesTest = () => {
    if (getGamePath() === undefined) {
      return undefined;
    }
    const basePath = modsPath(getGamePath());
    const requiredAssembly = path.join(basePath, 'CustomMeshes.dll');
    return isDependencyRequired(context.api, {
      dependentModType: 'valheim-custom-meshes',
      masterModType: '',
      masterName: 'CustomMeshes',
      masterURL: 'https://www.nexusmods.com/valheim/mods/184',
      requiredFiles: [ requiredAssembly ],
    });
  };

  const customTexturesTest = () => {
    if (getGamePath() === undefined) {
      return undefined;
    }
    const basePath = modsPath(getGamePath());
    const requiredAssembly = path.join(basePath, 'CustomTextures.dll');
    return isDependencyRequired(context.api, {
      dependentModType: 'valheim-custom-textures',
      masterModType: '',
      masterName: 'CustomTextures',
      masterURL: 'https://www.nexusmods.com/valheim/mods/48',
      requiredFiles: [ requiredAssembly ],
    });
  };

  const betterContinentsTest = () => {
    if (getGamePath() === undefined) {
      return undefined;
    }
    const basePath = modsPath(getGamePath());
    const requiredAssembly = path.join(basePath, 'BetterContinents.dll');
    return isDependencyRequired(context.api, {
      dependentModType: 'better-continents-mod',
      masterModType: '',
      masterName: 'Better Continents',
      masterURL: 'https://www.nexusmods.com/valheim/mods/446',
      requiredFiles: [ requiredAssembly ],
    });
  };

  context.registerDialog('valheim-update-dialog', UpdateDialog, () => ({
    releaseMap: releaseMap,
    onClose: () => context.api.store.dispatch(setShowUpdateDialog(false)),
    onConfirm: (tag: string) => {
      const release = releaseMap[tag];
      if (release !== undefined) {
        payloadDeployer.replacePayload(context.api, release);
      }
      context.api.store.dispatch(setShowUpdateDialog(false));
    }
  }));

  context.registerAction('mod-icons', 100, 'folder-download', {}, 'Update BepInEx', () => {
    context.api.store.dispatch(setShowUpdateDialog(true))
  }, () => isValheimActive(context.api));
  context.registerAction('mod-icons', 105, 'open-ext', {}, 'Open BepInEx Payload Folder', () => {
    payloadDeployer.openPayloadDir(context.api);
  }, () => isValheimActive(context.api));
  context.registerAction('mod-icons', 115, 'import', {}, 'Import From r2modman', () => {
    migrateR2ToVortex(context.api);
  }, () => {
    return isValheimActive(context.api)
      && userHasR2Installed()
      && (getGamePath() !== undefined);
  });

  const dependencyTests = [ vbuildDepTest, customMeshesTest,
    customTexturesTest, betterContinentsTest ];

  for (const testFunc of dependencyTests) {
    context.registerTest(testFunc.name.toString(), 'gamemode-activated', testFunc);
    context.registerTest(testFunc.name.toString(), 'mod-installed', testFunc);
  }

  context.registerTest('multiple-lib-mods', 'gamemode-activated',
                       () => hasMultipleLibMods(context.api));
  context.registerTest('multiple-lib-mods', 'mod-installed',
                       () => hasMultipleLibMods(context.api));

  context.registerInstaller('valheim-better-continents', 20, testBetterCont, installBetterCont);
  context.registerInstaller('valheim-core-remover', 20, testCoreRemover, installCoreRemover);
  context.registerInstaller('valheim-inslimvm', 20, testInSlimModLoader, installInSlimModLoader);
  context.registerInstaller('valheim-vbuild', 20, testVBuild, installVBuildMod);
  context.registerInstaller('valheim-full-bep-pack', 10, testFullPack, installFullPack);
  context.registerInstaller('valheim-config-manager', 10, testConfManager, installConfManager)

  // Migrations in the extension manager are broken and are crashing the renderer thread!
  //  will uncomment these once the issue is fixed.
  // context.registerMigration((oldVersion: string) => migrate103(context.api, oldVersion));
  // context.registerMigration((oldVersion: string) => migrate104(context.api, oldVersion));
  // context.registerMigration((oldVersion: string) => migrate106(context.api, oldVersion));
  // context.registerMigration((oldVersion: string) => migrate109(context.api, oldVersion));
  // context.registerMigration((oldVersion: string) => migrate1013(context.api, oldVersion));
  // context.registerMigration((oldVersion: string) => migrate1015(context.api, oldVersion));
  // context.registerMigration((oldVersion: string) => migrate110(context.api, oldVersion));

  context.registerModType('inslimvml-mod-loader', 20, isSupported, getGamePath,
    (instructions: types.IInstruction[]) => {
      const hasVMLIni = findInstrMatch(instructions, INSLIMVML_IDENTIFIER, path.basename);
      return Bluebird.Promise.Promise.resolve(hasVMLIni);
    }, { name: 'InSlimVML Mod Loader' });

  context.registerModType('inslimvml-mod', 10, isSupported,
    () => getGamePath() !== undefined ? path.join(getGamePath(), 'InSlimVML', 'Mods') : undefined, (instructions: types.IInstruction[]) => {
      // Unfortunately there are currently no identifiers to differentiate between
      //  BepInEx and InSlimVML mods and therefore cannot automatically assign
      //  this modType automatically. We do know that CR-AdvancedBuilder.dll is an InSlim
      //  mod, but that's about it.
      const vmlSuffix = '_vml.dll';
      const mod = (input: string) => (input.length > vmlSuffix.length)
        ? path.basename(input).slice(-vmlSuffix.length)
        : '';
      const testRes = findInstrMatch(instructions, 'cr-buildshare_vml.dll', path.basename)
        || findInstrMatch(instructions, '_vml.dll', mod);
      return Bluebird.Promise.Promise.resolve(testRes);
    }, { name: 'InSlimVML Mod' });

  context.registerModType('vbuild-mod', 10, isSupported, () => getGamePath() !== undefined ? path.join(getGamePath(), 'AdvancedBuilder', 'Builds') : undefined,
    (instructions: types.IInstruction[]) => {
      const res = findInstrMatch(instructions, VBUILD_EXT, path.extname);
      return Bluebird.Promise.Promise.resolve(res);
    }, { name: 'BuildShare Mod' });

  context.registerModType('valheim-custom-meshes', 10, isSupported,
    () => getGamePath() !== undefined ? path.join(modsPath(getGamePath()), 'CustomMeshes') : undefined,
    (instructions: types.IInstruction[]) => {
      const modifier = (filePath: string): string => {
        const segments = filePath.toLowerCase().split(path.sep);
        return (segments.includes('custommeshes'))
          ? filePath
          : path.extname(filePath);
      };
      const supported = findInstrMatch(instructions, FBX_EXT, modifier)
        || findInstrMatch(instructions, OBJ_EXT, modifier);
      return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'CustomMeshes Mod' });

  context.registerModType('valheim-custom-textures', 10, isSupported,
    () => getGamePath() !== undefined ? path.join(modsPath(getGamePath()), 'CustomTextures') : undefined,
    (instructions: types.IInstruction[]) => {
      const textureRgx: RegExp = new RegExp(/.*tex.png$/);
      let supported = false;
      for (const instr of instructions) {
        const segments = (!!instr.source)
          ? instr.source.toLowerCase().split(path.sep)
          : [];
        if (segments.includes('customtextures')) {
          // The existence of the customtextures folder suggests that the mod author
          //  may have added additional functionality in his mod. We don't want to
          //  mess with the files in this case.
          supported = false;
          break;
        }

        if ((instr.type === 'copy')
          && textureRgx.test(path.basename(instr.source).toLowerCase())) {
            supported = true;
            break;
        }
      }
      return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'CustomTextures Mod' });

  context.registerModType('unstripped-assemblies', 20, isSupported, getGamePath,
    (instructions: types.IInstruction[]) => {
      const testPath = path.join('unstripped_managed', 'mono.posix.dll');
      const supported = hasInstruction(instructions,
        (instr) => instr.source.toLowerCase().includes(testPath));
      return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'Unstripped Assemblies' });

  context.registerModType('bepinex-root-mod', 25, isSupported,
  () => getGamePath() !== undefined ? path.join(getGamePath(), 'BepInEx') : undefined,
  (instructions: types.IInstruction[]) => {
    const matcher = (filePath: string) => {
      const segments = filePath.split(path.sep);
      for (const stop of STOP_PATTERNS) {
        if (segments.includes(stop)) {
          return true;
        }
      }
      return false;
    };
    const supported = hasInstruction(instructions, (instr) => matcher(instr.source));
    return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'BepInEx Root Mod' });

  context.registerModType('better-continents-mod', 25, isSupported,
    () => getGamePath() !== undefined ? path.join(getGamePath(), 'vortex-worlds') : undefined,
    (instructions: types.IInstruction[]) => {
      const hasBCExt = findInstrMatch(instructions, BETTER_CONT_EXT, path.extname);
      return Bluebird.Promise.Promise.resolve(hasBCExt);
    }, { name: 'Better Continents Mod' });

  context.registerModType('val-conf-man', 20, isSupported,
    () => getGamePath() !== undefined ? path.join(getGamePath(), 'BepInEx') : undefined,
    (instructions: types.IInstruction[]) => {
      const testRes = findInstrMatch(instructions, CONF_MANAGER, path.basename);
      return Bluebird.Promise.Promise.resolve(testRes);
    }, { name: 'Configuration Manager' });

  context.once(() => {
    context.api.onAsync('will-deploy', async (profileId) => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }
      return payloadDeployer.onWillDeploy(context, profileId)
        .then(() => ensureUnstrippedAssemblies(genProps(context.api, profileId)))
        .catch(err => err instanceof util.UserCanceled
          ? Promise.resolve()
          : Promise.reject(err));
    });

    context.api.onAsync('did-purge', async (profileId) =>
      payloadDeployer.onDidPurge(context.api, profileId));

    context.api.events.on('gamemode-activated', async (gameMode: string) => {
      if (gameMode !== GAME_ID) {
        return;
      }

      // TODO: remove this once the extension manager migrations are fixed
      const api = context.api;
      const t = api.translate;
      api.sendNotification({
        id: 'valheim-update-1.1.0',
        type: 'info',
        message: 'Important Valheim Update Information',
        actions: [
          { title: 'More', action: (dismiss) => {
            api.showDialog('info', 'Valheim Update 1.1.0', {
              bbcode: t('Aside from updating the BepInEx payload to 5.4.22.[br][/br][br][/br]'
                      + 'This update adds a new button to the mods page "Update BepInEx" which allows '
                      + 'users to change the BepInEx version used by Vortex.[br][/br][br][/br]'
                      + 'Available versions are pulled directly from the BepInEx github repository, '
                      + 'and will maintain any existing configuration files in your game directory.[br][/br][br][/br]'
                      + 'If for any reason the BepInEx payload deployed by Vortex is not ideal for your mod setup, and you '
                      + 'require a custom version, the payload can be replaced manually using the "Open BepInEx Payload Folder" button '
                      + 'which will open the location of the payload itself in your file browser. Any changes there will be reflected in '
                      + 'your game directory upon deployment.', { ns: NAMESPACE }),
            }, [ { label: 'Close', action: () => {
              api.store.dispatch(actions.suppressNotification('valheim-update-1.1.0', true));
              dismiss()
            }, default: true } ]);
          }}
        ],
      });
      releaseMap = await getReleaseMap(context.api);
    });

    context.api.events.on('did-install-mod', async (gameId, archiveId, modId) => {
      if (gameId !== GAME_ID) {
        return;
      }

      // Point of this functionality is to set the version information
      //  for mods that are installed from an external site.
      const state = context.api.getState();
      const installPath = selectors.installPathForGame(state, gameId);
      const mod: types.IMod = state.persistent.mods?.[gameId]?.[modId];
      if ((installPath === undefined)
      || (mod?.installationPath === undefined)
      || (!!mod.attributes?.version)) {
        return;
      }
      const modPath = path.join(installPath, mod.installationPath);
      try {
        const fileEntries: IEntry[] = await walkDirPath(modPath);
        const manifestFile = fileEntries.find(entry => path.basename(entry.filePath.toLowerCase()) === 'manifest.json');
        if (manifestFile === undefined) {
          return;
        }

        const manifestData = await fs.readFileAsync(manifestFile.filePath, { encoding: 'utf8' });
        const data = JSON.parse(manifestData);
        if (data['version_number'] !== undefined) {
          context.api.store.dispatch(actions.setModAttribute(gameId, modId, 'version', data['version_number']));
        }
      } catch (err) {
        // This is a QoL feature, we don't care if it fails.
        return;
      }
    })
  });

  return true;
}

export default main;
