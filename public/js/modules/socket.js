class SocketConnection extends EventTarget {
	/** @type {SocketIOClient.Socket} */
	#socket;

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
	}

	connect() {
		this.#socket.once("connect", () => {
			this.dispatchEvent(new CustomEvent("connected"));
		});

		this.#socket.on("state:report", detail => {
			this.dispatchEvent(new CustomEvent("stateChanged", { detail }))
		});

		this.#socket.on("command", (commandName, args) => {
			this.dispatchEvent(new CustomEvent("commandReceived", { detail: { commandName, args } }))
		})

		this.#socket.connect();
	}

	get rawSocket() {
		return this.#socket;
	}

	/**
	 * @param state {State}
	 */
	reportState(state) {
		if (!this.#socket.connected) {
			console.error("Tried to report state but socket is not connected!");
			return;
		}

		this.#socket.emit("state:report", state);
	}

	/**
	 * @return {Promise<State>}
	 */
	async syncState() {
		if (!this.#socket.connected) {
			return Promise.reject("Tried to sync state but socket is not connected!");
		}

		return new Promise((resolve, reject) => {
			this.#socket.emit("state:sync", (response) => {
				if (!response.success) {
					reject(response.error);
					return;
				}

				resolve(response.state);
			});
		});
	}

	/**
	 * @param commandName {CommandName}
	 * @param args {?any}
	 */
	sendCommand(commandName, args = null) {
		if (!this.#socket.connected) {
			console.error("Tried to send command but socket is not connected!");
			return;
		}

		this.#socket.emit("command", commandName, args);
	}
}
