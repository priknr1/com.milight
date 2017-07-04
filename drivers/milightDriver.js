'use strict';

const Homey = require('homey');

const onecolor = require('onecolor');

const MilightDevice = require('./milightDevice');

class MilightDriver extends Homey.Driver {

	/**
	 * Method that will be called when a driver is initialized. It will register Flow Cards
	 * for the respective drivers. Options parameter should at least contain a driverType
	 * property.
	 * @param options {Object}
	 * @returns {Error}
	 */
	onInit(options) {
		if (!options.hasOwnProperty('driverType')) return new Error('missing_driver_type');

		// Store driverType
		this.driverType = options.driverType;

		// Register Flow Cards for RGB, RGBW and RGBWW
		if (this.driverType.includes('RGB')) {
			new Homey.FlowCardAction('set_color_rgb')
				.on('run', (args, state, callback) => {
					const myColor = onecolor(args.color);
					args.color = myColor.hue();
					args.device.onCapabilityLightHue(args.color)
						.then(() => callback(null, true))
						.catch(err => callback(err));
				})
				.register();

			// Register Flow Cards for RGBW and RGBWW
			if (this.driverType.includes('RGBW')) {
				new Homey.FlowCardAction('white_mode')
					.on('run', (args, state, callback) => {
						args.device.onCapabilityLightMode('temperature')
							.then(() => callback(null, true))
							.catch(err => callback(err));
					})
					.register();
				new Homey.FlowCardAction('disco_mode')
					.on('run', (args, state, callback) => {
						args.device.onCapabilityLightMode('disco')
							.then(() => callback(null, true))
							.catch(err => callback(err));
					})
					.register();
				new Homey.FlowCardAction('disco_mode_specific')
					.on('run', (args, state, callback) => {
						args.device.onCapabilityLightMode(Number(args.mode))
							.then(() => callback(null, true))
							.catch(err => callback(err));
					})
					.register();
				new Homey.FlowCardAction('enable_night_mode')
					.on('run', (args, state, callback) => {
						args.device.onCapabilityLightMode('night')
							.then(() => callback(null, true))
							.catch(err => callback(err));
					})
					.register();
			}
		}
	}


	/**
	 * Always use MilightDevice as device for this driver.
	 * @returns {MilightDevice}
	 */
	onMapDeviceClass() {
		return MilightDevice;
	}

	/**
	 * Method that will be called upon pairing. It handles discovering bridges for all types
	 * of drivers. After pairing is ended it removes the bridges it found that were not added.
	 * @param socket
	 */
	onPair(socket) {
		socket.on('list_devices', (data, callback) => {
			Homey.app.BridgeManager.discoverBridges({ temp: true })
				.then(bridges => {
					const results = [];
					for (let i = 0; i < bridges.length; i++) {
						const zones = bridges[i].getZones(this.driverType);
						for (let j = 0; j < zones.length; j++) {
							results.push({
								name: (bridges[i].bridgeVersion === 6) ? `iBox Bridge ${parseInt(i) + 1} ${zones[j].name}` : `Bridge ${parseInt(i) + 1} ${zones[j].name}`,
								data: {
									id: zones[j].id,
									bridgeMacAddress: bridges[i].mac,
									zoneNumber: parseInt(j) + 1,
									driverType: this.driverType,
								},
							});
						}
					}
					return callback(null, results);
				})
				.catch(err => callback(err, false));
		});
		socket.on('disconnect', () => setTimeout(() => Homey.app.BridgeManager.deregisterTempBridges, 30000));
	}
}

module.exports = MilightDriver;
