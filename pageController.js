const namhaePageScraper = require('./namhaePageScraper');
const daeyuPageScraper = require('./daeyuPageScraper');
const nongsaroPageScraper = require('./nongsaroPageScraper');
const plantixPageScraper = require('./plantixPageScraper');
const naverStorePageScraper = require('./naverStorePageScraper');

async function scrapeAll(browserInstance) {
	let browser;
	try {
		browser = await browserInstance;
		await naverStorePageScraper.scraper(browser);
	}
	catch (err) {
		console.log("Could not resolve the browser instance => ", err);
	}
}

module.exports = (browserInstance) => scrapeAll(browserInstance)