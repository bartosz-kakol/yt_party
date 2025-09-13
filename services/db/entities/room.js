class Room {
	/** @type {string} */
	id;

	/** @type {Date} */
	createdAt;

	/** @type {Queue} */
	queue;

	/** @type {?State} */
	state;
}

module.exports = Room;
