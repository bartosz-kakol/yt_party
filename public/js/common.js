function log(profile, message, ...args) {
	const convertedArgs = args.map(arg => typeof arg === "string" ? `font-size: 18px;${arg}` : arg);

	switch (profile) {
		case "player":
			console.log(
				`%c▶ %c${message}`,
				"color: red; font-weight: bold; font-size: 18px;",
				"font-size: 18px; color: revert;",
				...convertedArgs
			);
			break;
		case "socket":
			console.log(
				`%c🔌 ${message}`,
				"font-size: 18px;",
				...convertedArgs
			);
			break
		default:
			console.log(message, ...args);
	}
}
