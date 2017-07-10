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
		this.speed = 1;
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
		if (typeof hue === 'undefined') return new Error('missing_hue_parameter');
		if (hue < 0 || hue > 1) return new RangeError(`hue_parameter_out_of_range_${hue}`);

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
					this._sendCommand([this.commands.on(this.number), this.commands.hue(this.number, Math.round(map(0, 1, 1, 256, hue)))]);
				} else {
					this._sendCommand([this.commands.on(this.number), this.commands.hue(Math.round(map(0, 1, 1, 256, hue)))]);
				}
			} else {
				this._sendCommand(this.commands.hue(Math.round(map(0, 1, 1, 256, hue))));
			}
		}
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
					this._sendCommand([this.commands.on(this.number), this.commands.whiteTemperature(this.number, 100 - temperature * 100)]);
				} else {
					this._sendCommand(this.commands.whiteMode(this.number));
				}
			}
			else this._sendCommand([this.commands.on(this.number), this.commands.whiteMode(this.number)]);

			// Store new mode
			this.light_mode = 'temperature';
		}
	}

	/**
	 * Enable night mode on all rgbw
	 * lights in this zone.
	 */
	enableNightMode() {

		// Only available on rgbw
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW || this.type === TYPE.WHITE || this.type === TYPE.BRIDGE) {

			_log(`enableNightMode() -> zone:${this.number}_${this.type}`);

			if (this.type === TYPE.BRIDGE) this.enableWhiteMode();
			else if (this.bridgeVersion === 6) this._sendCommand(this.commands.nightMode(this.number));
			else this._sendCommand([this.commands.on(this.number), this.commands.nightMode(this.number)]);

			// Store new mode
			this.light_mode = 'temperature';
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
				if (sceneId) this._sendCommand(this.commands.effectMode(this.number, sceneId));
				else this._sendCommand(this.commands.effectModeNext(this.number));
			} else this._sendCommand([this.commands.on(this.number), this.commands.effectModeNext(this.number)]);
		}
	}

	/**
	 * Scenespeed higher on all rgbw
	 * lights in this zone.
	 */
	setSceneSpeedUp() {
		if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW) {

				_log(`setSceneSpeedUp() -> zone:${this.number}_${this.type} scene speed up`);

				// Send speed command
				this._sendCommand(this.commands.effectSpeedUp(this.number));
			}
		}

		/**
		 * Scenespeed lower on all rgbw
		 * lights in this zone.
		 */
		setSceneSpeedDown() {
			if (this.type === TYPE.RGBWW || this.type === TYPE.RGBW) {

					_log(`setSceneSpeedDown() -> zone:${this.number}_${this.type} scene speed down`);

					// Send speed command
					this._sendCommand(this.commands.effectSpeedDown(this.number));
				}
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
				if (brightness < 0.01) this.turnOff();
				else {
					// Send brightness command
					if (this.bridgeVersion === 6) this._sendCommand([this.commands.on(this.number), this.commands.brightness(this.number, brightness * 100)]);
					else this._sendCommand([this.commands.on(this.number), this.commands.brightness(brightness * 100)]);
				}

				break;
			case TYPE.RGBWW:

				// Turn off if
				if (brightness < 0.01) this.turnOff();
				else {
					// Send brightness command
					if (this.bridgeVersion === 6) this._sendCommand([this.commands.on(this.number), this.commands.brightness(this.number, brightness * 100)]);
					else this._sendCommand([this.commands.on(this.number), this.commands.brightness(brightness * 100)]);
				}

				break;
			case TYPE.RGB:

				// Set brightness
				this._setRgbBrightness(brightness);

				break;
			case TYPE.WHITE:

				// Set brightness
				this._setWhiteBrightness(brightness);

				break;
			case TYPE.BRIDGE:

				// Turn off if
				if (brightness < 0.01) this.turnOff();
				else {

					// Send brightness command
					this._sendCommand([this.commands.on(this.number), this.commands.brightness(brightness * 100)]);
				}

				break;
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

			// Calculate temperature difference
			const temp_dif = Math.round((temperature - this.temperature) * 10);
			if (temp_dif > 0) {
				for (let i = 0; i < temp_dif; i++) {

					// Send commands to turn light warmer
					this._sendCommand([this.commands.on(this.number), this.commands.warmer(this.number)]);
				}
			} else if (temp_dif < 0) {
				for (let i = 0; i < -temp_dif; i++) {

					// Send commands to turn light cooler
					this._sendCommand([this.commands.on(this.number), this.commands.cooler(this.number)]);
				}
			}
		} else if (this.type === TYPE.RGBWW) {
			_log(`setTemperature() -> zone:${this.number}_${this.type} to ${100 - temperature * 100}`);

			this._sendCommand([this.commands.on(this.number), this.commands.whiteTemperature(this.number, 100 - temperature * 100)]);
		}

		this.temperature = temperature;
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
		const brightness_diff = Math.round((brightness - this.brightness) * 10);

		// If brightness should be max
		if (brightness > 0.95) {

			// Set brightness to max by sending brightUp multiple times
			for (let i = 0; i < 5; i++) {
				if (this.bridgeVersion === 6) this._sendCommand(this.commands.brightUp());
				else this._sendCommand([this.commands.on(this.number), this.commands.brightUp()]);
			}

		} else if (brightness < 0.01) {
			// Turn off below 0.01
			this._sendCommand(this.commands.off());
		} else if (brightness_diff > 0) {
			for (let i = 0; i < brightness_diff; i++) {
				if (this.bridgeVersion === 6) this._sendCommand(this.commands.brightUp());
				else this._sendCommand([this.commands.on(this.number), this.commands.brightUp()]);
			}
		} else if (brightness_diff < 0) {
			for (let i = 0; i < -brightness_diff; i++) {
				if (this.bridgeVersion === 6) this._sendCommand(this.commands.brightDown());
				else this._sendCommand([this.commands.on(this.number), this.commands.brightDown()]);
			}
		}

		// Store new value
		this.brightness = brightness;
	}

	/**
	 * Set the brightness of white
	 * lights in this zone.
	 * @param brightness Range 0 - 1
	 * @private
	 */
	_setWhiteBrightness(brightness) {
		const brightness_diff = Math.round((brightness - this.brightness) * 10);

		// If brightness should be minimal
		if (brightness < 0.01) {

			// Below 0.01 turn light off
			this._sendCommand(this.commands.off(this.number));
		} else if (brightness > 0.95) {

			// Turn light to max brightness
			if (this.bridgeVersion === 6) this._sendCommand([this.commands.on(this.number), this.commands.maxBright(this.number)]);
			else this._sendCommand([this.commands.on(this.number), this.commands.maxBright(this.number)]);
		} else if (brightness_diff > 0) {
			for (let i = 0; i < brightness_diff; i++) {
				if (this.bridgeVersion === 6) this._sendCommand([this.commands.on(this.number), this.commands.brightUp(this.number)]);
				else this._sendCommand([this.commands.on(this.number), this.commands.brightUp(this.number)]);
			}
		} else if (brightness_diff < 0) {
			for (let i = 0; i < -brightness_diff; i++) {
				if (this.bridgeVersion === 6) this._sendCommand([this.commands.on(this.number), this.commands.brightDown(this.number)]);
				else this._sendCommand([this.commands.on(this.number), this.commands.brightDown(this.number)]);
			}
		}

		// Store new value
		this.brightness = brightness;
	}

	/**
	 * Initiate all commands from the
	 * provided zone number and type.
	 * @private
	 */
	_createCommands(type) {
		const commands = {
			RGB: {
				off: [0x21, 0x00, 0x55],
				on: [0x22, 0x00, 0x55],
				hue(hue) {
					return [0x20, Zone._calculateHue(hue), 0x55];
				},
				increaseBrightness: [0x23, 0x00, 0x55],
				decreaseBrightness: [0x24, 0x00, 0x55],
			},
			RGBW: {
				on: [[0x42, 0x45, 0x47, 0x49, 0x4B][this.number], 0x00, 0x55],
				off: [[0x41, 0x46, 0x48, 0x4A, 0x4C][this.number], 0x00, 0x55],
				hue(hue) {
					return [0x40, Zone._calculateHue(hue), 0x55];
				},
				enableWhiteMode: [[0xC2, 0xC5, 0xC7, 0xC9, 0xCB][this.number], 0x00, 0x55],
				enableNightMode: [[0xC1, 0xC6, 0xC8, 0xCA, 0xCC][this.number], 0x00, 0x55],
				enableColorMode: [0x40, Zone._calculateHue(this.hue), 0x55],
				enableEffectMode: [0x4D, 0x00, 0x55],
				brightness(brightness) {
					if (brightness < 0.01) return [[0x41, 0x46, 0x48, 0x4A, 0x4C][this.number], 0x00, 0x55];
					return [0x4E,
						[0x02, 0x03, 0x04, 0x05, 0x08, 0x09,
							0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x10, 0x11,
							0x12, 0x13, 0x14, 0x15, 0x17, 0x18, 0x19][Math.max(0, (Math.ceil((brightness * 100) / 100 * 20)) - 1)],
						0x55,
					];
				},
			},
			WHITE: {
				on: [[0x35, 0x38, 0x3D, 0x37, 0x32][this.number], 0x00, 0x55],
				off: [[0x39, 0x3B, 0x33, 0x3A, 0x36][this.number], 0x00, 0x55],
				maximiseBrightness: [[0xB5, 0xB8, 0xBD, 0xB7, 0xB2][this.number], 0x00, 0x55],
				increaseBrightness: [0x3C, 0x00, 0x55],
				decreaseBrightness: [0x34, 0x00, 0x55],
				warmer: [0x3E, 0x00, 0x55],
				cooler: [0x3F, 0x00, 0x55],
				enableNightMode: [[0xB9, 0xBB, 0xB3, 0xBA, 0xB6][this.number], 0x00, 0x55],
			},
		};

		// Store commands for this type of zone
		this.commands = commands[type];
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
