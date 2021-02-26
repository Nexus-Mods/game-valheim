"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDependencyRequired = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
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
    if (masterMods.length > 0) {
        if (dependencyTest.requiredFiles === undefined) {
            return bluebird_1.default.resolve(undefined);
        }
        fixAppliedTest = () => bluebird_1.default.each(dependencyTest.requiredFiles, iter => vortex_api_1.fs.statAsync(iter))
            .then(() => bluebird_1.default.resolve());
        return fixAppliedTest()
            .then(() => bluebird_1.default.resolve(undefined))
            .catch(err => bluebird_1.default.resolve(genFailedTestRes(fixAppliedTest)));
    }
    const hasDependentMods = modIds.find(id => { var _a; return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === dependencyTest.dependentModType; }) !== undefined;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0ZXN0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSx3REFBK0I7QUFDL0IsMkNBQXdEO0FBRXhELHFDQUFtQztBQXFCbkMsU0FBZ0Isb0JBQW9CLENBQUMsR0FBd0IsRUFBRSxjQUErQjtJQUM1RixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDN0IsTUFBTSxPQUFPLEdBQW1CLHNCQUFTLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9ELElBQUksQ0FBQSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsTUFBTSxNQUFLLGdCQUFPLEVBQUU7UUFDL0IsT0FBTyxrQkFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUNuQztJQUVELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxJQUF5QixFQUFxQixFQUFFLENBQUMsQ0FBQztRQUMxRSxXQUFXLEVBQUU7WUFDWCxLQUFLLEVBQUUsMkJBQTJCO1lBQ2xDLElBQUksRUFBRSwrRUFBK0U7a0JBQy9FLHdGQUF3RjtrQkFDeEYscURBQXFEO1lBQzNELE9BQU8sRUFBRSxFQUFFLFVBQVUsRUFBRSxjQUFjLENBQUMsVUFBVSxFQUFFO1NBQ25EO1FBQ0QsUUFBUSxFQUFFLFNBQVM7UUFDbkIsWUFBWSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRTthQUN2QixLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLGlCQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztLQUN0RCxDQUFDLENBQUM7SUFFSCxNQUFNLElBQUksR0FDUixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUUzRCxNQUFNLE1BQU0sR0FBRyxNQUFN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LENBQUMsRUFBRSxDQUFDLGlCQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLFVBQVUsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMzRSxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQUMsT0FBQSxPQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsMENBQUUsSUFBSSxNQUFLLGFBQWEsQ0FBQSxFQUFBLENBQUMsQ0FBQztJQUN6RSxPQUFPLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFByb21pc2UgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgeyBmcywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuaW1wb3J0IHsgR0FNRV9JRCB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSURlcGVuZGVuY3lUZXN0IHtcclxuICAvLyBUaGUgcmVxdWlyZWQgbW9kVHlwZS9tYXN0ZXJcclxuICBtYXN0ZXJNb2RUeXBlOiBzdHJpbmc7XHJcblxyXG4gIC8vIEh1bWFuIHJlYWRhYmxlIG1vZFR5cGUgbmFtZSBmb3IgdGhlIG1hc3RlclxyXG4gIG1hc3Rlck5hbWU6IHN0cmluZztcclxuXHJcbiAgLy8gVVJMIGxpbmsgZm9yIHRoZSBtYXN0ZXIgbW9kVHlwZSBmb3IgdGhlIHVzZXIgdG8gZG93bmxvYWQuXHJcbiAgbWFzdGVyVVJMOiBzdHJpbmc7XHJcblxyXG4gIC8vIFRoZSBkZXBlbmRlbnQgbW9kVHlwZS9zbGF2ZVxyXG4gIGRlcGVuZGVudE1vZFR5cGU6IHN0cmluZztcclxuXHJcbiAgLy8gT25seSB1c2VkIGlmIHNwZWNpZmljIGZpbGVzIGFyZSByZXF1aXJlZCwgdGhlc2UgbmVlZCB0byBiZVxyXG4gIC8vICBpbiBhYnNvbHV0ZSBwYXRoIGZvcm0uXHJcbiAgcmVxdWlyZWRGaWxlcz86IHN0cmluZ1tdO1xyXG59XHJcblxyXG4vLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1saW5lLWxlbmd0aFxyXG5leHBvcnQgZnVuY3Rpb24gaXNEZXBlbmRlbmN5UmVxdWlyZWQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBkZXBlbmRlbmN5VGVzdDogSURlcGVuZGVuY3lUZXN0KTogUHJvbWlzZTx0eXBlcy5JVGVzdFJlc3VsdD4ge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMuYWN0aXZlUHJvZmlsZShzdGF0ZSk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgZ2VuRmFpbGVkVGVzdFJlcyA9ICh0ZXN0OiAoKSA9PiBQcm9taXNlPHZvaWQ+KTogdHlwZXMuSVRlc3RSZXN1bHQgPT4gKHtcclxuICAgIGRlc2NyaXB0aW9uOiB7XHJcbiAgICAgIHNob3J0OiBge3ttYXN0ZXJOYW1lfX0gaXMgbWlzc2luZ2AsXHJcbiAgICAgIGxvbmc6ICdZb3UgY3VycmVudGx5IGhhdmUgYSBtb2QgaW5zdGFsbGVkIHRoYXQgcmVxdWlyZXMge3ttYXN0ZXJOYW1lfX0gdG8gZnVuY3Rpb24uICdcclxuICAgICAgICAgICsgJ3BsZWFzZSBpbnN0YWxsIHt7bWFzdGVyTmFtZX19IGJlZm9yZSBjb250aW51aW5nLiBJZiB5b3UgY29uZmlybWVkIHRoYXQge3ttYXN0ZXJOYW1lfX0gJ1xyXG4gICAgICAgICAgKyAnaXMgaW5zdGFsbGVkLCBtYWtlIHN1cmUgaXRcXCdzIGVuYWJsZWQgQU5EIGRlcGxveWVkLicsXHJcbiAgICAgIHJlcGxhY2U6IHsgbWFzdGVyTmFtZTogZGVwZW5kZW5jeVRlc3QubWFzdGVyTmFtZSB9LFxyXG4gICAgfSxcclxuICAgIHNldmVyaXR5OiAnd2FybmluZycsXHJcbiAgICBhdXRvbWF0aWNGaXg6ICgpID0+IHRlc3QoKVxyXG4gICAgICAuY2F0Y2goKGVycikgPT4gdXRpbC5vcG4oZGVwZW5kZW5jeVRlc3QubWFzdGVyVVJMKSksXHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcblxyXG4gIGNvbnN0IG1vZElkcyA9IE9iamVjdC5rZXlzKG1vZHMpXHJcbiAgICAuZmlsdGVyKGlkID0+IHV0aWwuZ2V0U2FmZShwcm9maWxlLCBbJ21vZFN0YXRlJywgaWQsICdlbmFibGVkJ10sIGZhbHNlKSk7XHJcbiAgY29uc3QgbWFzdGVyTW9kcyA9IG1vZElkcy5maWx0ZXIoaWQgPT4gbW9kc1tpZF0/LnR5cGUgPT09IGRlcGVuZGVuY3lUZXN0Lm1hc3Rlck1vZFR5cGUpO1xyXG4gIGxldCBmaXhBcHBsaWVkVGVzdCA9ICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcclxuICAgIGNvbnN0IHRlc3RSZXMgPSBoYXNNYXN0ZXJNb2RJbnN0YWxsZWQoYXBpLCBkZXBlbmRlbmN5VGVzdC5tYXN0ZXJNb2RUeXBlKTtcclxuICAgIHJldHVybiB0ZXN0UmVzXHJcbiAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcclxuICAgICAgOiBQcm9taXNlLnJlamVjdChuZXcgdXRpbC5Ob3RGb3VuZChkZXBlbmRlbmN5VGVzdC5tYXN0ZXJNb2RUeXBlKSk7XHJcbiAgfTtcclxuXHJcbiAgaWYgKG1hc3Rlck1vZHMubGVuZ3RoID4gMCkge1xyXG4gICAgaWYgKGRlcGVuZGVuY3lUZXN0LnJlcXVpcmVkRmlsZXMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XHJcbiAgICB9XHJcblxyXG4gICAgZml4QXBwbGllZFRlc3QgPSAoKSA9PiBQcm9taXNlLmVhY2goZGVwZW5kZW5jeVRlc3QucmVxdWlyZWRGaWxlcywgaXRlciA9PiBmcy5zdGF0QXN5bmMoaXRlcikpXHJcbiAgICAgIC50aGVuKCgpID0+IFByb21pc2UucmVzb2x2ZSgpKTtcclxuICAgIHJldHVybiBmaXhBcHBsaWVkVGVzdCgpXHJcbiAgICAgIC50aGVuKCgpID0+IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpKVxyXG4gICAgICAuY2F0Y2goZXJyID0+IFByb21pc2UucmVzb2x2ZShnZW5GYWlsZWRUZXN0UmVzKGZpeEFwcGxpZWRUZXN0KSkpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgaGFzRGVwZW5kZW50TW9kcyA9IG1vZElkcy5maW5kKGlkID0+XHJcbiAgICBtb2RzW2lkXT8udHlwZSA9PT0gZGVwZW5kZW5jeVRlc3QuZGVwZW5kZW50TW9kVHlwZSkgIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgaWYgKGhhc0RlcGVuZGVudE1vZHMpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZ2VuRmFpbGVkVGVzdFJlcyhmaXhBcHBsaWVkVGVzdCkpO1xyXG4gIH1cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhc01hc3Rlck1vZEluc3RhbGxlZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG1hc3Rlck1vZFR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMuYWN0aXZlUHJvZmlsZShzdGF0ZSk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuXHJcbiAgY29uc3QgbW9kSWRzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoaWQgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBpZCwgJ2VuYWJsZWQnXSwgZmFsc2UpKTtcclxuICBjb25zdCBtYXN0ZXJNb2RzID0gbW9kSWRzLmZpbHRlcihpZCA9PiBtb2RzW2lkXT8udHlwZSA9PT0gbWFzdGVyTW9kVHlwZSk7XHJcbiAgcmV0dXJuIChtYXN0ZXJNb2RzLmxlbmd0aCA+IDApO1xyXG59XHJcbiJdfQ==