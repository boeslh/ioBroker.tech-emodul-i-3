"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require('axios');

// Load your modules here, e.g.:
// const fs = require("fs");

class TechEmodulI3 extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "tech-emodul-i-3",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	async getAuthToken() {
    	/** Authentifiziert sich an der API und gibt ein Token zurück. */
    	const resp = await axios.post(`${this.config.APIURL}/authentication`, {
        	username: this.config.User,
        	password: this.config.Password
    	});
    	return [resp.data.user_id, resp.data.token];
	}
	
	async getModules(userid, token) {
    	/** Liest die Liste aller Module, auf die der Benutzer Zugriff hat. */
    	const headers = { "Authorization": `Bearer ${token}` };
    	const resp = await axios.get(`${this.config.APIURL}/users/${userid}/modules`, { headers: headers });
    	return resp.data;
	}

	async getModuleData(userid, token, udid) {
    	/** Liest alle Daten eines spezifischen Moduls aus. */
    	const headers = { "Authorization": `Bearer ${token}` };
    	const resp = await axios.get(`${this.config.APIURL}/users/${userid}/modules/${udid}`, { headers: headers });
    	return resp.data;
	}

	async getMenuData(userid, token, udid) {
    	/** Liest alle Menüdaten eines spezifischen Moduls aus. */
    	const headers = { "Authorization": `Bearer ${token}` };
    	const resp = await axios.get(`${this.config.APIURL}/users/${userid}/modules/${udid}/menu/MU`, { headers: headers });
    	return resp.data;
	}


	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config User: " + this.config.User);
		this.log.info("config Password: " + this.config.Password);
		this.log.info("config API-URL: " + this.config.APIURL);
		this.log.info("config Intervall: " + this.config.Intervall);

		if (!this.config.User) {
			this.log.warn("User is not set in the adapter configuration. Please set it in the adapter settings.");
			return;
		}

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectNotExistsAsync("UserID", {
			type: "state",
			common: {
				name: "UserID",
				type: "number",
				role: "value",
				read: true,
				write: true
			},
			native: {},
		});
		const [userid, token] = await this.getAuthToken();
		await this.setStateAsync("UserID", { val: userid, ack: true });
		this.log.info("UserID: " + userid);
		const s_userid = userid.toString();

		await this.setObjectNotExistsAsync(s_userid, {
			type: "folder",
			common: {
				name: s_userid
			},
			native: {},
		});

		const modules = await this.getModules(userid, token);
		const allData = {};
        const allMenu = {};

        for (const module of modules) {
            const modId = module.id;
            const udid = module.udid;
            const modName = module.name || modId;
			this.log.info(`Module: ${modName} (ID: ${modId}, UDID: ${udid})`);
            await this.setObjectNotExistsAsync(`${s_userid}.${udid}`, {
				type: "folder",
				common: {
					name: udid
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Name`, {
				type: "state",
				common: {
					name: "Name",
					type: "string",
					role: "value",
					read: true,
					write: true
				},
				native: {},
			});
			await this.setState(`${s_userid}.${udid}.Name`,`${modName}`, true);
			allData[modName] = await this.getModuleData(userid, token, udid);
            // allMenu[modName] = await getMenuData(userid, token, udid);
        
			const tiles = allData[`${modName}`]["tiles"];
			for (const tile of tiles) {
				const params = tile.params || {};
				switch (params.txtId) {
					case 192:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.ZH-Sensor`, {
							type: "state",
							common: {
								name: "ZH-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.ZH-Sensor`,`${params.value / 10}`, true);
						//console.log(`ZH Sensor: ${params.value / 10}`);
						break;
					case 194:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.WW-Sensor`, {
							type: "state",
							common: {
								name: "WW-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.WW-Sensor`,`${params.value / 10}`, true);	
						//console.log(`WW Sensor: ${params.value / 10}`);
						break;
					case 795:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Aussen-Sensor`, {
							type: "state",
							common: {
								name: "Aussen-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Aussen-Sensor`,`${params.value / 10}`, true);
						//console.log(`Aussen Sensor: ${params.value / 10}`);
						break;
					case 1040:
						const w_Puf_u_Sensor = params.value / 10;
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Puff_u-Sensor`, {
							type: "state",
							common: {
								name: "Puff_u-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Puff_u-Sensor`,`${params.value / 10}`, true);
						//console.log(`Puf_u: ${w_Puf_u_Sensor}`);
						break;
					case 196:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Kachelofen-Sensor`, {
							type: "state",
							common: {
								name: "Kachelofen-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Kachelofen-Sensor`,`${params.value / 10}`, true);
						//console.log(`Kachelofen: ${params.value / 10}`);
						break;
					case 197:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Brenner-Sensor`, {
							type: "state",
							common: {
								name: "Brenner-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Brenner-Sensor`,`${params.value / 10}`, true);
						console.log(`Brenner: ${params.value / 10}`);
						break;
					case 1288:
						const w_Puf_o_Sensor = params.value / 10;
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Puff_o-Sensor`, {
							type: "state",
							common: {
								name: "Puff_o-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Puff_o-Sensor`,`${params.value / 10}`, true);
						//console.log(`Puf_o: ${w_Puf_o_Sensor}`);
						break;
					case 1289:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Solar-Sensor`, {
							type: "state",
							common: {
								name: "Solar-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Solar-Sensor`,`${params.value / 10}`, true);
						//console.log(`Solar Sensor: ${params.value / 10}`);
						break;
					case 221:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.HK-FB-Sensor`, {
							type: "state",
							common: {
								name: "HK-FB-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.HK-FB-Sensor`,`${params.value / 10}`, true);
						//console.log(`Heizkreis Fussboden: ${params.value / 10}`);
						break;
					case 222:
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.HK-HK-Sensor`, {
							type: "state",
							common: {
								name: "HK-HK-Sensor",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.HK-HK-Sensor`,`${params.value / 10}`, true);
						//console.log(`Heizkreis HK: ${params.value / 10}`);
						break;
				}
			}
		}

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		// this.subscribeStates("testVariable");

		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		//let result = await this.checkPasswordAsync("admin", "iobroker");
		//this.log.info("check user admin pw iobroker: " + result);

		//result = await this.checkGroupAsync("admin", "admin");
		//this.log.info("check group user admin group admin: " + result);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new TechEmodulI3(options);
} else {
	// otherwise start the instance directly
	new TechEmodulI3();
}