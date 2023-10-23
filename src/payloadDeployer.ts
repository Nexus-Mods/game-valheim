/* eslint-disable max-lines-per-function */
import crypto from 'crypto';
import path from 'path';
import { IEntry } from 'turbowalk';
import { fs, selectors, types, util } from 'vortex-api';

import { deploy, DOORSTOPPER_HOOK, GAME_ID, genInstructions, genProps, IProps,
         ISVML_SKIP, purge, removeDir, walkDirPath, IGNORABLE_FILES } from './common';

import { doDownload } from './githubDownloader';

const PAYLOAD_PATH = path.join(__dirname, 'BepInExPayload');
const BACKUP_EXT: string = '.vortex_backup';
const CONFIG_EXT: string = '.cfg';

export async function openPayloadDir(api: types.IExtensionApi) {
  const activeGameId = selectors.activeGameId(api.store.getState());
  if (activeGameId !== GAME_ID) {
    return;
  }
  util.opn(PAYLOAD_PATH);
}

export async function replacePayload(api: types.IExtensionApi,
                                     downloadUrl: string) {
  const profileId = selectors.lastActiveProfileForGame(api.getState(), GAME_ID);
  const props: IProps = genProps(api, profileId);
  if (props === undefined) {
    // Do nothing, profile is either undefined, belongs to a different game
    //  or potentially the game is undiscovered.
    return;
  }

  api.showDialog('question', 'Replace Payload', {
    bbcode: api.translate('This action will replace the BepInEx payload for all of your Valheim profiles.[br][/br][br][/br]'
                        + 'Vortex will purge your mods, and re-deploy as part of this operation.[br][/br][br][/br]'
                        + 'Are you sure you wish to proceed?'),
  }, [
    { label: 'Proceed' }, { label: 'Cancel' },
  ]).then(async res => {
    if (res.action === 'Proceed') {
      try {
        await purge(api);
        // In this case we only want to remove the BIX files themselves, any existing plugins,
        //  patchers or configuration files should be left in place.
        const filterEntries = IGNORABLE_FILES.filter(fileName =>
          path.extname(fileName) !== CONFIG_EXT);
        const filter = (entry: IEntry) => filterEntries.map(fileName => fileName.toLowerCase())
          .indexOf(path.basename(entry.filePath).toLowerCase()) !== -1;
        await removeDir(PAYLOAD_PATH, filter);
        await fs.ensureDirWritableAsync(PAYLOAD_PATH);
        const filePath = path.join(util.getVortexPath('temp'), path.basename(downloadUrl));
        await doDownload(downloadUrl, filePath);
        const sevenZip = new util.SevenZip();
        await sevenZip.extractFull(filePath, PAYLOAD_PATH);
        await deploy(api);
        await fs.removeAsync(filePath).catch(err => Promise.resolve());
      } catch (err) {
        const userCanceled = (err instanceof util.UserCanceled);
        err['attachLogOnReport'] = true;
        api.showErrorNotification('Failed to replace payload', err, { allowReport: !userCanceled });
      }
    } else {
      // Cancel
      return;
    }
  });
}

export async function onWillDeploy(context: types.IExtensionContext,
                                   profileId: string) {
  const props: IProps = genProps(context.api, profileId);
  if (props === undefined) {
    // Do nothing, profile is either undefined, belongs to a different game
    //  or potentially the game is undiscovered.
    return;
  }
  try {
    await deployPayload(props);
  } catch (err) {
    const userCanceled = (err instanceof util.UserCanceled);
    err['attachLogOnReport'] = true;
    context.api.showErrorNotification('Failed to deploy payload',
                                      err, { allowReport: !userCanceled });
  }
}

export async function onDidPurge(api: types.IExtensionApi,
                                 profileId: string) {
  const props: IProps = genProps(api, profileId);
  if (props === undefined) {
    return;
  }
  try {
    await purgePayload(props);
  } catch (err) {
    const userCanceled = (err instanceof util.UserCanceled);
    err['attachLogOnReport'] = true;
    api.showErrorNotification('Failed to remove payload',
                              err, { allowReport: !userCanceled });
  }
}

