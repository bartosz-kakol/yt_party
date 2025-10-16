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

/**
 * @param value {number}
 * @param max {number}
 * @param formatter {function(number): string}
 * @param attributes
 */
function ProgressBar({ value, max, formatter = String, ...attributes }) {
	return (
		<div {...attributes} className="progress-bar">
			<div>
				<p>{formatter(value)}</p>
			</div>
			<div>
				<p>{formatter(max)}</p>
			</div>

			<div>
				<div></div>
				<div
					style={{
						width: `${((value / max) * 100).toFixed(2)}%`
					}}
				></div>
			</div>
		</div>
	);
}

/**
 * @param onMainButtonClick
 * @param onRewind10
 * @param onFastForward10
 * @param state {?State}
 */
function PlaybackPanel({ onMainButtonClick, onRewind10, onFastForward10, state }) {
	const controlsAttributes = {
		"UNSTARTED": {
			disabled: ["rewind10", "main", "fastforward10"],
			mainButtonIcon: "mdi:play"
		},
		"ENDED": {
			disabled: ["fastforward10"],
			mainButtonIcon: "mdi:repeat"
		},
		"PLAYING": {
			disabled: [],
			mainButtonIcon: "mdi:pause"
		},
		"PAUSED": {
			disabled: [],
			mainButtonIcon: "mdi:play"
		},
		"BUFFERING": {
			disabled: ["main"],
			mainButtonIcon: "mdi:hourglass-full"
		},
		"CUED": {
			disabled: ["rewind10", "main", "fastforward10"],
			mainButtonIcon: "mdi:hourglass-full"
		}
	};

	return (
		<>
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
						<PlaybackControls
							onMainButtonClick={onMainButtonClick}
							onRewind10={onRewind10}
							onFastForward10={onFastForward10}
							{...controlsAttributes[state?.playerState ?? "UNSTARTED"]}
						/>
					</div>
				</div>
			</div>

			<div className="row no-scroll">
				<ProgressBar
					id="playback-bar"
					value={state?.currentTime ?? 0}
					max={state?.duration ?? 1}
					formatter={formatDuration}
				/>
			</div>
		</>
	);
}

/**
 * @param onMainButtonClick
 * @param mainButtonIcon
 * @param onRewind10
 * @param onFastForward10
 * @param disabled {("rewind10"|"main"|"fastforward10")[]}
 */
function PlaybackControls({ onMainButtonClick, mainButtonIcon, onRewind10, onFastForward10, disabled }) {
	return (
		<>
			<button onClick={onRewind10} disabled={disabled.includes("rewind10")}>
				<iconify-icon
					icon="mdi:rewind-10"
					width={36}
				></iconify-icon>
			</button>
			<button onClick={onMainButtonClick} disabled={disabled.includes("main")}>
				<iconify-icon
					icon={mainButtonIcon}
					width={48}
				></iconify-icon>
			</button>
			<button onClick={onFastForward10} disabled={disabled.includes("fastforward10")}>
				<iconify-icon
					icon="mdi:fast-forward-10"
					width={36}
				></iconify-icon>
			</button>
		</>
	);
}

