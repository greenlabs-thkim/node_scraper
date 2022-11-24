const namhaePageScraper = require('./namhaePageScraper');
const daeyuPageScraper = require('./daeyuPageScraper');
const nongsaroPageScraper = require('./nongsaroPageScraper');
const plantixPageScraper = require('./plantixPageScraper');

async function scrapeAll(browserInstance) {
	let browser;
	try {
		browser = await browserInstance;
		await plantixPageScraper.scraper(browser);

	}
	catch (err) {
		console.log("Could not resolve the browser instance => ", err);
	}
}

module.exports = (browserInstance) => scrapeAll(browserInstance)