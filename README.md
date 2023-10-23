# Requirements

Before we get started, this guide assumes that you have installed Valheim and Vortex at their default locations. You will also need to be logged in to your Nexus Mods account in Vortex.

Please see: [Getting Started with Vortex](/en/vortex/users/getting-started)

# Getting Set Up

Open up Vortex and navigate to the Games page. Use the 'Manage' button on the game tile to add it to your managed games. If you can’t see Valheim, you can scan for it or define it manually.

Valheim modding requires the BepInEx mod injector for the game to load most mods - the Vortex extension is distributed with a tested version of the BepInEx payload which we confirmed works with
the latest game version. This package will need to be updated regularly as the game gets updated in order to maintain mod functionality. Updating the payload can be done in two separate ways which
we will cover later in this readme.

Valheim itself is distributed with stripped dotnet assemblies which hinders modding potential. On first load and on every deployment event, Vortex will download the latest version of denikson's
unstripped assemblies for Valheim which are required for all mods to function correctly - denikson's package will be installed as a mod which can be enabled/disabled like any other mod for testing purposes,
but it's highly advised to always keep it enabled.

# Dependencies

### BepInEx

As mentioned before, Valheim requires BepInEx to load mods into the game as the game doesn't have official mod support ([BepInEx](https://github.com/BepInEx/BepInEx))

### Denikson's unstripped assemblies for Valheim

The unstripped game/dotnet assemblies are required to provide better mod support [Denikson's ustripped assemblies](https://valheim.thunderstore.io/package/denikson/BepInExPack_Valheim/)

# Troubleshooting

See below for known problems and fixes to common modding problems

### Known Issues

* During the game's Early Access period, an additional mod injector library was developed in an attempt to mod the game - [InSlimVML](https://github.com/PJninja/InSlimVML) and at this point is seen as deprecated. Vortex's BepInEx payload includes a plugin which means to run any mods developed for InSlimVML using BepInEx. However, we can't guarantee mods that are developed for InSlimVML to load correctly.

* The BepInEx payload and Denikson's unstripped assemblies package may become outdated whenever a major game update occurs causing mods to break. As is the case with most games, you will have to exercise some patience while the packages and mods get updated. Vortex downloading a new version of Denikson's package is a clear sign that the modding community has started reacting to the change.

* Game asset replacers such as [HD Mods](https://www.nexusmods.com/valheim/mods/302) are not officially supported due issues that may arise when the game updates. Depending on how the mod is packaged, these mods can be functional if their modType is manually changed to "Engine Injector" which should deploy the files correctly. Please note you may be required to re-download and re-install such mods whenever a game update is released.

### Vortex's BepInEx payload

Vortex's payload includes a tested BepInEx package (5.4.22 at this time) added with the InSlimVML plugin and "vortex-worlds" which users can use to load different world mods from the website. The payload itself can be modified using Vortex's "Update BepInEx" button found on the mods page which will allow users to replace the payload with official BepInEx [releases](https://github.com/BepInEx/BepInEx/releases) found on Github.
Alternatively, the payload can be modified manually - clicking the "Open BepInEx Payload Folder" button in the mods page will open its location in your file explorer/browser. Any changes to the payload's directory structure will be reflected in the game's root directory whenever a deployment event occurs. It's HIGHLY advised not to add files to the payload which aren't part of the BepInEx package.

### Extra information
* You can check Valheim version information by going Vortex > Extensions > Click 'Show bundled' > Game: Valheim > Version should be greater than 1.1.0
* Purging your mods will also remove the BepInEx payload but will leave any configuration files behind (`BepInEx/config/*.cfg`)

# Further Support

* [Vortex Support (Nexus Forums) ](https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/)
* [Vortex Support (Discord)](https://discord.com/channels/215154001799413770/408252140533055499)
