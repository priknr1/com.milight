'use strict';

const commandsV6 = require('node-milight-promise').commandsV6;
const commandsLegacy = require('node-milight-promise').commands;

const DEBUG = true;
const TYPE = {
	RGBW: 'RGBW',
	RGB: 'RGB',
	WHITE: 'WHITE',
	BRIDGE: 'BRIDGE',
	RGBWW: 'RGBWW',
};

class Zone {

	/**
	 * Construct a zone
	 * @param options
	 */
	constructor(options) {
		options = options || {};

		// Zone id is bridge id plus zone number plus type
		this.id = options.id + options.number + options.type;
		this.number = options.number;
		this.type = options.type;
		this.brightness = 1;
		this.temperature = 1;
		this.hue = 1;
		this.light_mode = 'color';
		this.bridgeVersion = options.bridgeVersion;
		this.ip = options.ip;
		const bridgeCommands = (this.bridgeVersion === 6) ? commandsV6 : commandsLegacy;
		switch (this.type) {
			case 'BRIDGE':
				this.commands = bridgeCommands.bridge;
				break;
			case 'WHITE':
				this.commands = bridgeCommands.white;
				break;
			case 'RGB':
				this.commands = bridgeCommands.rgb;
				break;
			case 'RGBW':
				this.commands = bridgeCommands.rgbw;
				break;
			case 'RGBWW':
				this.commands = bridgeCommands.fullColor;
				break;
		}
		this._sendCommand = options._sendCommand;

		// Construct name
		this.name = `Zone ${this.number} ${this.type}`;
	}

	/**
	 * Turn on all lights in this zone.
	 */
	turnOn() {

		_log(`turnOn() -> zone ${this.number} ${this.type}`);

		// Turn this zone on
		return this._sendCommand(this.commands.on(this.number));
	}

	/**
	 * Turn off all lights in this zone.
	 */
	turnOff() {

		_log(`turnOff() -> zone ${this.number} ${this.type}`);

		// Turn this zone off
		return this._sendCommand(this.commands.off(this.number));
	}

