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
const semver_1 = __importDefault(require("semver"));
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
            bbcode: 'Vortex can attempt to migrate your R2 Mods Manager plugins to the game\'s '
                + 'directory, ensuring that your previously downloaded/installed mods are still '
                + 'available in-game.[br][/br][br][/br]'
                + 'Please note: [list]'
                + '[*]mod configuration changes will not be imported - these need to be '
                + 're-added or imported manually from your preferred profile.'
                + '[*]Vortex will have no control over these files - you will have to remove these'
                + 'manually.'
                + '[*]It is still highly recommended to use a fresh vanilla copy of the game when '
                + 'starting to mod with Vortex [/list]',
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
        const currentDeployment = yield getDeployment(api);
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
        const destination = path_1.default.join(discovery.path, 'BepInEx', 'plugins');
        const instructions = yield fileEntries.reduce((accumP, iter) => __awaiter(this, void 0, void 0, function* () {
            const accum = yield accumP;
            const segments = iter.filePath.split(path_1.default.sep);
            const idx = segments.findIndex(seg => verRgx.test(seg));
            if (idx === -1) {
                return accum;
            }
            const modKey = segments.slice(idx - 1, idx + 1).join(path_1.default.sep);
            const index = accum.findIndex((instr) => instr.key === modKey
                && instr.source === iter.filePath);
            if (index !== -1) {
                const existing = accum[index];
                const ver = existing.key.split(path_1.default.sep)[1];
                try {
                    if (semver_1.default.gt(segments[idx], ver)) {
                        accum[index].source = iter.filePath;
                    }
                }
                catch (err) {
                    return accum;
                }
            }
            else {
                const fullDest = path_1.default.join(destination, segments.slice(idx + 1).join(path_1.default.sep));
                if (!currentDeployment.includes(fullDest.toLowerCase())) {
                    accum.push({
                        type: 'copy',
                        source: iter.filePath,
                        destination: path_1.default.join(destination, segments.slice(idx + 1).join(path_1.default.sep)),
                        key: modKey,
                    });
                }
            }
            return accum;
        }), Promise.resolve([]));
        for (const instr of instructions) {
            yield vortex_api_1.fs.ensureDirWritableAsync(path_1.default.dirname(instr.destination));
            yield vortex_api_1.fs.removeAsync(instr.destination)
                .catch({ code: 'ENOENT' }, () => Promise.resolve());
            yield vortex_api_1.fs.copyAsync(instr.source, instr.destination);
        }
    });
}
function getDeployment(api) {
    return __awaiter(this, void 0, void 0, function* () {
        const manifest = yield vortex_api_1.util.getManifest(api, '', common_1.GAME_ID);
        return manifest.files.map(file => path_1.default.join(manifest.targetPath, file.relPath).toLowerCase());
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjJWb3J0ZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyMlZvcnRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBdUM7QUFDdkMsZ0RBQXdCO0FBQ3hCLDBEQUE4QztBQUM5QywyQ0FBd0Q7QUFFeEQsb0RBQTRCO0FBRTVCLHFDQUFzRTtBQUV0RSxNQUFNLGlCQUFpQixHQUFHLENBQUMsOEJBQThCLEVBQUUsNEJBQTRCLENBQUMsQ0FBQztBQUV6RixNQUFNLE1BQU0sR0FBRyxpQkFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsaUJBQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGNBQUcsQ0FBQztBQUl2RCxTQUFTLGtCQUFrQjtJQUN6QixPQUFPLGNBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDeEYsQ0FBQztBQUVELFNBQWdCLGtCQUFrQjtJQUNoQyxJQUFJO1FBQ0YsZUFBRSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUM7UUFDbEMsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUFDLE9BQU8sR0FBRyxFQUFFO1FBQ1osT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNILENBQUM7QUFQRCxnREFPQztBQUVELFNBQXNCLGlCQUFpQixDQUFDLEdBQXdCOztRQUM5RCxNQUFNLEtBQUssR0FBRyxHQUFTLEVBQUU7WUFDdkIsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUM7WUFDekMsR0FBRyxDQUFDLGdCQUFnQixDQUFDO2dCQUNuQixFQUFFLEVBQUUsVUFBVTtnQkFDZCxJQUFJLEVBQUUsVUFBVTtnQkFDaEIsT0FBTyxFQUFFLGdCQUFnQjtnQkFDekIsYUFBYSxFQUFFLEtBQUs7Z0JBQ3BCLFNBQVMsRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQztZQUVILElBQUk7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SSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUNqRSxNQUFNLGVBQUUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztpQkFDcEMsS0FBSyxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sZUFBRSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUNyRDtJQUNILENBQUM7Q0FBQTtBQUVELFNBQWUsYUFBYSxDQUFDLEdBQXdCOztRQUNuRCxNQUFNLFFBQVEsR0FBOEIsTUFBTSxpQkFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLGdCQUFPLENBQUMsQ0FBQztRQUNyRixPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsY0FBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ2hHLENBQUM7Q0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFwcCwgcmVtb3RlIH0gZnJvbSAnZWxlY3Ryb24nO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHR1cmJvd2FsaywgeyBJRW50cnkgfSBmcm9tICd0dXJib3dhbGsnO1xyXG5pbXBvcnQgeyBmcywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5cclxuaW1wb3J0IHsgRE9PUlNUT1BQRVJfSE9PSywgR0FNRV9JRCwgSUdOT1JBQkxFX0ZJTEVTIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuY29uc3QgaW52YWxpZE1vZEZvbGRlcnMgPSBbJ2Rlbmlrc29uLWJlcGluZXhwYWNrX3ZhbGhlaW0nLCAnMWYzMWEtYmVwaW5leF92YWxoZWltX2Z1bGwnXTtcclxuXHJcbmNvbnN0IGFwcFVuaSA9IHJlbW90ZSAhPT0gdW5kZWZpbmVkID8gcmVtb3RlLmFwcCA6IGFwcDtcclxuXHJcbi8vIFRPRE86IHJlc29sdmUgdGhlIGxvY2F0aW9uIG9mIHRoZSBjYWNoZSByYXRoZXIgdGhhbiBzZWFyY2hpbmcgZm9yIGl0IGluIHRoZVxyXG4vLyAgZGVmYXVsdCBsb2NhdGlvbi5cclxuZnVuY3Rpb24gZ2V0UjJDYWNoZUxvY2F0aW9uKCkge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oYXBwVW5pLmdldFBhdGgoJ2FwcERhdGEnKSwgJ3IybW9kbWFuUGx1cy1sb2NhbCcsICdWYWxoZWltJywgJ2NhY2hlJyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB1c2VySGFzUjJJbnN0YWxsZWQoKSB7XHJcbiAgdHJ5IHtcclxuICAgIGZzLnN0YXRTeW5jKGdldFIyQ2FjaGVMb2NhdGlvbigpKTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1pZ3JhdGVSMlRvVm9ydGV4KGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IHN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3QgYWN0aXZpdHlJZCA9ICdyMm1pZ3JhdGlvbmFjdGl2aXR5JztcclxuICAgIGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgICAgaWQ6IGFjdGl2aXR5SWQsXHJcbiAgICAgIHR5cGU6ICdhY3Rpdml0eScsXHJcbiAgICAgIG1lc3NhZ2U6ICdNaWdyYXRpbmcgTW9kcycsXHJcbiAgICAgIGFsbG93U3VwcHJlc3M6IGZhbHNlLFxyXG4gICAgICBub0Rpc21pc3M6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBzdGFydE1pZ3JhdGlvbihhcGkpO1xyXG4gICAgICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgICAgdHlwZTogJ3N1Y2Nlc3MnLFxyXG4gICAgICAgIG1lc3NhZ2U6ICdNb2RzIG1pZ3JhdGVkIHN1Y2Nlc3NmdWxseScsXHJcbiAgICAgICAgZGlzcGxheU1TOiAzMDAwLFxyXG4gICAgICB9KTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdGYWlsZWQgdG8gbWlncmF0ZSBtb2RzIGZyb20gUjIgTW9kIE1hbmFnZXInLCBlcnIpO1xyXG4gICAgfVxyXG5cclxuICAgIGFwaS5kaXNtaXNzTm90aWZpY2F0aW9uKGFjdGl2aXR5SWQpO1xyXG4gIH07XHJcblxyXG4gIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ1IyIE1vZHMgTWlncmF0aW9uJyxcclxuICB7XHJcbiAgICBiYmNvZGU6ICdWb3J0ZXggY2FuIGF0dGVtcHQgdG8gbWlncmF0ZSB5b3VyIFIyIE1vZHMgTWFuYWdlciBwbHVnaW5zIHRvIHRoZSBnYW1lXFwncyAnXHJcbiAgICAgICsgJ2RpcmVjdG9yeSwgZW5zdXJpbmcgdGhhdCB5b3VyIHByZXZpb3VzbHkgZG93bmxvYWRlZC9pbnN0YWxsZWQgbW9kcyBhcmUgc3RpbGwgJ1xyXG4gICAgICArICdhdmFpbGFibGUgaW4tZ2FtZS5bYnJdWy9icl1bYnJdWy9icl0nXHJcbiAgICAgICsgJ1BsZWFzZSBub3RlOiBbbGlzdF0nXHJcbiAgICAgICsgJ1sqXW1vZCBjb25maWd1cmF0aW9uIGNoYW5nZXMgd2lsbCBub3QgYmUgaW1wb3J0ZWQgLSB0aGVzZSBuZWVkIHRvIGJlICdcclxuICAgICAgKyAncmUtYWRkZWQgb3IgaW1wb3J0ZWQgbWFudWFsbHkgZnJvbSB5b3VyIHByZWZlcnJlZCBwcm9maWxlLidcclxuICAgICAgKyAnWypdVm9ydGV4IHdpbGwgaGF2ZSBubyBjb250cm9sIG92ZXIgdGhlc2UgZmlsZXMgLSB5b3Ugd2lsbCBoYXZlIHRvIHJlbW92ZSB0aGVzZSdcclxuICAgICAgKyAnbWFudWFsbHkuJ1xyXG4gICAgICArICdbKl1JdCBpcyBzdGlsbCBoaWdobHkgcmVjb21tZW5kZWQgdG8gdXNlIGEgZnJlc2ggdmFuaWxsYSBjb3B5IG9mIHRoZSBnYW1lIHdoZW4gJ1xyXG4gICAgICArICdzdGFydGluZyB0byBtb2Qgd2l0aCBWb3J0ZXggWy9saXN0XScsXHJcbiAgfSwgW1xyXG4gICAgeyBsYWJlbDogJ0NhbmNlbCcsIGFjdGlvbjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCkgfSxcclxuICAgIHsgbGFiZWw6ICdTdGFydCBNaWdyYXRpb24nLCBhY3Rpb246ICgpID0+IHN0YXJ0KCkgfSxcclxuICBdKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc3RhcnRNaWdyYXRpb24oYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKSB7XHJcbiAgY29uc3QgaGFzSW52YWxpZFNlZyA9IChzZWdtZW50OiBzdHJpbmcpID0+XHJcbiAgICBbRE9PUlNUT1BQRVJfSE9PS10uY29uY2F0KGludmFsaWRNb2RGb2xkZXJzLCBJR05PUkFCTEVfRklMRVMpLmluY2x1ZGVzKHNlZ21lbnQudG9Mb3dlckNhc2UoKSk7XHJcblxyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgZGlzY292ZXJ5OiB0eXBlcy5JRGlzY292ZXJ5UmVzdWx0ID0gc2VsZWN0b3JzLmRpc2NvdmVyeUJ5R2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgaWYgKGRpc2NvdmVyeT8ucGF0aCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBTaG91bGQgbmV2ZXIgYmUgcG9zc2libGUuXHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBjdXJyZW50RGVwbG95bWVudCA9IGF3YWl0IGdldERlcGxveW1lbnQoYXBpKTtcclxuICBjb25zdCByMlBhdGggPSBnZXRSMkNhY2hlTG9jYXRpb24oKTtcclxuICBsZXQgZmlsZUVudHJpZXM6IElFbnRyeVtdID0gW107XHJcbiAgYXdhaXQgdHVyYm93YWxrKHIyUGF0aCwgZW50cmllcyA9PiB7XHJcbiAgICBjb25zdCBmaWx0ZXJlZCA9IGVudHJpZXMuZmlsdGVyKGVudHJ5ID0+IHtcclxuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZW50cnkuZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBjb25zdCBpc0ludmFsaWQgPSBzZWdtZW50cy5maW5kKGhhc0ludmFsaWRTZWcpICE9PSB1bmRlZmluZWQ7XHJcbiAgICAgIGlmIChpc0ludmFsaWQpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9KTtcclxuICAgIGZpbGVFbnRyaWVzID0gZmlsZUVudHJpZXMuY29uY2F0KGZpbHRlcmVkKTtcclxuICB9KVxyXG4gIC5jYXRjaChlcnIgPT4gWydFTk9FTlQnLCAnRU5PVEZPVU5EJ10uaW5jbHVkZXMoZXJyLmNvZGUpXHJcbiAgICA/IFByb21pc2UucmVzb2x2ZSgpIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcblxyXG4gIGNvbnN0IHZlclJneCA9IG5ldyBSZWdFeHAoL15cXGRcXC5cXGRcXC5cXGR7MSw0fSQvKTtcclxuICBjb25zdCBkZXN0aW5hdGlvbiA9IHBhdGguam9pbihkaXNjb3ZlcnkucGF0aCwgJ0JlcEluRXgnLCAncGx1Z2lucycpO1xyXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbWF4LWxpbmUtbGVuZ3RoXHJcbiAgY29uc3QgaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSA9IGF3YWl0IGZpbGVFbnRyaWVzLnJlZHVjZShhc3luYyAoYWNjdW1QLCBpdGVyOiBJRW50cnkpID0+IHtcclxuICAgIGNvbnN0IGFjY3VtID0gYXdhaXQgYWNjdW1QO1xyXG4gICAgY29uc3Qgc2VnbWVudHMgPSBpdGVyLmZpbGVQYXRoLnNwbGl0KHBhdGguc2VwKTtcclxuICAgIGNvbnN0IGlkeCA9IHNlZ21lbnRzLmZpbmRJbmRleChzZWcgPT4gdmVyUmd4LnRlc3Qoc2VnKSk7XHJcbiAgICBpZiAoaWR4ID09PSAtMSkge1xyXG4gICAgICAvLyBUaGlzIGlzIGFuIGludmFsaWQgZmlsZSBlbnRyeSwgYXQgbGVhc3QgYXMgZmFyIGFzIHRoZSBSMiBjYWNoZSBmaWxlXHJcbiAgICAgIC8vIHN0cnVjdHVyZSB3YXMgaW4gMDIvMDMvMjAyMTtcclxuICAgICAgcmV0dXJuIGFjY3VtO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbW9kS2V5ID0gc2VnbWVudHMuc2xpY2UoaWR4IC0gMSwgaWR4ICsgMSkuam9pbihwYXRoLnNlcCk7XHJcbiAgICBjb25zdCBpbmRleCA9IGFjY3VtLmZpbmRJbmRleCgoaW5zdHIpID0+IGluc3RyLmtleSA9PT0gbW9kS2V5XHJcbiAgICAgICYmIGluc3RyLnNvdXJjZSA9PT0gaXRlci5maWxlUGF0aCk7XHJcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nOiB0eXBlcy5JSW5zdHJ1Y3Rpb24gPSBhY2N1bVtpbmRleF07XHJcbiAgICAgIGNvbnN0IHZlciA9IGV4aXN0aW5nLmtleS5zcGxpdChwYXRoLnNlcClbMV07XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKHNlbXZlci5ndChzZWdtZW50c1tpZHhdLCB2ZXIpKSB7XHJcbiAgICAgICAgICBhY2N1bVtpbmRleF0uc291cmNlID0gaXRlci5maWxlUGF0aDtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIC8vIFdlIGNhbid0IGRlZHVjZSB3aGljaCBvbmUgaXMgbW9yZSB1cCB0byBkYXRlIC0ganVzdCBsZWF2ZSB0aGUgb25lIHdlIGhhdmUuXHJcbiAgICAgICAgcmV0dXJuIGFjY3VtO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBmdWxsRGVzdCA9IHBhdGguam9pbihkZXN0aW5hdGlvbiwgc2VnbWVudHMuc2xpY2UoaWR4ICsgMSkuam9pbihwYXRoLnNlcCkpO1xyXG4gICAgICBpZiAoIWN1cnJlbnREZXBsb3ltZW50LmluY2x1ZGVzKGZ1bGxEZXN0LnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgYWNjdW0ucHVzaCh7XHJcbiAgICAgICAgICB0eXBlOiAnY29weScsXHJcbiAgICAgICAgICBzb3VyY2U6IGl0ZXIuZmlsZVBhdGgsXHJcbiAgICAgICAgICBkZXN0aW5hdGlvbjogcGF0aC5qb2luKGRlc3RpbmF0aW9uLCBzZWdtZW50cy5zbGljZShpZHggKyAxKS5qb2luKHBhdGguc2VwKSksXHJcbiAgICAgICAgICBrZXk6IG1vZEtleSxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBhY2N1bTtcclxuICB9LCBQcm9taXNlLnJlc29sdmUoW10pKTtcclxuXHJcbiAgZm9yIChjb25zdCBpbnN0ciBvZiBpbnN0cnVjdGlvbnMpIHtcclxuICAgIGF3YWl0IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5kaXJuYW1lKGluc3RyLmRlc3RpbmF0aW9uKSk7XHJcbiAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhpbnN0ci5kZXN0aW5hdGlvbilcclxuICAgICAgLmNhdGNoKHsgY29kZTogJ0VOT0VOVCcgfSwgKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCkpO1xyXG4gICAgYXdhaXQgZnMuY29weUFzeW5jKGluc3RyLnNvdXJjZSwgaW5zdHIuZGVzdGluYXRpb24pO1xyXG4gIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0RGVwbG95bWVudChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpIHtcclxuICBjb25zdCBtYW5pZmVzdDogdHlwZXMuSURlcGxveW1lbnRNYW5pZmVzdCA9IGF3YWl0IHV0aWwuZ2V0TWFuaWZlc3QoYXBpLCAnJywgR0FNRV9JRCk7XHJcbiAgcmV0dXJuIG1hbmlmZXN0LmZpbGVzLm1hcChmaWxlID0+IHBhdGguam9pbihtYW5pZmVzdC50YXJnZXRQYXRoLCBmaWxlLnJlbFBhdGgpLnRvTG93ZXJDYXNlKCkpO1xyXG59XHJcbiJdfQ==