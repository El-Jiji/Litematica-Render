const nbt = require('nbt');
const fs = require('fs');

const fileData = fs.readFileSync('debug.litematic');

nbt.parse(fileData, (error, data) => {
    if (error) {
        fs.writeFileSync('debug_log.txt', 'Error: ' + error.message, 'utf8');
        return;
    }

    let output = '';
    const log = (msg) => { output += msg + '\n'; console.log(msg); };

    log('Root keys: ' + JSON.stringify(Object.keys(data.value)));

    const regions = data.value.Regions.value;
    const firstRegionName = Object.keys(regions)[0];
    const region = regions[firstRegionName].value;

    log('Region keys: ' + JSON.stringify(Object.keys(region)));

    const palette = region.BlockStatePalette || region.Palette;
    log('Palette found: ' + !!palette);
    if (palette) {
        log('Palette type: ' + palette.type);
        log('Palette value is array? ' + Array.isArray(palette.value));

        if (Array.isArray(palette.value)) {
            log('Palette length: ' + palette.value.length);
            if (palette.value.length > 0) {
                log('First palette entry keys: ' + JSON.stringify(Object.keys(palette.value[0])));
                log('First palette entry Name: ' + JSON.stringify(palette.value[0].Name));
            }
        } else {
            log('Palette value: ' + JSON.stringify(palette.value));
        }
    }

    const blockStates = region.BlockStates;
    if (blockStates) {
        log('BlockStates type: ' + blockStates.type);
        log('BlockStates sample: ' + JSON.stringify(blockStates.value.slice(0, 5)));
    }

    fs.writeFileSync('debug_log.txt', output, 'utf8');
});
