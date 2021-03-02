import crypto from 'crypto';
import path from 'path';
import { IEntry } from 'turbowalk';
import { fs, types, util } from 'vortex-api';

import { DOORSTOPPER_HOOK, genInstructions, genProps, IProps, walkDirPath } from './common';

const PAYLOAD_PATH = path.join(__dirname, 'BepInExPayload');
const BACKUP_EXT: string = '.vortex_backup';

export async function onWillDeploy(context: types.IExtensionContext,
                                   profileId: string) {
  const props: IProps = genProps(context, profileId);
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

export async function onDidPurge(context: types.IExtensionContext,
                                 profileId: string) {
  const props: IProps = genProps(context, profileId);
  if (props === undefined) {
    return;
  }
  try {
    await purgePayload(props);
  } catch (err) {
    const userCanceled = (err instanceof util.UserCanceled);
    err['attachLogOnReport'] = true;
    context.api.showErrorNotification('Failed to remove payload',
      err, { allowReport: !userCanceled });
  }
}

async function purgePayload(props: IProps) {
  if (props === undefined) {
    return;
  }
  try {
    const fileEntries: IEntry[] = await walkDirPath(PAYLOAD_PATH);
    const srcPath = PAYLOAD_PATH;
    const destPath = props.discovery.path;
    const instructions: types.IInstruction[] = genInstructions(srcPath, destPath, fileEntries);
    for (const instr of instructions) {
      await fs.removeAsync(instr.destination)
        .catch({ code: 'ENOENT' }, () => Promise.resolve());
    }
  } catch (err) {
    throw err;
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

async function deployPayload(props: IProps) {
  if (props === undefined) {
    return;
  }
  try {
    const fileEntries: IEntry[] = await walkDirPath(PAYLOAD_PATH);
    const srcPath = PAYLOAD_PATH;
    const destPath = props.discovery.path;
    const instructions: types.IInstruction[] = genInstructions(srcPath, destPath, fileEntries);
    for (const instr of instructions) {
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
    throw err;
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
