import Bluebird from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { actions, fs, log, selectors, types, util } from 'vortex-api';
import Parser, { IniFile, WinapiFormat } from 'vortex-parse-ini';
import * as payloadDeployer from './payloadDeployer';

import { generate, generate as shortid } from 'shortid';

import { UnstrippedAssemblyDownloader } from './unstrippedAssembly';

import {
  BETTER_CONT_EXT, FBX_EXT, GAME_ID, GAME_ID_SERVER,
  genProps, guessModId, IGNORABLE_FILES, INSLIMVML_IDENTIFIER,
  IProps, ISCMDProps, NEXUS, OBJ_EXT, PackType, removeDir, STEAM_ID, VBUILD_EXT,
} from './common';
import { installBetterCont, installCoreRemover, installFullPack, installInSlimModLoader,
  installVBuildMod, testBetterCont, testCoreRemover, testFullPack, testInSlimModLoader,
  testVBuild } from './installers';
import { migrate103, migrate104, migrate106, migrate109 } from './migrations';
import { hasMultipleLibMods, isDependencyRequired } from './tests';

import { migrateR2ToVortex, userHasR2Installed } from './r2Vortex';

const app = remote !== undefined ? remote.app : appIn;

const STOP_PATTERNS = ['config', 'plugins', 'patchers'];
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

  const url = path.join(NEXUS, 'valheim', 'mods', '1202') + `?tab=files&file_id=4899&nmm=1`;
  const raiseMissingAssembliesDialog = () => new Promise<void>((resolve, reject) => {
    api.showDialog('info', 'Missing unstripped assemblies', {
      bbcode: t('Valheim\'s assemblies are distributed in an "optimised" state to reduce required '
      + 'disk space. This unfortunately means that Valheim\'s modding capabilities are also affected.{{br}}{{br}}'
      + 'In order to mod Valheim, the unoptimised/unstripped assemblies are required - please download these '
      + 'from Nexus Mods.{{br}}{{br}} You can choose the Vortex/mod manager download or manual download '
      + '(simply drag and drop the archive into the mods dropzone to add it to Vortex).{{br}}{{br}}'
      + 'Vortex will then be able to install the assemblies where they are needed to enable '
      + 'modding, leaving the original ones untouched.', { replace: { br: '[br][/br]' } }),
    }, [
      { label: 'Cancel', action: () => reject(new util.UserCanceled()) },
      {
        label: 'Download Unstripped Assemblies',
        action: () => util.opn(url)
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
                  + 'Please note that all mods must also be updated in order for them to function with the new game version.',
                  { replace: { lb: '[br][/br][br][/br]', br: '[br][/br]' } }),
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

  const runDownloader = async () => {
    const downloader = new UnstrippedAssemblyDownloader(util.getVortexPath('temp'));
    const folderName = generate();
    try {
      if (props.profile?.gameId !== GAME_ID) {
        // This is a valid scenario when the user tries to manage Valheim
        //  when the active gameMode is undefined.
        throw new util.ProcessCanceled('Wrong gamemode');
      }
      const archiveFilePath = await downloader.downloadNewest('full_name', 'denikson-BepInExPack_Valheim');
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
      return raiseMissingAssembliesDialog();
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
          const dllOverridePath = expectedFilePath.replace(props.discovery.path + path.sep, '')
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
  return path.join(gamePath, 'BepInEx', 'plugins');
}

function main(context: types.IExtensionContext) {
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

  // context.registerGame({
  //   id: GAME_ID_SERVER,
  //   name: 'Valheim: Dedicated Server',
  //   mergeMods: true,
  //   queryPath: () => undefined,
  //   queryModPath: modsPath,
  //   logo: 'gameart.jpg',
  //   executable: () => 'start_headless_server.bat',
  //   requiresLauncher,
  //   setup: discovery => prepareForModding(context, discovery),
  //   requiredFiles: [
  //     'start_headless_server.bat',
  //   ],
  //   environment: {
  //     SteamAPPId: STEAM_ID,
  //   },
  //   details: {
  //     nexusPageId: GAME_ID,
  //     steamAppId: +STEAM_ID,
  //     stopPatterns: STOP_PATTERNS.map(toWordExp),
  //     ignoreConflicts: IGNORABLE_FILES,
  //     ignoreDeploy: IGNORABLE_FILES,
  //   },
  // });

  const getGamePath = () => {
    const props: IProps = genProps(context);
    return (props?.discovery?.path !== undefined)
      ? props.discovery.path : '.';
  };

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
    const buildShareAssembly = path.join(gamePath, 'InSlimVML', 'Mods', 'CR-BuildShare_VML.dll');
    return isDependencyRequired(context.api, {
      dependentModType: 'vbuild-mod',
      masterModType: 'inslimvml-mod',
      masterName: 'BuildShare (AdvancedBuilding)',
      masterURL: 'https://www.nexusmods.com/valheim/mods/5',
      requiredFiles: [ buildShareAssembly ],
    });
  };

  const customMeshesTest = () => {
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

  // context.registerAction('mod-icons', 100, 'steamcmd', {}, 'SteamCMD Dedicated Server', () => {
  //   context.api.selectDir({})
  //     .then((selectedPath: string) => {
  //       if (selectedPath) {
  //         const props: ISCMDProps = {
  //           gameId: GAME_ID_SERVER,
  //           steamAppId: +STEAM_ID,
  //           arguments: [
  //             { argument: 'force_install_dir', value: selectedPath },
  //             { argument: 'quit' },
  //           ],
  //           callback: ((err, data) => null),
  //         };
  //         context.api.ext.scmdStartDedicatedServer(props);
  //       }
  //     })
  //     .catch(err => null);
  // }, () => context.api.ext?.scmdStartDedicatedServer !== undefined);

  context.registerAction('mod-icons', 115, 'import', {}, 'Import From r2modman', () => {
    migrateR2ToVortex(context.api);
  }, () => {
    const state = context.api.getState();
    const activeGameId = selectors.activeGameId(state);
    return userHasR2Installed()
      && (getGamePath() !== '.')
      && (activeGameId === GAME_ID);
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

  context.registerMigration((oldVersion: string) => migrate103(context.api, oldVersion));
  context.registerMigration((oldVersion: string) => migrate104(context.api, oldVersion));
  context.registerMigration((oldVersion: string) => migrate106(context.api, oldVersion));
  context.registerMigration((oldVersion: string) => migrate109(context.api, oldVersion));

  context.registerModType('inslimvml-mod-loader', 20, isSupported, getGamePath,
    (instructions: types.IInstruction[]) => {
      const hasVMLIni = findInstrMatch(instructions, INSLIMVML_IDENTIFIER, path.basename);
      return Bluebird.Promise.Promise.resolve(hasVMLIni);
    }, { name: 'InSlimVML Mod Loader' });

  context.registerModType('inslimvml-mod', 10, isSupported,
    () => path.join(getGamePath(), 'InSlimVML', 'Mods'), (instructions: types.IInstruction[]) => {
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

  context.registerModType('vbuild-mod', 10, isSupported, () => path.join(getGamePath(), 'AdvancedBuilder', 'Builds'),
    (instructions: types.IInstruction[]) => {
      const res = findInstrMatch(instructions, VBUILD_EXT, path.extname);
      return Bluebird.Promise.Promise.resolve(res);
    }, { name: 'BuildShare Mod' });

  context.registerModType('valheim-custom-meshes', 10, isSupported,
    () => path.join(modsPath(getGamePath()), 'CustomMeshes'),
    (instructions: types.IInstruction[]) => {
      const supported = findInstrMatch(instructions, FBX_EXT, path.extname)
        || findInstrMatch(instructions, OBJ_EXT, path.extname);
      return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'CustomMeshes Mod' });

  context.registerModType('valheim-custom-textures', 10, isSupported,
    () => path.join(modsPath(getGamePath()), 'CustomTextures'),
    (instructions: types.IInstruction[]) => {
      const textureRgx: RegExp = new RegExp(/^texture_.*.png$/);
      let supported = false;
      for (const instr of instructions) {
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

  context.registerModType('bepinex-root-mod', 25, isSupported, () => path.join(getGamePath(), 'BepInEx'),
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
    () => path.join(getGamePath(), 'vortex-worlds'),
    (instructions: types.IInstruction[]) => {
      const hasBCExt = findInstrMatch(instructions, BETTER_CONT_EXT, path.extname);
      return Bluebird.Promise.Promise.resolve(hasBCExt);
    }, { name: 'Better Continents Mod' });

  context.once(() => {
    context.api.onAsync('will-deploy', async (profileId) => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }
      return payloadDeployer.onWillDeploy(context, profileId)
        .then(() => ensureUnstrippedAssemblies(genProps(context, profileId)))
        .catch(err => err instanceof util.UserCanceled
          ? Promise.resolve()
          : Promise.reject(err));
    });

    context.api.onAsync('did-purge', async (profileId) =>
      payloadDeployer.onDidPurge(context, profileId));
  });

  return true;
}

export default main;
