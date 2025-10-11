const sideMenuElement = document.getElementById("side-menu");
const qrCodeElement = document.getElementById("qr-code");
const playerWrapper = document.getElementById("player-wrapper");

const qrCodeScreen = Screens.get("qr-code");
const waitingForPlayerScreen = Screens.get("waiting-for-player");
const interactionScreen = Screens.get("interaction");

class ReadinessTracker extends EventTarget {
	/** @type {Record<string, boolean>} */
	#components = {};

	addComponent(name) {
		if (this.#components.hasOwnProperty(name)) {
			console.warn(`Tried to add component "${name}" twice!`);
		}

		this.#components[name] = false;

		this.dispatchEvent(new CustomEvent("componentAdded", { detail: { name } }));
	}

	/**
	 * @return {Record<string, boolean>}
	 */
	get components() {
		return {...this.#components};
	}

	componentReady(name) {
		if (!this.#components.hasOwnProperty(name)) {
			throw new Error(`Component "${name}" does not exist!`);
		}

		if (this.#components[name] === true) return;

		this.#components[name] = true;

		if (Object.values(this.#components).every(v => v)) {
			this.dispatchEvent(new CustomEvent("ready"));
		}
	}
}

const readinessTracker = new ReadinessTracker();

readinessTracker.addComponent("YouTubeIframeAPI");

// noinspection JSUnusedGlobalSymbols
function onYouTubeIframeAPIReady() {
	readinessTracker.componentReady("YouTubeIframeAPI");
}

const socket = new SocketConnection(ROOM_ID);
readinessTracker.addComponent("socket");

const memberUrl = new URL(`${window.location.origin}/${ROOM_ID}`);

let player;

/** @typedef {"UNSTARTED"|"ENDED"|"PLAYING"|"PAUSED"|"BUFFERING"|"CUED"} PlayerState */

/** @type {Record<number, PlayerState>} */
const playerStateMap = {
	[-1]: "UNSTARTED",
	0: "ENDED",
	1: "PLAYING",
	2: "PAUSED",
	3: "BUFFERING",
	5: "CUED",
};

/**
 * @typedef {Object} StateVideoMetadata
 * @property {string} title
 * @property {string} author
 */

/**
 * @typedef {Object} State
 * @property {string} videoId
 * @property {StateVideoMetadata} videoMetadata
 * @property {PlayerState} playerState
 * @property {number} currentTime
 * @property {number} duration
 */

/** @typedef {() => ?State} StateDefiner */

class StateManager extends EventTarget {
	/** @type {?State} */
	#state = null;

	/** @type {StateDefiner} */
	#definer;

	/**
	 * @param stateDefiner {StateDefiner}
	 */
	constructor(stateDefiner) {
		super();
		this.#definer = stateDefiner;
	}

	/**
	 * @return {?State}
	 */
	get state() {
		return structuredClone(this.#state);
	}

	/**
	 * @param value {?State}
	 */
	set state(value) {
		this.#state = structuredClone(value);

		this.dispatchEvent(new CustomEvent("stateChanged", { detail: { state: this.state } }));
	}

	updateState() {
		this.state = this.#definer();
	}
}

function defineState() {
	if (!player) return null;

	const videoData = player.getVideoData();

	return {
		videoId: videoData.video_id ?? null,
		videoMetadata: {
			title: videoData.title,
			author: videoData.author
		},
		playerState: playerStateMap[player.getPlayerState()],
		currentTime: Math.floor(player.getCurrentTime()),
		duration: Math.floor(player.getDuration())
	};
}

const stateManager = new StateManager(defineState);

stateManager.addEventListener("stateChanged", event => {
	const { state } = event.detail;

	// noinspection JSIgnoredPromiseFromCall
	socket.state.report(state);
});

function askForInteraction() {
	interactionScreen.element.addEventListener("click", () => {
		interactionScreen.hide();

		createPlayer();
	}, { once: true });

	interactionScreen.show();
}

function createPlayer() {
	waitingForPlayerScreen.show();

	readinessTracker.addComponent("player");
	readinessTracker.addEventListener("ready", onPlayerReady, { once: true });

	player = new YT.Player("player", {
		width: "100%",
		height: "100%",
		playerVars: {
			autoplay: 1,
			modestbranding: 1,
			rel: 0,
			fs: 0
		},
		events: {
			onReady: () => {
				readinessTracker.componentReady("player");
			},
			onStateChange: onPlayerStateChange
		}
	});
}

function onPlayerReady() {
	log("player", `%cReady`, "color: green;");

	readinessTracker.addComponent("state");
	readinessTracker.addEventListener("ready", () => {
		waitingForPlayerScreen.hide();
		onReady();
	}, { once: true });

	// Sync state and show QR code if the state is empty or indicates that the player was not started yet.
	socket.state.sync()
		.then(receivedState => {
			log("socket", "State synced from server:\n%o", receivedState);

			if (receivedState === null || receivedState.playerState === "UNSTARTED") {
				showQRCode();
			}

			if (receivedState !== null) {
				stateManager.state = receivedState;
			}

			readinessTracker.componentReady("state");
		});
}

/**
 * This is the main function called when the player, socket and state are ready.
 * At this point the state has already been synced and the player can be interacted with.
 */
function onReady() {
	sideMenuElement.style.visibility = null;

	setPlayerToCurrentState();

	// Report the current state every second if the player is playing.
	setInterval(() => {
		if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;

		stateManager.updateState();
	}, 1000);
}

// This is a simple queue system, which can be used to queue actions that should be performed when the player
// is ready to be controlled.
//
// For example, if the app wants to:
// - Load a new video.
// - Seek to a specific timestamp.
// - Play/pause the video.
//
// It must first queue the last two actions and then invoke `player.loadVideoById()`. This will guarantee that
// the player will perform them as soon as it is able to.
// This is necessary because after loading a new video, the player can be in a state where it is not ready to perform
// these actions immediately.
//
// Every action added to the queue is removed when invoked.
/** @type {Function[]} */
const playerActionQueue = [];

/**
 * Executes the next action in the queue and removes it.
 */
function doQueuedPlayerAction() {
	const action = playerActionQueue.shift();

	if (action) action();
}

/**
 * Does everything to put the player in the same state as the current state held in the `StateManager`.
 */
function setPlayerToCurrentState() {
	const currentVideoId = player.getVideoData().video_id;

	// Manipulating the player can cause certain events to fire, which will modify the global state.
	// Therefore, a copy needs to be made as a sort of "reference".
	// This "reference" is what will be used to determine the ultimate state of the player.
	const referenceState = stateManager.state;

	if (referenceState === null) return;

	const actions = () => {
		player.seekTo(referenceState.currentTime, true);

		if (referenceState.playerState === "PLAYING") {
			player.playVideo();
		} else {
			player.pauseVideo();
		}
	};

	// If the video ID has changed, add the rest of the actions to the queue, then load the new video and let the player
	// event handler take care of the queue.
	if (referenceState.videoId !== null && referenceState.videoId !== currentVideoId) {
		playerActionQueue.push(actions);
		player.loadVideoById(referenceState.videoId);
		return;
	}

	// If loading a new video was not necessary, just execute the remaining actions immediately.
	actions();
}

function onPlayerStateChange(event) {
	const stateNum = event.data;
	const stateName = playerStateMap[stateNum];

	log("player", `State changed to %c${stateName}`,
		"background: white; color: black; font-family: monospace; padding: 0 4px; border-radius: 4px;");

	stateManager.updateState();

	if (["PLAYING", "PAUSED"].includes(stateName)) {
		while (playerActionQueue.length > 0) {
			doQueuedPlayerAction();
		}
	}
}

function showQRCode() {
	try {
		const qr = new QRCodeJs({
			data: memberUrl.toString(),
			cornersSquareOptions: {
				color: "#c4c4ce",
				type: "square"
			},
			cornersDotOptions: {
				color: "#ddddec",
				type: "square"
			},
			dotsOptions: {
				gradient: {
					type: "linear",
					rotation: 3 * Math.PI / 4,
					colorStops: [
						{ offset: 0.2, color: "#b7ecfd" },
						{ offset: 0.9, color: "#6acff1" }
					]
				},
				type: "square"
			},
			backgroundOptions: {
				color: "black"
			},
			isResponsive: true
		});
		qr.append(qrCodeElement, { clearContainer: true });

		qrCodeScreen.show();
	} catch (e) {
		console.warn("Error while creating QR code! %o", e);
		alert("Nie udało się wygenerować kodu QR.");
	}
}

function copyMemberLink() {
	navigator.clipboard.writeText(memberUrl.toString())
		.then(() => {
			alert("Link skopiowany do schowka!");
		});
}


socket.addEventListener("connected", () => {
	log("socket", "%cConnected", "color: green;");
	readinessTracker.componentReady("socket");
});

socket.addEventListener("commandReceived", event => {
	/** @type {CommandName} */
	const commandName = event.detail.commandName;
	const arg = event.detail.arg;

	log("socket",
		`Received command %c${commandName}%c with arg:\n%o`,
		"background: orange; color: white; font-family: monospace; padding: 0 4px; border-radius: 4px;",
		"",
		arg
	);

	switch (commandName) {
		case "play":
			player.playVideo();
			break;
		case "pause":
			player.pauseVideo();
			break;
		case "seek":
			player.seekTo(arg, true);
			break;
		default:
			console.warn(`Unknown command "${commandName}" received!`);
			break;
	}
});

stateManager.addEventListener("stateChanged", event => {
	/** @type {?State} */
	const state = event.detail.state;

	const isVideoSet = state?.videoId === null;

	playerWrapper.style.visibility = isVideoSet ? "hidden" : null;
});

readinessTracker.addEventListener("ready", askForInteraction, { once: true });

function logReadinessTrackerState() {
	const components = readinessTracker.components;
	const prettyText = Object.entries(components)
		.map(([name, ready]) =>
			`${ready ? "🟩" : "🟥"} ${name}`
		)
		.join("\n");

	log("readiness-tracker", `Components:\n%c${prettyText}`,
		"font-family: monospace; font-weight: bolder;");
}

readinessTracker.addEventListener("componentAdded", logReadinessTrackerState);
readinessTracker.addEventListener("ready", logReadinessTrackerState);

socket.connect();
