class SocketConnection extends EventTarget {
	/** @type {SocketIOClient.Socket} */
	#socket;

	/** @type {SocketStateCommander} */
	#stateCommander;

	/** @type {SocketQueueCommander} */
	#queueCommander;

	/** @type {SocketGeneralAPICommander} */
	#generalAPICommander;

	/**
	 * @param roomId {string}
	 */
	constructor(roomId) {
		super();

		this.#socket = io({
			autoConnect: false,
			query: {
				roomId
			}
		});

		this.#stateCommander = this.#commander("state");
		this.#queueCommander = this.#commander("queue");
		this.#generalAPICommander = this.#commander("api");
	}

	connect() {
		this.#socket.on("connect", () => {
			this.dispatchEvent(new CustomEvent("connected"));
		});

		this.#socket.on("state:report", data => {
			this.dispatchEvent(new CustomEvent("stateChanged", { detail: data }));
		});

		this.#socket.on("command", (commandName, arg) => {
			this.dispatchEvent(new CustomEvent("commandReceived", { detail: { commandName, arg } }));
		});

		this.#socket.on("queue:modified", queue => {
			this.dispatchEvent(new CustomEvent("queueModified", { detail: { queue } }));
		});

		this.#socket.connect();
	}

	/**
	 * @param commandName {CommandName}
	 * @param arg {?any}
	 */
	sendCommand(commandName, arg = null) {
		if (!this.#socket.connected) {
			console.error("Tried to send command but socket is not connected!");
			return;
		}

		this.#socket.emit("command", commandName, arg);
	}

	/**
	 * @param prefix {string}
	 * @returns {(command: string, ...args: any[]) => Promise<any>}
	 */
	#commanderExecutorFactory(prefix) {
		return (command, ...args) => {
			if (!this.#socket.connected) {
				return Promise.reject(`Tried to execute "${prefix}:${command}" but socket is not connected!`);
			}

			return new Promise((resolve, reject) => {
				this.#socket.emit(`${prefix}:${command}`, ...args, (response) => {
					if (!response.success) {
						reject(response.error);
						return;
					}

					resolve(response.data);
				});
			});
		};
	}

	/**
	 * @param executor {(command: string, ...args: any[]) => Promise<any>}
	 * @returns {Object}
	 */
	#commanderFactory(executor) {
		return new Proxy({}, {
			get(target, prop, _) {
				return (...args) => executor(prop, ...args);
			}
		});
	}

	/**
	 * @param prefix {string}
	 * @returns {Object}
	 */
	#commander(prefix) {
		return this.#commanderFactory(this.#commanderExecutorFactory(prefix).bind(this));
	}

	get state() {
		return this.#stateCommander;
	}

	get queue() {
		return this.#queueCommander;
	}

	get api() {
		return this.#generalAPICommander;
	}
}

/**
 * @typedef {Object} SocketQueueCommander
 * @property {() => Promise<YouTubeVideoMetadata[]>} sync
 * @property {(videoId: string) => Promise<void>} addVideo
 * @property {(index: number) => Promise<void>} removeVideo
 * @property {(index: number, newPosition: number) => Promise<void>} moveVideo
 */

/**
 * @typedef {Object} SocketGeneralAPICommander
 * @property {(videoId: string) => Promise<YouTubeVideoMetadata>} downloadVideoMetadata
 */

/**
 * @typedef {Object} SocketStateCommander
 * @property {(state: State) => Promise<void>} report
 * @property {() => Promise<State>} sync
 */
