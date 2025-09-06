const splashElement = document.getElementById("splash");

const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);

function hideSplash() {
	splashElement.style.display = "none";
}

const socket = new SocketConnection(ROOM_ID);

socket.addEventListener("connected", () => {
	hideSplash();
	log("socket", "%cConnected", "color: green;");
});

function MemberPage() {
	/** @type {?Object} */
	const initialNowPlaying = null;
	const [nowPlaying, setNowPlaying] = React.useState(initialNowPlaying);

	React.useEffect(() => {
		socket.connect();
	}, []);

	return (
		<div className="container fill no-scroll">
			<div className="row no-scroll" style={{height: "100px"}}>
				<div className="container center-v">
					<b style={{fontSize: "1.5em"}}>{nowPlaying?.title ?? "Nic nie jest odtwarzane"}</b>
					<div style={{height: "4px"}}></div>
					<p>{nowPlaying?.channel ?? "Dodaj coś do kolejki"}</p>
				</div>
			</div>
			<div className="row" style={{height: "1px", background: "#aaa"}}></div>
			<div className="row no-scroll" style={{height: "50px", padding: "4px"}}>
				<input type="text" placeholder="Link do filmu YouTube" style={{width: "100%"}} />
				<div style={{width: "4px"}}></div>
				<button>
					<iconify-icon icon="mdi:plus" width="32"></iconify-icon>
				</button>
			</div>
			<div className="row fill no-scroll-x auto-scroll-y">

			</div>
		</div>
	);
}

root.render(<MemberPage />);