async function purgePayload(props: IProps) {
  if (props === undefined) {
    return;
  }
  const fileEntries: IEntry[] = await walkDirPath(PAYLOAD_PATH);
  const srcPath = PAYLOAD_PATH;
  const destPath = props.discovery.path;
  const instructions: types.IInstruction[] = genInstructions(srcPath, destPath, fileEntries);
  for (const instr of instructions) {
    // Don't remove the config files
    if (path.extname(instr.destination) === CONFIG_EXT) {
      continue;
    }
    await fs.removeAsync(instr.destination)
      .catch({ code: 'ENOENT' }, () => Promise.resolve());
  }
}

async function ensureLatest(instruction: types.IInstruction) {
  // When deploying the payload, we may encounter the EEXIST error
  //  code. We always assume that the BepInEx assemblies that come with
  //  the game extension are the latest assemblies and therefore we need
  //  to ensure that whenever we encounter EEXIST, we check if the
  //  hash of the source and destination match - if they don't - replace
  //  the existing deployed assembly.
  try {
    const srcHash = await getHash(instruction.source);
    const destHash = await getHash(instruction.destination);
    if (destHash !== srcHash) {
      if (path.extname(instruction.destination) === CONFIG_EXT) {
        // Don't overwrite the config files
        return;
      }
      await fs.removeAsync(instruction.destination);
      await fs.ensureDirWritableAsync(path.dirname(instruction.destination));
      await fs.copyAsync(instruction.source, instruction.destination);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      // We assume that it's the destination file that was somehow removed.
      //  If it's the source - the user clearly has a corrput installation of
      //  this extension, in which case it's ok to crash/error out.
      await fs.ensureDirWritableAsync(instruction.destination);
      await fs.copyAsync(instruction.source, instruction.destination);
    }

    return Promise.reject(err);
  }
}

async function isISVMLEnabled(props: IProps) {
  const mods = util.getSafe(props.state, ['persistent', 'mods', GAME_ID], {});
  const inSlimId = Object.keys(mods).find(key => mods[key].type === 'inslimvml-mod-loader');
  if (inSlimId === undefined) {
    return false;
  }

  const manifest: types.IDeploymentManifest = await util.getManifest(props.api, 'inslimvml-mod-loader', GAME_ID);
  const isDeployed = manifest.files.length > 0;
  return isDeployed || util.getSafe(props.profile, ['modState', inSlimId, 'enabled'], false);
}

async function deployPayload(props: IProps) {
  if (props === undefined) {
    return;
  }
  const isVMLEnabled = await isISVMLEnabled(props);
  try {
    const fileEntries: IEntry[] = await walkDirPath(PAYLOAD_PATH);
    const srcPath = PAYLOAD_PATH;
    const destPath = props.discovery.path;
    const instructions: types.IInstruction[] = genInstructions(srcPath, destPath, fileEntries);
    for (const instr of instructions) {
      if (isVMLEnabled && instr.type === 'copy') {
        if (ISVML_SKIP.includes(path.basename(instr.source).toLowerCase())) {
          // If InSlim is installed and enabled, don't bother with BIX_SVML patcher
          //  or its requirements
          continue;
        }
      }
      if (path.basename(instr.source).toLowerCase() === DOORSTOPPER_HOOK) {
        try {
          // Check if InSlim is installed and is overwriting our doorstopper.
          await fs.statAsync(instr.destination + BACKUP_EXT);
          instr.destination = instr.destination + BACKUP_EXT;
        } catch (err) {
          // nop
        }
      }
      await fs.ensureDirWritableAsync(path.dirname(instr.destination));
      await fs.copyAsync(instr.source, instr.destination)
        .catch({ code: 'EEXIST' }, () => ensureLatest(instr));
    }
  } catch (err) {
    return Promise.reject(err);
  }
}

function calcHashImpl(filePath: string) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('readable', () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function getHash(filePath: string, tries: number = 3) {
  return calcHashImpl(filePath)
    .catch(err => {
      if (['EMFILE', 'EBADF'].includes(err['code']) && (tries > 0)) {
        return getHash(filePath, tries - 1);
      } else {
        return Promise.reject(err);
      }
    });
}
