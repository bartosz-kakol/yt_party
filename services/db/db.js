const uuid = require("uuid");
const Room = require("./entities/room");
const Queue = require("../../utils/queue");

const DAY_IN_MS = 24 * 60 * 60 * 1000;

class Database {
	/** @type {Date} */
	#lastCleaning;

	/** @type {Record<string, Room>} */
	#rooms;

	constructor() {
		this.#lastCleaning = new Date();
		this.#rooms = {};
	}

	/**
	 * @return {boolean}
	 */
	cleanIfNecessary() {
		const now = new Date();
		const diff = now - this.#lastCleaning;

		if (diff > DAY_IN_MS) {
			this.#clean();

			return true;
		}

		return false;
	}

	#clean() {
		const now = new Date();

		for (const roomId in this.#rooms) {
			const room = this.#rooms[roomId];
			const diff = now - room.createdAt;

			if (diff > DAY_IN_MS) {
				delete this.#rooms[roomId];
			}
		}
	}

	/**
	 * @return {string}
	 */
	createRoom() {
		const id = uuid.v4();
		const room = new Room();

		room.id = id
		room.queue = new Queue();
		room.state = null;

		this.#rooms[id] = room;

		return id;
	}

	/**
	 * @param id {string}
	 * @return {?Room}
	 */
	getRoom(id) {
		return this.#rooms[id] ?? null;
	}
}

module.exports = Database;
