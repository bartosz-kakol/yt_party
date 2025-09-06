const createError = require("http-errors");
const debug = require("debug")("yt-party:server");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const winston = require("winston");

const Database = require("./services/db/db");

const app = express();
const server = http.createServer(app);
// noinspection JSCheckFunctionSignatures,JSClosureCompilerSyntax
const io = new Server(server);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function pretty(obj) {
	return JSON.stringify(obj, undefined, 4);
}

app.locals.siteTitle = "YouTube Party";

/**
 * @typedef {Object} Services
 * @property {import("winston").Logger} logger
 * @property {import("./services/db/db")} db
 * @property {import("socket.io").Server} socket
 */

/** @type {Services} */
const services = {
	logger: winston.createLogger({
		format: winston.format.combine(
			winston.format.colorize(),
			winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
			winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
		),
		transports: [
			new winston.transports.Console(),
		]
	}),
	db: new Database(),
	socket: io,
}

app.use((req, res, next) => {
	res.on("finish", () => {
		if (res.statusCode >= 200 && res.statusCode < 300) {
			const didClean = services.db.cleanIfNecessary();

			if (didClean) {
				services.logger.info("✨ Cleaned database");
			}
		}
	});
	next();
});

app.use("/", require("./routes/main")(services));

// catch 404 and forward to the error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
// noinspection JSCheckFunctionSignatures
app.use((err, req, res, next) => {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get("env") === "development" ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render("error");
});

io.on("connection", socket => {
	if (!socket.handshake.query.roomId) {
		socket.disconnect();
		return;
	}

	const roomId = socket.handshake.query.roomId;
	const room = services.db.getRoom(roomId);

	if (room === null) {
		socket.disconnect();
		return;
	}

	socket.join(roomId);

	socket.on("state:sync", callback => {
		const room = services.db.getRoom(roomId);

		if (room === null) {
			callback({
				success: false,
				error: "Room does not exist."
			});
			return;
		}

		callback({
			success: true,
			state: room.state,
		});
	});

	socket.on("state:report", state => {
		const room = services.db.getRoom(roomId);

		if (room === null) return;

		if (state === null || typeof state !== "object") {
			services.logger.error(`Received invalid state for room ${roomId}:\n${pretty(state)}`);
			return;
		}

		room.state = state;
		io.to(roomId).emit("state:report", state);
	});
});

const port = normalizePort(process.env.PORT || "3000");
app.set("port", port);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val) {
	const port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}

function onError(error) {
	if (error.syscall !== "listen") {
		throw error;
	}

	const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

	switch (error.code) {
		case "EACCES":
			console.error(bind + " requires elevated privileges");
			process.exit(1);
			break;
		case "EADDRINUSE":
			console.error(bind + " is already in use");
			process.exit(1);
			break;
		default:
			throw error;
	}
}

function onListening() {
	const addr = server.address();
	const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;

	debug("Listening on " + bind);
}
