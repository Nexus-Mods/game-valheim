import Promise from 'bluebird';
import path from 'path';

import { types } from 'vortex-api';
import { DOORSTOPPER_HOOK, GAME_ID, IGNORABLE_FILES,
  INSLIMVML_IDENTIFIER, VBUILD_EXT } from './common';

// These are directories we
const INVALID_DIRS = ['core', 'valheim_data'];
const INVALID_FILES = [DOORSTOPPER_HOOK].concat(IGNORABLE_FILES).map(file => file.toLowerCase());

function isInvalidSegment(filePathSegment: string, invalidCollection: string[]) {
  return invalidCollection.includes(filePathSegment);
}

export function testVBuild(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const supported = files.find(file => path.extname(file) === VBUILD_EXT) !== undefined;
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installVBuildMod(files: string[], destinationPath: string, gameId: string) {
  const filtered = files.filter(file => path.extname(file) === VBUILD_EXT);
  const instructions: types.IInstruction[] = filtered.map(file => ({
    type: 'copy',
    source: file,
    destination: path.basename(file),
  }));

  return Promise.resolve({ instructions });
}

// tslint:disable-next-line: max-line-length
export function testInSlimModLoader(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const supported = files.find(file => path.basename(file) === INSLIMVML_IDENTIFIER) !== undefined;
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installInSlimModLoader(files: string[], destinationPath: string, gameId: string) {
  // This game extension comes with the InSlimVML unity door stopper assembly by default, no point
  //  in adding it.
  const identifier = files.find(file => path.basename(file) === INSLIMVML_IDENTIFIER);
  const minSegIdx = identifier.split(path.sep).indexOf(INSLIMVML_IDENTIFIER);
  const instructions: types.IInstruction[] = files.reduce((accum, file) => {
    const segments = file.split(path.sep).filter(seg => !!seg);
    if (!path.extname(segments[segments.length - 1])) {
      // This is a directory, we don't need it.
      return accum;
    }
    const destination = (segments.length >= minSegIdx + 1)
      ? segments.slice(minSegIdx).join(path.sep)
      : undefined;
    if (destination !== undefined) {
      accum.push({
        type: 'copy',
        source: file,
        destination,
      });
    }
    return accum;
  }, []);
  return Promise.resolve({ instructions });
}

export function testCoreRemover(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  let supported = false;
  for (const file of files) {
    const segments = file.split(path.sep).map(seg => seg.toLowerCase());
    if ((segments.find(seg => isInvalidSegment(seg, INVALID_DIRS)) !== undefined)
      && (isInvalidSegment(segments[segments.length - 1], INVALID_FILES))) {
        supported = true;
        break;
      }
  }
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installCoreRemover(files: string[], destinationPath: string, gameId: string) {
  // Many existing mods have BepInEx's core directory pre-included, we do not want
  //  those files installed as it will just cause unexpected behaviour.
  let minSegIdx = 0;
  for (const file of files) {
    const segments = file.split(path.sep)
      .filter(seg => !!seg)
      .map(seg => seg.toLowerCase());

    if (segments.includes('plugins')) {
      minSegIdx = segments.indexOf('plugins');
      break;
    }
    if (segments.includes('patchers')) {
      minSegIdx = segments.indexOf('patchers');
      break;
    }
  }

  const instructions: types.IInstruction[] = files.reduce((accum, iter) => {
    const segments = iter.split(path.sep).filter(seg => !!seg);

    if (!segments.find(seg => isInvalidSegment(seg.toLowerCase(), INVALID_DIRS))
      && (!isInvalidSegment(segments[segments.length - 1].toLowerCase(), INVALID_FILES))
      && !!path.extname(segments[segments.length - 1])) {
        const destination = (segments.length > minSegIdx + 1)
          ? segments.slice(minSegIdx).join(path.sep)
          : undefined;

        if (destination !== undefined) {
          const instr: types.IInstruction = {
            type: 'copy',
            source: iter,
            destination,
          };
          accum.push(instr);
        }
    }
    return accum;
  }, []);

  return Promise.resolve({ instructions });
}

export function testFullPack(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  let supported = false;
  for (const file of files) {
    const segments = file.split(path.sep).map(seg => seg.toLowerCase());
    const coreLibIdx = segments.findIndex(seg => seg === 'core_lib');
    if (coreLibIdx === -1) {
      continue;
    }

    if (coreLibIdx > 1 && segments[coreLibIdx - 1] === 'bepinex') {
      supported = true;
      break;
    }
  }
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installFullPack(files: string[], destinationPath: string, gameId: string) {
  let coreLibIdx = -1;
  const filtered = files.filter(file => {
    const segments = file.split(path.sep).map(seg => seg.toLowerCase());
    if (!path.extname(segments[segments.length - 1])) {
      return false;
    }
    if (coreLibIdx === -1) {
      const potentialMatch = segments.findIndex(seg => seg === 'core_lib');
      if (potentialMatch > 1 && segments[potentialMatch - 1] === 'bepinex') {
        coreLibIdx = potentialMatch;
        return true;
      }
    } else {
      if ((segments[coreLibIdx - 1] === 'bepinex')
        && (segments[coreLibIdx] === 'core_lib')) {
        return true;
      }
    }
    return false;
  });

  const modTypeInstr: types.IInstruction = {
    type: 'setmodtype',
    value: 'bepinex-root-mod',
  };

  const modAttribInstr: types.IInstruction = {
    type: 'attribute',
    key: 'IsCoreLibMod',
    value: 'true',
  };
  const instructions: types.IInstruction[] = [modTypeInstr, modAttribInstr]
    .concat(filtered.map(file => ({
      type: 'copy',
      source: file,
      destination: file.split(path.sep).slice(coreLibIdx).join(path.sep),
  })));

  return Promise.resolve({ instructions });
}
