const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);

const socket = new SocketConnection(ROOM_ID);

function tryGetYouTubeVideoId(url) {
	const testYouTubeVideoId = videoId => /^[a-zA-Z0-9_-]{11}$/.test(videoId);

	try {
		const urlObj = new URL(url);

		switch (urlObj.hostname) {
			case "www.youtube.com": {
				if (urlObj.pathname !== "/watch") return null;

				const videoId = urlObj.searchParams.get("v");
				if (!videoId) return null;

				if (!testYouTubeVideoId(videoId)) return null;

				return videoId;
			}
			case "youtu.be": {
				const videoId = urlObj.pathname.slice(1);

				if (!testYouTubeVideoId(videoId)) return null;

				return videoId;
			}
			default:
				return null;
		}
	} catch (e) {
		return null;
	}
}

function formatDuration(seconds) {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function MemberPage() {
	const [connected, setConnected] = React.useState(false);

	/** @type {?State} */
	const initialState = null;
	const [state, setState] = React.useState(initialState);

	const [videoUrl, setVideoUrl] = React.useState("");
	const [videoId, setVideoId] = React.useState("");

	function onStateChange(event) {
		const { state: newState } = event.detail;

		setState(newState);
	}

	function onAddVideoToQueueClick() {
		console.log(videoId);
	}

	function togglePlayback() {
		if (state?.playerState === "PLAYING") {
			socket.sendCommand("pause");
		} else {
			socket.sendCommand("play");
		}
	}

	React.useEffect(() => {
		if (!connected) return;

		socket.syncState()
			.then(receivedState => {
				log("socket", "State synced from server:\n%o", receivedState);

				setState(receivedState);
			});
	}, [connected]);

	React.useEffect(() => {
		setVideoId(tryGetYouTubeVideoId(videoUrl));
	}, [videoUrl]);

	React.useEffect(() => {
		socket.addEventListener("connected", () => {
			log("socket", "%cConnected", "color: green;");
			setConnected(true);
		});
		socket.addEventListener("stateChanged", onStateChange);

		socket.connect();

		return () => {
			socket.removeEventListener("stateChanged", onStateChange);
			socket.disconnect();
		}
	}, []);

	if (!connected) {
		return (
			<div className="container fill no-scroll center-h center-v">
				<h1>Łączenie...</h1>
			</div>
		)
	}

	return (
		<div className="container no-scroll" style={{width: "100%", height: "100%"}}>
			<div className="row no-scroll">
				<div className="container fill center-v">
					<b style={{fontSize: "1.5em"}}>
						{state?.videoMetadata?.title ?? "Nic nie jest odtwarzane"}
					</b>

					<p>
						{state?.videoMetadata?.author ?? "Dodaj coś do kolejki"}
					</p>
				</div>
				<div className="container center-v">
					<div className="row center-v center-h not-responsive">
						<button>
							<iconify-icon
								icon="mdi:rewind-10"
								width="36"
							></iconify-icon>
						</button>
						<button onClick={togglePlayback}>
							<iconify-icon
								icon={state?.playerState === "PLAYING" ? "mdi:pause" : "mdi:play"}
								width="48"
							></iconify-icon>
						</button>
						<button>
							<iconify-icon
								icon="mdi:fast-forward-10"
								width="36"
							></iconify-icon>
						</button>
					</div>
				</div>
			</div>
			<div id="playback-bar" className="row no-scroll">
				<div>
					<p>{formatDuration(state?.currentTime ?? 0)}</p>
				</div>
				<div>
					<p>{formatDuration(state?.duration ?? 0)}</p>
				</div>
				<div>
					<div></div>
					<div
						style={{
							width: `${(((state?.currentTime ?? 0) / (state?.duration ?? 1)) * 100).toFixed(2)}%`
						}}
					></div>
				</div>
			</div>

			<div className="separator"></div>

			<div className="row no-scroll not-responsive">
				<input
					type="text"
					placeholder="Link do filmu YouTube"
					style={{width: "100%"}}
					onChange={e => {
						setVideoUrl(e.target.value);
					}}
					value={videoUrl}
				/>
				<button disabled={videoId === null} onClick={onAddVideoToQueueClick}>
					<iconify-icon icon="mdi:plus" width="32"></iconify-icon>
				</button>
			</div>
			<div className="row fill no-scroll-x auto-scroll-y">

			</div>
		</div>
	);
}

root.render(<MemberPage />);
