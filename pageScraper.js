const { Parser, transforms: { unwind } } = require('json2csv');
const fs = require('fs');

const scraperObject = {
    url: `https://www.nhchem.co.kr/sub/product/fertilizer/list.html`,
    async scraper(browser) {
        let page = await browser.newPage();
        console.log(`Navigating to ${this.url}...`);
        await page.goto(this.url);
        await page.waitForSelector('.inner');
        // 1. 비료 페이지 접근 완료
        // 2. 해당 페이지에서 page list 를 구성        
        const resultsSelector = '.paging_list > ul > li';
        await page.waitForSelector(resultsSelector);
        const links = await page.evaluate(resultsSelector => {
            return [...document.querySelectorAll(resultsSelector)].map(anchor => {
                if (isNaN(anchor.outerText)) {

                } else {
                    return `https://www.nhchem.co.kr/sub/product/fertilizer/list.html?curpage=${anchor.outerText}`
                }
            });
        }, resultsSelector);
        // 3. page list 순회하면서 비료 선택
        console.log('start search');
        console.log(links);
        const results = [];

        for (let index = 0; index < links.length; index++) {
            const link = links[index];
            if (link) {
                await page.goto(link);
                console.log(`goto url : ${link}`);
                await page.waitForSelector('.inner');
                await page.waitForSelector('.gal_list');
                const resultsSelector = '.gal_list > li > a';
                await page.waitForSelector(resultsSelector);
                const links = await page.evaluate(resultsSelector => {
                    return [...document.querySelectorAll(resultsSelector)].map(anchor => {
                        return anchor.href
                    });
                }, resultsSelector);
                // 4. 해당 페이지의 상품 페이지 리스트 추출 완료                
                for (let index = 0; index < links.length; index++) {
                    const result = {};
                    const link = links[index];
                    await page.goto(link);
                    console.log(`goto url : ${link}`);
                    await page.waitForSelector('.ferti_view');
                    const itemSelectors = ['.con01', '.con02', '.con03', '.con04', '.con05'];
                    for (let index = 0; index < itemSelectors.length; index++) {
                        const selector = itemSelectors[index];
                        const handler = await page.waitForSelector(selector);
                        switch (selector) {
                            case '.con01':
                                const con01_tit = await handler.$eval('.tit > strong', div => {                                    
                                    return div.outerText;
                                });                                
                                result.product = con01_tit;
                                console.log(`제품명 : ${result.product}`);
                                break;
                            case '.con02':
                                const con02_tit = await handler.$eval('.vi_tit', div => {                                    
                                    return div.outerText;
                                });
                                console.log(con02_tit);
                                const name_list = await handler.$$eval('.percent > ul > li > span', nodes => nodes.map(node => node.outerText));
                                const percent_list = await handler.$$eval('.ball', nodes => nodes.map(node => node.outerText));
                                result.성분함량 = [];
                                for (let index = 0; index < name_list.length; index++) {
                                    const name = name_list[index];
                                    const percent = percent_list[index];
                                    result.성분함량.push({
                                        성분명: name,
                                        함량: percent,
                                    })
                                }
                                console.log(`성분함량 : ${JSON.stringify(result.성분함량)}`);
                                break;
                            case '.con03':
                                result.usage = [];
                                try {
                                    const con03_tit = await handler.$eval('.vi_tit', div => {
                                        console.log(div);
                                        return div.outerText;
                                    });
                                    console.log(con03_tit);                                    
                                    const con03_nodes = await handler.$$('.slick-slide');
                                    for (let index = 0; index < con03_nodes.length; index++) {
                                        const con03_node = con03_nodes[index];
                                        const crop_name_node = await con03_node.getProperty('outerText');
                                        const cropName = crop_name_node.toString().split(':')[1]
                                        await con03_node.$eval('a', node => node.onclick());
                                        let topManure, bottomManure
                                        try {
                                            topManure = await handler.$eval('#top_manure', el => el.outerText);                                                
                                        } catch (error) {
                                            console.log('웃거름 없음')
                                        }                                        
                                        try {
                                            bottomManure = await handler.$eval('#bottom_manure', el => el.outerText);    
                                        } catch (error) {
                                            console.log('밑거름 없음')
                                        }
                                        
                                        result.usage.push({
                                            cropName: cropName,
                                            topManure: topManure,
                                            bottomManure: bottomManure,
                                        });                                        
                                    }
                                } catch (error) {                                    
                                    console.log('사용량 없음');
                                }
                                console.log(`사용량 : ${JSON.stringify(result.usage)}`);
                                break;
                            case '.con04':

                                break;
                            case '.con05':

                                break;
                            default:
                                break;
                        }
                    }
                    console.log(JSON.stringify(result));
                    results.push(result);
                }                
            }
        }
        
        console.log(JSON.stringify(results));
        console.log('end search');
        // 여기서 csv 파일로 세이브
        const fields = ['product', 'usage.cropName', 'usage.topManure', 'usage.bottomManure'];        
        const transforms = [unwind({ paths: ['usage'], blankOut: true })];
        const json2csvParser = new Parser({ fields, transforms });
        const csv = json2csvParser.parse(results);
        fs.writeFileSync(`output.csv`, csv);
    }
}

module.exports = scraperObject;