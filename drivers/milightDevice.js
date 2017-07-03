'use strict';

const Homey = require('homey');
const onecolor = require('onecolor');
const HomeyWifiDevice = require('node-homey-wifi-device');

const homeyWifiDeviceOptions = {
	backOffStrategy: {
		randomisationFactor: 0,
		initialDelay: 10000,
		maxDelay: 1000 * 60 * 60, // 1 hour
	},
};

class MilightDevice extends HomeyWifiDevice {

	/**
	 * Method that will be called when a device is initialized. It will bind the capability
	 * listeners specific to the driverType, and it will fetch/search a bridge and stores
	 * a reference to that bridge.
	 */
	onInit() {
		super.onInit(homeyWifiDeviceOptions);

		this.log(`onInit() -> ${this.getData().bridgeMacAddress} - ${this.getData().driverType} - ${this.getData().zoneNumber}`);

		// Get driverType from driver
		this.driverType = this.getDriver().driverType;

		// Start discovery or retrieve already discovered bridge
		Homey.app.BridgeManager.findBridge(this.getData().bridgeMacAddress)
			.then(bridge => {

				// Register that this bridge is being used to prevent it from being destroyed
				Homey.app.BridgeManager.registerBridge(bridge, false);

				// Register this device with the bridge
				bridge.registerDevice(this.getData());

				// Set available and unavailable when bridge is down
				bridge
					.on('offline', () => this.setUnavailable(Homey.__('no_response')))
					.on('online', () => this.setAvailable());

				// Store additional properties
				this.name = `Zone ${this.zoneNumber} ${this.driverType}`;
				this.bridge = bridge;

				// General capability listeners
				this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
				this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));

				// Driver specific capability listeners
				if (this.driverType.includes('RGB')) {
					this.registerCapabilityListener('light_hue', this.onCapabilityLightHue.bind(this));
				}
				if (this.driverType === 'WHITE' || this.driverType === 'RGBWW') {
					this.registerCapabilityListener('light_temperature', this.onCapabilityLightTemperature.bind(this));
				}
				if (this.driverType.includes('RGBW')) {
					this.registerCapabilityListener('light_mode', this.onCapabilityLightMode.bind(this));
				}

				this.log(`onInit() -> ${this.getData().bridgeMacAddress} - ${this.getData().driverType} - ${this.getData().zoneNumber} -> succeeded`);
				this.setAvailable();

				// Abort retrying initialization
				this.resetBackOff();
			})
			.catch(err => {
				this.setUnavailable(Homey.__('no_response'));
				this.error(`onInit() -> ${this.getData().bridgeMacAddress} - ${this.getData().driverType} - ${this.getData().zoneNumber} -> findBridge() error`, err);

				// Retry initialization
				this.nextBackOff();
			});
	}

	/**
	 * Getter for bridge zone.
	 * @returns {Zone}
	 */
	get zone() {
		return this.bridge.getZone(this.driverType, this.getData().zoneNumber);
	}

	/**
	 * This method will be called when the onoff state needs to be changed.
	 * @param onoff
	 * @returns {Promise}
	 */
	onCapabilityOnOff(onoff) {
		if (onoff) return this.zone.turnOn();
		return this.zone.turnOff();
	}

	/**
	 * This method will be called when the dim needs to be changed.
	 * @param dim
	 * @returns {Promise}
	 */
	onCapabilityDim(dim) {
		if (dim < 0.01) this.setCapabilityValue('onoff', false);
		else this.setCapabilityValue('onoff', true);
		return this.zone.setBrightness(dim);
	}

	/**
	 * This method will be called when the light hue needs to be changed.
	 * @param hue
	 * @returns {Promise}
	 */
	onCapabilityLightHue(hue) {
		if (this.getSetting('invert_red_and_green') === true) {
			const red = onecolor(`hsl(${hue * 360}, 1, 1)`).red();
			const green = onecolor(`hsl(${hue * 360}, 1, 1)`).green();
			const blue = onecolor(`hsl(${hue * 360}, 1, 1)`).blue();
			const color = onecolor(`rgb(${green},${red},${blue})`);
			this.setCapabilityValue('light_mode', 'color');
			return this.zone.setHue(MilightDevice.calibrateHue(color.hue(), this.getSetting('invert_red_and_green')));
		}
		this.setCapabilityValue('light_mode', 'color');
		return this.zone.setHue(MilightDevice.calibrateHue(hue, this.getSetting('invert_red_and_green')));
	}

	/**
	 * This method will be called when the light temperature needs to be changed.
	 * @param temperature
	 * @returns {Promise}
	 */
	onCapabilityLightTemperature(temperature) {
		this.setCapabilityValue('light_mode', 'temperature');
		return this.zone.setTemperature(temperature);
	}

	/**
	 * This method will be called when the light mode needs to be changed.
	 * @param mode
	 * @returns {Promise}
	 */
	onCapabilityLightMode(mode) {
		switch (mode) {
			case 'temperature':
				return this.zone.enableWhiteMode(this.getCapabilityValue('light_temperature'));
			case 'color':
				return this.onCapabilityLightHue(this.getCapabilityValue('light_hue'));
			case 'disco':
				return this.onCapabilityLightMode('color')
					.then(this.zone.toggleScene);
			case 'night':
				return this.zone.enableNightMode();
			case 'number':
				return this.zone.toggleScene(mode);
			default:
				return Promise.reject('missing_mode_parameter');
		}
	}

	/**
	 * This method will be called when a device has been removed. It de-registers the device
	 * with the bridge, so in case this was the last registered device the bridge can be
	 * destroyed.
	 */
	onDeleted() {
		this.log(`onDeleted() -> ${this.getData().bridgeMacAddress} - ${this.getData().driverType} - ${this.getData().zoneNumber}`);
		this.bridge.deregisterDevice(this.getData());
	}

	/**
	 * Calibrate hue value, to keep
	 * value in hue range of 0 - 1
	 * @param hue
	 * @param value
	 * @returns {number}
	 */
	static calibrateHue(hue, value) {
		hue = hue + value;
		if (hue > 1) return hue - 1;
		if (hue < 0) return hue + 1;
		return hue;
	}
}

module.exports = MilightDevice;
