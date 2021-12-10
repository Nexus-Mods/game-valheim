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
exports.onDidPurge = exports.onWillDeploy = void 0;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
const PAYLOAD_PATH = path_1.default.join(__dirname, 'BepInExPayload');
const BACKUP_EXT = '.vortex_backup';
function onWillDeploy(context, profileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const props = (0, common_1.genProps)(context.api, profileId);
        if (props === undefined) {
            return;
        }
        try {
            yield deployPayload(props);
        }
        catch (err) {
            const userCanceled = (err instanceof vortex_api_1.util.UserCanceled);
            err['attachLogOnReport'] = true;
            context.api.showErrorNotification('Failed to deploy payload', err, { allowReport: !userCanceled });
        }
    });
}
exports.onWillDeploy = onWillDeploy;
function onDidPurge(api, profileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const props = (0, common_1.genProps)(api, profileId);
        if (props === undefined) {
            return;
        }
        try {
            yield purgePayload(props);
        }
        catch (err) {
            const userCanceled = (err instanceof vortex_api_1.util.UserCanceled);
            err['attachLogOnReport'] = true;
            api.showErrorNotification('Failed to remove payload', err, { allowReport: !userCanceled });
        }
    });
}
exports.onDidPurge = onDidPurge;
function purgePayload(props) {
    return __awaiter(this, void 0, void 0, function* () {
        if (props === undefined) {
            return;
        }
        try {
            const fileEntries = yield (0, common_1.walkDirPath)(PAYLOAD_PATH);
            const srcPath = PAYLOAD_PATH;
            const destPath = props.discovery.path;
            const instructions = (0, common_1.genInstructions)(srcPath, destPath, fileEntries);
            for (const instr of instructions) {
                yield vortex_api_1.fs.removeAsync(instr.destination)
                    .catch({ code: 'ENOENT' }, () => Promise.resolve());
            }
        }
        catch (err) {
            throw err;
        }
    });
}
function ensureLatest(instruction) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const srcHash = yield getHash(instruction.source);
            const destHash = yield getHash(instruction.destination);
            if (destHash !== srcHash) {
                yield vortex_api_1.fs.removeAsync(instruction.destination);
                yield vortex_api_1.fs.ensureDirWritableAsync(path_1.default.dirname(instruction.destination));
                yield vortex_api_1.fs.copyAsync(instruction.source, instruction.destination);
            }
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                yield vortex_api_1.fs.ensureDirWritableAsync(instruction.destination);
                yield vortex_api_1.fs.copyAsync(instruction.source, instruction.destination);
            }
            return Promise.reject(err);
        }
    });
}
function isISVMLEnabled(props) {
    return __awaiter(this, void 0, void 0, function* () {
        const mods = vortex_api_1.util.getSafe(props.state, ['persistent', 'mods', common_1.GAME_ID], {});
        const inSlimId = Object.keys(mods).find(key => mods[key].type === 'inslimvml-mod-loader');
        if (inSlimId === undefined) {
            return false;
        }
        const manifest = yield vortex_api_1.util.getManifest(props.api, 'inslimvml-mod-loader', common_1.GAME_ID);
        const isDeployed = manifest.files.length > 0;
        return isDeployed || vortex_api_1.util.getSafe(props.profile, ['modState', inSlimId, 'enabled'], false);
    });
}
function deployPayload(props) {
    return __awaiter(this, void 0, void 0, function* () {
        if (props === undefined) {
            return;
        }
        const isVMLEnabled = yield isISVMLEnabled(props);
        try {
            const fileEntries = yield (0, common_1.walkDirPath)(PAYLOAD_PATH);
            const srcPath = PAYLOAD_PATH;
            const destPath = props.discovery.path;
            const instructions = (0, common_1.genInstructions)(srcPath, destPath, fileEntries);
            for (const instr of instructions) {
                if (isVMLEnabled && instr.type === 'copy') {
                    if (common_1.ISVML_SKIP.includes(path_1.default.basename(instr.source).toLowerCase())) {
                        continue;
                    }
                }
                if (path_1.default.basename(instr.source).toLowerCase() === common_1.DOORSTOPPER_HOOK) {
                    try {
                        yield vortex_api_1.fs.statAsync(instr.destination + BACKUP_EXT);
                        instr.destination = instr.destination + BACKUP_EXT;
                    }
                    catch (err) {
                    }
                }
                yield vortex_api_1.fs.ensureDirWritableAsync(path_1.default.dirname(instr.destination));
                yield vortex_api_1.fs.copyAsync(instr.source, instr.destination)
                    .catch({ code: 'EEXIST' }, () => ensureLatest(instr));
            }
        }
        catch (err) {
            return Promise.reject(err);
        }
    });
}
function calcHashImpl(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto_1.default.createHash('md5');
        const stream = vortex_api_1.fs.createReadStream(filePath);
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
function getHash(filePath, tries = 3) {
    return calcHashImpl(filePath)
        .catch(err => {
        if (['EMFILE', 'EBADF'].includes(err['code']) && (tries > 0)) {
            return getHash(filePath, tries - 1);
        }
        else {
            return Promise.reject(err);
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bG9hZERlcGxveWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGF5bG9hZERlcGxveWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUE0QjtBQUM1QixnREFBd0I7QUFFeEIsMkNBQTZDO0FBRTdDLHFDQUM0QztBQUU1QyxNQUFNLFlBQVksR0FBRyxjQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzVELE1BQU0sVUFBVSxHQUFXLGdCQUFnQixDQUFDO0FBRTVDLFNBQXNCLFlBQVksQ0FBQyxPQUFnQyxFQUNoQyxTQUFpQjs7UUFDbEQsTUFBTSxLQUFLLEdBQVcsSUFBQSxpQkFBUSxFQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDdkQsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBR3ZCLE9BQU87U0FDUjtRQUNELElBQUk7WUFDRixNQUFNLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM1QjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLFlBQVksaUJBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN4RCxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQywwQkFBMEIsRUFDMUQsR0FBRyxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztTQUN4QztJQUNILENBQUM7Q0FBQTtBQWhCRCxvQ0FnQkM7QUFFRCxTQUFzQixVQUFVLENBQUMsR0FBd0IsRUFDeEIsU0FBaUI7O1FBQ2hELE1BQU0sS0FBSyxHQUFXLElBQUEsaUJBQVEsRUFBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDL0MsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3ZCLE9BQU87U0FDUjtR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QUM7WUFDM0IsSUFBSSxJQUFJLEVBQUU7Z0JBQ1IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNuQjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzdCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsT0FBTyxDQUFDLFFBQWdCLEVBQUUsUUFBZ0IsQ0FBQztJQUNsRCxPQUFPLFlBQVksQ0FBQyxRQUFRLENBQUM7U0FDMUIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ1gsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUU7WUFDNUQsT0FBTyxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztTQUNyQzthQUFNO1lBQ0wsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzVCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgSUVudHJ5IH0gZnJvbSAndHVyYm93YWxrJztcclxuaW1wb3J0IHsgZnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgeyBET09SU1RPUFBFUl9IT09LLCBHQU1FX0lELCBnZW5JbnN0cnVjdGlvbnMsIGdlblByb3BzLCBJUHJvcHMsXHJcbiAgSVNWTUxfU0tJUCwgd2Fsa0RpclBhdGggfSBmcm9tICcuL2NvbW1vbic7XHJcblxyXG5jb25zdCBQQVlMT0FEX1BBVEggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnQmVwSW5FeFBheWxvYWQnKTtcclxuY29uc3QgQkFDS1VQX0VYVDogc3RyaW5nID0gJy52b3J0ZXhfYmFja3VwJztcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvbldpbGxEZXBsb3koY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvZmlsZUlkOiBzdHJpbmcpIHtcclxuICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dC5hcGksIHByb2ZpbGVJZCk7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIERvIG5vdGhpbmcsIHByb2ZpbGUgaXMgZWl0aGVyIHVuZGVmaW5lZCwgYmVsb25ncyB0byBhIGRpZmZlcmVudCBnYW1lXHJcbiAgICAvLyAgb3IgcG90ZW50aWFsbHkgdGhlIGdhbWUgaXMgdW5kaXNjb3ZlcmVkLlxyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICB0cnkge1xyXG4gICAgYXdhaXQgZGVwbG95UGF5bG9hZChwcm9wcyk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zdCB1c2VyQ2FuY2VsZWQgPSAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQpO1xyXG4gICAgZXJyWydhdHRhY2hMb2dPblJlcG9ydCddID0gdHJ1ZTtcclxuICAgIGNvbnRleHQuYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRmFpbGVkIHRvIGRlcGxveSBwYXlsb2FkJyxcclxuICAgICAgZXJyLCB7IGFsbG93UmVwb3J0OiAhdXNlckNhbmNlbGVkIH0pO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9uRGlkUHVyZ2UoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlSWQ6IHN0cmluZykge1xyXG4gIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhhcGksIHByb2ZpbGVJZCk7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IHB1cmdlUGF5bG9hZChwcm9wcyk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zdCB1c2VyQ2FuY2VsZWQgPSAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQpO1xyXG4gICAgZXJyWydhdHRhY2hMb2dPblJlcG9ydCddID0gdHJ1ZTtcclxuICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0ZhaWxlZCB0byByZW1vdmUgcGF5bG9hZCcsXHJcbiAgICAgIGVyciwgeyBhbGxvd1JlcG9ydDogIXVzZXJDYW5jZWxlZCB9KTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHB1cmdlUGF5bG9hZChwcm9wczogSVByb3BzKSB7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IGF3YWl0IHdhbGtEaXJQYXRoKFBBWUxPQURfUEFUSCk7XHJcbiAgICBjb25zdCBzcmNQYXRoID0gUEFZTE9BRF9QQVRIO1xyXG4gICAgY29uc3QgZGVzdFBhdGggPSBwcm9wcy5kaXNjb3ZlcnkucGF0aDtcclxuICAgIGNvbnN0IGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10gPSBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aCwgZGVzdFBhdGgsIGZpbGVFbnRyaWVzKTtcclxuICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKGluc3RyLmRlc3RpbmF0aW9uKVxyXG4gICAgICAgIC5jYXRjaCh7IGNvZGU6ICdFTk9FTlQnIH0sICgpID0+IFByb21pc2UucmVzb2x2ZSgpKTtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHRocm93IGVycjtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUxhdGVzdChpbnN0cnVjdGlvbjogdHlwZXMuSUluc3RydWN0aW9uKSB7XHJcbiAgLy8gV2hlbiBkZXBsb3lpbmcgdGhlIHBheWxvYWQsIHdlIG1heSBlbmNvdW50ZXIgdGhlIEVFWElTVCBlcnJvclxyXG4gIC8vICBjb2RlLiBXZSBhbHdheXMgYXNzdW1lIHRoYXQgdGhlIEJlcEluRXggYXNzZW1ibGllcyB0aGF0IGNvbWUgd2l0aFxyXG4gIC8vICB0aGUgZ2FtZSBleHRlbnNpb24gYXJlIHRoZSBsYXRlc3QgYXNzZW1ibGllcyBhbmQgdGhlcmVmb3JlIHdlIG5lZWRcclxuICAvLyAgdG8gZW5zdXJlIHRoYXQgd2hlbmV2ZXIgd2UgZW5jb3VudGVyIEVFWElTVCwgd2UgY2hlY2sgaWYgdGhlXHJcbiAgLy8gIGhhc2ggb2YgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gbWF0Y2ggLSBpZiB0aGV5IGRvbid0IC0gcmVwbGFjZVxyXG4gIC8vICB0aGUgZXhpc3RpbmcgZGVwbG95ZWQgYXNzZW1ibHkuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHNyY0hhc2ggPSBhd2FpdCBnZXRIYXNoKGluc3RydWN0aW9uLnNvdXJjZSk7XHJcbiAgICBjb25zdCBkZXN0SGFzaCA9IGF3YWl0IGdldEhhc2goaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pO1xyXG4gICAgaWYgKGRlc3RIYXNoICE9PSBzcmNIYXNoKSB7XHJcbiAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhwYXRoLmRpcm5hbWUoaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pKTtcclxuICAgICAgYXdhaXQgZnMuY29weUFzeW5jKGluc3RydWN0aW9uLnNvdXJjZSwgaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgaWYgKGVyci5jb2RlID09PSAnRU5PRU5UJykge1xyXG4gICAgICAvLyBXZSBhc3N1bWUgdGhhdCBpdCdzIHRoZSBkZXN0aW5hdGlvbiBmaWxlIHRoYXQgd2FzIHNvbWVob3cgcmVtb3ZlZC5cclxuICAgICAgLy8gIElmIGl0J3MgdGhlIHNvdXJjZSAtIHRoZSB1c2VyIGNsZWFybHkgaGFzIGEgY29ycnB1dCBpbnN0YWxsYXRpb24gb2ZcclxuICAgICAgLy8gIHRoaXMgZXh0ZW5zaW9uLCBpbiB3aGljaCBjYXNlIGl0J3Mgb2sgdG8gY3Jhc2gvZXJyb3Igb3V0LlxyXG4gICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgICAgYXdhaXQgZnMuY29weUFzeW5jKGluc3RydWN0aW9uLnNvdXJjZSwgaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gaXNJU1ZNTEVuYWJsZWQocHJvcHM6IElQcm9wcykge1xyXG4gIGNvbnN0IG1vZHMgPSB1dGlsLmdldFNhZmUocHJvcHMuc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBpblNsaW1JZCA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbmQoa2V5ID0+IG1vZHNba2V5XS50eXBlID09PSAnaW5zbGltdm1sLW1vZC1sb2FkZXInKTtcclxuICBpZiAoaW5TbGltSWQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgbWFuaWZlc3Q6IHR5cGVzLklEZXBsb3ltZW50TWFuaWZlc3QgPSBhd2FpdCB1dGlsLmdldE1hbmlmZXN0KHByb3BzLmFwaSwgJ2luc2xpbXZtbC1tb2QtbG9hZGVyJywgR0FNRV9JRCk7XHJcbiAgY29uc3QgaXNEZXBsb3llZCA9IG1hbmlmZXN0LmZpbGVzLmxlbmd0aCA+IDA7XHJcbiAgcmV0dXJuIGlzRGVwbG95ZWQgfHwgdXRpbC5nZXRTYWZlKHByb3BzLnByb2ZpbGUsIFsnbW9kU3RhdGUnLCBpblNsaW1JZCwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBkZXBsb3lQYXlsb2FkKHByb3BzOiBJUHJvcHMpIHtcclxuICBpZiAocHJvcHMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBjb25zdCBpc1ZNTEVuYWJsZWQgPSBhd2FpdCBpc0lTVk1MRW5hYmxlZChwcm9wcyk7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IGF3YWl0IHdhbGtEaXJQYXRoKFBBWUxPQURfUEFUSCk7XHJcbiAgICBjb25zdCBzcmNQYXRoID0gUEFZTE9BRF9QQVRIO1xyXG4gICAgY29uc3QgZGVzdFBhdGggPSBwcm9wcy5kaXNjb3ZlcnkucGF0aDtcclxuICAgIGNvbnN0IGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10gPSBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aCwgZGVzdFBhdGgsIGZpbGVFbnRyaWVzKTtcclxuICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgIGlmIChpc1ZNTEVuYWJsZWQgJiYgaW5zdHIudHlwZSA9PT0gJ2NvcHknKSB7XHJcbiAgICAgICAgaWYgKElTVk1MX1NLSVAuaW5jbHVkZXMocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAvLyBJZiBJblNsaW0gaXMgaW5zdGFsbGVkIGFuZCBlbmFibGVkLCBkb24ndCBib3RoZXIgd2l0aCBCSVhfU1ZNTCBwYXRjaGVyXHJcbiAgICAgICAgICAvLyAgb3IgaXRzIHJlcXVpcmVtZW50c1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGlmIChwYXRoLmJhc2VuYW1lKGluc3RyLnNvdXJjZSkudG9Mb3dlckNhc2UoKSA9PT0gRE9PUlNUT1BQRVJfSE9PSykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBDaGVjayBpZiBJblNsaW0gaXMgaW5zdGFsbGVkIGFuZCBpcyBvdmVyd3JpdGluZyBvdXIgZG9vcnN0b3BwZXIuXHJcbiAgICAgICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoaW5zdHIuZGVzdGluYXRpb24gKyBCQUNLVVBfRVhUKTtcclxuICAgICAgICAgIGluc3RyLmRlc3RpbmF0aW9uID0gaW5zdHIuZGVzdGluYXRpb24gKyBCQUNLVVBfRVhUO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgLy8gbm9wXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGF3YWl0IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5kaXJuYW1lKGluc3RyLmRlc3RpbmF0aW9uKSk7XHJcbiAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhpbnN0ci5zb3VyY2UsIGluc3RyLmRlc3RpbmF0aW9uKVxyXG4gICAgICAgIC5jYXRjaCh7IGNvZGU6ICdFRVhJU1QnIH0sICgpID0+IGVuc3VyZUxhdGVzdChpbnN0cikpO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBjYWxjSGFzaEltcGwoZmlsZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpO1xyXG4gICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlUGF0aCk7XHJcbiAgICBzdHJlYW0ub24oJ3JlYWRhYmxlJywgKCkgPT4ge1xyXG4gICAgICBjb25zdCBkYXRhID0gc3RyZWFtLnJlYWQoKTtcclxuICAgICAgaWYgKGRhdGEpIHtcclxuICAgICAgICBoYXNoLnVwZGF0ZShkYXRhKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBzdHJlYW0ub24oJ2VuZCcsICgpID0+IHJlc29sdmUoaGFzaC5kaWdlc3QoJ2hleCcpKSk7XHJcbiAgICBzdHJlYW0ub24oJ2Vycm9yJywgcmVqZWN0KTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SGFzaChmaWxlUGF0aDogc3RyaW5nLCB0cmllczogbnVtYmVyID0gMykge1xyXG4gIHJldHVybiBjYWxjSGFzaEltcGwoZmlsZVBhdGgpXHJcbiAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgaWYgKFsnRU1GSUxFJywgJ0VCQURGJ10uaW5jbHVkZXMoZXJyWydjb2RlJ10pICYmICh0cmllcyA+IDApKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldEhhc2goZmlsZVBhdGgsIHRyaWVzIC0gMSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcbiJdfQ==