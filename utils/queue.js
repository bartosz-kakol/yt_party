/**
 * @template T
 */
export default class Queue {
	/** @type {T[]} */
	#queue;

	constructor() {
		this.#queue = [];
	}

	/**
	 * @param item {T}
	 */
	enqueue(item) {
		this.#queue.push(item);
	}

	/**
	 * @param item {T}
	 */
	addToBeginning(item) {
		this.#queue.unshift(item);
	}

	/**
	 * @returns {?T}
	 */
	peek() {
		if (this.#queue.length === 0) {
			return null;
		}

		return this.#queue[0];
	}

	/**
	 * @returns {?T}
	 */
	dequeue() {
		if (this.#queue.length === 0) {
			return null;
		}

		return this.#queue.shift();
	}

	/**
	 * @param value {T}
	 * @param newPosition {number}
	 */
	moveItem(value, newPosition) {
		const index = this.#queue.indexOf(value);

		if (index === -1) {
			throw new Error(`Item "${value}" not found in the queue`);
		}

		if (newPosition < 0 || newPosition >= this.#queue.length) {
			throw new Error("New position is out of bounds");
		}

		// Remove item from the old position
		this.removeItemAt(index);

		// Insert item at new position
		this.#queue.splice(newPosition, 0, value);
	}

	/**
	 * @param index {number}
	 */
	removeItemAt(index) {
		if (index < 0 || index >= this.#queue.length) {
			throw new Error("Index is out of bounds");
		}

		this.#queue.splice(index, 1);
	}

	/**
	 * @return {T[]}
	 */
	toArray() {
		return [...this.#queue];
	}
}