	/**
	 * Set the hue value of all lights in this
	 * zone.
	 */
	setHue(hue) {
		if (typeof hue === 'undefined') return Promise.reject(new Error('missing_hue_parameter'));
		if (hue < 0 || hue > 1) return Promise.reject(new RangeError(`hue_parameter_out_of_range_${hue}`));

		_log(`setHue() -> hue: ${hue} -> zone:${this.number}_${this.type} to ${hue}`);

		const bridgeCorrection = 0.015;
		const fullColorCorrection = 0.045;
		const rgbwCorrection = (this.bridgeVersion === 6) ? 0.115 : 0;

		switch (this.type) {
			case 'BRIDGE':
				hue = hue + bridgeCorrection;
				break;
			case 'RGB':
				hue = hue; // TODO add calibration value
				break;
			case 'RGBW':
				hue = hue + rgbwCorrection;
				break;
			case 'RGBWW':
				hue = hue + fullColorCorrection;
				break;
		}

		if (hue === 0) hue = 0.01; // Some bulbs don't accept a hue of zero

		// Only available on rgbww, rgbw and rgb
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW || this.type === TYPE.RGB || this.type === TYPE.BRIDGE) {

			// Update hue
			this.hue = hue;

			// Reset temperature
			this.temperature = 0;

			// Update hue
			if (this.type === TYPE.RGBW || this.type === TYPE.RGBWW) {
				if (this.bridgeVersion === 6) {
					return this._sendCommand([this.commands.on(this.number), this.commands.hue(this.number, Math.round(map(0, 1, 1, 256, hue)))]);
				}
				return this._sendCommand([this.commands.on(this.number), this.commands.hue(Math.round(map(0, 1, 1, 256, hue)))]);
			}
			return this._sendCommand(this.commands.hue(Math.round(map(0, 1, 1, 256, hue))));
		}
		return Promise.reject('not_rgbww_or_rgbw');
	}

	/**
	 * Enable white mode on all rgbw
	 * lights in this zone.
	 */
	enableWhiteMode(temperature) {

		// Only available on rgbw
		if (this.type === TYPE.RGBW || this.type === TYPE.RGBWW || this.type === TYPE.BRIDGE) {

			_log(`enableWhiteMode() -> zone:${this.number}_${this.type}`);

			// Send white mode command
			if (this.bridgeVersion === 6) {
				if (this.type === TYPE.RGBWW) {
					return this._sendCommand([this.commands.on(this.number), this.commands.whiteTemperature(this.number, 100 - temperature * 100)]);
				}
				return this._sendCommand(this.commands.whiteMode(this.number));
			}

			// Store new mode
			this.light_mode = 'temperature';

			return this._sendCommand([this.commands.on(this.number), this.commands.whiteMode(this.number)]);
		}
		return Promise.reject('not_rgbww_rgbw_or_bridge');
	}

	/**
	 * Enable night mode on all rgbw
	 * lights in this zone.
	 */
	enableNightMode() {

		// Only available on rgbw
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW || this.type === TYPE.WHITE || this.type === TYPE.BRIDGE) {

			_log(`enableNightMode() -> zone:${this.number}_${this.type}`);

			if (this.type === TYPE.BRIDGE) return this.enableWhiteMode();
			else if (this.bridgeVersion === 6) return this._sendCommand(this.commands.nightMode(this.number));

			// Store new mode
			this.light_mode = 'temperature';

			return this._sendCommand([this.commands.on(this.number), this.commands.nightMode(this.number)]);
		}
	}

	/**
	 * Enable a scene on all rgbw
	 * lights in this zone.
	 */
	toggleScene(sceneId) {

		// Only available on rgbw
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW) {

			_log(`toggleScene() -> sceneId:${sceneId} -> zone:${this.number}_${this.type}`);

			if (this.bridgeVersion === 6) {
				if (sceneId) return this._sendCommand(this.commands.effectMode(this.number, sceneId));
				return this._sendCommand(this.commands.effectModeNext(this.number));
			}
			return this._sendCommand([this.commands.on(this.number), this.commands.effectModeNext(this.number)]);
		}
		return Promise.reject('not_rgbww_or_rgbw');
	}

	/**
	 * Scenespeed higher on all rgbw
	 * lights in this zone.
	 */
	setSceneSpeedUp() {
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW) {

			_log(`setSceneSpeedUp() -> zone:${this.number}_${this.type} scene speed up`);

			// Send speed command
			return this._sendCommand(this.commands.effectSpeedUp(this.number));
		}
		return Promise.reject('not_rgbww_or_rgbw');
	}

	/**
	 * Scenespeed lower on all rgbw
	 * lights in this zone.
	 */
	setSceneSpeedDown() {
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW) {

			_log(`setSceneSpeedDown() -> zone:${this.number}_${this.type} scene speed down`);

			// Send speed command
			return this._sendCommand(this.commands.effectSpeedDown(this.number));
		}
		return Promise.reject('not_rgbww_or_rgbw');
	}

	/**
	 * Set brightness on all lights in
	 * this zone.
	 * @param brightness Range 0 - 1
	 */
	setBrightness(brightness) {

		_log(`setBrightness() -> zone:${this.number}_${this.type} to ${brightness}`);

		// Determine proper command
		switch (this.type) {
			case TYPE.RGBW:

				// Turn off if
				if (brightness < 0.01) return this.turnOff();

				// Send brightness command
				if (this.bridgeVersion === 6) return this._sendCommand([this.commands.on(this.number), this.commands.brightness(this.number, brightness * 100)]);
				return this._sendCommand([this.commands.on(this.number), this.commands.brightness(brightness * 100)]);
			case TYPE.RGBWW:

				// Turn off if
				if (brightness < 0.01) return this.turnOff();

				// Send brightness command
				if (this.bridgeVersion === 6) return this._sendCommand([this.commands.on(this.number), this.commands.brightness(this.number, brightness * 100)]);
				return this._sendCommand([this.commands.on(this.number), this.commands.brightness(brightness * 100)]);
			case TYPE.RGB:

				// Set brightness
				return this._setRgbBrightness(brightness);
			case TYPE.WHITE:

				// Set brightness
				return this._setWhiteBrightness(brightness);
			case TYPE.BRIDGE:

				// Turn off if
				if (brightness < 0.01) return this.turnOff();

				// Send brightness command
				return this._sendCommand([this.commands.on(this.number), this.commands.brightness(brightness * 100)]);
			default:
				return Promise.reject('invalid_type');
		}
	}

	/**
	 * Set the light temperature on
	 * all white lights in this zone.
	 * @param temperature Range 0 - 1
	 */
	setTemperature(temperature) {

		// Only available on white lights
		if (this.type === TYPE.WHITE) {

			_log(`setTemperature() -> zone:${this.number}_${this.type} to ${temperature}`);

			const promises = [];

			// Calculate temperature difference
			const tempDiff = Math.round((temperature - this.temperature) * 10);
			if (tempDiff > 0) {
				for (let i = 0; i < tempDiff; i++) {

					// Send commands to turn light warmer
					promises.push(this._sendCommand([this.commands.on(this.number), this.commands.warmer(this.number)]));
				}
			} else {
				for (let i = 0; i < -tempDiff; i++) {

					// Send commands to turn light cooler
					promises.push(this._sendCommand([this.commands.on(this.number), this.commands.cooler(this.number)]));
				}
			}
			this.temperature = temperature;
			return Promise.all(promises);
		} else if (this.type === TYPE.RGBWW) {
			_log(`setTemperature() -> zone:${this.number}_${this.type} to ${100 - temperature * 100}`);
			this.temperature = temperature;
			return this._sendCommand([this.commands.on(this.number), this.commands.whiteTemperature(this.number, 100 - temperature * 100)]);
		}
		return Promise.reject('not_white');
	}

	/**
	 * Calculate hue value usable
	 * for Milight bridge.
	 * @param hue Range 0 - 1
	 * @returns {Number}
	 * @private
	 */
	static _calculateHue(hue) {
		const hex = ((256 + 176 - Math.floor(Number(hue) * 255.0)) % 256).toString(16);
		return (hex.length < 2) ? parseInt(`0x0${hex}`) : parseInt(`0x${hex}`);
	}

	/**
	 * Set the brightness of rgb
	 * lights in this sub zone.
	 * @param brightness Range 0 - 1
	 * @private
	 */
	_setRgbBrightness(brightness) {
		const brightnessDiff = Math.round((brightness - this.brightness) * 10);

		// If brightness should be max
		if (brightness > 0.95) {

			const promises = [];

			// Set brightness to max by sending brightUp multiple times
			for (let i = 0; i < 5; i++) {
				if (this.bridgeVersion === 6) promises.push(this._sendCommand(this.commands.brightUp()));
				else promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightUp()]));
			}
			// Store new value
			this.brightness = brightness;

			return Promise.all(promises);
		} else if (brightness < 0.01) {

			// Store new value
			this.brightness = brightness;

			// Turn off below 0.01
			return this._sendCommand(this.commands.off());
		} else if (brightnessDiff > 0) {
			const promises = [];

			for (let i = 0; i < brightnessDiff; i++) {
				if (this.bridgeVersion === 6) promises.push(this._sendCommand(this.commands.brightUp()));
				else promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightUp()]));
			}
			// Store new value
			this.brightness = brightness;
			return Promise.all(promises);
		} else if (brightnessDiff < 0) {
			const promises = [];

			for (let i = 0; i < -brightnessDiff; i++) {
				if (this.bridgeVersion === 6) promises.push(this._sendCommand(this.commands.brightDown()));
				else promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightDown()]));
			}
			// Store new value
			this.brightness = brightness;
			return Promise.all(promises);
		}
		return Promise.reject('invalid_brightness_value');
	}

	/**
	 * Set the brightness of white
	 * lights in this zone.
	 * @param brightness Range 0 - 1
	 * @private
	 */
	_setWhiteBrightness(brightness) {
		const brightnessDiff = Math.round((brightness - this.brightness) * 10);

		// If brightness should be minimal
		if (brightness < 0.01) {

			// Below 0.01 turn light off
			return this._sendCommand(this.commands.off(this.number));
		} else if (brightness > 0.95) {

			// Store new value
			this.brightness = brightness;

			// Turn light to max brightness
			if (this.bridgeVersion === 6) return this._sendCommand([this.commands.on(this.number), this.commands.maxBright(this.number)]);
			return this._sendCommand([this.commands.on(this.number), this.commands.maxBright(this.number)]);

		} else if (brightnessDiff > 0) {
			const promises = [];

			for (let i = 0; i < brightnessDiff; i++) {
				if (this.bridgeVersion === 6) promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightUp(this.number)]));
				else promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightUp(this.number)]));
			}

			// Store new value
			this.brightness = brightness;
			return Promise.all(promises);
		} else if (brightnessDiff < 0) {
			const promises = [];

			for (let i = 0; i < -brightnessDiff; i++) {
				if (this.bridgeVersion === 6) promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightDown(this.number)]));
				else promises.push(this._sendCommand([this.commands.on(this.number), this.commands.brightDown(this.number)]));
			}

			// Store new value
			this.brightness = brightness;
			return Promise.all(promises);
		}
		return Promise.reject('invalid_brightness_value');

	}
}