function MemberPage() {
	const [connected, setConnected] = React.useState(false);

	/** @type {?State} */
	const initialState = null;
	const [state, setState] = React.useState(initialState);

	const [videoUrlInput, setVideoUrlInput] = React.useState("");
	const [videoIdInput, setVideoIdInput] = React.useState("");

	/** @type {?StateVideoMetadata} */
	const initialDownloadedVideoMetadata = null;
	const [downloadedVideoMetadata, setDownloadedVideoMetadata] = React.useState(initialDownloadedVideoMetadata);

	/** @type {?(string[])} */
	const initialVideoQueue = null;
	const [videoQueue, setVideoQueue] = React.useState(initialVideoQueue);

	/** @type {?number} */
	const initialMovingQueueVideoIndex = null;
	const [movingQueueVideoIndex, setMovingQueueVideoIndex] = React.useState(initialMovingQueueVideoIndex);

	function onConnected() {
		log("socket", "%cConnected", "color: green;");
		setConnected(true);
	}

	function onStateChange(event) {
		const { state: newState } = event.detail;

		setState(newState);
	}

	function onQueueModified(event) {
		/** @type {string[]} */
		const queue = event.detail.queue;

		log("socket", "Queue modified:\n%o", queue);
		setVideoQueue(queue);
	}

	function onAddVideoToQueueClick() {
		if (videoIdInput === null) return;

		socket.queue.addVideo(videoIdInput)
			.then(() => {
				log("socket", `Video added to queue:\n%c${videoIdInput}`, "font-family: monospace; font-size: revert;");
			})
			.catch(e => {
				console.warn(e);
			});

		setVideoUrlInput("");
	}

	function onPlaybackPanelMainButtonClick() {
		switch (state?.playerState) {
			case "UNSTARTED":
				// Do nothing
				break;
			case "ENDED":
				socket.sendCommand("seek", 0);
				break;
			case "PLAYING":
				socket.sendCommand("pause");
				break;
			case "PAUSED":
				socket.sendCommand("play");
				break;
			case "BUFFERING":
				// Do nothing
				break;
			case "CUED":
				socket.sendCommand("play");
				break;
			default:
				break;
		}
	}

	/**
	 * @param index {number}
	 */
	function onMoveVideoInQueueButtonClick(index) {
		setMovingQueueVideoIndex(index);
	}

	React.useEffect(() => {
		socket.addEventListener("connected", onConnected);
		socket.addEventListener("stateChanged", onStateChange);
		socket.addEventListener("queueModified", onQueueModified);

		socket.connect();

		return () => {
			socket.removeEventListener("connected", onConnected);
			socket.removeEventListener("stateChanged", onStateChange);
			socket.removeEventListener("queueModified", onQueueModified);

			socket.disconnect();
		}
	}, []);

	React.useEffect(() => {
		if (!connected) return;

		socket.state.sync()
			.then(receivedState => {
				log("socket", "State synced from server:\n%o", receivedState);

				setState(receivedState);
			})
			.catch(err => {
				console.warn(err);
			});

		socket.queue.sync()
			.then(receivedQueue => {
				log("socket", "Queue synced from server:\n%o", receivedQueue);

				setVideoQueue(receivedQueue);
			})
			.catch(err => {
				console.warn(err);
			});
	}, [connected]);

	React.useEffect(() => {
		setVideoIdInput(tryGetYouTubeVideoId(videoUrlInput));
	}, [videoUrlInput]);

	React.useEffect(() => {
		if (!videoIdInput) return;

		setDownloadedVideoMetadata(null);

		socket.api.downloadVideoMetadata(videoIdInput)
			.then(metadata => {
				if (videoIdInput !== metadata.id) return;

				setDownloadedVideoMetadata(metadata);

				log("socket", "Video metadata downloaded:\n%o", metadata);
			})
			.catch(e => {
				console.warn(e);
			});
	}, [videoIdInput]);

	if (!connected) {
		return (
			<div className="container fill no-scroll center-h center-v">
				<h1>Łączenie...</h1>
			</div>
		);
	}

	return (
		<div className="container no-scroll" style={{width: "100%", height: "100%"}}>
			<PlaybackPanel
				state={state}
				onMainButtonClick={onPlaybackPanelMainButtonClick}
			/>

			<div className="separator"></div>

			<div className="row not-responsive" style={{position: "relative"}}>
				{
					videoIdInput &&
					(
						<div id="video-metadata" className="container no-scroll not-responsive center-h center-v">
							{
								downloadedVideoMetadata && downloadedVideoMetadata.id === videoIdInput ?
									<div className="row fill no-scroll not-responsive">
										<img
											src={downloadedVideoMetadata.thumbnail}
											alt={`Thumbnail for ${downloadedVideoMetadata.title}`}
											style={{
												height: "100%",
												aspectRatio: "16 / 9",
												borderRadius: "8px"
											}}
										/>

										<div className="container fill no-scroll">
											<div className="row no-scroll" style={{minWidth: "0", paddingBottom: "2px"}}>
												<h3 className="ellipsis" style={{margin: 0}}>{downloadedVideoMetadata.title}</h3>
											</div>
											<div className="row no-scroll" style={{minWidth: "0", paddingTop: "2px"}}>
												<p className="ellipsis" style={{margin: 0, color: "#aaa"}}>{downloadedVideoMetadata.author}</p>
											</div>
											<div className="row no-scroll fill not-responsive" style={{justifyContent: "flex-end", alignItems: "flex-end", flexShrink: "0"}}>
												<button className="btn-secondary">
													<iconify-icon icon="mdi:play" width="32"></iconify-icon>
													Odtwórz teraz
												</button>
												<button onClick={onAddVideoToQueueClick}>
													<iconify-icon icon="mdi:add" width="32"></iconify-icon>
													Do kolejki
												</button>
											</div>
										</div>
									</div>
									:
									<>
										<p>Wyszukiwanie...</p>
									</>
							}
						</div>
					)
				}
				<input
					type="text"
					placeholder="Link do filmu YouTube"
					style={{width: "100%"}}
					onChange={e => {
						setVideoUrlInput(e.target.value);
					}}
					value={videoUrlInput}
				/>
			</div>
			<div className="row fill no-scroll-x auto-scroll-y center-h">
				{
					videoQueue !== null ?
						<div className="container fill">
							{
								videoQueue.map((video, index) => (
									<>
										<div key={`video${index}`} className="row center-v no-scroll not-responsive">
											<img
												src={video.thumbnail}
												alt={`Thumbnail for ${video.title}`}
												style={{
													height: "50px",
													aspectRatio: "16 / 9",
													borderRadius: "8px"
												}}
											/>

											<div className="container fill no-scroll">
												<div className="row no-scroll" style={{minWidth: "0", paddingBottom: "3px"}}>
													<p className="ellipsis" style={{margin: 0, fontWeight: "bold"}}>{video.title}</p>
												</div>
												<div className="row no-scroll" style={{minWidth: "0", paddingTop: "3px"}}>
													<p className="ellipsis" style={{margin: 0, color: "#aaa"}}>{video.author}</p>
												</div>
											</div>

											<div className="container no-scroll" style={{flexShrink: "0"}}>
												<div className="row no-scroll fill not-responsive" style={{justifyContent: "flex-end", alignItems: "flex-end"}}>
													<button
														className="btn-secondary"
														title="Odtwórz teraz"
													>
														<iconify-icon icon="mdi:play" width="32"></iconify-icon>
													</button>
													<button
														title="Zmień pozycję"
														onClick={() => onMoveVideoInQueueButtonClick(index)}
													>
														<iconify-icon icon="mdi:arrow-up-down-bold" width="32"></iconify-icon>
													</button>
												</div>
											</div>
										</div>

										<div key={`separator${index}`} className="row center-h no-scroll not-responsive">
											<button className="btn-secondary">
												{/* TODO add moving handles */}
												Umieść tutaj
											</button>
										</div>
									</>
								))
							}
						</div>
						:
						<p>Synchronizowanie kolejki...</p>
				}
			</div>
		</div>
	);
}

root.render(<MemberPage />);
