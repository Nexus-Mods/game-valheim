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
            err['attachLogOnReport'] = true;
            context.api.showErrorNotification('Failed to deploy payload', err);
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
            err['attachLogOnReport'] = true;
            context.api.showErrorNotification('Failed to remove payload', err);
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
            const instructions = genInstructions(props, fileEntries);
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
            const instructions = genInstructions(props, fileEntries);
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
function genInstructions(props, entries) {
    const srcPath = PAYLOAD_PATH;
    const destPath = props.discovery.path;
    return entries.filter(entry => !entry.isDirectory)
        .reduce((accum, iter) => {
        const destination = iter.filePath.replace(srcPath, destPath);
        accum.push({
            type: 'copy',
            source: iter.filePath,
            destination,
        });
        return accum;
    }, []);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bG9hZERlcGxveWVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicGF5bG9hZERlcGxveWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUE0QjtBQUM1QixnREFBd0I7QUFFeEIsMkNBQXNFO0FBRXRFLHFDQUEyRTtBQUUzRSxNQUFNLFlBQVksR0FBRyxjQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzVELE1BQU0sVUFBVSxHQUFXLGdCQUFnQixDQUFDO0FBRTVDLFNBQXNCLFlBQVksQ0FBQyxPQUFnQyxFQUNoQyxTQUFpQjs7UUFDbEQsTUFBTSxLQUFLLEdBQVcsaUJBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbkQsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBR3ZCLE9BQU87U0FDUjtRQUNELElBQUk7WUFDRixNQUFNLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM1QjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osR0FBRyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQ2hDLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsMEJBQTBCLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDcEU7SUFDSCxDQUFDO0NBQUE7QUFkRCxvQ0FjQztBQUVELFNBQXNCLFVBQVUsQ0FBQyxPQUFnQyxFQUNoQyxTQUFpQjs7UUFDaEQsTUFBTSxLQUFLLEdBQVcsaUJBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbkQsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1lBQ3ZCLE9BQU87U0FDUjtRQUNELElBQUk7WUFDRixNQUFNLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMzQjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osR0FBRyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQ2hDLE9B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Q0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFO1lBQzVELE9BQU8sT0FBTyxDQUFDLFFBQVEsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7U0FDckM7YUFBTTtZQUNMLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUM1QjtJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ1AsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLEtBQWEsRUFBRSxPQUFpQjtJQUN2RCxNQUFNLE9BQU8sR0FBRyxZQUFZLENBQUM7SUFDN0IsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7SUFDdEMsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO1NBQy9DLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUN0QixNQUFNLFdBQVcsR0FBVyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDckUsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULElBQUksRUFBRSxNQUFNO1lBQ1osTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3JCLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNYLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBJRW50cnkgfSBmcm9tICd0dXJib3dhbGsnO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgeyBET09SU1RPUFBFUl9IT09LLCBnZW5Qcm9wcywgSVByb3BzLCB3YWxrRGlyUGF0aCB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmNvbnN0IFBBWUxPQURfUEFUSCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICdCZXBJbkV4UGF5bG9hZCcpO1xyXG5jb25zdCBCQUNLVVBfRVhUOiBzdHJpbmcgPSAnLnZvcnRleF9iYWNrdXAnO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9uV2lsbERlcGxveShjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlSWQ6IHN0cmluZykge1xyXG4gIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9wcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBEbyBub3RoaW5nLCBwcm9maWxlIGlzIGVpdGhlciB1bmRlZmluZWQsIGJlbG9uZ3MgdG8gYSBkaWZmZXJlbnQgZ2FtZVxyXG4gICAgLy8gIG9yIHBvdGVudGlhbGx5IHRoZSBnYW1lIGlzIHVuZGlzY292ZXJlZC5cclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IGRlcGxveVBheWxvYWQocHJvcHMpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgZXJyWydhdHRhY2hMb2dPblJlcG9ydCddID0gdHJ1ZTtcclxuICAgIGNvbnRleHQuYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRmFpbGVkIHRvIGRlcGxveSBwYXlsb2FkJywgZXJyKTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvbkRpZFB1cmdlKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9maWxlSWQ6IHN0cmluZykge1xyXG4gIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0LCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9wcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBwdXJnZVBheWxvYWQocHJvcHMpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgZXJyWydhdHRhY2hMb2dPblJlcG9ydCddID0gdHJ1ZTtcclxuICAgIGNvbnRleHQuYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRmFpbGVkIHRvIHJlbW92ZSBwYXlsb2FkJywgZXJyKTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHB1cmdlUGF5bG9hZChwcm9wczogSVByb3BzKSB7XHJcbiAgaWYgKHByb3BzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IGF3YWl0IHdhbGtEaXJQYXRoKFBBWUxPQURfUEFUSCk7XHJcbiAgICBjb25zdCBpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdID0gZ2VuSW5zdHJ1Y3Rpb25zKHByb3BzLCBmaWxlRW50cmllcyk7XHJcbiAgICBmb3IgKGNvbnN0IGluc3RyIG9mIGluc3RydWN0aW9ucykge1xyXG4gICAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhpbnN0ci5kZXN0aW5hdGlvbilcclxuICAgICAgICAuY2F0Y2goeyBjb2RlOiAnRU5PRU5UJyB9LCAoKSA9PiBQcm9taXNlLnJlc29sdmUoKSk7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICB0aHJvdyBlcnI7XHJcbiAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVMYXRlc3QoaW5zdHJ1Y3Rpb246IHR5cGVzLklJbnN0cnVjdGlvbikge1xyXG4gIC8vIFdoZW4gZGVwbG95aW5nIHRoZSBwYXlsb2FkLCB3ZSBtYXkgZW5jb3VudGVyIHRoZSBFRVhJU1QgZXJyb3JcclxuICAvLyAgY29kZS4gV2UgYWx3YXlzIGFzc3VtZSB0aGF0IHRoZSBCZXBJbkV4IGFzc2VtYmxpZXMgdGhhdCBjb21lIHdpdGhcclxuICAvLyAgdGhlIGdhbWUgZXh0ZW5zaW9uIGFyZSB0aGUgbGF0ZXN0IGFzc2VtYmxpZXMgYW5kIHRoZXJlZm9yZSB3ZSBuZWVkXHJcbiAgLy8gIHRvIGVuc3VyZSB0aGF0IHdoZW5ldmVyIHdlIGVuY291bnRlciBFRVhJU1QsIHdlIGNoZWNrIGlmIHRoZVxyXG4gIC8vICBoYXNoIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIG1hdGNoIC0gaWYgdGhleSBkb24ndCAtIHJlcGxhY2VcclxuICAvLyAgdGhlIGV4aXN0aW5nIGRlcGxveWVkIGFzc2VtYmx5LlxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzcmNIYXNoID0gYXdhaXQgZ2V0SGFzaChpbnN0cnVjdGlvbi5zb3VyY2UpO1xyXG4gICAgY29uc3QgZGVzdEhhc2ggPSBhd2FpdCBnZXRIYXNoKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgIGlmIChkZXN0SGFzaCAhPT0gc3JjSGFzaCkge1xyXG4gICAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhpbnN0cnVjdGlvbi5kZXN0aW5hdGlvbik7XHJcbiAgICAgIGF3YWl0IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5kaXJuYW1lKGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKSk7XHJcbiAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhpbnN0cnVjdGlvbi5zb3VyY2UsIGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGlmIChlcnIuY29kZSA9PT0gJ0VOT0VOVCcpIHtcclxuICAgICAgLy8gV2UgYXNzdW1lIHRoYXQgaXQncyB0aGUgZGVzdGluYXRpb24gZmlsZSB0aGF0IHdhcyBzb21laG93IHJlbW92ZWQuXHJcbiAgICAgIC8vICBJZiBpdCdzIHRoZSBzb3VyY2UgLSB0aGUgdXNlciBjbGVhcmx5IGhhcyBhIGNvcnJwdXQgaW5zdGFsbGF0aW9uIG9mXHJcbiAgICAgIC8vICB0aGlzIGV4dGVuc2lvbiwgaW4gd2hpY2ggY2FzZSBpdCdzIG9rIHRvIGNyYXNoL2Vycm9yIG91dC5cclxuICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhpbnN0cnVjdGlvbi5kZXN0aW5hdGlvbik7XHJcbiAgICAgIGF3YWl0IGZzLmNvcHlBc3luYyhpbnN0cnVjdGlvbi5zb3VyY2UsIGluc3RydWN0aW9uLmRlc3RpbmF0aW9uKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGRlcGxveVBheWxvYWQocHJvcHM6IElQcm9wcykge1xyXG4gIGlmIChwcm9wcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBmaWxlRW50cmllczogSUVudHJ5W10gPSBhd2FpdCB3YWxrRGlyUGF0aChQQVlMT0FEX1BBVEgpO1xyXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSA9IGdlbkluc3RydWN0aW9ucyhwcm9wcywgZmlsZUVudHJpZXMpO1xyXG4gICAgZm9yIChjb25zdCBpbnN0ciBvZiBpbnN0cnVjdGlvbnMpIHtcclxuICAgICAgaWYgKHBhdGguYmFzZW5hbWUoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpID09PSBET09SU1RPUFBFUl9IT09LKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIC8vIENoZWNrIGlmIEluU2xpbSBpcyBpbnN0YWxsZWQgYW5kIGlzIG92ZXJ3cml0aW5nIG91ciBkb29yc3RvcHBlci5cclxuICAgICAgICAgIGF3YWl0IGZzLnN0YXRBc3luYyhpbnN0ci5kZXN0aW5hdGlvbiArIEJBQ0tVUF9FWFQpO1xyXG4gICAgICAgICAgaW5zdHIuZGVzdGluYXRpb24gPSBpbnN0ci5kZXN0aW5hdGlvbiArIEJBQ0tVUF9FWFQ7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAvLyBub3BcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgYXdhaXQgZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhwYXRoLmRpcm5hbWUoaW5zdHIuZGVzdGluYXRpb24pKTtcclxuICAgICAgYXdhaXQgZnMuY29weUFzeW5jKGluc3RyLnNvdXJjZSwgaW5zdHIuZGVzdGluYXRpb24pXHJcbiAgICAgICAgLmNhdGNoKHsgY29kZTogJ0VFWElTVCcgfSwgKCkgPT4gZW5zdXJlTGF0ZXN0KGluc3RyKSk7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICB0aHJvdyBlcnI7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBjYWxjSGFzaEltcGwoZmlsZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBoYXNoID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpO1xyXG4gICAgY29uc3Qgc3RyZWFtID0gZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlUGF0aCk7XHJcbiAgICBzdHJlYW0ub24oJ3JlYWRhYmxlJywgKCkgPT4ge1xyXG4gICAgICBjb25zdCBkYXRhID0gc3RyZWFtLnJlYWQoKTtcclxuICAgICAgaWYgKGRhdGEpIHtcclxuICAgICAgICBoYXNoLnVwZGF0ZShkYXRhKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBzdHJlYW0ub24oJ2VuZCcsICgpID0+IHJlc29sdmUoaGFzaC5kaWdlc3QoJ2hleCcpKSk7XHJcbiAgICBzdHJlYW0ub24oJ2Vycm9yJywgcmVqZWN0KTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SGFzaChmaWxlUGF0aDogc3RyaW5nLCB0cmllczogbnVtYmVyID0gMykge1xyXG4gIHJldHVybiBjYWxjSGFzaEltcGwoZmlsZVBhdGgpXHJcbiAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgaWYgKFsnRU1GSUxFJywgJ0VCQURGJ10uaW5jbHVkZXMoZXJyWydjb2RlJ10pICYmICh0cmllcyA+IDApKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldEhhc2goZmlsZVBhdGgsIHRyaWVzIC0gMSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZW5JbnN0cnVjdGlvbnMocHJvcHM6IElQcm9wcywgZW50cmllczogSUVudHJ5W10pOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSB7XHJcbiAgY29uc3Qgc3JjUGF0aCA9IFBBWUxPQURfUEFUSDtcclxuICBjb25zdCBkZXN0UGF0aCA9IHByb3BzLmRpc2NvdmVyeS5wYXRoO1xyXG4gIHJldHVybiBlbnRyaWVzLmZpbHRlcihlbnRyeSA9PiAhZW50cnkuaXNEaXJlY3RvcnkpXHJcbiAgICAucmVkdWNlKChhY2N1bSwgaXRlcikgPT4ge1xyXG4gICAgICBjb25zdCBkZXN0aW5hdGlvbjogc3RyaW5nID0gaXRlci5maWxlUGF0aC5yZXBsYWNlKHNyY1BhdGgsIGRlc3RQYXRoKTtcclxuICAgICAgYWNjdW0ucHVzaCh7XHJcbiAgICAgICAgdHlwZTogJ2NvcHknLFxyXG4gICAgICAgIHNvdXJjZTogaXRlci5maWxlUGF0aCxcclxuICAgICAgICBkZXN0aW5hdGlvbixcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiBhY2N1bTtcclxuICAgIH0sIFtdKTtcclxufVxyXG4iXX0=