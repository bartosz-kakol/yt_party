class Queue {
	#queue;

	constructor() {
		this.#queue = [];
	}

	enqueue(item) {
		this.#queue.push(item);
	}

	addToBeginning(item) {
		this.#queue.unshift(item);
	}

	peek() {
		if (this.#queue.length === 0) {
			return null;
		}

		return this.#queue[0];
	}

	dequeue() {
		if (this.#queue.length === 0) {
			return null;
		}

		return this.#queue.shift();
	}

	moveItem(value, newPosition) {
		const index = this.#queue.indexOf(value);

		if (index === -1) {
			throw new Error(`Item "${value}" not found in the queue`);
		}

		if (newPosition < 0 || newPosition >= this.#queue.length) {
			throw new Error('New position is out of bounds');
		}

		// Remove item from the old position
		this.#queue.splice(index, 1);

		// Insert item at new position
		this.#queue.splice(newPosition, 0, value);
	}

	getQueue() {
		return [...this.#queue];
	}
}

module.exports = Queue;
