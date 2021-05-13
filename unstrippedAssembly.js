"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnstrippedAssemblyDownloader = void 0;
const path = __importStar(require("path"));
const vortex_api_1 = require("vortex-api");
class UnstrippedAssemblyDownloader {
    constructor(tempPath) {
        this.mTempPath = tempPath;
    }
    downloadNewest(searchType, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const pred = searchType === 'full_name'
                ? (ent) => ent.full_name === value
                : (ent) => ent.uuid4 === value;
            try {
                const manifestEntry = yield this.findManifestEntry(value, pred);
                const latestVer = manifestEntry.versions[0];
                const dest = path.join(this.mTempPath, latestVer.full_name + '.zip');
                yield this.fetchFileFromUrl(latestVer.download_url, dest);
                return Promise.resolve(dest);
            }
            catch (err) {
                return Promise.reject(err);
            }
        });
    }
    fetchFileFromUrl(url, dest) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield fetch(url);
                const buffer = yield res.arrayBuffer();
                yield vortex_api_1.fs.writeFileAsync(dest, Buffer.from(buffer));
            }
            catch (err) {
                return Promise.reject(err);
            }
        });
    }
    getManifest() {
        return __awaiter(this, void 0, void 0, function* () {
            const tempFilePath = path.join(this.mTempPath, MANIFEST_FILE);
            yield this.fetchFileFromUrl(MANIFEST_URL, tempFilePath);
            const data = yield vortex_api_1.fs.readFileAsync(tempFilePath, { encoding: 'utf8' });
            const manifest = JSON.parse(data);
            return manifest;
        });
    }
    findManifestEntry(value, pred) {
        return __awaiter(this, void 0, void 0, function* () {
            const manifestEntries = yield this.getManifest();
            const entry = manifestEntries.find(pred);
            if (entry === undefined) {
                throw new NotFoundError(value);
            }
            return entry;
        });
    }
}
exports.UnstrippedAssemblyDownloader = UnstrippedAssemblyDownloader;
const MANIFEST_URL = 'https://valheim.thunderstore.io/api/v1/package/';
const MANIFEST_FILE = 'manifest.json';
class NotFoundError extends Error {
    constructor(what) {
        super(`Failed to find entry based on: ${what}`);
        this.name = 'NotFoundError';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5zdHJpcHBlZEFzc2VtYmx5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidW5zdHJpcHBlZEFzc2VtYmx5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyQ0FBNkI7QUFFN0IsMkNBQWdDO0FBRWhDLE1BQWEsNEJBQTRCO0lBRXZDLFlBQVksUUFBZ0I7UUFDMUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7SUFDNUIsQ0FBQztJQUVZLGNBQWMsQ0FBQyxVQUFzQixFQUFFLEtBQWE7O1lBQy9ELE1BQU0sSUFBSSxHQUFHLFVBQVUsS0FBSyxXQUFXO2dCQUNyQyxDQUFDLENBQUMsQ0FBQyxHQUFtQixFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsU0FBUyxLQUFLLEtBQUs7Z0JBQ2xELENBQUMsQ0FBQyxDQUFDLEdBQW1CLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEtBQUssS0FBSyxDQUFDO1lBQ2pELElBQUk7Z0JBQ0YsTUFBTSxhQUFhLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNoRSxNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM1QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsQ0FBQztnQkFDckUsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDMUQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzlCO1lBQUMsT0FBTyxHQUFHLEVBQUU7Z0JBQ1osT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQzVCO1FBQ0gsQ0FBQztLQUFBO0lBRWEsZ0JBQWdCLENBQUMsR0FBVyxFQUFFLElBQVk7O1lBQ3RELElBQUk7Z0JBQ0YsTUFBTSxHQUFHLEdBQUcsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzdCLE1BQU0sTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUN2QyxNQUFNLGVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzthQUNwRDtZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM1QjtRQUNILENBQUM7S0FBQTtJQUVhLFdBQVc7O1lBQ3ZCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUM5RCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDeEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxlQUFFLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1lBQ3hFLE1BQU0sUUFBUSxHQUFxQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BELE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7S0FBQTtJQUVhLGlCQUFpQixDQUFDLEtBQWEsRUFBRSxJQUF3Qzs7WUFDckYsTUFBTSxlQUFlLEdBQXFCLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ25FLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDekMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO2dCQUN2QixNQUFNLElBQUksYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ2hDO1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0tBQUE7Q0FDRjtBQS9DRCxvRUErQ0M7QUFFRCxNQUFNLFlBQVksR0FBRyxpREFBaUQsQ0FBQztBQUN2RSxNQUFNLGFBQWEsR0FBRyxlQUFlLENBQUM7QUFFdEMsTUFBTSxhQUFjLFNBQVEsS0FBSztJQUMvQixZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLGtDQUFrQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxJQUFJLEdBQUcsZUFBZSxDQUFDO0lBQzlCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG5pbXBvcnQgeyBmcyB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGNsYXNzIFVuc3RyaXBwZWRBc3NlbWJseURvd25sb2FkZXIge1xyXG4gIHByaXZhdGUgbVRlbXBQYXRoOiBzdHJpbmc7XHJcbiAgY29uc3RydWN0b3IodGVtcFBhdGg6IHN0cmluZykge1xyXG4gICAgdGhpcy5tVGVtcFBhdGggPSB0ZW1wUGF0aDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBkb3dubG9hZE5ld2VzdChzZWFyY2hUeXBlOiBTZWFyY2hUeXBlLCB2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IHByZWQgPSBzZWFyY2hUeXBlID09PSAnZnVsbF9uYW1lJ1xyXG4gICAgICA/IChlbnQ6IElNYW5pZmVzdEVudHJ5KSA9PiBlbnQuZnVsbF9uYW1lID09PSB2YWx1ZVxyXG4gICAgICA6IChlbnQ6IElNYW5pZmVzdEVudHJ5KSA9PiBlbnQudXVpZDQgPT09IHZhbHVlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgbWFuaWZlc3RFbnRyeSA9IGF3YWl0IHRoaXMuZmluZE1hbmlmZXN0RW50cnkodmFsdWUsIHByZWQpO1xyXG4gICAgICBjb25zdCBsYXRlc3RWZXIgPSBtYW5pZmVzdEVudHJ5LnZlcnNpb25zWzBdO1xyXG4gICAgICBjb25zdCBkZXN0ID0gcGF0aC5qb2luKHRoaXMubVRlbXBQYXRoLCBsYXRlc3RWZXIuZnVsbF9uYW1lICsgJy56aXAnKTtcclxuICAgICAgYXdhaXQgdGhpcy5mZXRjaEZpbGVGcm9tVXJsKGxhdGVzdFZlci5kb3dubG9hZF91cmwsIGRlc3QpO1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGRlc3QpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBmZXRjaEZpbGVGcm9tVXJsKHVybDogc3RyaW5nLCBkZXN0OiBzdHJpbmcpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCk7XHJcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHJlcy5hcnJheUJ1ZmZlcigpO1xyXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGVBc3luYyhkZXN0LCBCdWZmZXIuZnJvbShidWZmZXIpKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgZ2V0TWFuaWZlc3QoKSB7XHJcbiAgICBjb25zdCB0ZW1wRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy5tVGVtcFBhdGgsIE1BTklGRVNUX0ZJTEUpO1xyXG4gICAgYXdhaXQgdGhpcy5mZXRjaEZpbGVGcm9tVXJsKE1BTklGRVNUX1VSTCwgdGVtcEZpbGVQYXRoKTtcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZUFzeW5jKHRlbXBGaWxlUGF0aCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pO1xyXG4gICAgY29uc3QgbWFuaWZlc3Q6IElNYW5pZmVzdEVudHJ5W10gPSBKU09OLnBhcnNlKGRhdGEpO1xyXG4gICAgcmV0dXJuIG1hbmlmZXN0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBmaW5kTWFuaWZlc3RFbnRyeSh2YWx1ZTogc3RyaW5nLCBwcmVkOiAoZW50cnk6IElNYW5pZmVzdEVudHJ5KSA9PiBib29sZWFuKSB7XHJcbiAgICBjb25zdCBtYW5pZmVzdEVudHJpZXM6IElNYW5pZmVzdEVudHJ5W10gPSBhd2FpdCB0aGlzLmdldE1hbmlmZXN0KCk7XHJcbiAgICBjb25zdCBlbnRyeSA9IG1hbmlmZXN0RW50cmllcy5maW5kKHByZWQpO1xyXG4gICAgaWYgKGVudHJ5ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IE5vdEZvdW5kRXJyb3IodmFsdWUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGVudHJ5O1xyXG4gIH1cclxufVxyXG5cclxuY29uc3QgTUFOSUZFU1RfVVJMID0gJ2h0dHBzOi8vdmFsaGVpbS50aHVuZGVyc3RvcmUuaW8vYXBpL3YxL3BhY2thZ2UvJztcclxuY29uc3QgTUFOSUZFU1RfRklMRSA9ICdtYW5pZmVzdC5qc29uJztcclxuXHJcbmNsYXNzIE5vdEZvdW5kRXJyb3IgZXh0ZW5kcyBFcnJvciB7XHJcbiAgY29uc3RydWN0b3Iod2hhdDogc3RyaW5nKSB7XHJcbiAgICBzdXBlcihgRmFpbGVkIHRvIGZpbmQgZW50cnkgYmFzZWQgb246ICR7d2hhdH1gKTtcclxuICAgIHRoaXMubmFtZSA9ICdOb3RGb3VuZEVycm9yJztcclxuICB9XHJcbn1cclxuXHJcbnR5cGUgU2VhcmNoVHlwZSA9ICdmdWxsX25hbWUnIHwgJ3V1aWQ0JztcclxuXHJcbmludGVyZmFjZSBJTWFuaWZlc3RFbnRyeSB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIGZ1bGxfbmFtZTogc3RyaW5nO1xyXG4gIG93bmVyOiBzdHJpbmc7XHJcbiAgcGFja2FnZV91cmw6IHN0cmluZztcclxuICBkYXRlX2NyZWF0ZWQ6IHN0cmluZztcclxuICBkYXRlX3VwZGF0ZWQ6IHN0cmluZztcclxuICB1dWlkNDogc3RyaW5nO1xyXG4gIHJhdGluZ19zY29yZTogbnVtYmVyO1xyXG4gIGlzX3Bpbm5lZDogYm9vbGVhbjtcclxuICBpc19kZXByZWNhdGVkOiBib29sZWFuO1xyXG4gIGhhc19uc2Z3X2NvbnRlbnQ6IGJvb2xlYW47XHJcbiAgY2F0ZWdvcmllczogYW55W107XHJcbiAgdmVyc2lvbnM6IElNYW5pZmVzdEVudHJ5VmVyc2lvbltdO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgSU1hbmlmZXN0RW50cnlWZXJzaW9uIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgZnVsbF9uYW1lOiBzdHJpbmc7XHJcbiAgZGVzY3JpcHRpb246IHN0cmluZztcclxuICBpY29uOiBzdHJpbmc7XHJcbiAgdmVyc2lvbl9udW1iZXI6IHN0cmluZztcclxuICBkZXBlbmRlbmNpZXM6IGFueVtdO1xyXG4gIGRvd25sb2FkX3VybDogc3RyaW5nO1xyXG4gIGRvd25sb2FkczogbnVtYmVyO1xyXG4gIGRhdGVfY3JlYXRlZDogc3RyaW5nO1xyXG4gIHdlYnNpdGVfdXJsOiBzdHJpbmc7XHJcbiAgaXNfYWN0aXZlOiBib29sZWFuO1xyXG4gIHV1aWQ0OiBzdHJpbmc7XHJcbn1cclxuIl19