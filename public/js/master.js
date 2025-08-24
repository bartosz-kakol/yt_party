const splashElement = document.getElementById("splash");

const socket = new SocketConnection(ROOM_ID);

function hideSplash() {
	splashElement.style.display = "none";
}

socket.connect(() => {
	hideSplash();
	log("socket", "%cConnected", "color: green;");
});

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
 * @property {PlayerState} playerState
 * @property {number} currentTime
 * @property {number} duration
 */

/** @type {MasterState} */
const state = {
	playerState: "UNSTARTED",
	currentTime: 0,
	duration: 0,
};

function reportState() {

}

// noinspection JSUnusedGlobalSymbols
function onYouTubeIframeAPIReady() {
	player = new YT.Player("player", {
		videoId: "dQw4w9WgXcQ",
		width: "100%",
		height: "100%",
		playerVars: {
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

function onPlayerReady(event) {
	log("player", `%cReady`, "color: green;");

	// Report the current time every second
	setInterval(() => {
		if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;

		state.currentTime = Math.ceil(player.getCurrentTime());
		state.duration = player.getDuration();

		reportState();
	}, 1000);
}

function onPlayerStateChange(event) {
	const stateNum = event.data;
	const state = playerStateMap[stateNum];

	log("player", `State changed to %c${state}`, "background: white; color: black; font-family: monospace; padding: 0 2px;");

	state.playerState = state;
	reportState();
}
