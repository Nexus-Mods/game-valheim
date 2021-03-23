import Promise from 'bluebird';
import path from 'path';

import { types, util } from 'vortex-api';
import { BETTER_CONT_EXT, DOORSTOPPER_HOOK, GAME_ID, IGNORABLE_FILES,
  INSLIMVML_IDENTIFIER, PackType, VBUILD_EXT } from './common';

const INVALID_DIRS = ['core', 'valheim_data'];
const INVALID_FILES = [DOORSTOPPER_HOOK].concat(IGNORABLE_FILES).map(file => file.toLowerCase());
const PACK_SEGMENTS = ['core_lib', 'unstripped_corlib'];

function indexOfPackSegment(segments: string[]) {
  const hasPackSegment = (seg: string) => PACK_SEGMENTS.includes(seg);
  const segment = segments.find(hasPackSegment);
  if (segment !== undefined) {
    return segments.indexOf(segment);
  }
  return -1;
}

function getPackType(seg: string): PackType {
  switch (seg) {
    case 'core_lib':
      return 'core_lib';
    case 'unstripped_corlib':
      return 'unstripped_corlib';
    default:
      return 'none';
  }
}

function isInvalidSegment(filePathSegment: string, invalidCollection: string[]) {
  return invalidCollection.includes(filePathSegment);
}

export function testBetterCont(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }

  const supported = files.find(file =>
    path.extname(file).toLowerCase() === BETTER_CONT_EXT) !== undefined;
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installBetterCont(files: string[], destinationPath: string, gameId: string) {
  const filtered = files.filter(path.extname);
  const betterContFile = filtered.find(file =>
    path.extname(file).toLowerCase() === BETTER_CONT_EXT);
  const idx = betterContFile.split(path.sep).indexOf(path.basename(betterContFile));
  const instructions: types.IInstruction[] = filtered.map(file => ({
    type: 'copy',
    source: file,
    destination: file.split(path.sep).slice(idx).join(path.sep),
  }));

  return Promise.resolve({ instructions });
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
    const coreLibIdx = indexOfPackSegment(segments);
    if (coreLibIdx === -1) {
      continue;
    }

    if (coreLibIdx !== undefined) {
      supported = true;
      break;
    }
  }
  return Promise.resolve({ supported, requiredFiles: [] });
}

export function installFullPack(files: string[], destinationPath: string, gameId: string) {
  let coreLibIdx = -1;
  let packType: PackType;
  const filtered = files.filter(file => {
    const segments = file.split(path.sep).map(seg => seg.toLowerCase());
    if (!path.extname(segments[segments.length - 1])) {
      return false;
    }
    if (coreLibIdx === -1) {
      coreLibIdx = indexOfPackSegment(segments);
      packType = getPackType(segments[coreLibIdx]);
      if (coreLibIdx !== -1) {
        return true;
      }
    } else {
      if (PACK_SEGMENTS.includes(segments[coreLibIdx])) {
        return true;
      }
    }
    return false;
  });

  if (packType === 'none') {
    // How did we get here if this isn't an unstripped assemblies package?
    return Promise.reject(new util.NotSupportedError());
  }
  const modTypeInstr: types.IInstruction = (packType === 'core_lib')
    ? {
      type: 'setmodtype',
      value: 'bepinex-root-mod',
    } : {
      type: 'setmodtype',
      value: 'unstripped-assemblies',
    };

  const modAttribInstr: types.IInstruction = {
    type: 'attribute',
    key: 'CoreLibType',
    value: packType,
  };
  const instructions: types.IInstruction[] = [modTypeInstr, modAttribInstr]
    .concat(filtered.map(file => ({
      type: 'copy',
      source: file,
      destination: file.split(path.sep).slice(coreLibIdx).join(path.sep),
  })));

  return Promise.resolve({ instructions });
}
