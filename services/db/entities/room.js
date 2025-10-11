export default class Room {
	/** @type {string} */
	id;

	/** @type {Date} */
	createdAt;

	/** @type {Queue<YouTubeVideoMetadata>} */
	queue;

	/** @type {?State} */
	state;
}
