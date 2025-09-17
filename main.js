"use strict";

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require('axios');

let i18nList = {};
let conf_lang = "en";

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

	async geti18nList(userid, token, lang) {
    	/** Liest alle Menüdaten eines spezifischen Moduls aus. */
    	const headers = { "Authorization": `Bearer ${token}` };
    	const resp = await axios.get(`${this.config.APIURL}/i18n/${lang}`, { headers: headers });
    	return resp.data;
	}

	async getLanguage() {
    try {
        const obj = await this.getForeignObjectAsync('system.config');
        
        // 1. Prüfe, ob das Objekt existiert und die notwendigen Eigenschaften hat.
        if (obj && obj.common && obj.common.language) {
            const language = obj.common.language;
            this.log.info(`Die konfigurierte Sprache ist: ${language}`);
            return language;
        } else {
            // 2. Fallback, wenn das Objekt unvollständig ist.
            this.log.warn("Sprache konnte nicht aus 'system.config' ermittelt werden. Verwende Standard 'en'.");
            return 'en';
        }
    } catch (e) {
        // 3. Fehlerbehandlung, falls der Aufruf fehlschlägt.
        this.log.error(`Fehler beim Abrufen der Systemkonfiguration: ${e.message}`);
        return 'en'; // Setze auch hier einen Standardwert
    }
}
	

	async getAllData() {
		// This method can be used to fetch data from the API or perform other operations.
		const [userid, token] = await this.getAuthToken();
		this.setStateAsync("UserID", { val: userid, ack: true });
		const s_userid = userid.toString();
        const modules = await this.getModules(userid, token);
		const allData = {};
        const allMenu = {};
		this.log.info("Get all Tiles " + userid );
			
        for (const module of modules) {
            const modId = module.id;
            const udid = module.udid;
            const modName = module.name || modId;
			this.log.info("Get all Tiles " + modName + " (ID: " + modId + ", UDID: " + udid + ")");
			allData[modName] = await this.getModuleData(userid, token, udid);
            const tiles = allData[`${modName}`]["tiles"];
			for (const tile of tiles) {
				const params = tile.params || {};
				switch (tile.type) {
					case 1:
						console.log(`Tile: ID: ${tile.id}, Value: ${params.value} ` );
					    await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}`,parseFloat(`${params.value / 10}`), true);
					    break;
					case 6:
						console.log(`Tile: ID: ${tile.id}, Status: ${params.statusId} ` );
					    await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.state`,parseFloat(`${params.statusId}`), true);	
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.widget1`,parseFloat(`${params.widget1.value}`), true);
					    await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.widget2`,parseFloat(`${params.widget2.value}`), true);
						break;
					case 23:
						console.log(`Tile: ID: ${tile.id}, Status: ${params.currentTemp / 10} ` );
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`,parseFloat(`${params.currentTemp / 10}`), true);
                        await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`,parseFloat(`${params.setTemp}`), true);
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`,parseFloat(`${params.valvePump}`), true);
						break;
				}
			}

			allMenu[modName] = await this.getMenuData(userid, token, udid);
			const elements = allMenu[`${modName}`]["data"]["elements"];
			for (const element of elements) {
				const params = element.params || {};
				switch (element.type) {
					case 1:
						console.log(`Element: ID: ${element.id}, Value: ${params.value} ` );
					    const mstate = await this.getStateAsync(`${s_userid}.${udid}.MU.${element.id}`);
						if ( mstate?.val !== params.value) {
						    console.log(`Element: ID: ${element.id}, txtId: ${element.txtId}, Value: ${params.value} changed - Write` );
							await this.setState(`${s_userid}.${udid}.MU.${element.id}`,parseInt(`${params.value}`), true);
						}
					    break;
				}
			}
		}

	}
	
	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		let s_Auto_Sommer_Temp = "";
		let grouping_id = 0;
		let grouping_name = "";
		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config User: " + this.config.User);
		//this.log.info("config Password: " + this.config.Password);
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
		const conf_obj = await this.getForeignObjectsAsync('system.config');
		//if (conf_obj && conf_obj.common) {
			conf_lang = await this.getLanguage();
			this.log.info(`System language: ${conf_lang}`);
		//}
		i18nList = await this.geti18nList(userid, token, conf_lang );
		const i18nItem = i18nList["data"]["4622"];
		this.log.info(`i18n Key: ${i18nItem} (${conf_lang})`);
		
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
			// generate Folder for each Device
            await this.setObjectNotExistsAsync(`${s_userid}.${udid}`, {
				type: "folder",
				common: {
					name: udid
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles`, {
				type: "folder",
				common: {
					name: "Tiles"
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${s_userid}.${udid}.MU`, {
				type: "folder",
				common: {
					name: "User Menue"
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
					write: false
				},
				native: {},
			});
			await this.setState(`${s_userid}.${udid}.Name`,`${modName}`, true);
			allData[modName] = await this.getModuleData(userid, token, udid);
            allMenu[modName] = await this.getMenuData(userid, token, udid);
        
			const tiles = allData[`${modName}`]["tiles"];
			const elements = allMenu[`${modName}`]["data"]["elements"];

			for (const element of elements) {
				if (element.type == 0) {
					// Grouping Menu Element
					grouping_id = element.id;
					grouping_name = i18nList["data"][`${element.txtId}`];
				}
				if (element.type == 1) {
					const params = element.params || {};
					let ptxt= "";
					//const ptxt= i18nList["data"][`${element.txtId}`]
					if (element.parentId == grouping_id) {
						ptxt= `${grouping_name}/${i18nList["data"][`${element.txtId}`]}/${i18nList["data"][`${params.txtId}`]}`
					} else {
					    ptxt= `${i18nList["data"][`${element.txtId}`]}/${i18nList["data"][`${params.txtId}`]}`
					}
				    console.log(`Elemet: ID: ${element.id}, txtId: ${element.txtId}, txtId: ${params.txtId}, Text: ${ptxt}, Value: ${params.value} ` );
					await this.setObjectNotExistsAsync(`${s_userid}.${udid}.MU.${element.id}`, {
						type: "state",
						common: {
							name: `${ptxt}`,
							type: "number",
							role: "value",
							read: true,
							write: true
						},
						native: {},
					});
					await this.setState(`${s_userid}.${udid}.MU.${element.id}`,parseInt(`${params.value}`), true);
					if (element.id == 4622) {
					    s_Auto_Sommer_Temp = `${s_userid}.${udid}.MU.${element.id}`;
					}
				}
				
			}

			
			for (const tile of tiles) {
				let widget1= {};
				let widget2= {};
				let pval=0;
				const params = tile.params || {};
				let ptxt= `${i18nList["data"][`${params.txtId}`]}/${i18nList["data"][`${tile.txtId}`]}`
				switch (tile.type) {
					case 1:
						ptxt= i18nList["data"][`${params.txtId}`]
						pval = params.value / 10;
						console.log(`Tiles: ID: ${tile.id}, txtId: ${params.txtId}, Text: ${ptxt}, Value: ${pval} ` );
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}`, {
							type: "state",
							common: {
								name: `${ptxt}`,
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}`,parseFloat(`${params.value / 10}`), true);
						break;
					case 6:
						widget1= params.widget1 || {};
						pval =widget1.value;
						console.log(`Tiles: ID: ${tile.id}, txtId: ${widget1.txtId}, Text: ${ptxt}, Value: ${pval} ` );
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}`, {
				            type: "folder",
				            common: {
					        name: `${tile.id}`
				            },
				            native: {},
			                });
			
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}.state`, {
							type: "state",
							common: {
								name: "Status",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.state`,params.statusId, true);
						ptxt= i18nList["data"][`${widget1.txtId}`];
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}.widget1`, {
							type: "state",
							common: {
								name: `${ptxt}`,
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.widget1`,parseFloat(`${widget1.value}`), true);
						ptxt= i18nList["data"][`${widget2.txtId}`];
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}.widget2`, {
							type: "state",
							common: {
								name: `${ptxt}`,
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
						await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.widget2`,parseFloat(`${widget2.value}`), true);
						break;
				    case 23:
						ptxt= i18nList["data"][`${params.txtId}`]
						console.log(`Tiles: ID: ${tile.id}, txtId: ${params.txtId}, Text: ${ptxt}, Value: ${pval} ` );
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}`, {
				            type: "folder",
				            common: {
					        name: `${ptxt}`
				            },
				            native: {},
			                });
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`, {
							type: "state",
							common: {
								name: "currentTemp",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
				        await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`,parseFloat(`${params.currentTemp / 10}`), true);
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}.setTemp`, {
							type: "state",
							common: {
								name: "setTemp",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
				        await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`,parseFloat(`${params.setTemp}`), true);
						await this.setObjectNotExistsAsync(`${s_userid}.${udid}.Tiles.${tile.id}.valvePump`, {
							type: "state",
							common: {
								name: "valvePump",
								type: "number",
								role: "value",
								read: true,
								write: false
							},
						native: {},
						});
				        await this.setState(`${s_userid}.${udid}.Tiles.${tile.id}.currentTemp`,parseFloat(`${params.valvePump}`), true);
						
				}
			}
			
		}
		//this.log.info("Intervall starten " + this.config.Intervall);
		setInterval(() => { this.getAllData()}, this.config.Intervall * 1000);
		//this.subscribeStates("601931793.bebbe8daf62b8b2bd72b4c6c6a4ec6a2.Auto_Sommer_Temp");
		//this.log.info(`SubscribeStates: ${s_Auto_Sommer_Temp}`);
		this.subscribeStates(`${s_Auto_Sommer_Temp}`); 
		
		// This is a placeholder. Replace with the actual state path if needed.
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

	async setModuleData(userid, token, udid, ido, value) {
		/** Setzt Daten für ein spezifisches Modul. */
		const headers = { "Authorization": `Bearer ${token}` };
		const resp = await axios.post(`${this.config.APIURL}/users/${userid}/modules/${udid}/menu/MU/ido/${ido}`, { value: value }, { headers: headers });
		this.log.info(`Set Module Data: ${JSON.stringify(resp.data)}`);
		return resp.data;
	}

	async onStateChange(id, state) {
		//console.log(`State changed: ${id} - New value: ${state ? state.val : "undefined"}`);
		if (id.includes("4622")) {
			const newValue = state ? state.val : null;
			if (newValue !== null) {
				this.log.info(`Auto Sommer Temp changed to: ${newValue}`);
				const [userid, token] = await this.getAuthToken();
				const s_userid = userid.toString();
				const modules = await this.getModules(userid, token);
				const allData = {};
				const allMenu = {};
				let udid = "";
				for (const module of modules) {
					const modId = module.id;
					udid = module.udid;
				}
				//const headers1 = { "Authorization": `Bearer ${token}` };
    			//const resp = await axios.post(`${this.config.APIURL}/users/${userid}/modules/${udid}/menu/MU/ido/4622`, { value: `${newValue}` }, { headers: `${headers1}`});
				const status = await this.setModuleData(userid, token, udid, 4622, newValue);
			} else {
				this.log.warn("Auto Sommer Temp state was deleted or set to null.");
			}
		}

	}
	//onStateChange(""`${s_userid}.${udid}.Auto_Sommer_Temp`", (id, state) => {
	//	const newValue = state.val;
	//	//this.log.info(`Auto Sommer Temp changed to: ${newValue}`);
	//	console.log(`Auto Sommer Temp changed to: ${newValue}`);	
	//});

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
	//onStateChange(id, state) {
	//	if (state) {
	//		// The state was changed
	//		this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
	//	} else {
	//		// The state was deleted
	//		this.log.info(`state ${id} deleted`);
	//	}
	//}

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