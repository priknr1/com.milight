'use strict';

var Type = {
	RGBW: "RGBW",
	RGB: "RGB",
	WHITE: "WHITE"
};

class Zone {

	/**
	 * Construct a zone
	 * @param number Zone number (1, 2, 3, 4)
	 * @param id from bridge
	 * @param sendCommand Reference to bridge to send command
	 */
	constructor(options) {
		options = options || {};

		// Zone id is bridge id plus zone number plus type
		this.id = options.id + options.number + options.type;
		this.number = options.number;
		this.type = options.type;
		this.status = "off";
		this.brightness = 1;
		this.temperature = 1;
		this.hue = 1;
		this.light_mode = "color";

		// Construct name
		this.name = `Zone ${this.number} ${this.type}`;

		// Create commands for this specific sub zone
		this._createCommands(this.type);

		// Set options
		this._sendCommand = options.sendCommand;
	}

	/**
	 * Turn on all lights in this zone.
	 */
	turnOn() {

		console.log("Zone: turn on zone " + this.number + " " + this.type);

		// Update status
		this.status = "on";

		// Turn this zone off
		this._sendCommand(this.commands.on);
	}

	/**
	 * Turn off all lights in this zone.
	 */
	turnOff() {

		console.log("Zone: turn off zone " + this.number + " " + this.type);

		// Update status
		this.status = "off";

		// Turn this zone off
		this._sendCommand(this.commands.off);
	}

	/**
	 * Set the hue value of all lights in this
	 * zone.
	 */
	setHue(hue) {

		// Only available on rgbw and rgb
		if (this.type == Type.RGBW || this.type == Type.RGB) {

			console.log("Zone: set hue of zone " + this.number + " " + this.type + " to: " + hue);

			// Update hue
			this.hue = hue;

			// Set temperature to 0
			this.temperature = 0;

			// Update hue
			this._sendCommand(this.commands.hue(hue));
		}
	}

	/**
	 * Enable white mode on all rgbw
	 * lights in this zone.
	 */
	enableWhiteMode() {

		// Only available on rgbw
		if (this.type == Type.RGBW) {

			console.log("Zone: enable white mode of zone " + this.number);

			// Activate sub zone
			this.turnOn();

			// Send white mode command
			this._sendCommand(this.commands.enableWhiteMode);

			// Store new mode
			this.light_mode = "temperature";
		}
	}

	/**
	 * Enable color mode on all rgbw
	 * lights in this zone (will use
	 * latest known hue value.
	 */
	enableColorMode() {

		// Only available on rgbw
		if (this.type == Type.RGBW) {

			console.log("Zone: enable color mode of zone " + this.number);

			// Activate sub zone
			this.turnOn();

			// Send white mode command
			this._sendCommand(this.commands.enableColorMode);

			// Store new mode
			this.light_mode = "color";

			// Set temperature to 0
			this.temperature = 0;
		}
	}

	/**
	 * Enable a scene on all rgbw
	 * lights in this zone.
	 */
	toggleScene() {

		// Only available on rgbw
		if (this.type == Type.RGBW) {

			console.log("Zone: toggle scene of zone " + this.number);

			// Toggle next scene
			this._sendCommand(this.commands.enableEffectMode);
		}
	}

