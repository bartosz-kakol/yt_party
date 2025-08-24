class SocketConnection {
	/** @type {SocketIOClient.Socket} */
	#socket;

	/**
	 * @param roomId {string}
	 */
	constructor(roomId) {
		this.#socket = io({
			autoConnect: false,
			query: {
				roomId
			}
		});
	}

	/**
	 * @param onConnect {?Function}
	 */
	connect(onConnect) {
		if (onConnect) {
			this.#socket.once("connect", onConnect);
		}

		this.#socket.connect();
	}

	get rawSocket() {
		return this.#socket;
	}

	reportState() {
		if (!this.#socket.connected) {
			console.error("Tried to report state but socket is not connected!");
			return;
		}

		this.#socket.emit("state:report", state);
	}

	async syncState() {
		if (!this.#socket.connected) {
			console.error("Tried to sync state but socket is not connected!");
			return;
		}

		return new Promise((resolve, reject) => {
			this.#socket.timeout(5000).emit("state:sync", (err, state) => {
				if (err) {
					reject(err);
					return;
				}

				resolve(state);
			});
		});
	}
}
