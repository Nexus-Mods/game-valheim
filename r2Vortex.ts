import { app, remote } from 'electron';
import path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import { fs, selectors, types, util } from 'vortex-api';

import semver from 'semver';

import { DOORSTOPPER_HOOK, GAME_ID, IGNORABLE_FILES } from './common';

const invalidModFolders = ['denikson-bepinexpack_valheim', '1f31a-bepinex_valheim_full'];

const appUni = remote !== undefined ? remote.app : app;

// TODO: resolve the location of the cache rather than searching for it in the
//  default location.
function getR2CacheLocation() {
  return path.join(appUni.getPath('appData'), 'r2modmanPlus-local', 'Valheim', 'cache');
}

export function userHasR2Installed() {
  try {
    fs.statSync(getR2CacheLocation());
    return true;
  } catch (err) {
    return false;
  }
}

export async function migrateR2ToVortex(api: types.IExtensionApi) {
  const start = async () => {
    const activityId = 'r2migrationactivity';
    api.sendNotification({
      id: activityId,
      type: 'activity',
      message: 'Migrating Mods',
      allowSuppress: false,
      noDismiss: true,
    });

    try {
      await startMigration(api);
      api.sendNotification({
        type: 'success',
        message: 'Mods migrated successfully',
        displayMS: 3000,
      });
    } catch (err) {
      api.showErrorNotification('Failed to migrate mods from R2 Mod Manager', err);
    }

    api.dismissNotification(activityId);
  };

  api.showDialog('info', 'R2 Mods Migration',
  {
    bbcode: 'Vortex can attempt to migrate your R2 Mods Manager plugins to the game\'s '
      + 'directory, ensuring that your previously downloaded/installed mods are still '
      + 'available in-game.[br][/br][br][/br]'
      + 'Please note: [list]'
      + '[*]mod configuration changes will not be imported - these need to be '
      + 're-added or imported manually from your preferred profile'
      + '[*]Vortex will have no control over these files - you will have to remove them '
      + 'manually from the game\'s mods directory'
      + '[*]It is still highly recommended to use a fresh vanilla copy of the game when '
      + 'starting to mod with Vortex[/list]',
  }, [
    { label: 'Cancel', action: () => Promise.resolve() },
    { label: 'Start Migration', action: () => start() },
  ]);
}

async function startMigration(api: types.IExtensionApi) {
  const hasInvalidSeg = (segment: string) =>
    [DOORSTOPPER_HOOK].concat(invalidModFolders, IGNORABLE_FILES).includes(segment.toLowerCase());

  const state = api.getState();
  const discovery: types.IDiscoveryResult = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.path === undefined) {
    // Should never be possible.
    return;
  }

  const currentDeployment = await getDeployment(api);
  const r2Path = getR2CacheLocation();
  let fileEntries: IEntry[] = [];
  await turbowalk(r2Path, entries => {
    const filtered = entries.filter(entry => {
      if (entry.isDirectory) {
        return false;
      }
      const segments = entry.filePath.split(path.sep);
      const isInvalid = segments.find(hasInvalidSeg) !== undefined;
      if (isInvalid) {
        return false;
      }
      return true;
    });
    fileEntries = fileEntries.concat(filtered);
  })
  .catch(err => ['ENOENT', 'ENOTFOUND'].includes(err.code)
    ? Promise.resolve() : Promise.reject(err));

  const verRgx = new RegExp(/^\d\.\d\.\d{1,4}$/);
  const destination = path.join(discovery.path, 'BepInEx', 'plugins');
  // tslint:disable-next-line: max-line-length
  const instructions: types.IInstruction[] = await fileEntries.reduce(async (accumP, iter: IEntry) => {
    const accum = await accumP;
    const segments = iter.filePath.split(path.sep);
    const idx = segments.findIndex(seg => verRgx.test(seg));
    if (idx === -1) {
      // This is an invalid file entry, at least as far as the R2 cache file
      // structure was in 02/03/2021;
      return accum;
    }
    const modKey = segments.slice(idx - 1, idx + 1).join(path.sep);
    const index = accum.findIndex((instr) => instr.key === modKey
      && instr.source === iter.filePath);
    if (index !== -1) {
      const existing: types.IInstruction = accum[index];
      const ver = existing.key.split(path.sep)[1];
      try {
        if (semver.gt(segments[idx], ver)) {
          accum[index].source = iter.filePath;
        }
      } catch (err) {
        // We can't deduce which one is more up to date - just leave the one we have.
        return accum;
      }
    } else {
      const fullDest = path.join(destination, segments.slice(idx + 1).join(path.sep));
      if (!currentDeployment.includes(fullDest.toLowerCase())) {
        accum.push({
          type: 'copy',
          source: iter.filePath,
          destination: path.join(destination, segments.slice(idx + 1).join(path.sep)),
          key: modKey,
        });
      }
    }

    return accum;
  }, Promise.resolve([]));

  for (const instr of instructions) {
    await fs.ensureDirWritableAsync(path.dirname(instr.destination));
    await fs.removeAsync(instr.destination)
      .catch({ code: 'ENOENT' }, () => Promise.resolve());
    await fs.copyAsync(instr.source, instr.destination);
  }
}

async function getDeployment(api: types.IExtensionApi) {
  const manifest: types.IDeploymentManifest = await util.getManifest(api, '', GAME_ID);
  return manifest.files.map(file => path.join(manifest.targetPath, file.relPath).toLowerCase());
}
