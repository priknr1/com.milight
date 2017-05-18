'use strict';

// TODO specific scene Flow card: toggleScene(sceneId)
// TODO RGBWW driver
// TODO remove TCP PING dependency, use discover bridges to check availability
// TODO refactor to have a bridge only once in memory to prevent message overflow
// TODO refactor legacy bridge to use node-milight-promise
// TODO add flow card for night mode for bridge and new bulbs?

const Log = require('homey-log').Log;

module.exports.init = () => {
	console.log(`${Homey.manifest.id} running...`);
};
