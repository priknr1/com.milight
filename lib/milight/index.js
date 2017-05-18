'use strict';

const dgram = require('dgram');
const discoverBridges = require('node-milight-promise').discoverBridges;
const Bridge = require('./Bridge');
const tcpp = require('tcp-ping');

class Milight {

	/**
	 * Construct Milight object
	 */
	constructor() {

		// Array holding bridges found
		this.bridges = [];
	}

	/**
	 * Search for bridges and
	 * resolve array with found
	 * bridges
	 * @returns {Promise} Resolves bridges array
	 */
	getBridges() {
		return this._discoverBridges();
	}

	/**
	 * Search for specific bridge.
	 * @param id
	 * @returns {*}
	 */
	getBridge(id) {
		for (var i in this.bridges) {
			if (this.bridges[i].id === id) return this.bridges[i];
		}
	}

	/**
	 * Discover bridges
	 * @returns {Promise} Resolves with bridges array
	 * @private
	 */
	_discoverBridges() {
		return new Promise(resolve => {

			this.bridges = [];

			console.log("Milight: starting bridge discovery...");

			// Use type 'all' to discover, both, legacy and v6 bridges
			// Use type 'v6' to discover v6 bridges will be discovered, only
			// If no type set, legacy bridges will be discovered, only
			discoverBridges({
				type: 'all'
			}).then(results => {
				if (Array.isArray(results) && results.length > 0) {
					results.forEach(bridge => {

						// Store bridge internally
						this._addBridge(new Bridge({
							ip: bridge.ip,
							mac: bridge.mac,
							id: new Buffer(bridge.mac).toString('base64'),
							bridgeVersion: (typeof bridge.name !== 'undefined' && bridge.name === "HF-LPB100") ? 6 : 5
						}));
					})
				}
				return resolve(this.bridges)
			});
		});
	}

	/**
	 * Send ping message to bridge
	 * to see if it is still online.
	 */
	pingBridge(ip) {

		// If ping timeout is already present clear it
		if (this.pingTimeout) clearTimeout(this.pingTimeout);
		this.pingTimeout = null;

		// Set new ping timeout
		this.pingTimeout = setTimeout(() => {

			// Ping bridge
			tcpp.ping({ address: ip }, (err, data) => {

				// Check if bridge is alive
				if (data.max && data.min) {
					clearTimeout(timeout);

					console.log("Milight: bridge: is  online");
				}

				// Clear ping
				clearTimeout(this.pingTimeout);
				this.pingTimeout = null;
			});

			// After two seconds consider device unavailable
			let timeout = setTimeout(() => {

				console.log("Milight: bridge is offline");

				// Clear ping
				clearTimeout(this.pingTimeout);
				this.pingTimeout = null;

				// Keep retrying
				setTimeout(() => {
					this.pingBridge(ip);
				}, 2000);

			}, 2000);
		}, 5000);
	}

	/**
	 * Adds or replaces an bridge object.
	 * @param bridge
	 * @private
	 */
	_addBridge(bridge) {
		let done = false;
		for (let i in this.bridges) {
			if (this.bridges[i].id === bridge.id) {

				// Replace it
				this.bridges[i] = bridge;
				done = true;
			}
		}

		// Add it
		if (!done) this.bridges.push(bridge);
	}
}

// Export as singleton
module.exports = new Milight();