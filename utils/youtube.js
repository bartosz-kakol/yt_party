import * as cheerio from "cheerio";

/**
 * @typedef {Object} YouTubeVideoMetadata
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} thumbnail
 */

export default {
	/**
	 * @param videoId {string}
	 * @returns {boolean}
	 */
	testYouTubeVideoId(videoId) {
		return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
	},

	/**
	 * @param videoId {string}
	 * @returns {Promise<YouTubeVideoMetadata>}
	 */
	async downloadVideoMetadata(videoId) {
		const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0.1 Safari/605.1.15"
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch video metadata. Status code: ${response.statusText}`);
		}

		const html = await response.text();
		const $ = cheerio.load(html);

		return {
			id: videoId,
			title: $(`meta[property="og:title"]`).attr("content"),
			author: $(`span[itemprop="author"] link[itemprop="name"]`).attr("content"),
			thumbnail: $(`meta[property="og:image"]`).attr("content")
		};
	}
};
