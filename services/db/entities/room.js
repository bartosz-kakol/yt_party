class Room {
	/** @type {string} */
	id;

	/** @type {Date} */
	createdAt;

	/** @type {Queue} */
	queue;

	/** @type {?MasterState} */
	state;
}

module.exports = Room;
