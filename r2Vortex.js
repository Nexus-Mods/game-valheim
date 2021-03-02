"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateR2ToVortex = exports.userHasR2Installed = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
const invalidModFolders = ['denikson-bepinexpack_valheim', '1f31a-bepinex_valheim_full'];
const appUni = electron_1.remote !== undefined ? electron_1.remote.app : electron_1.app;
function getR2CacheLocation() {
    return path_1.default.join(appUni.getPath('appData'), 'r2modmanPlus-local', 'Valheim', 'cache');
}
function userHasR2Installed() {
    try {
        vortex_api_1.fs.statSync(getR2CacheLocation());
        return true;
    }
    catch (err) {
        return false;
    }
}
exports.userHasR2Installed = userHasR2Installed;
function migrateR2ToVortex(api) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = () => __awaiter(this, void 0, void 0, function* () {
            const activityId = 'r2migrationactivity';
            api.sendNotification({
                id: activityId,
                type: 'activity',
                message: 'Migrating Mods',
                allowSuppress: false,
                noDismiss: true,
            });
            try {
                yield startMigration(api);
                api.sendNotification({
                    type: 'success',
                    message: 'Mods migrated successfully',
                    displayMS: 3000,
                });
            }
            catch (err) {
                api.showErrorNotification('Failed to migrate mods from R2 Mod Manager', err);
            }
            api.dismissNotification(activityId);
        });
        api.showDialog('info', 'R2 Mods Migration', {
            bbcode: 'Vortex can attempt to import your R2 Mods Manager mods and allow you to '
                + 'manage these from inside Vortex - please be aware that these will be imported '
                + 'in an uninstalled state and will have to be installed, enabled and deployed through '
                + 'Vortex before the mods are re-instated into the game![br][/br][br][/br]'
                + 'Please note: [list]'
                + '[*]Mod configuration changes will not be imported - these need to be '
                + 're-added or imported manually from your preferred R2 profile'
                + '[*]Vortex will import ALL versions of the mods you have in your R2 Mod Manager cache, '
                + 'even the outdated ones - it\'s up to you to sift through the imported mods and install '
                + 'the ones you want active in-game '
                + '[*]It is still highly recommended to use a fresh vanilla copy of the game when '
                + 'starting to mod with Vortex[/list]',
        }, [
            { label: 'Cancel', action: () => Promise.resolve() },
            { label: 'Start Migration', action: () => start() },
        ]);
    });
}
exports.migrateR2ToVortex = migrateR2ToVortex;
function startMigration(api) {
    return __awaiter(this, void 0, void 0, function* () {
        const hasInvalidSeg = (segment) => [common_1.DOORSTOPPER_HOOK].concat(invalidModFolders, common_1.IGNORABLE_FILES).includes(segment.toLowerCase());
        const state = api.getState();
        const discovery = vortex_api_1.selectors.discoveryByGame(state, common_1.GAME_ID);
        if ((discovery === null || discovery === void 0 ? void 0 : discovery.path) === undefined) {
            return;
        }
        const r2Path = getR2CacheLocation();
        let fileEntries = [];
        yield turbowalk_1.default(r2Path, entries => {
            const filtered = entries.filter(entry => {
                if (entry.isDirectory) {
                    return false;
                }
                const segments = entry.filePath.split(path_1.default.sep);
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
        const arcMap = fileEntries.reduce((accum, iter) => {
            const segments = iter.filePath.split(path_1.default.sep);
            const idx = segments.findIndex(seg => verRgx.test(seg));
            if (idx === -1) {
                return accum;
            }
            const modKey = segments.slice(idx - 1, idx + 1).join('_');
            if (accum[modKey] === undefined) {
                accum[modKey] = [];
            }
            const basePath = segments.slice(0, idx + 1).join(path_1.default.sep);
            const relPath = path_1.default.relative(basePath, iter.filePath);
            const pathExists = (accum[modKey].find(r2file => r2file.relPath.split(path_1.default.sep)[0] === relPath.split(path_1.default.sep)[0]) !== undefined);
            if (!pathExists) {
                accum[modKey].push({ relPath, basePath });
            }
            return accum;
        }, {});
        const downloadsPath = vortex_api_1.selectors.downloadPathForGame(state, common_1.GAME_ID);
        const szip = new vortex_api_1.util.SevenZip();
        for (const modKey of Object.keys(arcMap)) {
            const archivePath = path_1.default.join(downloadsPath, modKey + '.zip');
            yield szip.add(archivePath, arcMap[modKey]
                .map(r2ModFile => path_1.default.join(r2ModFile.basePath, r2ModFile.relPath.split(path_1.default.sep)[0])), { raw: ['-r'] });
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjJWb3J0ZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyMlZvcnRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBdUM7QUFDdkMsZ0RBQXdCO0FBQ3hCLDBEQUE4QztBQUM5QywyQ0FBd0Q7QUFDeEQscUNBQXNFO0FBRXRFLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyw4QkFBOEIsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO0FBQ3pGLE1BQU0sTUFBTSxHQUFHLGlCQUFNLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxpQkFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBRyxDQUFDO0FBU3ZELFNBQVMsa0JBQWtCO0lBQ3pCLE9BQU8sY0FBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN4RixDQUFDO0FBRUQsU0FBZ0Isa0JBQWtCO0lBQ2hDLElBQUk7UUFDRixlQUFFLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQVBELGdEQU9DO0FBRUQsU0FBc0IsaUJBQWlCLENBQUMsR0FBd0I7O1FBQzlELE1BQU0sS0FBSyxHQUFHLEdBQVMsRUFBRTtZQUN2QixNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQztZQUN6QyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ25CLEVBQUUsRUFBRSxVQUFVO2dCQUNkLElBQUksRUFBRSxVQUFVO2dCQUNoQixPQUFPLEVBQUUsZ0JBQWdCO2dCQUN6QixhQUFhLEVBQUUsS0FBSztnQkFDcEIsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1lBRUgsSUFBSTtnQkFDRixNQUFNLGNB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LENBQUMsS0FBSyxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDO1lBQ25GLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQ2YsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFUCxNQUFNLGFBQWEsR0FBRyxzQkFBUyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxnQkFBTyxDQUFDLENBQUM7UUFDcEUsTUFBTSxJQUFJLEdBQUcsSUFBSSxpQkFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2pDLEtBQUssTUFBTSxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN4QyxNQUFNLFdBQVcsR0FBRyxjQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUM7WUFDOUQsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO2lCQUN2QyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxjQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUM1RztJQUNILENBQUM7Q0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFwcCwgcmVtb3RlIH0gZnJvbSAnZWxlY3Ryb24nO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHR1cmJvd2FsaywgeyBJRW50cnkgfSBmcm9tICd0dXJib3dhbGsnO1xyXG5pbXBvcnQgeyBmcywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5pbXBvcnQgeyBET09SU1RPUFBFUl9IT09LLCBHQU1FX0lELCBJR05PUkFCTEVfRklMRVMgfSBmcm9tICcuL2NvbW1vbic7XHJcblxyXG5jb25zdCBpbnZhbGlkTW9kRm9sZGVycyA9IFsnZGVuaWtzb24tYmVwaW5leHBhY2tfdmFsaGVpbScsICcxZjMxYS1iZXBpbmV4X3ZhbGhlaW1fZnVsbCddO1xyXG5jb25zdCBhcHBVbmkgPSByZW1vdGUgIT09IHVuZGVmaW5lZCA/IHJlbW90ZS5hcHAgOiBhcHA7XHJcblxyXG5pbnRlcmZhY2UgSVIyTW9kRmlsZSB7XHJcbiAgcmVsUGF0aDogc3RyaW5nO1xyXG4gIGJhc2VQYXRoOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8vIFRPRE86IHJlc29sdmUgdGhlIGxvY2F0aW9uIG9mIHRoZSBjYWNoZSByYXRoZXIgdGhhbiBzZWFyY2hpbmcgZm9yIGl0IGluIHRoZVxyXG4vLyAgZGVmYXVsdCBsb2NhdGlvbi5cclxuZnVuY3Rpb24gZ2V0UjJDYWNoZUxvY2F0aW9uKCkge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oYXBwVW5pLmdldFBhdGgoJ2FwcERhdGEnKSwgJ3IybW9kbWFuUGx1cy1sb2NhbCcsICdWYWxoZWltJywgJ2NhY2hlJyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB1c2VySGFzUjJJbnN0YWxsZWQoKSB7XHJcbiAgdHJ5IHtcclxuICAgIGZzLnN0YXRTeW5jKGdldFIyQ2FjaGVMb2NhdGlvbigpKTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1pZ3JhdGVSMlRvVm9ydGV4KGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IHN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3QgYWN0aXZpdHlJZCA9ICdyMm1pZ3JhdGlvbmFjdGl2aXR5JztcclxuICAgIGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgICAgaWQ6IGFjdGl2aXR5SWQsXHJcbiAgICAgIHR5cGU6ICdhY3Rpdml0eScsXHJcbiAgICAgIG1lc3NhZ2U6ICdNaWdyYXRpbmcgTW9kcycsXHJcbiAgICAgIGFsbG93U3VwcHJlc3M6IGZhbHNlLFxyXG4gICAgICBub0Rpc21pc3M6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBzdGFydE1pZ3JhdGlvbihhcGkpO1xyXG4gICAgICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgdHlwZTogJ3N1Y2Nlc3MnLFxyXG4gICAgICAgIG1lc3NhZ2U6ICdNb2RzIG1pZ3JhdGVkIHN1Y2Nlc3NmdWxseScsXHJcbiAgICAgICAgZGlzcGxheU1TOiAzMDAwLFxyXG4gICAgICB9KTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdGYWlsZWQgdG8gbWlncmF0ZSBtb2RzIGZyb20gUjIgTW9kIE1hbmFnZXInLCBlcnIpO1xyXG4gICAgfVxyXG5cclxuICAgIGFwaS5kaXNtaXNzTm90aWZpY2F0aW9uKGFjdGl2aXR5SWQpO1xyXG4gIH07XHJcblxyXG4gIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ1IyIE1vZHMgTWlncmF0aW9uJyxcclxuICB7XHJcbiAgICBiYmNvZGU6ICdWb3J0ZXggY2FuIGF0dGVtcHQgdG8gaW1wb3J0IHlvdXIgUjIgTW9kcyBNYW5hZ2VyIG1vZHMgYW5kIGFsbG93IHlvdSB0byAnXHJcbiAgICAgICsgJ21hbmFnZSB0aGVzZSBmcm9tIGluc2lkZSBWb3J0ZXggLSBwbGVhc2UgYmUgYXdhcmUgdGhhdCB0aGVzZSB3aWxsIGJlIGltcG9ydGVkICdcclxuICAgICAgKyAnaW4gYW4gdW5pbnN0YWxsZWQgc3RhdGUgYW5kIHdpbGwgaGF2ZSB0byBiZSBpbnN0YWxsZWQsIGVuYWJsZWQgYW5kIGRlcGxveWVkIHRocm91Z2ggJyBcclxuICAgICAgKyAnVm9ydGV4IGJlZm9yZSB0aGUgbW9kcyBhcmUgcmUtaW5zdGF0ZWQgaW50byB0aGUgZ2FtZSFbYnJdWy9icl1bYnJdWy9icl0nXHJcbiAgICAgICsgJ1BsZWFzZSBub3RlOiBbbGlzdF0nXHJcbiAgICAgICsgJ1sqXU1vZCBjb25maWd1cmF0aW9uIGNoYW5nZXMgd2lsbCBub3QgYmUgaW1wb3J0ZWQgLSB0aGVzZSBuZWVkIHRvIGJlICdcclxuICAgICAgKyAncmUtYWRkZWQgb3IgaW1wb3J0ZWQgbWFudWFsbHkgZnJvbSB5b3VyIHByZWZlcnJlZCBSMiBwcm9maWxlJ1xyXG4gICAgICArICdbKl1Wb3J0ZXggd2lsbCBpbXBvcnQgQUxMIHZlcnNpb25zIG9mIHRoZSBtb2RzIHlvdSBoYXZlIGluIHlvdXIgUjIgTW9kIE1hbmFnZXIgY2FjaGUsICdcclxuICAgICAgKyAnZXZlbiB0aGUgb3V0ZGF0ZWQgb25lcyAtIGl0XFwncyB1cCB0byB5b3UgdG8gc2lmdCB0aHJvdWdoIHRoZSBpbXBvcnRlZCBtb2RzIGFuZCBpbnN0YWxsICdcclxuICAgICAgKyAndGhlIG9uZXMgeW91IHdhbnQgYWN0aXZlIGluLWdhbWUgJ1xyXG4gICAgICArICdbKl1JdCBpcyBzdGlsbCBoaWdobHkgcmVjb21tZW5kZWQgdG8gdXNlIGEgZnJlc2ggdmFuaWxsYSBjb3B5IG9mIHRoZSBnYW1lIHdoZW4gJ1xyXG4gICAgICArICdzdGFydGluZyB0byBtb2Qgd2l0aCBWb3J0ZXhbL2xpc3RdJyxcclxuICB9LCBbXHJcbiAgICB7IGxhYmVsOiAnQ2FuY2VsJywgYWN0aW9uOiAoKSA9PiBQcm9taXNlLnJlc29sdmUoKSB9LFxyXG4gICAgeyBsYWJlbDogJ1N0YXJ0IE1pZ3JhdGlvbicsIGFjdGlvbjogKCkgPT4gc3RhcnQoKSB9LFxyXG4gIF0pO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzdGFydE1pZ3JhdGlvbihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpIHtcclxuICBjb25zdCBoYXNJbnZhbGlkU2VnID0gKHNlZ21lbnQ6IHN0cmluZykgPT5cclxuICAgIFtET09SU1RPUFBFUl9IT09LXS5jb25jYXQoaW52YWxpZE1vZEZvbGRlcnMsIElHTk9SQUJMRV9GSUxFUykuaW5jbHVkZXMoc2VnbWVudC50b0xvd2VyQ2FzZSgpKTtcclxuXHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQgPSBzZWxlY3RvcnMuZGlzY292ZXJ5QnlHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBpZiAoZGlzY292ZXJ5Py5wYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIFNob3VsZCBuZXZlciBiZSBwb3NzaWJsZS5cclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIGNvbnN0IHIyUGF0aCA9IGdldFIyQ2FjaGVMb2NhdGlvbigpO1xyXG4gIGxldCBmaWxlRW50cmllczogSUVudHJ5W10gPSBbXTtcclxuICBhd2FpdCB0dXJib3dhbGsocjJQYXRoLCBlbnRyaWVzID0+IHtcclxuICAgIGNvbnN0IGZpbHRlcmVkID0gZW50cmllcy5maWx0ZXIoZW50cnkgPT4ge1xyXG4gICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3Qgc2VnbWVudHMgPSBlbnRyeS5maWxlUGF0aC5zcGxpdChwYXRoLnNlcCk7XHJcbiAgICAgIGNvbnN0IGlzSW52YWxpZCA9IHNlZ21lbnRzLmZpbmQoaGFzSW52YWxpZFNlZykgIT09IHVuZGVmaW5lZDtcclxuICAgICAgaWYgKGlzSW52YWxpZCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0pO1xyXG4gICAgZmlsZUVudHJpZXMgPSBmaWxlRW50cmllcy5jb25jYXQoZmlsdGVyZWQpO1xyXG4gIH0pXHJcbiAgLmNhdGNoKGVyciA9PiBbJ0VOT0VOVCcsICdFTk9URk9VTkQnXS5pbmNsdWRlcyhlcnIuY29kZSlcclxuICAgID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuXHJcbiAgY29uc3QgdmVyUmd4ID0gbmV3IFJlZ0V4cCgvXlxcZFxcLlxcZFxcLlxcZHsxLDR9JC8pO1xyXG4gIC8vY29uc3QgZGVzdGluYXRpb24gPSBwYXRoLmpvaW4oZGlzY292ZXJ5LnBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1saW5lLWxlbmd0aFxyXG4gIGNvbnN0IGFyY01hcDogeyBbYXJjTmFtZTogc3RyaW5nXTogSVIyTW9kRmlsZVtdIH0gPSBmaWxlRW50cmllcy5yZWR1Y2UoKGFjY3VtLCBpdGVyKSA9PiB7XHJcbiAgICBjb25zdCBzZWdtZW50cyA9IGl0ZXIuZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgY29uc3QgaWR4ID0gc2VnbWVudHMuZmluZEluZGV4KHNlZyA9PiB2ZXJSZ3gudGVzdChzZWcpKTtcclxuICAgIGlmIChpZHggPT09IC0xKSB7XHJcbiAgICAgIC8vIFRoaXMgaXMgYW4gaW52YWxpZCBmaWxlIGVudHJ5LCBhdCBsZWFzdCBhcyBmYXIgYXMgdGhlIFIyIGNhY2hlIGZpbGVcclxuICAgICAgLy8gc3RydWN0dXJlIHdhcyBpbiAwMi8wMy8yMDIxO1xyXG4gICAgICByZXR1cm4gYWNjdW07XHJcbiAgICB9XHJcbiAgICBjb25zdCBtb2RLZXkgPSBzZWdtZW50cy5zbGljZShpZHggLSAxLCBpZHggKyAxKS5qb2luKCdfJyk7XHJcbiAgICBpZiAoYWNjdW1bbW9kS2V5XSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGFjY3VtW21vZEtleV0gPSBbXTtcclxuICAgIH1cclxuICAgIGNvbnN0IGJhc2VQYXRoID0gc2VnbWVudHMuc2xpY2UoMCwgaWR4ICsgMSkuam9pbihwYXRoLnNlcCk7XHJcbiAgICBjb25zdCByZWxQYXRoID0gcGF0aC5yZWxhdGl2ZShiYXNlUGF0aCwgaXRlci5maWxlUGF0aCk7XHJcbiAgICBjb25zdCBwYXRoRXhpc3RzID0gKGFjY3VtW21vZEtleV0uZmluZChyMmZpbGUgPT5cclxuICAgICAgcjJmaWxlLnJlbFBhdGguc3BsaXQocGF0aC5zZXApWzBdID09PSByZWxQYXRoLnNwbGl0KHBhdGguc2VwKVswXSkgIT09IHVuZGVmaW5lZCk7XHJcbiAgICBpZiAoIXBhdGhFeGlzdHMpIHtcclxuICAgICAgYWNjdW1bbW9kS2V5XS5wdXNoKHsgcmVsUGF0aCwgYmFzZVBhdGggfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYWNjdW07XHJcbiAgfSwge30pO1xyXG5cclxuICBjb25zdCBkb3dubG9hZHNQYXRoID0gc2VsZWN0b3JzLmRvd25sb2FkUGF0aEZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHN6aXAgPSBuZXcgdXRpbC5TZXZlblppcCgpO1xyXG4gIGZvciAoY29uc3QgbW9kS2V5IG9mIE9iamVjdC5rZXlzKGFyY01hcCkpIHtcclxuICAgIGNvbnN0IGFyY2hpdmVQYXRoID0gcGF0aC5qb2luKGRvd25sb2Fkc1BhdGgsIG1vZEtleSArICcuemlwJyk7XHJcbiAgICBhd2FpdCBzemlwLmFkZChhcmNoaXZlUGF0aCwgYXJjTWFwW21vZEtleV1cclxuICAgICAgLm1hcChyMk1vZEZpbGUgPT4gcGF0aC5qb2luKHIyTW9kRmlsZS5iYXNlUGF0aCwgcjJNb2RGaWxlLnJlbFBhdGguc3BsaXQocGF0aC5zZXApWzBdKSksIHsgcmF3OiBbJy1yJ10gfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==