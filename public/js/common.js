function log(profile, message, ...args) {
	switch (profile) {
		case "player":
			console.log(
				`%c▶ %c${message}`,
				"color: red; font-weight: bold; font-size: 18px;",
				"font-size: 18px; color: revert;",
				...args.map(arg => `font-size: 18px;${arg}`)
			);
			break;
		case "socket":
			console.log(
				`%c🔌 ${message}`,
				"font-size: 18px;",
				...args.map(arg => `font-size: 18px;${arg}`)
			);
			break
		default:
			console.log(message);
	}
}