/**
 * Log method, log level info.
 */
function _log() {
	if (!DEBUG) return;
	const args = Array.prototype.slice.call(arguments);
	args.unshift('[info] Zone.js');
	args.unshift('\t');
	args.unshift(timestamp());
	console.log.apply(null, args);
}

/**
 * Log method, log level error.
 */
function _error() {
	if (!DEBUG) return;
	const args = Array.prototype.slice.call(arguments);
	args.unshift('[error] Zone.js');
	args.unshift('\t');
	args.unshift(timestamp());
	console.error.apply(null, args);
}

/**
 * Create current timestamp,
 * HH:MM:SS:sss
 * @returns {string}
 */
function timestamp() {
	const d = new Date();
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(d.getMilliseconds())}`;
}

/**
 * Pad a value with zero if necessary.
 * @param value
 * @returns {string}
 */
function pad(value) {
	return (value < 10) ? `0${value}` : value;
}

/**
 * Map a range of values to a different range of values
 * @param inputStart
 * @param inputEnd
 * @param outputStart
 * @param outputEnd
 * @param input
 * @returns {*}
 */
function map(inputStart, inputEnd, outputStart, outputEnd, input) {
	return outputStart + ((outputEnd - outputStart) / (inputEnd - inputStart)) * (input - inputStart);
}

module.exports = Zone;
