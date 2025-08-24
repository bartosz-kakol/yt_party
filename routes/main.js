const express = require("express");

/**
 * @param services {Services}
 * @returns {import("express").Router}
 */
module.exports = services => {
	const router = express.Router();

	router.get("/", (req, res, next) => {
		const newRoomId = services.db.createRoom();

		res.redirect(`/${newRoomId}/master`);
	});

	router.get("/:roomId/master", (req, res, next) => {
		const { roomId } = req.params;

		const room = services.db.getRoom(roomId);

		if (room === null) {
			res.render("room_doesnt_exist.ejs");
		}

		res.render("master", {
			room
		});
	});

	router.get("/:roomId", (req, res, next) => {
		const { roomId } = req.params;

		const room = services.db.getRoom(roomId);

		if (room === null) {
			res.render("room_doesnt_exist.ejs");
		}

		res.render("member", {
			room
		});
	});

	return router;
};
