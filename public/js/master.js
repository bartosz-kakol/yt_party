const splashElement = document.getElementById("splash");
const sideMenuElement = document.getElementById("side-menu");
const qrCodeScreen = document.getElementById("qr-code-screen");
const qrCodeElement = document.getElementById("qr-code");
const waitingForPlayerScreen = document.getElementById("waiting-for-player-screen");

const memberUrl = new URL(`${window.location.origin}/${ROOM_ID}`);

const socket = new SocketConnection(ROOM_ID);

function hideSplash() {
	splashElement.style.display = "none";
}

socket.addEventListener("connected", () => {
	hideSplash();
	log("socket", "%cConnected", "color: green;");
});

socket.connect();

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
 * @typedef {Object} MasterState
 * @property {string} videoId
 * @property {PlayerState} playerState
 * @property {number} currentTime
 * @property {number} duration
 */

/** @type {MasterState} */
let state = {
	videoId: "dQw4w9WgXcQ",
	playerState: "UNSTARTED",
	currentTime: 0,
	duration: 0,
};

function reportState() {
	socket.reportState(state);
}

// noinspection JSUnusedGlobalSymbols
function onYouTubeIframeAPIReady() {
	player = new YT.Player("player", {
		videoId: state.videoId,
		width: "100%",
		height: "100%",
		playerVars: {
			autoplay: 1,
			modestbranding: 1,
			rel: 0,
			fs: 0
		},
		events: {
			onReady: onPlayerReady,
			onStateChange: onPlayerStateChange
		}
	});
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
const playerActionQueue = [];

/**
 * Executes the next action in the queue and removes it.
 */
function doQueuedPlayerAction() {
	const action = playerActionQueue.shift();

	if (action) action();
}

/**
 * Does everything to put the player in the same state as the current state indicated by the global `state` variable.
 */
function setPlayerToCurrentState() {
	const currentVideoId = player.getVideoData().video_id;

	// Manipulating the player can cause certain events to fire, which will modify the global state.
	// Therefore, a copy needs to be made as a sort of "reference".
	// This "reference" is what will be used to determine the ultimate state of the player.
	const referenceState = {...state};

	playerActionQueue.push(() => {
		player.seekTo(referenceState.currentTime, true);

		if (referenceState.playerState === "PLAYING") {
			player.playVideo();
		} else {
			player.pauseVideo();
		}
	});

	// If the video ID has changed, load the new video and let the player event handler take care of the queue.
	if (referenceState.videoId !== currentVideoId) {
		player.loadVideoById(state.videoId);
		return;
	}

	// If the video stayed the same, just take care of the queue immediately.
	doQueuedPlayerAction();
}

/**
 * This is the main function called when the player, socket and state is ready.
 * At this point the state has already been synced and the player can be interacted with.
 */
function onReady() {
	waitingForPlayerScreen.setAttribute("data-show", "0");
	sideMenuElement.style.visibility = null;

	setPlayerToCurrentState();

	// Report time and video details every second the player is playing.
	setInterval(() => {
		if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;

		state.videoId = player.getVideoData().video_id;
		state.currentTime = Math.ceil(player.getCurrentTime());
		state.duration = Math.floor(player.getDuration());

		reportState();
	}, 1000);
}

function onPlayerReady(event) {
	log("player", `%cReady`, "color: green;");

	// Sync state and show QR code if the state is empty or indicates that the player was not started yet.
	socket.syncState()
		.then(receivedState => {
			log("socket", "State synced from server:\n%o", receivedState);

			if (receivedState === null || receivedState.playerState === "UNSTARTED") {
				showQRCode();
			}

			if (receivedState !== null) {
				state = receivedState;
			}

			onReady();
		});
}

function onPlayerStateChange(event) {
	const stateNum = event.data;
	const stateName = playerStateMap[stateNum];

	log("player", `State changed to %c${stateName}`, "background: white; color: black; font-family: monospace; padding: 0 2px;");

	state.playerState = stateName;

	reportState();

	if (["PLAYING", "PAUSED"].includes(stateName)) {
		doQueuedPlayerAction();
	}
}

function showQRCode() {
	try {
		const dotsOptions = {
			color: "white",
			type: "rounded"
		};

		const qr = new QRCodeJs({
			data: memberUrl.toString(),
			cornersSquareOptions: dotsOptions,
			cornersDotOptions: dotsOptions,
			dotsOptions: dotsOptions,
			backgroundOptions: {
				color: "black",
				round: 0.2
			}
		});
		qr.append(qrCodeElement, { clearContainer: true });

		qrCodeScreen.setAttribute("data-show", "1");
	} catch (e) {
		console.warn("Error while creating QR code! %o", e);
		alert("Nie udało się wygenerować kodu QR.");
	}
}

function hideQRCode() {
	qrCodeScreen.setAttribute("data-show", "0");
}

function copyMemberLink() {
	navigator.clipboard.writeText(memberUrl.toString())
		.then(() => {
			alert("Link skopiowany do schowka!");
		});
}
