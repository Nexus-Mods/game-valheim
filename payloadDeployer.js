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
        const props = common_1.genProps(context, profileId);
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
function onDidPurge(context, profileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const props = common_1.genProps(context, profileId);
        if (props === undefined) {
            return;
        }
        try {
            yield purgePayload(props);
        }
        catch (err) {
            const userCanceled = (err instanceof vortex_api_1.util.UserCanceled);
            err['attachLogOnReport'] = true;
            context.api.showErrorNotification('Failed to remove payload', err, { allowReport: !userCanceled });
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
            const fileEntries = yield common_1.walkDirPath(PAYLOAD_PATH);
            const srcPath = PAYLOAD_PATH;
            const destPath = props.discovery.path;
            const instructions = common_1.genInstructions(srcPath, destPath, fileEntries);
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
function deployPayload(props) {
    return __awaiter(this, void 0, void 0, function* () {
        if (props === undefined) {
            return;
        }
        try {
            const fileEntries = yield common_1.walkDirPath(PAYLOAD_PATH);
            const srcPath = PAYLOAD_PATH;
            const destPath = props.discovery.path;
            const instructions = common_1.genInstructions(srcPath, destPath, fileEntries);
            for (const instr of instructions) {
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
            throw err;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bG9hZERlcGxveWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGF5bG9hZERlcGxveWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUE0QjtBQUM1QixnREFBd0I7QUFFeEIsMkNBQTZDO0FBRTdDLHFDQUE0RjtBQUU1RixNQUFNLFlBQVksR0FBRyxjQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzVELE1BQU0sVUFBVSxHQUFXLGdCQUFnQixDQUFDO0FBRTVDLFNBQXNCLFlBQVksQ0FBQyxPQUFnQyxFQUNoQyxTQUFpQjs7UUFDbEQsTUFBTSxLQUFLLEdBQVcsaUJBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbkQsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBR3ZCLE9BQU87U0FDUjtRQUNELElBQUk7WUFDRixNQUFNLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM1QjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLFlBQVksaUJBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN4RCxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQywwQkFBMEIsRUFDMUQsR0FBRyxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztTQUN4QztJQUNILENBQUM7Q0FBQTtBQWhCRCxvQ0FnQkM7QUFFRCxTQUFzQixVQUFVLENBQUMsT0FBZ0MsRUFDaEMsU0FBaUI7O1FBQ2hELE1BQU0sS0FBSyxHQUFXLGlCQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ25ELElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUN2QixPQUFPO1NBQ1I7UUFDRCxJQUFJO1lBQ0YsTUFBTSxZ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LElBQUksSUFBSSxFQUFFO2dCQUNSLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDbkI7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRCxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM3QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxRQUFnQixFQUFFLFFBQWdCLENBQUM7SUFDbEQsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDO1NBQzFCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUNYLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQzVELE9BQU8sT0FBTyxDQUFDLFFBQVEsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7U0FDckM7YUFBTTtZQUNMLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUM1QjtJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcbmltcG9ydCB7IGZzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuaW1wb3J0IHsgRE9PUlNUT1BQRVJfSE9PSywgZ2VuSW5zdHJ1Y3Rpb25zLCBnZW5Qcm9wcywgSVByb3BzLCB3YWxrRGlyUGF0aCB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmNvbnN0IFBBWUxPQURfUEFUSCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICdCZXBJbkV4UGF5bG9hZCcpO1xyXG5jb25zdCBCQUNLVVBfRVhUOiBzdHJpbmcgPSAnLnZvcnRleF9iYWNrdXAnO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9uV2lsbERlcGxveShjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlSWQ6IHN0cmluZykge1xyXG4gIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9wcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBEbyBub3RoaW5nLCBwcm9maWxlIGlzIGVpdGhlciB1bmRlZmluZWQsIGJlbG9uZ3MgdG8gYSBkaWZmZXJlbnQgZ2FtZVxyXG4gICAgLy8gIG9yIHBvdGVudGlhbGx5IHRoZSBnYW1lIGlzIHVuZGlzY292ZXJlZC5cclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IGRlcGxveVBheWxvYWQocHJvcHMpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgY29uc3QgdXNlckNhbmNlbGVkID0gKGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkKTtcclxuICAgIGVyclsnYXR0YWNoTG9nT25SZXBvcnQnXSA9IHRydWU7XHJcbiAgICBjb250ZXh0LmFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0ZhaWxlZCB0byBkZXBsb3kgcGF5bG9hZCcsXHJcbiAgICAgIGVyciwgeyBhbGxvd1JlcG9ydDogIXVzZXJDYW5jZWxlZCB9KTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvbkRpZFB1cmdlKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlSWQ6IHN0cmluZykge1xyXG4gIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9wcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBwdXJnZVBheWxvYWQocHJvcHMpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgY29uc3QgdXNlckNhbmNlbGVkID0gKGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkKTtcclxuICAgIGVyclsnYXR0YWNoTG9nT25SZXBvcnQnXSA9IHRydWU7XHJcbiAgICBjb250ZXh0LmFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0ZhaWxlZCB0byByZW1vdmUgcGF5bG9hZCcsXHJcbiAgICAgIGVyciwgeyBhbGxvd1JlcG9ydDogIXVzZXJDYW5jZWxlZCB9KTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHB1cmdlUGF5bG9hZChwcm9wczogSVByb3BzKSB7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IGF3YWl0IHdhbGtEaXJQYXRoKFBBWUxPQURfUEFUSCk7XHJcbiAgICBjb25zdCBzcmNQYXRoID0gUEFZTE9BRF9QQVRIO1xyXG4gICAgY29uc3QgZGVzdFBhdGggPSBwcm9wcy5kaXNjb3ZlcnkucGF0aDtcclxuICAgIGNvbnN0IGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10gPSBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aCwgZGVzdFBhdGgsIGZpbGVFbnRyaWVzKTtcclxuICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKGluc3RyLmRlc3RpbmF0aW9uKVxyXG4gICAgICAgIC5jYXRjaCh7IGNvZGU6ICdFTk9FTlQnIH0sICgpID0+IFByb21pc2UucmVzb2x2ZSgpKTtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHRocm93IGVycjtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUxhdGVzdChpbnN0cnVjdGlvbjogdHlwZXMuSUluc3RydWN0aW9uKSB7XHJcbiAgLy8gV2hlbiBkZXBsb3lpbmcgdGhlIHBheWxvYWQsIHdlIG1heSBlbmNvdW50ZXIgdGhlIEVFWElTVCBlcnJvclxyXG4gIC8vICBjb2RlLiBXZSBhbHdheXMgYXNzdW1lIHRoYXQgdGhlIEJlcEluRXggYXNzZW1ibGllcyB0aGF0IGNvbWUgd2l0aFxyXG4gIC8vICB0aGUgZ2FtZSBleHRlbnNpb24gYXJlIHRoZSBsYXRlc3QgYXNzZW1ibGllcyBhbmQgdGhlcmVmb3JlIHdlIG5lZWRcclxuICAvLyAgdG8gZW5zdXJlIHRoYXQgd2hlbmV2ZXIgd2UgZW5jb3VudGVyIEVFWElTVCwgd2UgY2hlY2sgaWYgdGhlXHJcbiAgLy8gIGhhc2ggb2YgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gbWF0Y2ggLSBpZiB0aGV5IGRvbid0IC0gcmVwbGFjZVxyXG4gIC8vICB0aGUgZXhpc3RpbmcgZGVwbG95ZWQgYXNzZW1ibHkuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHNyY0hhc2ggPSBhd2FpdCBnZXRIYXNoKGluc3RydWN0aW9uLnNvdXJjZSk7XHJcbiAgICBjb25zdCBkZXN0SGFzaCA9IGF3YWl0IGdldEhhc2goaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pO1xyXG4gICAgaWYgKGRlc3RIYXNoICE9PSBzcmNIYXNoKSB7XHJcbiAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhwYXRoLmRpcm5hbWUoaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pKTtcclxuICAgICAgYXdhaXQgZnMuY29weUFzeW5jKGluc3RydWN0aW9uLnNvdXJjZSwgaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgaWYgKGVyci5jb2RlID09PSAnRU5PRU5UJykge1xyXG4gICAgICAvLyBXZSBhc3N1bWUgdGhhdCBpdCdzIHRoZSBkZXN0aW5hdGlvbiBmaWxlIHRoYXQgd2FzIHNvbWVob3cgcmVtb3ZlZC5cclxuICAgICAgLy8gIElmIGl0J3MgdGhlIHNvdXJjZSAtIHRoZSB1c2VyIGNsZWFybHkgaGFzIGEgY29ycnB1dCBpbnN0YWxsYXRpb24gb2ZcclxuICAgICAgLy8gIHRoaXMgZXh0ZW5zaW9uLCBpbiB3aGljaCBjYXNlIGl0J3Mgb2sgdG8gY3Jhc2gvZXJyb3Igb3V0LlxyXG4gICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgICAgYXdhaXQgZnMuY29weUFzeW5jKGluc3RydWN0aW9uLnNvdXJjZSwgaW5zdHJ1Y3Rpb24uZGVzdGluYXRpb24pO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZGVwbG95UGF5bG9hZChwcm9wczogSVByb3BzKSB7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IGF3YWl0IHdhbGtEaXJQYXRoKFBBWUxPQURfUEFUSCk7XHJcbiAgICBjb25zdCBzcmNQYXRoID0gUEFZTE9BRF9QQVRIO1xyXG4gICAgY29uc3QgZGVzdFBhdGggPSBwcm9wcy5kaXNjb3ZlcnkucGF0aDtcclxuICAgIGNvbnN0IGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10gPSBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aCwgZGVzdFBhdGgsIGZpbGVFbnRyaWVzKTtcclxuICAgIGZvciAoY29uc3QgaW5zdHIgb2YgaW5zdHJ1Y3Rpb25zKSB7XHJcbiAgICAgIGlmIChwYXRoLmJhc2VuYW1lKGluc3RyLnNvdXJjZSkudG9Mb3dlckNhc2UoKSA9PT0gRE9PUlNUT1BQRVJfSE9PSykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBDaGVjayBpZiBJblNsaW0gaXMgaW5zdGFsbGVkIGFuZCBpcyBvdmVyd3JpdGluZyBvdXIgZG9vcnN0b3BwZXIuXHJcbiAgICAgICAgICBhd2FpdCBmcy5zdGF0QXN5bmMoaW5zdHIuZGVzdGluYXRpb24gKyBCQUNLVVBfRVhUKTtcclxuICAgICAgICAgIGluc3RyLmRlc3RpbmF0aW9uID0gaW5zdHIuZGVzdGluYXRpb24gKyBCQUNLVVBfRVhUO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgLy8gbm9wXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGF3YWl0IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5kaXJuYW1lKGluc3RyLmRlc3RpbmF0aW9uKSk7XHJcbiAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhpbnN0ci5zb3VyY2UsIGluc3RyLmRlc3RpbmF0aW9uKVxyXG4gICAgICAgIC5jYXRjaCh7IGNvZGU6ICdFRVhJU1QnIH0sICgpID0+IGVuc3VyZUxhdGVzdChpbnN0cikpO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgdGhyb3cgZXJyO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY2FsY0hhc2hJbXBsKGZpbGVQYXRoOiBzdHJpbmcpIHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgY29uc3QgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKTtcclxuICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZVBhdGgpO1xyXG4gICAgc3RyZWFtLm9uKCdyZWFkYWJsZScsICgpID0+IHtcclxuICAgICAgY29uc3QgZGF0YSA9IHN0cmVhbS5yZWFkKCk7XHJcbiAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgaGFzaC51cGRhdGUoZGF0YSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgc3RyZWFtLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKGhhc2guZGlnZXN0KCdoZXgnKSkpO1xyXG4gICAgc3RyZWFtLm9uKCdlcnJvcicsIHJlamVjdCk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEhhc2goZmlsZVBhdGg6IHN0cmluZywgdHJpZXM6IG51bWJlciA9IDMpIHtcclxuICByZXR1cm4gY2FsY0hhc2hJbXBsKGZpbGVQYXRoKVxyXG4gICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgIGlmIChbJ0VNRklMRScsICdFQkFERiddLmluY2x1ZGVzKGVyclsnY29kZSddKSAmJiAodHJpZXMgPiAwKSkge1xyXG4gICAgICAgIHJldHVybiBnZXRIYXNoKGZpbGVQYXRoLCB0cmllcyAtIDEpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxufVxyXG4iXX0=