	/**
	 * Set brightness on all lights in
	 * this zone.
	 * @param brightness Range 0 - 1
	 */
	setBrightness(brightness) {

		console.log("Zone: set brightness of zone " + this.number + " " + this.type + " to: " + brightness);

		// Determine proper command
		switch (this.type) {
			case Type.RGBW:

				// Turn off if
				if (brightness < 0.01) this.turnOff();
				else {

					// Activate sub zone
					this.turnOn();

					// Send brightness command
					this._sendCommand(this.commands.brightness(brightness));
				}

				break;
			case Type.RGB:

				// Activate sub zone
				this.turnOn();

				// Set brightness
				this._setRgbBrightness(brightness);

				break;
			case Type.WHITE:

				// Activate sub zone
				this.turnOn();

				// Set brightness
				this._setWhiteBrightness(brightness);

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
		if (this.type === Type.WHITE) {

			console.log("Zone: set temperature of zone " + this.number + " to: " + temperature);

			// Calculate temperature difference
			var temp_dif = Math.round((temperature - this.temperature) * 10);
			if (temp_dif > 0) {
				for (let i = 0; i < temp_dif; i++) {

					// Send commands to turn light warmer
					this._sendCommand(this.commands.warmer);
				}
			}
			else if (temp_dif < 0) {
				for (let i = 0; i < -temp_dif; i++) {

					// Send commands to turn light cooler
					this._sendCommand(this.commands.cooler);
				}
			}

			// Store new value
			this.temperature = temperature;
		}
	}

	/**
	 * Calculate hue value usable
	 * for Milight bridge.
	 * @param hue Range 0 - 1
	 * @returns {Number}
	 * @private
	 */
	_calculateHue(hue) {
		var hex = ((256 + 176 - Math.floor(Number(hue) * 255.0)) % 256).toString(16);
		return (hex.length < 2) ? parseInt('0x0' + hex) : parseInt('0x' + hex);
	}

	/**
	 * Set the brightness of rgb
	 * lights in this sub zone.
	 * @param brightness Range 0 - 1
	 * @private
	 */
	_setRgbBrightness(brightness) {
		var brightness_diff = Math.round((brightness - this.brightness) * 10);

		// If brightness should be max
		if (brightness > 0.95) {

			// Set brightness to max by sending brightUp multiple times
			for (let i = 0; i < 5; i++) {
				this._sendCommand(this.commands.increaseBrightness);
			}

		} else if (brightness < 0.01) {
			// Turn off below 0.01
			this._sendCommand(this.commands.off);
		}
		else if (brightness_diff > 0) {
			for (let i = 0; i < brightness_diff; i++) {
				this._sendCommand(this.commands.increaseBrightness);
			}
		}
		else if (brightness_diff < 0) {
			for (let i = 0; i < -brightness_diff; i++) {
				this._sendCommand(this.commands.decreaseBrightness);
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
		var brightness_diff = Math.round((brightness - this.brightness) * 10);

		// If brightness should be minimal
		if (brightness < 0.01) {

			// Below 0.01 turn light off
			this._sendCommand(this.commands.off);
		}
		else if (brightness > 0.95) {

			// Turn light to max brightness
			this._sendCommand(this.commands.maximiseBrightness);
		}
		else if (brightness_diff > 0) {
			for (let i = 0; i < brightness_diff; i++) {
				this._sendCommand(this.commands.increaseBrightness);
			}
		}
		else if (brightness_diff < 0) {
			for (let i = 0; i < -brightness_diff; i++) {
				this._sendCommand(this.commands.decreaseBrightness);
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
		var self = this;
		var commands = {
			RGB: {
				off: [0x21, 0x00, 0x55],
				on: [0x22, 0x00, 0x55],
				hue: function (hue) {
					return [0x20, self._calculateHue(hue), 0x55];
				},
				increaseBrightness: [0x23, 0x00, 0x55],
				decreaseBrightness: [0x24, 0x00, 0x55]
			},
			RGBW: {
				on: [[0x42, 0x45, 0x47, 0x49, 0x4B][this.number], 0x00, 0x55],
				off: [[0x41, 0x46, 0x48, 0x4A, 0x4C][this.number], 0x00, 0x55],
				hue: function (hue) {
					return [0x40, self._calculateHue(hue), 0x55];
				},
				enableWhiteMode: [[0xC2, 0xC5, 0xC7, 0xC9, 0xCB][this.number], 0x00, 0x55],
				enableColorMode: [0x40, self._calculateHue(this.hue), 0x55],
				enableEffectMode: [0x4D, 0x00, 0x55],
				brightness: function (brightness) {
					if (brightness < 0.01) return [[0x41, 0x46, 0x48, 0x4A, 0x4C][this.number], 0x00, 0x55];
					else return [0x4E
						, [0x02, 0x03, 0x04, 0x05, 0x08, 0x09
							, 0x0A, 0x0B, 0x0D, 0x0E, 0x0F, 0x10, 0x11
							, 0x12, 0x13, 0x14, 0x15, 0x17, 0x18, 0x19][Math.max(0, (Math.ceil((brightness * 100) / 100 * 20)) - 1)]
						, 0x55
					];

					// Update brightness
					self.brightness = brightness;
				}
			},
			WHITE: {
				on: [[0x35, 0x38, 0x3D, 0x37, 0x32][this.number], 0x00, 0x55],
				off: [[0x39, 0x3B, 0x33, 0x3A, 0x36][this.number], 0x00, 0x55],
				maximiseBrightness: [[0xB5, 0xB8, 0xBD, 0xB7, 0xB2][this.number], 0x00, 0x55],
				increaseBrightness: [0x3C, 0x00, 0x55],
				decreaseBrightness: [0x34, 0x00, 0x55],
				warmer: [0x3E, 0x00, 0x55],
				cooler: [0x3F, 0x00, 0x55]
			}
		};

		// Store commands for this type of zone
		this.commands = commands[type];
	}
}

module.exports = Zone;