"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDependencyRequired = exports.hasMultipleLibMods = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
function hasMultipleLibMods(api) {
    const state = api.getState();
    const profile = vortex_api_1.selectors.activeProfile(state);
    if ((profile === null || profile === void 0 ? void 0 : profile.gameId) !== common_1.GAME_ID) {
        return bluebird_1.default.resolve(undefined);
    }
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const modNames = Object.keys(mods)
        .filter(id => {
        const isPackMod = vortex_api_1.util.getSafe(mods[id], ['attributes', 'CoreLibType'], undefined) !== undefined;
        const isEnabled = vortex_api_1.util.getSafe(profile, ['modState', id, 'enabled'], false);
        return isPackMod && isEnabled;
    })
        .map(id => vortex_api_1.util.renderModName(mods[id]));
    return (modNames.length > 1)
        ? bluebird_1.default.resolve({
            description: {
                short: 'Multiple unstripped assembly mods detected',
                long: 'You currently have several mods installed and enabled which aim to provide '
                    + 'replacements for Valheim\'s optimized assemblies - Vortex is currently configuring '
                    + 'the Unity doorstop hook to use "{{primaryMod}}" - if this is incorrect, please disable '
                    + '"{{primaryMod}}" and re-deploy your mods.\n\n',
                replace: { primaryMod: modNames[0] },
            },
            severity: 'warning',
        })
        : bluebird_1.default.resolve(undefined);
}
exports.hasMultipleLibMods = hasMultipleLibMods;
function isDependencyRequired(api, dependencyTest) {
    const state = api.getState();
    const profile = vortex_api_1.selectors.activeProfile(state);
    if ((profile === null || profile === void 0 ? void 0 : profile.gameId) !== common_1.GAME_ID) {
        return bluebird_1.default.resolve(undefined);
    }
    const genFailedTestRes = (test) => ({
        description: {
            short: `{{masterName}} is missing`,
            long: 'You currently have a mod installed that requires {{masterName}} to function. '
                + 'please install {{masterName}} before continuing. If you confirmed that {{masterName}} '
                + 'is installed, make sure it\'s enabled AND deployed.',
            replace: { masterName: dependencyTest.masterName },
        },
        severity: 'warning',
        automaticFix: () => test()
            .catch((err) => vortex_api_1.util.opn(dependencyTest.masterURL)),
    });
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const modIds = Object.keys(mods)
        .filter(id => vortex_api_1.util.getSafe(profile, ['modState', id, 'enabled'], false));
    const masterMods = modIds.filter(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === dependencyTest.masterModType; });
    let fixAppliedTest = () => {
        const testRes = hasMasterModInstalled(api, dependencyTest.masterModType);
        return testRes
            ? bluebird_1.default.resolve()
            : bluebird_1.default.reject(new vortex_api_1.util.NotFound(dependencyTest.masterModType));
    };
    const hasDependentMods = modIds.find(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === dependencyTest.dependentModType; }) !== undefined;
    if (masterMods.length > 0) {
        if (dependencyTest.requiredFiles === undefined) {
            return bluebird_1.default.resolve(undefined);
        }
        fixAppliedTest = () => (hasDependentMods)
            ? bluebird_1.default.each(dependencyTest.requiredFiles, iter => vortex_api_1.fs.statAsync(iter))
                .then(() => bluebird_1.default.resolve())
            : bluebird_1.default.resolve();
        return fixAppliedTest()
            .then(() => bluebird_1.default.resolve(undefined))
            .catch(err => bluebird_1.default.resolve(genFailedTestRes(fixAppliedTest)));
    }
    if (hasDependentMods) {
        return bluebird_1.default.resolve(genFailedTestRes(fixAppliedTest));
    }
    return bluebird_1.default.resolve(undefined);
}
exports.isDependencyRequired = isDependencyRequired;
function hasMasterModInstalled(api, masterModType) {
    const state = api.getState();
    const profile = vortex_api_1.selectors.activeProfile(state);
    if ((profile === null || profile === void 0 ? void 0 : profile.gameId) !== common_1.GAME_ID) {
        return false;
    }
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const modIds = Object.keys(mods)
        .filter(id => vortex_api_1.util.getSafe(profile, ['modState', id, 'enabled'], false));
    const masterMods = modIds.filter(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === masterModType; });
    return (masterMods.length > 0);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0ZXN0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSx3REFBK0I7QUFDL0IsMkNBQXdEO0FBRXhELHFDQUFtQztBQXFCbkMsU0FBZ0Isa0JBQWtCLENBQUMsR0FBd0I7SUFDekQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzdCLE1BQU0sT0FBTyxHQUFtQixzQkFBUyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvRCxJQUFJLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLE1BQU0sTUFBSyxnQkFBTyxFQUFFO1FBQy9CLE9BQU8sa0JBQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDbkM7SUFFRCxNQUFNLElBQUksR0FDUixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUUzRCxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztTQUMvQixNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7UUFDWCxNQUFNLFNBQVMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQ3JDLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUMxRCxNQUFNLFNBQVMsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVFLE9BQU8sU0FBUyxJQUFJLFNBQVMsQ0FBQztJQUNoQyxDQUFDLENBQUM7U0FDRCxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxpQkFBSSxD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QUUsQ0FBQztJQUM3QixNQUFNLE9BQU8sR0FBbUIsc0JBQVMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0QsSUFBSSxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxNQUFNLE1BQUssZ0JBQU8sRUFBRTtRQUMvQixPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsTUFBTSxJQUFJLEdBQ1IsaUJBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxnQkFBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFM0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDN0IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsaUJBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsVUFBVSxFQUFFLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzNFLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBQyxPQUFBLE9BQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQywwQ0FBRSxJQUFJLE1BQUssYUFBYSxDQUFBLEVBQUEsQ0FBQyxDQUFDO0lBQ3pFLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCB7IGZzLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lEIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJRGVwZW5kZW5jeVRlc3Qge1xyXG4gIC8vIFRoZSByZXF1aXJlZCBtb2RUeXBlL21hc3RlclxyXG4gIG1hc3Rlck1vZFR5cGU6IHN0cmluZztcclxuXHJcbiAgLy8gSHVtYW4gcmVhZGFibGUgbW9kVHlwZSBuYW1lIGZvciB0aGUgbWFzdGVyXHJcbiAgbWFzdGVyTmFtZTogc3RyaW5nO1xyXG5cclxuICAvLyBVUkwgbGluayBmb3IgdGhlIG1hc3RlciBtb2RUeXBlIGZvciB0aGUgdXNlciB0byBkb3dubG9hZC5cclxuICBtYXN0ZXJVUkw6IHN0cmluZztcclxuXHJcbiAgLy8gVGhlIGRlcGVuZGVudCBtb2RUeXBlL3NsYXZlXHJcbiAgZGVwZW5kZW50TW9kVHlwZTogc3RyaW5nO1xyXG5cclxuICAvLyBPbmx5IHVzZWQgaWYgc3BlY2lmaWMgZmlsZXMgYXJlIHJlcXVpcmVkLCB0aGVzZSBuZWVkIHRvIGJlXHJcbiAgLy8gIGluIGFic29sdXRlIHBhdGggZm9ybS5cclxuICByZXF1aXJlZEZpbGVzPzogc3RyaW5nW107XHJcbn1cclxuXHJcbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbWF4LWxpbmUtbGVuZ3RoXHJcbmV4cG9ydCBmdW5jdGlvbiBoYXNNdWx0aXBsZUxpYk1vZHMoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKTogUHJvbWlzZTx0eXBlcy5JVGVzdFJlc3VsdD4ge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMuYWN0aXZlUHJvZmlsZShzdGF0ZSk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuXHJcbiAgY29uc3QgbW9kTmFtZXMgPSBPYmplY3Qua2V5cyhtb2RzKVxyXG4gICAgLmZpbHRlcihpZCA9PiB7XHJcbiAgICAgIGNvbnN0IGlzUGFja01vZCA9IHV0aWwuZ2V0U2FmZShtb2RzW2lkXSxcclxuICAgICAgICBbJ2F0dHJpYnV0ZXMnLCAnQ29yZUxpYlR5cGUnXSwgdW5kZWZpbmVkKSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgICBjb25zdCBpc0VuYWJsZWQgPSB1dGlsLmdldFNhZmUocHJvZmlsZSwgWydtb2RTdGF0ZScsIGlkLCAnZW5hYmxlZCddLCBmYWxzZSk7XHJcbiAgICAgIHJldHVybiBpc1BhY2tNb2QgJiYgaXNFbmFibGVkO1xyXG4gICAgfSlcclxuICAgIC5tYXAoaWQgPT4gdXRpbC5yZW5kZXJNb2ROYW1lKG1vZHNbaWRdKSk7XHJcblxyXG4gIHJldHVybiAobW9kTmFtZXMubGVuZ3RoID4gMSlcclxuICAgID8gUHJvbWlzZS5yZXNvbHZlKHtcclxuICAgICAgZGVzY3JpcHRpb246IHtcclxuICAgICAgICBzaG9ydDogJ011bHRpcGxlIHVuc3RyaXBwZWQgYXNzZW1ibHkgbW9kcyBkZXRlY3RlZCcsXHJcbiAgICAgICAgbG9uZzogJ1lvdSBjdXJyZW50bHkgaGF2ZSBzZXZlcmFsIG1vZHMgaW5zdGFsbGVkIGFuZCBlbmFibGVkIHdoaWNoIGFpbSB0byBwcm92aWRlICdcclxuICAgICAgICAgICAgKyAncmVwbGFjZW1lbnRzIGZvciBWYWxoZWltXFwncyBvcHRpbWl6ZWQgYXNzZW1ibGllcyAtIFZvcnRleCBpcyBjdXJyZW50bHkgY29uZmlndXJpbmcgJ1xyXG4gICAgICAgICAgICArICd0aGUgVW5pdHkgZG9vcnN0b3AgaG9vayB0byB1c2UgXCJ7e3ByaW1hcnlNb2R9fVwiIC0gaWYgdGhpcyBpcyBpbmNvcnJlY3QsIHBsZWFzZSBkaXNhYmxlICdcclxuICAgICAgICAgICAgKyAnXCJ7e3ByaW1hcnlNb2R9fVwiIGFuZCByZS1kZXBsb3kgeW91ciBtb2RzLlxcblxcbicsXHJcbiAgICAgICAgcmVwbGFjZTogeyBwcmltYXJ5TW9kOiBtb2ROYW1lc1swXSB9LFxyXG4gICAgICB9LFxyXG4gICAgICBzZXZlcml0eTogJ3dhcm5pbmcnLFxyXG4gICAgfSlcclxuICAgIDogUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XHJcbn1cclxuXHJcbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbWF4LWxpbmUtbGVuZ3RoXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0RlcGVuZGVuY3lSZXF1aXJlZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIGRlcGVuZGVuY3lUZXN0OiBJRGVwZW5kZW5jeVRlc3QpOiBQcm9taXNlPHR5cGVzLklUZXN0UmVzdWx0PiB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5hY3RpdmVQcm9maWxlKHN0YXRlKTtcclxuICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBnZW5GYWlsZWRUZXN0UmVzID0gKHRlc3Q6ICgpID0+IFByb21pc2U8dm9pZD4pOiB0eXBlcy5JVGVzdFJlc3VsdCA9PiAoe1xyXG4gICAgZGVzY3JpcHRpb246IHtcclxuICAgICAgc2hvcnQ6IGB7e21hc3Rlck5hbWV9fSBpcyBtaXNzaW5nYCxcclxuICAgICAgbG9uZzogJ1lvdSBjdXJyZW50bHkgaGF2ZSBhIG1vZCBpbnN0YWxsZWQgdGhhdCByZXF1aXJlcyB7e21hc3Rlck5hbWV9fSB0byBmdW5jdGlvbi4gJ1xyXG4gICAgICAgICAgKyAncGxlYXNlIGluc3RhbGwge3ttYXN0ZXJOYW1lfX0gYmVmb3JlIGNvbnRpbnVpbmcuIElmIHlvdSBjb25maXJtZWQgdGhhdCB7e21hc3Rlck5hbWV9fSAnXHJcbiAgICAgICAgICArICdpcyBpbnN0YWxsZWQsIG1ha2Ugc3VyZSBpdFxcJ3MgZW5hYmxlZCBBTkQgZGVwbG95ZWQuJyxcclxuICAgICAgcmVwbGFjZTogeyBtYXN0ZXJOYW1lOiBkZXBlbmRlbmN5VGVzdC5tYXN0ZXJOYW1lIH0sXHJcbiAgICB9LFxyXG4gICAgc2V2ZXJpdHk6ICd3YXJuaW5nJyxcclxuICAgIGF1dG9tYXRpY0ZpeDogKCkgPT4gdGVzdCgpXHJcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB1dGlsLm9wbihkZXBlbmRlbmN5VGVzdC5tYXN0ZXJVUkwpKSxcclxuICB9KTtcclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuXHJcbiAgY29uc3QgbW9kSWRzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoaWQgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBpZCwgJ2VuYWJsZWQnXSwgZmFsc2UpKTtcclxuICBjb25zdCBtYXN0ZXJNb2RzID0gbW9kSWRzLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gZGVwZW5kZW5jeVRlc3QubWFzdGVyTW9kVHlwZSk7XHJcbiAgbGV0IGZpeEFwcGxpZWRUZXN0ID0gKCk6IFByb21pc2U8dm9pZD4gPT4ge1xyXG4gICAgY29uc3QgdGVzdFJlcyA9IGhhc01hc3Rlck1vZEluc3RhbGxlZChhcGksIGRlcGVuZGVuY3lUZXN0Lm1hc3Rlck1vZFR5cGUpO1xyXG4gICAgcmV0dXJuIHRlc3RSZXNcclxuICAgICAgPyBQcm9taXNlLnJlc29sdmUoKVxyXG4gICAgICA6IFByb21pc2UucmVqZWN0KG5ldyB1dGlsLk5vdEZvdW5kKGRlcGVuZGVuY3lUZXN0Lm1hc3Rlck1vZFR5cGUpKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBoYXNEZXBlbmRlbnRNb2RzID0gbW9kSWRzLmZpbmQoaWQgPT5cclxuICAgIG1vZHNbaWRdPy50eXBlID09PSBkZXBlbmRlbmN5VGVzdC5kZXBlbmRlbnRNb2RUeXBlKSAhPT0gdW5kZWZpbmVkO1xyXG5cclxuICBpZiAobWFzdGVyTW9kcy5sZW5ndGggPiAwKSB7XHJcbiAgICBpZiAoZGVwZW5kZW5jeVRlc3QucmVxdWlyZWRGaWxlcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcclxuICAgIH1cclxuXHJcbiAgICBmaXhBcHBsaWVkVGVzdCA9ICgpID0+IChoYXNEZXBlbmRlbnRNb2RzKVxyXG4gICAgICA/IFByb21pc2UuZWFjaChkZXBlbmRlbmN5VGVzdC5yZXF1aXJlZEZpbGVzLCBpdGVyID0+IGZzLnN0YXRBc3luYyhpdGVyKSlcclxuICAgICAgICAudGhlbigoKSA9PiBQcm9taXNlLnJlc29sdmUoKSlcclxuICAgICAgOiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgIHJldHVybiBmaXhBcHBsaWVkVGVzdCgpXHJcbiAgICAgIC50aGVuKCgpID0+IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpKVxyXG4gICAgICAuY2F0Y2goZXJyID0+IFByb21pc2UucmVzb2x2ZShnZW5GYWlsZWRUZXN0UmVzKGZpeEFwcGxpZWRUZXN0KSkpO1xyXG4gIH1cclxuXHJcbiAgaWYgKGhhc0RlcGVuZGVudE1vZHMpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZ2VuRmFpbGVkVGVzdFJlcyhmaXhBcHBsaWVkVGVzdCkpO1xyXG4gIH1cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhc01hc3Rlck1vZEluc3RhbGxlZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG1hc3Rlck1vZFR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMuYWN0aXZlUHJvZmlsZShzdGF0ZSk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuXHJcbiAgY29uc3QgbW9kSWRzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoaWQgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBpZCwgJ2VuYWJsZWQnXSwgZmFsc2UpKTtcclxuICBjb25zdCBtYXN0ZXJNb2RzID0gbW9kSWRzLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gbWFzdGVyTW9kVHlwZSk7XHJcbiAgcmV0dXJuIChtYXN0ZXJNb2RzLmxlbmd0aCA+IDApO1xyXG59XHJcbiJdfQ==