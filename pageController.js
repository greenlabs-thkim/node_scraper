const namhaePageScraper = require('./namhaePageScraper');
const daeyuPageScraper = require('./daeyuPageScraper');
const nongsaroPageScraper = require('./nongsaroPageScraper');

async function scrapeAll(browserInstance){
	let browser;
	try{
		browser = await browserInstance;
		await nongsaroPageScraper.scraper(browser);	
		
	}
	catch(err){
		console.log("Could not resolve the browser instance => ", err);
	}
}

module.exports = (browserInstance) => scrapeAll(browserInstance)