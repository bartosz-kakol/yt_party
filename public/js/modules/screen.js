class ScreenContainer {
	/** @type {HTMLDivElement} */
	#el;

	/**
	 * @param element {HTMLDivElement}
	 */
	constructor(element) {
		this.#el = element;
	}

	show() {
		this.#el.setAttribute("data-show", "1");
	}

	hide() {
		this.#el.setAttribute("data-show", "0");
	}

	get element() {
		return this.#el;
	}
}

class Screens {
	/**
	 * @param name {string}
	 * @return {ScreenContainer}
	 */
	static get(name) {
		const id = `${name}-screen`;
		const el = document.getElementById(id);

		if (el === null) {
			throw new Error(`Screen with name "${name}" not found`);
		}

		return new ScreenContainer(el);
	}
}
