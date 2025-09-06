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

		this.#socket.on("state:report", state => {
			this.dispatchEvent(new CustomEvent("stateChanged", state))
		});

		this.#socket.connect();
	}

	get rawSocket() {
		return this.#socket;
	}

	/**
	 * @param state {MasterState}
	 */
	reportState(state) {
		if (!this.#socket.connected) {
			console.error("Tried to report state but socket is not connected!");
			return;
		}

		this.#socket.emit("state:report", state);
	}

	/**
	 * @return {Promise<MasterState>}
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
}
