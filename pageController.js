const namhaePageScraper = require('./namhaePageScraper');
const daeyuPageScraper = require('./daeyuPageScraper');

async function scrapeAll(browserInstance){
	let browser;
	try{
		browser = await browserInstance;
		await daeyuPageScraper.scraper(browser);	
		
	}
	catch(err){
		console.log("Could not resolve the browser instance => ", err);
	}
}

module.exports = (browserInstance) => scrapeAll(browserInstance)