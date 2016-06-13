'use strict';

const dgram = require('dgram');
const EventEmitter = require('events').EventEmitter;
var tcpp = require('tcp-ping');

const Zone = require('./Zone');

const DEFAULT_PORT = 8899;
const COMMAND_REPEAT = 3;

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
		this.id = options.id;
		this.status = "on";

		// Keep an array with promises
		this.commandPromises = [];

		// Create a socket connection with the bridge
		this.socket = this._createSocket();

		// Instantiate the four zones
		this.zones = {
			"RGB": [
				new Zone({type: "RGB", number: 1, id: this.id, sendCommand: this.sendCommand.bind(this)})
			],
			"RGBW": [
				new Zone({type: "RGBW", number: 1, id: this.id, sendCommand: this.sendCommand.bind(this)}),
				new Zone({type: "RGBW", number: 2, id: this.id, sendCommand: this.sendCommand.bind(this)}),
				new Zone({type: "RGBW", number: 3, id: this.id, sendCommand: this.sendCommand.bind(this)}),
				new Zone({type: "RGBW", number: 4, id: this.id, sendCommand: this.sendCommand.bind(this)})
			],
			"WHITE": [
				new Zone({type: "WHITE", number: 1, id: this.id, sendCommand: this.sendCommand.bind(this)}),
				new Zone({type: "WHITE", number: 2, id: this.id, sendCommand: this.sendCommand.bind(this)}),
				new Zone({type: "WHITE", number: 3, id: this.id, sendCommand: this.sendCommand.bind(this)}),
				new Zone({type: "WHITE", number: 4, id: this.id, sendCommand: this.sendCommand.bind(this)})
			]
		};
	}

	/**
	 * Getter for the zones array
	 * @returns {Array|*[]}
	 */
	getZones(type) {
		if (type) return this.zones[type];
		else return this.zones;
	}

	/**
	 * Return specific zone
	 * @param number
	 * @returns {*}
	 */
	getZone(type, number) {
		return this.zones[type][(number <= 0) ? 0 : number - 1];
	}

	/**
	 * Turn on all zones, or only
	 * the devices of type which is
	 * specified.
	 * @param type
	 */
	turnAllOn(type) {

		console.log("Bridge: turn on all zones, type: " + type);

		if (type) {
			for (let i in this.zones[type]) {
				this.zones[type][i].turnOn();
			}

		}
		else {
			for (let type in this.zones) {
				for (let i in this.zones[type]) {
					this.zones[type][i].turnOn();
				}
			}
		}
	}

	/**
	 * Turn off all zones, or only
	 * the devices of type which is
	 * specified.
	 * @param type
	 */
	turnAllOff(type) {

		console.log("Bridge: turn off all zones, type: " + type);

		if (type) {
			for (let i in this.zones[type]) {
				this.zones[type][i].turnOff();
			}

		}
		else {
			for (let type in this.zones) {
				for (let i in this.zones[type]) {
					this.zones[type][i].turnOff();
				}
			}
		}
	}

	/**
	 * Public middleware for sending
	 * messages through the bridge.
	 * @param command
	 */
	sendCommand(command) {
		this._processCommand(command)
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

				console.log("Bridge: initializing socket");

				// Create socket
				var socket = dgram.createSocket('udp4');

				try {

					// Bind it and resolve promise
					socket.bind(function () {
						this.socket = socket;

						this.socket.on('error', function (err) {
							console.log("Bridge: socket binding error: " + err);
						});
						this.socket.on('close', function () {
							console.log('Bridge: socket connection closed');
						});

						console.log("Bridge: socket connection successful");

						resolve(this.socket);
					}.bind(this));

				} catch (err) {

					console.log("Bridge: socket connection failed");

					return reject(err);
				}

			});
		}
		else {
			return Promise.resolve(this.socket);
		}
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

				// Ping bridge to see if alive
				this._pingBridge();

				// If no socket available create one
				this._createSocket().then(socket => {

					// Create buffer
					var buffer = new Buffer(message);

					// Send buffer
					socket.send(buffer, 0, buffer.length, DEFAULT_PORT, this.ip, function (err) {
							if (err) {

								console.log("Bridge: UDP socket error " + err);

								// Add time between commands
								setTimeout(() => {
									return reject(err);
								}, 50);
							}
							else {

								// Add time between commands
								setTimeout(() => {

									return resolve();
								}, 50);
							}
						}
					);
				}).catch(error => {

					console.log("Bridge: socket connection error " + error);

					// Emit socket connection error
					this.emit("offline", error);
				})
			});
		})
	}

	/**
	 * Send ping message to bridge
	 * to see if it is still online.
	 * @private
	 */
	_pingBridge() {

		// If ping timeout is already present clear it
		clearTimeout(this.pingTimeout);
		this.pingTimeout = null;

		// Set new ping timeout
		this.pingTimeout = setTimeout(()=> {

			// After two seconds consider device unavailable
			var timeout = setTimeout(()=> {

				console.log("Bridge: is offline");

				// Toggle status
				this.status = "off";

				// Emit offline event
				this.emit("offline");

				// Clear ping
				clearTimeout(this.pingTimeout);
				this.pingTimeout = null;

				// Keep retrying
				setTimeout(() => {
					this._pingBridge();
				}, 5000);

			}, 5000);

			// Ping bridge
			tcpp.ping({address: this.ip}, function (err, data) {

				// Check if bridge is alive
				if (data.max && data.min) {
					clearTimeout(timeout);

					// If previous state was off
					if (this.status == "off") {

						console.log("Bridge: is back online");

						// Emit back online
						this.emit("online");
					}

					// Toggle status
					this.status = "on";
				}

				// Clear ping
				clearTimeout(this.pingTimeout);
				this.pingTimeout = null;

			}.bind(this));
		}, 1000);
	}
}

module.exports = Bridge;