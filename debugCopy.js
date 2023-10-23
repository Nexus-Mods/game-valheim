/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const sevenZip = require('node-7z');

const sourceArchive = 'game-valheim.7z';
const destinationDirectory = path.join(process.env.APPDATA, 'vortex_devel', 'plugins');

const copyArchive = (source, destination) => {
  const sourceStream = fs.createReadStream(source);
  const destinationPath = path.join(destination, path.basename(source));

  const destinationStream = fs.createWriteStream(destinationPath);

  sourceStream.pipe(destinationStream);

  destinationStream.on('close', () => {
    console.log('Archive copied to destination directory.');
    extractArchive(destinationPath, destination);
  });

  destinationStream.on('error', (error) => {
    console.error('Error copying archive:', error);
  });
};

const removeArchive = (archivePath) => {
  fs.unlink(archivePath, (unlinkErr) => {
    if (unlinkErr) {
      console.error('Error removing archive:', unlinkErr);
    } else {
      console.log('Archive removed from the destination directory.');
    }
  });
};

const removeFolderRecursive = (folderPath) => {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        removeFolderRecursive(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });

    fs.rmdirSync(folderPath);
  }
}

const extractArchive = async (archivePath, destination) => {
  const destinationPath = path.join(destination, path.basename(archivePath, '.7z'));
  removeFolderRecursive(destinationPath);
  const seven = new sevenZip();
  await seven.extractFull(archivePath, destinationPath);
  removeArchive(archivePath);
};

copyArchive(sourceArchive, destinationDirectory);