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
            const fileEntries = yield common_1.walkDirPath(PAYLOAD_PATH);
            const srcPath = PAYLOAD_PATH;
            const destPath = props.discovery.path;
            const instructions = common_1.genInstructions(srcPath, destPath, fileEntries);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bG9hZERlcGxveWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGF5bG9hZERlcGxveWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUE0QjtBQUM1QixnREFBd0I7QUFFeEIsMkNBQTZDO0FBRTdDLHFDQUM0QztBQUU1QyxNQUFNLFlBQVksR0FBRyxjQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzVELE1BQU0sVUFBVSxHQUFXLGdCQUFnQixDQUFDO0FBRTVDLFNBQXNCLFlBQVksQ0FBQyxPQUFnQyxFQUNoQyxTQUFpQjs7UUFDbEQsTUFBTSxLQUFLLEdBQVcsaUJBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbkQsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBR3ZCLE9BQU87U0FDUjtRQUNELElBQUk7WUFDRixNQUFNLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM1QjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLFlBQVksaUJBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN4RCxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQywwQkFBMEIsRUFDMUQsR0FBRyxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztTQUN4QztJQUNILENBQUM7Q0FBQTtBQWhCRCxvQ0FnQkM7QUFFRCxTQUFzQixVQUFVLENBQUMsT0FBZ0MsRUFDaEMsU0FBaUI7O1FBQ2hELE1BQU0sS0FBSyxHQUFXLGlCQUFRLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ25ELElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUN2QixPQUFPO1NBQ1I7UUFDRCxJQUFJO1lBQ0YsTUFBTSxZ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SUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUNuQjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzdCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsT0FBTyxDQUFDLFFBQWdCLEVBQUUsUUFBZ0IsQ0FBQztJQUNsRCxPQUFPLFlBQVksQ0FBQyxRQUFRLENBQUM7U0FDMUIsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ1gsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUU7WUFDNUQsT0FBTyxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztTQUNyQzthQUFNO1lBQ0wsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzVCO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgSUVudHJ5IH0gZnJvbSAndHVyYm93YWxrJztcclxuaW1wb3J0IHsgZnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgeyBET09SU1RPUFBFUl9IT09LLCBHQU1FX0lELCBnZW5JbnN0cnVjdGlvbnMsIGdlblByb3BzLCBJUHJvcHMsXHJcbiAgSVNWTUxfU0tJUCwgd2Fsa0RpclBhdGggfSBmcm9tICcuL2NvbW1vbic7XHJcblxyXG5jb25zdCBQQVlMT0FEX1BBVEggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnQmVwSW5FeFBheWxvYWQnKTtcclxuY29uc3QgQkFDS1VQX0VYVDogc3RyaW5nID0gJy52b3J0ZXhfYmFja3VwJztcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvbldpbGxEZXBsb3koY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvZmlsZUlkOiBzdHJpbmcpIHtcclxuICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCwgcHJvZmlsZUlkKTtcclxuICBpZiAocHJvcHMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gRG8gbm90aGluZywgcHJvZmlsZSBpcyBlaXRoZXIgdW5kZWZpbmVkLCBiZWxvbmdzIHRvIGEgZGlmZmVyZW50IGdhbWVcclxuICAgIC8vICBvciBwb3RlbnRpYWxseSB0aGUgZ2FtZSBpcyB1bmRpc2NvdmVyZWQuXHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBkZXBsb3lQYXlsb2FkKHByb3BzKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnN0IHVzZXJDYW5jZWxlZCA9IChlcnIgaW5zdGFuY2VvZiB1dGlsLlVzZXJDYW5jZWxlZCk7XHJcbiAgICBlcnJbJ2F0dGFjaExvZ09uUmVwb3J0J10gPSB0cnVlO1xyXG4gICAgY29udGV4dC5hcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdGYWlsZWQgdG8gZGVwbG95IHBheWxvYWQnLFxyXG4gICAgICBlcnIsIHsgYWxsb3dSZXBvcnQ6ICF1c2VyQ2FuY2VsZWQgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb25EaWRQdXJnZShjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvZmlsZUlkOiBzdHJpbmcpIHtcclxuICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCwgcHJvZmlsZUlkKTtcclxuICBpZiAocHJvcHMgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICB0cnkge1xyXG4gICAgYXdhaXQgcHVyZ2VQYXlsb2FkKHByb3BzKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnN0IHVzZXJDYW5jZWxlZCA9IChlcnIgaW5zdGFuY2VvZiB1dGlsLlVzZXJDYW5jZWxlZCk7XHJcbiAgICBlcnJbJ2F0dGFjaExvZ09uUmVwb3J0J10gPSB0cnVlO1xyXG4gICAgY29udGV4dC5hcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdGYWlsZWQgdG8gcmVtb3ZlIHBheWxvYWQnLFxyXG4gICAgICBlcnIsIHsgYWxsb3dSZXBvcnQ6ICF1c2VyQ2FuY2VsZWQgfSk7XHJcbiAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBwdXJnZVBheWxvYWQocHJvcHM6IElQcm9wcykge1xyXG4gIGlmIChwcm9wcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBmaWxlRW50cmllczogSUVudHJ5W10gPSBhd2FpdCB3YWxrRGlyUGF0aChQQVlMT0FEX1BBVEgpO1xyXG4gICAgY29uc3Qgc3JjUGF0aCA9IFBBWUxPQURfUEFUSDtcclxuICAgIGNvbnN0IGRlc3RQYXRoID0gcHJvcHMuZGlzY292ZXJ5LnBhdGg7XHJcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdID0gZ2VuSW5zdHJ1Y3Rpb25zKHNyY1BhdGgsIGRlc3RQYXRoLCBmaWxlRW50cmllcyk7XHJcbiAgICBmb3IgKGNvbnN0IGluc3RyIG9mIGluc3RydWN0aW9ucykge1xyXG4gICAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhpbnN0ci5kZXN0aW5hdGlvbilcclxuICAgICAgICAuY2F0Y2goeyBjb2RlOiAnRU5PRU5UJyB9LCAoKSA9PiBQcm9taXNlLnJlc29sdmUoKSk7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICB0aHJvdyBlcnI7XHJcbiAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVMYXRlc3QoaW5zdHJ1Y3Rpb246IHR5cGVzLklJbnN0cnVjdGlvbikge1xyXG4gIC8vIFdoZW4gZGVwbG95aW5nIHRoZSBwYXlsb2FkLCB3ZSBtYXkgZW5jb3VudGVyIHRoZSBFRVhJU1QgZXJyb3JcclxuICAvLyAgY29kZS4gV2UgYWx3YXlzIGFzc3VtZSB0aGF0IHRoZSBCZXBJbkV4IGFzc2VtYmxpZXMgdGhhdCBjb21lIHdpdGhcclxuICAvLyAgdGhlIGdhbWUgZXh0ZW5zaW9uIGFyZSB0aGUgbGF0ZXN0IGFzc2VtYmxpZXMgYW5kIHRoZXJlZm9yZSB3ZSBuZWVkXHJcbiAgLy8gIHRvIGVuc3VyZSB0aGF0IHdoZW5ldmVyIHdlIGVuY291bnRlciBFRVhJU1QsIHdlIGNoZWNrIGlmIHRoZVxyXG4gIC8vICBoYXNoIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIG1hdGNoIC0gaWYgdGhleSBkb24ndCAtIHJlcGxhY2VcclxuICAvLyAgdGhlIGV4aXN0aW5nIGRlcGxveWVkIGFzc2VtYmx5LlxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzcmNIYXNoID0gYXdhaXQgZ2V0SGFzaChpbnN0cnVjdGlvbi5zb3VyY2UpO1xyXG4gICAgY29uc3QgZGVzdEhhc2ggPSBhd2FpdCBnZXRIYXNoKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgIGlmIChkZXN0SGFzaCAhPT0gc3JjSGFzaCkge1xyXG4gICAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhpbnN0cnVjdGlvbi5kZXN0aW5hdGlvbik7XHJcbiAgICAgIGF3YWl0IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5kaXJuYW1lKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKSk7XHJcbiAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhpbnN0cnVjdGlvbi5zb3VyY2UsIGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VOT0VOVCcpIHtcclxuICAgICAgLy8gV2UgYXNzdW1lIHRoYXQgaXQncyB0aGUgZGVzdGluYXRpb24gZmlsZSB0aGF0IHdhcyBzb21laG93IHJlbW92ZWQuXHJcbiAgICAgIC8vICBJZiBpdCdzIHRoZSBzb3VyY2UgLSB0aGUgdXNlciBjbGVhcmx5IGhhcyBhIGNvcnJwdXQgaW5zdGFsbGF0aW9uIG9mXHJcbiAgICAgIC8vICB0aGlzIGV4dGVuc2lvbiwgaW4gd2hpY2ggY2FzZSBpdCdzIG9rIHRvIGNyYXNoL2Vycm9yIG91dC5cclxuICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhpbnN0cnVjdGlvbi5kZXN0aW5hdGlvbik7XHJcbiAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhpbnN0cnVjdGlvbi5zb3VyY2UsIGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGlzSVNWTUxFbmFibGVkKHByb3BzOiBJUHJvcHMpIHtcclxuICBjb25zdCBtb2RzID0gdXRpbC5nZXRTYWZlKHByb3BzLnN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgaW5TbGltSWQgPSBPYmplY3Qua2V5cyhtb2RzKS5maW5kKGtleSA9PiBtb2RzW2tleV0udHlwZSA9PT0gJ2luc2xpbXZtbC1tb2QtbG9hZGVyJyk7XHJcbiAgaWYgKGluU2xpbUlkID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIGNvbnN0IG1hbmlmZXN0OiB0eXBlcy5JRGVwbG95bWVudE1hbmlmZXN0ID0gYXdhaXQgdXRpbC5nZXRNYW5pZmVzdChwcm9wcy5hcGksICdpbnNsaW12bWwtbW9kLWxvYWRlcicsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IGlzRGVwbG95ZWQgPSBtYW5pZmVzdC5maWxlcy5sZW5ndGggPiAwO1xyXG4gIHJldHVybiBpc0RlcGxveWVkIHx8IHV0aWwuZ2V0U2FmZShwcm9wcy5wcm9maWxlLCBbJ21vZFN0YXRlJywgaW5TbGltSWQsICdlbmFibGVkJ10sIGZhbHNlKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZGVwbG95UGF5bG9hZChwcm9wczogSVByb3BzKSB7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY29uc3QgaXNWTUxFbmFibGVkID0gYXdhaXQgaXNJU1ZNTEVuYWJsZWQocHJvcHMpO1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBmaWxlRW50cmllczogSUVudHJ5W10gPSBhd2FpdCB3YWxrRGlyUGF0aChQQVlMT0FEX1BBVEgpO1xyXG4gICAgY29uc3Qgc3JjUGF0aCA9IFBBWUxPQURfUEFUSDtcclxuICAgIGNvbnN0IGRlc3RQYXRoID0gcHJvcHMuZGlzY292ZXJ5LnBhdGg7XHJcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdID0gZ2VuSW5zdHJ1Y3Rpb25zKHNyY1BhdGgsIGRlc3RQYXRoLCBmaWxlRW50cmllcyk7XHJcbiAgICBmb3IgKGNvbnN0IGluc3RyIG9mIGluc3RydWN0aW9ucykge1xyXG4gICAgICBpZiAoaXNWTUxFbmFibGVkICYmIGluc3RyLnR5cGUgPT09ICdjb3B5Jykge1xyXG4gICAgICAgIGlmIChJU1ZNTF9TS0lQLmluY2x1ZGVzKHBhdGguYmFzZW5hbWUoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpKSkge1xyXG4gICAgICAgICAgLy8gSWYgSW5TbGltIGlzIGluc3RhbGxlZCBhbmQgZW5hYmxlZCwgZG9uJ3QgYm90aGVyIHdpdGggQklYX1NWTUwgcGF0Y2hlclxyXG4gICAgICAgICAgLy8gIG9yIGl0cyByZXF1aXJlbWVudHNcclxuICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBpZiAocGF0aC5iYXNlbmFtZShpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT09IERPT1JTVE9QUEVSX0hPT0spIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgLy8gQ2hlY2sgaWYgSW5TbGltIGlzIGluc3RhbGxlZCBhbmQgaXMgb3ZlcndyaXRpbmcgb3VyIGRvb3JzdG9wcGVyLlxyXG4gICAgICAgICAgYXdhaXQgZnMuc3RhdEFzeW5jKGluc3RyLmRlc3RpbmF0aW9uICsgQkFDS1VQX0VYVCk7XHJcbiAgICAgICAgICBpbnN0ci5kZXN0aW5hdGlvbiA9IGluc3RyLmRlc3RpbmF0aW9uICsgQkFDS1VQX0VYVDtcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgIC8vIG5vcFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBhd2FpdCBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKHBhdGguZGlybmFtZShpbnN0ci5kZXN0aW5hdGlvbikpO1xyXG4gICAgICBhd2FpdCBmcy5jb3B5QXN5bmMoaW5zdHIuc291cmNlLCBpbnN0ci5kZXN0aW5hdGlvbilcclxuICAgICAgICAuY2F0Y2goeyBjb2RlOiAnRUVYSVNUJyB9LCAoKSA9PiBlbnN1cmVMYXRlc3QoaW5zdHIpKTtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY2FsY0hhc2hJbXBsKGZpbGVQYXRoOiBzdHJpbmcpIHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgY29uc3QgaGFzaCA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKTtcclxuICAgIGNvbnN0IHN0cmVhbSA9IGZzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZVBhdGgpO1xyXG4gICAgc3RyZWFtLm9uKCdyZWFkYWJsZScsICgpID0+IHtcclxuICAgICAgY29uc3QgZGF0YSA9IHN0cmVhbS5yZWFkKCk7XHJcbiAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgaGFzaC51cGRhdGUoZGF0YSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgc3RyZWFtLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKGhhc2guZGlnZXN0KCdoZXgnKSkpO1xyXG4gICAgc3RyZWFtLm9uKCdlcnJvcicsIHJlamVjdCk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEhhc2goZmlsZVBhdGg6IHN0cmluZywgdHJpZXM6IG51bWJlciA9IDMpIHtcclxuICByZXR1cm4gY2FsY0hhc2hJbXBsKGZpbGVQYXRoKVxyXG4gICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgIGlmIChbJ0VNRklMRScsICdFQkFERiddLmluY2x1ZGVzKGVyclsnY29kZSddKSAmJiAodHJpZXMgPiAwKSkge1xyXG4gICAgICAgIHJldHVybiBnZXRIYXNoKGZpbGVQYXRoLCB0cmllcyAtIDEpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxufVxyXG4iXX0=