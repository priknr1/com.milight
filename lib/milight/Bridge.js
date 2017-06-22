'use strict';

// TODO use this.light in sendCommand

const dgram = require('dgram');
const EventEmitter = require('events').EventEmitter;
const NodeMilightPromise = require('node-milight-promise').MilightController;

const Zone = require('./Zone');

const DEFAULT_PORT = 8899;
const COMMAND_REPEAT = 3;
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

		// Keep an array with promises
		this.commandPromises = [];

		// Create a socket connection with the bridge
		this.socket = this._createSocket();

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

		// Instantiate the four zones
		this.zones = {
			RGB: [
				new Zone({
					type: 'RGB',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
			],
			RGBW: [
				new Zone({
					type: 'RGBW',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'RGBW',
					number: 2,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'RGBW',
					number: 3,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'RGBW',
					number: 4,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
			],
			RGBWW: [
				new Zone({
					type: 'RGBWW',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'RGBWW',
					number: 2,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'RGBWW',
					number: 3,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'RGBWW',
					number: 4,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
			],
			WHITE: [
				new Zone({
					type: 'WHITE',
					number: 1,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'WHITE',
					number: 2,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'WHITE',
					number: 3,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
				new Zone({
					type: 'WHITE',
					number: 4,
					id: this.mac,
					ip: this.ip,
					bridgeVersion: this.bridgeVersion,
					_sendCommand: sendCommands,
				}),
			],
		};

		// Add bridge light itself
		if (this.bridgeVersion === 6) {
			this.zones.RGBW.push(new Zone({
				type: 'BRIDGE',
				number: 5,
				id: this.mac,
				ip: this.ip,
				bridgeVersion: this.bridgeVersion,
				_sendCommand: sendCommands,
			}));
		}
	}

	/**
	 * Update the IP address of the bridge and re-initiate the NodeMilightPromise object.
	 * @param ip
	 */
	updateIPAddress(ip) {
		this.ip = ip;

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

	/**
	 * Middleware for sending
	 * messages through the bridge.
	 * @param command
	 */
	sendCommand(command) {
		this._processCommand(command);
	}

	/**
	 * Creates a socket to the bridge
	 * if this has not already happened.
	 * @returns {Promise} Resolves with socket
	 * @private
	 */
	_createSocket() {

		// Check if socket already present
		if (!this.socket) {

			return new Promise((resolve, reject) => {

				_log('initializing socket');

				// Create socket
				const socket = dgram.createSocket('udp4');

				try {

					// Bind it and resolve promise
					socket.bind(() => {
						this.socket = socket;

						this.socket.on('error', (err) => {
							_log(`Bridge: socket binding error: ${err}`);
						});
						this.socket.on('close', () => {
							_log('socket connection closed');
						});

						_log('socket connection successful');

						return resolve(this.socket);
					});

				} catch (err) {

					_error('socket connection failed');

					return reject(err);
				}
			});
		}
		return Promise.resolve(this.socket);
	}

	/**
	 * Initiates sending a command, and pushes
	 * it to the commandPromisses array
	 * to spread the commands send to the
	 * bridge over time.
	 * @param command
	 * @private
	 */
	_processCommand(command) {

		// Wait for other commands to finish
		Promise.all(this.commandPromises).then(() => {

			// Send two times
			for (let j = 0; j < COMMAND_REPEAT; j++) {
				this.commandPromises.push(this._sendCommand(command));
			}
		});
	}

	/**
	 * Sends command over socket connection to bridge.
	 * @param message
	 * @returns {Promise}
	 * @private
	 */
	_sendCommand(message) {
		return new Promise((resolve, reject) => {

			// Wait for other commands to resolve
			Promise.all(this.commandPromises).then(() => {

				// If no socket available create one
				this._createSocket().then(socket => {

					// Create buffer
					const buffer = new Buffer(message);

					// Send buffer
					socket.send(buffer, 0, buffer.length, DEFAULT_PORT, this.ip, (err) => {
							if (err) {

								_error(`UDP socket error ${err}`);

								// Add time between commands
								setTimeout(() => reject(err), 50);
							} else {

								// Add time between commands
								setTimeout(() => resolve(), 50);
							}
						}
					);
				}).catch(error => {

					_error(`Socket connection error ${error}`);

					// Emit socket connection error
					this.emit('offline', error);
				});
			});
		});
	}
}

/**
 * Log method, log level info.
 */
function _log() {
	if (!DEBUG) return;
	const args = Array.prototype.slice.call(arguments);
	args.unshift('[info] Bridge.js');
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
	args.unshift('[error] Bridge.js');
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

module.exports = Bridge;
