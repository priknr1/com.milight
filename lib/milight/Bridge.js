'use strict';

const EventEmitter = require('events').EventEmitter;

const NodeMilightPromise = require('node-milight-promise').MilightController;

const Zone = require('./Zone');

const DEBUG = true;

class Bridge extends EventEmitter {

	/**
	 * Construct bridge object, needs
	 * an ip and mac address.
	 * @param options
	 */
	constructor(options) {
		super();

		options = options || {};

		// Store bridge specific variable
		this.ip = options.ip;
		this.mac = options.mac;
		this.bridgeVersion = options.bridgeVersion;
		this.unavailableCounter = 0;
		this.temp = options.temp;

		this.debouncedCommands = [];
		this.debouncedPromises = [];

		const communicationMiddleware = new NodeMilightPromise({
			ip: this.ip,
			type: (this.bridgeVersion === 6) ? 'v6' : 'legacy',
		});

		// Initialize the bridge's zones
		this.initializeZones(communicationMiddleware);

		// Keep track of all Homey devices connected to this bridge
		this.registeredDevices = new Set();
	}

	/**
	 * Construct all possible zones for this bridge. IMPORTANT for bridgeVersion 6 this is necessary with a new
	 * NodeMilightPromise object due to the need for refreshed sessions after reboot of the bridge.
	 */
	initializeZones(communicationMiddleware) {

		const sendCommands = communicationMiddleware.sendCommands.bind(communicationMiddleware);

		// Debouncify the sendCommands middleware
		const debouncedSendCommands = function () {
			if (Array.isArray(arguments[0])) {
				if (!Array.isArray(arguments[0][0])) this.debouncedCommands.push(arguments[0])
				else {
					arguments[0].forEach(command => {
						this.debouncedCommands.push(command);
					});
				}
			} else {
				this.debouncedCommands.push([arguments[0]]);
			}

			if (this.sending) clearTimeout(this.debounce);
			this.sending = true;

			this.debounce = setTimeout(() => {
				sendCommands(this.debouncedCommands).then(result => {
					this.debouncedPromises.forEach(promise => promise.resolve(result));
					this.sending = false;
					return result;
				}).catch(err => {
					this.debouncedPromises.forEach(promise => promise.reject(err));
					this.sending = false;
					return err;
				});
				this.debouncedCommands = [];
			}, 300);

			return new Promise((resolve, reject) => this.debouncedPromises.push({ resolve, reject }));
		}.bind(this);

		// Instantiate the four zones
		this.zones = {
			RGB: [
				new Zone({
					type: 'RGB',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
			],
			RGBW: [
				new Zone({
					type: 'RGBW',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'RGBW',
					number: 2,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'RGBW',
					number: 3,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'RGBW',
					number: 4,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
			],
			WHITE: [
				new Zone({
					type: 'WHITE',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'WHITE',
					number: 2,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'WHITE',
					number: 3,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'WHITE',
					number: 4,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
			],
		};

		// Add bridge light itself and RGBWW
		if (this.bridgeVersion === 6) {
			this.zones.RGBW.push(new Zone({
				type: 'BRIDGE',
				number: 5,
				id: this.mac,
				ip: this.ip,
				bridgeVersion: this.bridgeVersion,
				_sendCommand: debouncedSendCommands,
			}));

			this.zones.RGBWW = [
				new Zone({
					type: 'RGBWW',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'RGBWW',
					number: 2,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'RGBWW',
					number: 3,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
				new Zone({
					type: 'RGBWW',
					number: 4,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: debouncedSendCommands,
				}),
			];
		}
	}

	/**
	 * Update the IP address of the bridge and re-initiate the NodeMilightPromise object.
	 * @param ip
	 */
	updateIPAddress(ip) {
		this.ip = ip || this.ip;

		const communicationMiddleware = new NodeMilightPromise({
			ip: this.ip,
			type: (this.bridgeVersion === 6) ? 'v6' : 'legacy',
		});

		// Initialize zones with new NodeMilightPromise object
		this.initializeZones(communicationMiddleware);
	}

	/**
	 * Destroy this bridge object, emit 'destroy' event.
	 */
	destroy() {
		if (!this.destroyed) this.emit('destroy', this);
		this.destroyed = true;
	}

	/**
	 * Add a device to the set to keep track of all connected devices.
	 * @param deviceId
	 */
	registerDevice(deviceId) {
		this.registeredDevices.add(deviceId);
	}

	/**
	 * Remove device from set so that bridge can destroy itself once it becomes without devices.
	 * @param deviceId
	 */
	deregisterDevice(deviceId) {
		this.registeredDevices.delete(deviceId);
		if (this.registeredDevices.size === 0) {
			this.destroy();
		}
	}

	/**
	 * Getter for the zones array
	 * @returns {Array|*[]}
	 */
	getZones(type) {
		if (type) return this.zones[type];
		return this.zones;
	}

	/**
	 * Return specific zone
	 * @param type
	 * @param number
	 * @returns {*}
	 */
	getZone(type, number) {
		return this.zones[type][(number <= 0) ? 0 : number - 1];
	}
}

module.exports = Bridge;
