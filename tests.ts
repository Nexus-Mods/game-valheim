import Promise from 'bluebird';
import { fs, selectors, types, util } from 'vortex-api';

import { GAME_ID } from './common';

export interface IDependencyTest {
  // The required modType/master
  masterModType: string;

  // Human readable modType name for the master
  masterName: string;

  // URL link for the master modType for the user to download.
  masterURL: string;

  // The dependent modType/slave
  dependentModType: string;

  // Only used if specific files are required, these need to be
  //  in absolute path form.
  requiredFiles?: string[];
}

// tslint:disable-next-line: max-line-length
export function isDependencyRequired(api: types.IExtensionApi, dependencyTest: IDependencyTest): Promise<types.ITestResult> {
  const state = api.getState();
  const profile: types.IProfile = selectors.activeProfile(state);
  if (profile?.gameId !== GAME_ID) {
    return Promise.resolve(undefined);
  }

  const genFailedTestRes = (test: () => Promise<void>): types.ITestResult => ({
    description: {
      short: `{{masterName}} is missing`,
      long: 'You currently have a mod installed that requires {{masterName}} to function. '
          + 'please install {{masterName}} before continuing. If you confirmed that {{masterName}} '
          + 'is installed, make sure it\'s enabled AND deployed.',
      replace: { masterName: dependencyTest.masterName },
    },
    severity: 'warning',
    automaticFix: () => test()
      .catch((err) => util.opn(dependencyTest.masterURL)),
  });

  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});

  const modIds = Object.keys(mods)
    .filter(id => util.getSafe(profile, ['modState', id, 'enabled'], false));
  const masterMods = modIds.filter(id => mods[id]?.type === dependencyTest.masterModType);
  let fixAppliedTest = (): Promise<void> => {
    const testRes = hasMasterModInstalled(api, dependencyTest.masterModType);
    return testRes
      ? Promise.resolve()
      : Promise.reject(new util.NotFound(dependencyTest.masterModType));
  };

  const hasDependentMods = modIds.find(id =>
    mods[id]?.type === dependencyTest.dependentModType) !== undefined;

  if (masterMods.length > 0) {
    if (dependencyTest.requiredFiles === undefined) {
      return Promise.resolve(undefined);
    }

    fixAppliedTest = () => (hasDependentMods)
      ? Promise.each(dependencyTest.requiredFiles, iter => fs.statAsync(iter))
        .then(() => Promise.resolve())
      : Promise.resolve();
    return fixAppliedTest()
      .then(() => Promise.resolve(undefined))
      .catch(err => Promise.resolve(genFailedTestRes(fixAppliedTest)));
  }

  if (hasDependentMods) {
    return Promise.resolve(genFailedTestRes(fixAppliedTest));
  }
  return Promise.resolve(undefined);
}

function hasMasterModInstalled(api: types.IExtensionApi, masterModType: string): boolean {
  const state = api.getState();
  const profile: types.IProfile = selectors.activeProfile(state);
  if (profile?.gameId !== GAME_ID) {
    return false;
  }

  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});

  const modIds = Object.keys(mods)
    .filter(id => util.getSafe(profile, ['modState', id, 'enabled'], false));
  const masterMods = modIds.filter(id => mods[id]?.type === masterModType);
  return (masterMods.length > 0);
}
