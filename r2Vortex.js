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
const path_1 = __importDefault(require("path"));
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
const invalidModFolders = ['denikson-bepinexpack_valheim', '1f31a-bepinex_valheim_full'];
function getR2CacheLocation() {
    return path_1.default.join(vortex_api_1.util.getVortexPath('appData'), 'r2modmanPlus-local', 'Valheim', 'cache');
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
        api.showDialog('info', 'r2modman Mods Migration', {
            bbcode: 'Vortex can import your mods installed with r2modman and allow you to manage them '
                + 'from inside Vortex. Please be aware that the mods will be imported in an '
                + 'uninstalled state and will have to be installed, enabled and deployed through '
                + 'Vortex before the mods are re-instated into the game.[br][/br][br][/br]'
                + 'Please note: [br][/br][br][/br][list]'
                + '[*]Mod configuration changes will not be imported - these need to be '
                + 're-added or imported manually from your preferred r2modman profile.'
                + '[*]Vortex will import ALL versions of the mods you have in your r2modman cache, even '
                + 'the outdated ones - it\'s up to you to look through the imported mods and install '
                + 'the ones you want active in-game.'
                + '[*]r2modman stores recently uninstalled mods in its cache meaning that Vortex might '
                + 'import mods you recently uninstalled in r2modman. You can simply choose to not '
                + 'install or remove them entirely after importing. '
                + '[/list][br][/br]It is still highly recommended to use a fresh vanilla copy of the game when '
                + 'starting to mod with Vortex.',
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
        yield (0, turbowalk_1.default)(r2Path, entries => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjJWb3J0ZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyMlZvcnRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQSxnREFBd0I7QUFDeEIsMERBQThDO0FBQzlDLDJDQUF3RDtBQUN4RCxxQ0FBc0U7QUFFdEUsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLDhCQUE4QixFQUFFLDRCQUE0QixDQUFDLENBQUM7QUFTekYsU0FBUyxrQkFBa0I7SUFDekIsT0FBTyxjQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUM1RixDQUFDO0FBRUQsU0FBZ0Isa0JBQWtCO0lBQ2hDLElBQUk7UUFDRixlQUFFLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztRQUNsQyxPQUFPLElBQUksQ0FBQztLQUNiO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQVBELGdEQU9DO0FBRUQsU0FBc0IsaUJBQWlCLENBQUMsR0FBd0I7O1FBQzlELE1BQU0sS0FBSyxHQUFHLEdBQVMsRUFBRTtZQUN2QixNQUFNLFVBQVUsR0FBRyxxQkFBcUIsQ0FBQztZQUN6QyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ25CLEVBQUUsRUFBRSxVQUFVO2dCQUNkLElBQUksRUFBRSxVQUFVO2dCQUNoQixPQUFPLEVBQUUsZ0JBQWdCO2dCQUN6QixhQUFhLEVBQUUsS0FBSztnQkFDcEIsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1lBRUgsSUFBSTtnQkFDRixNQUFNLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDMUIsR0FBRyxDQUFDLGdCQUFnQixDQUFDO29CQUNuQixJQUFJLEVBQUUsU0FBUztvQkFDZixPQUFPLEVBQUUsNEJBQTRCO29CQUNyQyxT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QUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUM7WUFDbkYsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDZixLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7YUFDM0M7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVQLE1BQU0sYUFBYSxHQUFHLHNCQUFTLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLGdCQUFPLENBQUMsQ0FBQztRQUNwRSxNQUFNLElBQUksR0FBRyxJQUFJLGlCQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDakMsS0FBSyxNQUFNLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3hDLE1BQU0sV0FBVyxHQUFHLGNBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQztZQUM5RCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUM7aUJBQ3ZDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLGNBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFDNUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUM5RDtJQUNILENBQUM7Q0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgdHVyYm93YWxrLCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcbmltcG9ydCB7IGZzLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCB7IERPT1JTVE9QUEVSX0hPT0ssIEdBTUVfSUQsIElHTk9SQUJMRV9GSUxFUyB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmNvbnN0IGludmFsaWRNb2RGb2xkZXJzID0gWydkZW5pa3Nvbi1iZXBpbmV4cGFja192YWxoZWltJywgJzFmMzFhLWJlcGluZXhfdmFsaGVpbV9mdWxsJ107XHJcblxyXG5pbnRlcmZhY2UgSVIyTW9kRmlsZSB7XHJcbiAgcmVsUGF0aDogc3RyaW5nO1xyXG4gIGJhc2VQYXRoOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8vIFRPRE86IHJlc29sdmUgdGhlIGxvY2F0aW9uIG9mIHRoZSBjYWNoZSByYXRoZXIgdGhhbiBzZWFyY2hpbmcgZm9yIGl0IGluIHRoZVxyXG4vLyAgZGVmYXVsdCBsb2NhdGlvbi5cclxuZnVuY3Rpb24gZ2V0UjJDYWNoZUxvY2F0aW9uKCkge1xyXG4gIHJldHVybiBwYXRoLmpvaW4odXRpbC5nZXRWb3J0ZXhQYXRoKCdhcHBEYXRhJyksICdyMm1vZG1hblBsdXMtbG9jYWwnLCAnVmFsaGVpbScsICdjYWNoZScpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdXNlckhhc1IySW5zdGFsbGVkKCkge1xyXG4gIHRyeSB7XHJcbiAgICBmcy5zdGF0U3luYyhnZXRSMkNhY2hlTG9jYXRpb24oKSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtaWdyYXRlUjJUb1ZvcnRleChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpIHtcclxuICBjb25zdCBzdGFydCA9IGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IGFjdGl2aXR5SWQgPSAncjJtaWdyYXRpb25hY3Rpdml0eSc7XHJcbiAgICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgIGlkOiBhY3Rpdml0eUlkLFxyXG4gICAgICB0eXBlOiAnYWN0aXZpdHknLFxyXG4gICAgICBtZXNzYWdlOiAnTWlncmF0aW5nIE1vZHMnLFxyXG4gICAgICBhbGxvd1N1cHByZXNzOiBmYWxzZSxcclxuICAgICAgbm9EaXNtaXNzOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgc3RhcnRNaWdyYXRpb24oYXBpKTtcclxuICAgICAgYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgICAgIHR5cGU6ICdzdWNjZXNzJyxcclxuICAgICAgICBtZXNzYWdlOiAnTW9kcyBtaWdyYXRlZCBzdWNjZXNzZnVsbHknLFxyXG4gICAgICAgIGRpc3BsYXlNUzogMzAwMCxcclxuICAgICAgfSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRmFpbGVkIHRvIG1pZ3JhdGUgbW9kcyBmcm9tIFIyIE1vZCBNYW5hZ2VyJywgZXJyKTtcclxuICAgIH1cclxuXHJcbiAgICBhcGkuZGlzbWlzc05vdGlmaWNhdGlvbihhY3Rpdml0eUlkKTtcclxuICB9O1xyXG5cclxuICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdyMm1vZG1hbiBNb2RzIE1pZ3JhdGlvbicsXHJcbiAge1xyXG4gICAgYmJjb2RlOiAnVm9ydGV4IGNhbiBpbXBvcnQgeW91ciBtb2RzIGluc3RhbGxlZCB3aXRoIHIybW9kbWFuIGFuZCBhbGxvdyB5b3UgdG8gbWFuYWdlIHRoZW0gJ1xyXG4gICAgICArICdmcm9tIGluc2lkZSBWb3J0ZXguIFBsZWFzZSBiZSBhd2FyZSB0aGF0IHRoZSBtb2RzIHdpbGwgYmUgaW1wb3J0ZWQgaW4gYW4gJ1xyXG4gICAgICArICd1bmluc3RhbGxlZCBzdGF0ZSBhbmQgd2lsbCBoYXZlIHRvIGJlIGluc3RhbGxlZCwgZW5hYmxlZCBhbmQgZGVwbG95ZWQgdGhyb3VnaCAnXHJcbiAgICAgICsgJ1ZvcnRleCBiZWZvcmUgdGhlIG1vZHMgYXJlIHJlLWluc3RhdGVkIGludG8gdGhlIGdhbWUuW2JyXVsvYnJdW2JyXVsvYnJdJ1xyXG4gICAgICArICdQbGVhc2Ugbm90ZTogW2JyXVsvYnJdW2JyXVsvYnJdW2xpc3RdJ1xyXG4gICAgICArICdbKl1Nb2QgY29uZmlndXJhdGlvbiBjaGFuZ2VzIHdpbGwgbm90IGJlIGltcG9ydGVkIC0gdGhlc2UgbmVlZCB0byBiZSAnXHJcbiAgICAgICsgJ3JlLWFkZGVkIG9yIGltcG9ydGVkIG1hbnVhbGx5IGZyb20geW91ciBwcmVmZXJyZWQgcjJtb2RtYW4gcHJvZmlsZS4nXHJcbiAgICAgICsgJ1sqXVZvcnRleCB3aWxsIGltcG9ydCBBTEwgdmVyc2lvbnMgb2YgdGhlIG1vZHMgeW91IGhhdmUgaW4geW91ciByMm1vZG1hbiBjYWNoZSwgZXZlbiAnXHJcbiAgICAgICsgJ3RoZSBvdXRkYXRlZCBvbmVzIC0gaXRcXCdzIHVwIHRvIHlvdSB0byBsb29rIHRocm91Z2ggdGhlIGltcG9ydGVkIG1vZHMgYW5kIGluc3RhbGwgJ1xyXG4gICAgICArICd0aGUgb25lcyB5b3Ugd2FudCBhY3RpdmUgaW4tZ2FtZS4nXHJcbiAgICAgICsgJ1sqXXIybW9kbWFuIHN0b3JlcyByZWNlbnRseSB1bmluc3RhbGxlZCBtb2RzIGluIGl0cyBjYWNoZSBtZWFuaW5nIHRoYXQgVm9ydGV4IG1pZ2h0ICdcclxuICAgICAgKyAnaW1wb3J0IG1vZHMgeW91IHJlY2VudGx5IHVuaW5zdGFsbGVkIGluIHIybW9kbWFuLiBZb3UgY2FuIHNpbXBseSBjaG9vc2UgdG8gbm90ICdcclxuICAgICAgKyAnaW5zdGFsbCBvciByZW1vdmUgdGhlbSBlbnRpcmVseSBhZnRlciBpbXBvcnRpbmcuICdcclxuICAgICAgKyAnWy9saXN0XVticl1bL2JyXUl0IGlzIHN0aWxsIGhpZ2hseSByZWNvbW1lbmRlZCB0byB1c2UgYSBmcmVzaCB2YW5pbGxhIGNvcHkgb2YgdGhlIGdhbWUgd2hlbiAnXHJcbiAgICAgICsgJ3N0YXJ0aW5nIHRvIG1vZCB3aXRoIFZvcnRleC4nLFxyXG4gIH0sIFtcclxuICAgIHsgbGFiZWw6ICdDYW5jZWwnLCBhY3Rpb246ICgpID0+IFByb21pc2UucmVzb2x2ZSgpIH0sXHJcbiAgICB7IGxhYmVsOiAnU3RhcnQgTWlncmF0aW9uJywgYWN0aW9uOiAoKSA9PiBzdGFydCgpIH0sXHJcbiAgXSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0TWlncmF0aW9uKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IGhhc0ludmFsaWRTZWcgPSAoc2VnbWVudDogc3RyaW5nKSA9PlxyXG4gICAgW0RPT1JTVE9QUEVSX0hPT0tdLmNvbmNhdChpbnZhbGlkTW9kRm9sZGVycywgSUdOT1JBQkxFX0ZJTEVTKS5pbmNsdWRlcyhzZWdtZW50LnRvTG93ZXJDYXNlKCkpO1xyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCA9IHNlbGVjdG9ycy5kaXNjb3ZlcnlCeUdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGlmIChkaXNjb3Zlcnk/LnBhdGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gU2hvdWxkIG5ldmVyIGJlIHBvc3NpYmxlLlxyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcjJQYXRoID0gZ2V0UjJDYWNoZUxvY2F0aW9uKCk7XHJcbiAgbGV0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IFtdO1xyXG4gIGF3YWl0IHR1cmJvd2FsayhyMlBhdGgsIGVudHJpZXMgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyZWQgPSBlbnRyaWVzLmZpbHRlcihlbnRyeSA9PiB7XHJcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBzZWdtZW50cyA9IGVudHJ5LmZpbGVQYXRoLnNwbGl0KHBhdGguc2VwKTtcclxuICAgICAgY29uc3QgaXNJbnZhbGlkID0gc2VnbWVudHMuZmluZChoYXNJbnZhbGlkU2VnKSAhPT0gdW5kZWZpbmVkO1xyXG4gICAgICBpZiAoaXNJbnZhbGlkKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSk7XHJcbiAgICBmaWxlRW50cmllcyA9IGZpbGVFbnRyaWVzLmNvbmNhdChmaWx0ZXJlZCk7XHJcbiAgfSlcclxuICAuY2F0Y2goZXJyID0+IFsnRU5PRU5UJywgJ0VOT1RGT1VORCddLmluY2x1ZGVzKGVyci5jb2RlKVxyXG4gICAgPyBQcm9taXNlLnJlc29sdmUoKSA6IFByb21pc2UucmVqZWN0KGVycikpO1xyXG5cclxuICBjb25zdCB2ZXJSZ3ggPSBuZXcgUmVnRXhwKC9eXFxkXFwuXFxkXFwuXFxkezEsNH0kLyk7XHJcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBtYXgtbGluZS1sZW5ndGhcclxuICBjb25zdCBhcmNNYXA6IHsgW2FyY05hbWU6IHN0cmluZ106IElSMk1vZEZpbGVbXSB9ID0gZmlsZUVudHJpZXMucmVkdWNlKChhY2N1bSwgaXRlcikgPT4ge1xyXG4gICAgY29uc3Qgc2VnbWVudHMgPSBpdGVyLmZpbGVQYXRoLnNwbGl0KHBhdGguc2VwKTtcclxuICAgIGNvbnN0IGlkeCA9IHNlZ21lbnRzLmZpbmRJbmRleChzZWcgPT4gdmVyUmd4LnRlc3Qoc2VnKSk7XHJcbiAgICBpZiAoaWR4ID09PSAtMSkge1xyXG4gICAgICAvLyBUaGlzIGlzIGFuIGludmFsaWQgZmlsZSBlbnRyeSwgYXQgbGVhc3QgYXMgZmFyIGFzIHRoZSBSMiBjYWNoZSBmaWxlXHJcbiAgICAgIC8vIHN0cnVjdHVyZSB3YXMgaW4gMDIvMDMvMjAyMTtcclxuICAgICAgcmV0dXJuIGFjY3VtO1xyXG4gICAgfVxyXG4gICAgY29uc3QgbW9kS2V5ID0gc2VnbWVudHMuc2xpY2UoaWR4IC0gMSwgaWR4ICsgMSkuam9pbignXycpO1xyXG4gICAgaWYgKGFjY3VtW21vZEtleV0gPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBhY2N1bVttb2RLZXldID0gW107XHJcbiAgICB9XHJcbiAgICBjb25zdCBiYXNlUGF0aCA9IHNlZ21lbnRzLnNsaWNlKDAsIGlkeCArIDEpLmpvaW4ocGF0aC5zZXApO1xyXG4gICAgY29uc3QgcmVsUGF0aCA9IHBhdGgucmVsYXRpdmUoYmFzZVBhdGgsIGl0ZXIuZmlsZVBhdGgpO1xyXG4gICAgY29uc3QgcGF0aEV4aXN0cyA9IChhY2N1bVttb2RLZXldLmZpbmQocjJmaWxlID0+XHJcbiAgICAgIHIyZmlsZS5yZWxQYXRoLnNwbGl0KHBhdGguc2VwKVswXSA9PT0gcmVsUGF0aC5zcGxpdChwYXRoLnNlcClbMF0pICE9PSB1bmRlZmluZWQpO1xyXG4gICAgaWYgKCFwYXRoRXhpc3RzKSB7XHJcbiAgICAgIGFjY3VtW21vZEtleV0ucHVzaCh7IHJlbFBhdGgsIGJhc2VQYXRoIH0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFjY3VtO1xyXG4gIH0sIHt9KTtcclxuXHJcbiAgY29uc3QgZG93bmxvYWRzUGF0aCA9IHNlbGVjdG9ycy5kb3dubG9hZFBhdGhGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBzemlwID0gbmV3IHV0aWwuU2V2ZW5aaXAoKTtcclxuICBmb3IgKGNvbnN0IG1vZEtleSBvZiBPYmplY3Qua2V5cyhhcmNNYXApKSB7XHJcbiAgICBjb25zdCBhcmNoaXZlUGF0aCA9IHBhdGguam9pbihkb3dubG9hZHNQYXRoLCBtb2RLZXkgKyAnLnppcCcpO1xyXG4gICAgYXdhaXQgc3ppcC5hZGQoYXJjaGl2ZVBhdGgsIGFyY01hcFttb2RLZXldXHJcbiAgICAgIC5tYXAocjJNb2RGaWxlID0+IHBhdGguam9pbihyMk1vZEZpbGUuYmFzZVBhdGgsXHJcbiAgICAgICAgcjJNb2RGaWxlLnJlbFBhdGguc3BsaXQocGF0aC5zZXApWzBdKSksIHsgcmF3OiBbJy1yJ10gfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==