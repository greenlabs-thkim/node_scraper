const { Parser, transforms: { unwind } } = require('json2csv');
const fs = require('fs');

const scraperObject = {
    url: `https://dae-yu.co.kr/html/farming_pictorial.html`,
    async sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    },
    async scraper(browser) {
        let page = await browser.newPage();
        await page.goto(this.url);
        // 1. 비료 페이지 접근 완료
        console.log(`Navigating to ${this.url}...`);
        const content_inner_node = await page.waitForSelector('#content .inner');
        // 2. 해당 페이지에서 farming_pictorial_list 를 구성        
        const farming_pictorial_node_list = await content_inner_node.$$('.farming_pictorial_list > ul> li');
        const results = [];
        for (let index = 0; index < farming_pictorial_node_list.length; index++) {
            // 페이지 이동하면서 content_inner_node, farming_pictorial_node_list 가 초기화됨 주의!!
            // const farming_pictorial_node = farming_pictorial_node_list[index];
            // const f_name = await farming_pictorial_node.$eval('.f_name', el => el.outerText);
            const temp = await page.waitForSelector('#content .inner');
            const temp2 = await temp.$$('.farming_pictorial_list > ul> li');
            // 페이지 이동하면서 content_inner_node, farming_pictorial_node_list 가 초기화됨 주의!!

            const farming_pictorial_node = temp2[index];
            const f_name = await farming_pictorial_node.$eval('.f_name', el => el.outerText);

            console.log(`과일명 : ${f_name}`);
            await farming_pictorial_node.click();
            // 3. 화면 전환 일어남
            const content_inner_node2 = await page.waitForSelector('#content .inner');
            const farming_shortage_node_list2 = await content_inner_node2.$$('.farming_shortage_list > ul> li');
            for (let index = 0; index < farming_shortage_node_list2.length; index++) {
                const result = {};
                const farming_shortage_node = farming_shortage_node_list2[index];
                // 4. 팝업 생성
                await farming_shortage_node.click();
                // click 후 지연 
                await this.sleep(500);
                const popup_farming_shortage_node = await page.waitForSelector('.layerPopup.popup_farming_shortage.active');
                const detail_view_node = await popup_farming_shortage_node.$('.body .detail_view');
                const title = await detail_view_node.$eval('.tit', el => el.outerText);
                console.log(`Title : ${title}`);
                const tagList = await detail_view_node.$$eval('.tag', nodes => nodes.map(node => node.outerText));
                const textList = await detail_view_node.$$eval('.text', nodes => nodes.map(node => node.outerText));
                result.title = title;
                result.body = [];
                for (let index = 0; index < tagList.length; index++) {
                    const tag = tagList[index];
                    const text = textList[index];
                    result.body.push({
                        f_name: f_name,
                        tag: tag,
                        text, text,
                    });
                }
                results.push(result);
                console.log(JSON.stringify(result));
                await popup_farming_shortage_node.$eval('.top > a', node => node.onclick());
                // click 후 지연 
                await this.sleep(500);
            }
            await content_inner_node2.$eval('.btn_c > a', node => node.click());
            await this.sleep(500);
        }

        console.log(JSON.stringify(results));
        console.log('end search');
        // 여기서 csv 파일로 세이브
        const fields = ['title', 'body.f_name', 'body.tag', 'body.text'];
        const transforms = [unwind({ paths: ['body'], blankOut: true })];
        const json2csvParser = new Parser({ fields, transforms });
        const csv = json2csvParser.parse(results);
        fs.writeFileSync(`output.csv`, csv);
    }
}

module.exports = scraperObject;