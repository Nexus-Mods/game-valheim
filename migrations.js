"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate102 = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const semver_1 = __importDefault(require("semver"));
function migrate102(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.2')) {
        return bluebird_1.default.resolve();
    }
    const t = api.translate;
    api.sendNotification({
        message: 'Ingame Mod Configuration Manager added.',
        type: 'info',
        allowSuppress: false,
        actions: [
            {
                title: 'More',
                action: (dismiss) => {
                    api.showDialog('info', 'Ingame Mod Configuration Manager added', {
                        bbcode: t('Some (but not all) Valheim mods come with configuration files allowing '
                            + 'you to tweak mod specific settings. Once you\'ve installed one or several '
                            + 'such mods, you can bring up the mod configuration manager ingame by pressing F1.'
                            + '[br][/br][br][/br]'
                            + 'Any settings you change ingame should be applied immediately and will be saved '
                            + 'to the mods\' config files.'),
                    }, [{ label: 'Close', action: () => dismiss(), default: true }]);
                },
            },
        ],
    });
}
exports.migrate102 = migrate102;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZ3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQStCO0FBQy9CLG9EQUE0QjtBQUc1QixTQUFnQixVQUFVLENBQUMsR0FBd0IsRUFBRSxVQUFrQjtJQUNyRSxJQUFJLGdCQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtRQUNuQyxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBRXhCLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNuQixPQUFPLEVBQUUseUNBQXlDO1FBQ2xELElBQUksRUFBRSxNQUFNO1FBQ1osYUFBYSxFQUFFLEtBQUs7UUFDcEIsT0FBTyxFQUFFO1lBQ1A7Z0JBQ0UsS0FBSyxFQUFFLE1BQU07Z0JBQ2IsTUFBTSxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUU7b0JBQ2xCLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLHdDQUF3QyxFQUMvRDt3QkFDRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLHlFQUF5RTs4QkFDL0UsNEVBQTRFOzhCQUM1RSxrRkFBa0Y7OEJBQ2xGLG9CQUFvQjs4QkFDcEIsaUZBQWlGOzhCQUNqRiw2QkFBNkIsQ0FBQztxQkFDbkMsRUFDRCxDQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFFLENBQUMsQ0FBQztnQkFDbEUsQ0FBQzthQUNGO1NBQ0Y7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBN0JELGdDQTZCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQcm9taXNlIGZyb20gJ2JsdWViaXJkJztcclxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5pbXBvcnQgeyB0eXBlcyB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDIoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBvbGRWZXJzaW9uOiBzdHJpbmcpIHtcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjInKSkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcblxyXG4gIGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgIG1lc3NhZ2U6ICdJbmdhbWUgTW9kIENvbmZpZ3VyYXRpb24gTWFuYWdlciBhZGRlZC4nLFxyXG4gICAgdHlwZTogJ2luZm8nLFxyXG4gICAgYWxsb3dTdXBwcmVzczogZmFsc2UsXHJcbiAgICBhY3Rpb25zOiBbXHJcbiAgICAgIHtcclxuICAgICAgICB0aXRsZTogJ01vcmUnLFxyXG4gICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IHtcclxuICAgICAgICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ0luZ2FtZSBNb2QgQ29uZmlndXJhdGlvbiBNYW5hZ2VyIGFkZGVkJyxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgYmJjb2RlOiB0KCdTb21lIChidXQgbm90IGFsbCkgVmFsaGVpbSBtb2RzIGNvbWUgd2l0aCBjb25maWd1cmF0aW9uIGZpbGVzIGFsbG93aW5nICdcclxuICAgICAgICAgICAgICArICd5b3UgdG8gdHdlYWsgbW9kIHNwZWNpZmljIHNldHRpbmdzLiBPbmNlIHlvdVxcJ3ZlIGluc3RhbGxlZCBvbmUgb3Igc2V2ZXJhbCAnXHJcbiAgICAgICAgICAgICAgKyAnc3VjaCBtb2RzLCB5b3UgY2FuIGJyaW5nIHVwIHRoZSBtb2QgY29uZmlndXJhdGlvbiBtYW5hZ2VyIGluZ2FtZSBieSBwcmVzc2luZyBGMS4nXHJcbiAgICAgICAgICAgICAgKyAnW2JyXVsvYnJdW2JyXVsvYnJdJ1xyXG4gICAgICAgICAgICAgICsgJ0FueSBzZXR0aW5ncyB5b3UgY2hhbmdlIGluZ2FtZSBzaG91bGQgYmUgYXBwbGllZCBpbW1lZGlhdGVseSBhbmQgd2lsbCBiZSBzYXZlZCAnXHJcbiAgICAgICAgICAgICAgKyAndG8gdGhlIG1vZHNcXCcgY29uZmlnIGZpbGVzLicpLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIFsgeyBsYWJlbDogJ0Nsb3NlJywgYWN0aW9uOiAoKSA9PiBkaXNtaXNzKCksIGRlZmF1bHQ6IHRydWUgfSBdKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgXSxcclxuICB9KTtcclxufVxyXG4iXX0=