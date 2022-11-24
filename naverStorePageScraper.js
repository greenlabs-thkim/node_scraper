const { Parser, transforms: { unwind } } = require('json2csv');
const fs = require('fs');
const path = require('path');
const https = require('node:https');

const scraperObject = {
    url: `https://shopping.naver.com/home`,
    async sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    },
    download: (url, file_dir) => new Promise((resolve, reject) => {
        console.log(`download url: ${url}`);
        const filename = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
        fs.mkdirSync(file_dir, { recursive: true });
        const file_path = path.join(file_dir, filename);
        const file = fs.createWriteStream(file_path);
        https.get(url, response => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve(true));
            });
        }).on('error', error => {
            fs.unlink(file_dir);
            reject(error.message);
        });
    }),
    async saveToCSV(json, fileName) {
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(json);
        fs.writeFileSync(`${fileName}.csv`, csv);
    },
    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    },
    async sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    },
    async scraper(browser) {
        const page = await browser.newPage();
        await page.goto(this.url);
        const keyword = '제초재';
        console.log(`Navigating to ${this.url}...`);
        await page.$eval('[title="검색어 입력"]', (node, keyword) => node.value = keyword, keyword);
        const buttonNode = await page.$('._searchInput_button_search_1n1aw');
        await buttonNode.click();

        const products = [];
        let flag = true
        while (flag) {
            // 단일 페이지 루틴
            // 현재 페이지 가져오기            
            await page.waitForSelector('.list_basis');
            // auto scroll 필요함.
            await this.autoScroll(page);
            const currentPageNumber = await page.$eval('.pagination_btn_page___ry_S.active', node => /[0-9]+/.exec(node.textContent)[0]);
            const pageList = await page.$$eval('[data-testid="SEARCH_PAGINATOR"]', nodes => nodes.map(node => {
                return {
                    page_number: node.textContent,
                    page_id: node.getAttribute('data-nclick'),
                }
            }));
            const nextPage = pageList.find(page => Number(page.page_number) === Number(currentPageNumber) + 1);
            const productListNode = await page.$('.list_basis');
            const items = await productListNode.$$('.basicList_item__0T9JD');
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const product = {};
                try {
                    product.thumbnail_url = await item.$eval('.thumbnail_thumb__Bxb6Z > img', node => node.src);
                } catch (error) {
                    console.error(error);
                }
                try {
                    await item.$eval('.basicList_title__VfX3c > a', (node, product) => {
                        product.url = node.href;
                        product.title = node.title;
                    }, product);
                } catch (error) {
                    console.error(error);
                }
                products.push(product);
                console.log(`[product:${products.length}]${JSON.stringify(product)}`);
            }
            // 단일 페이지 루틴

            if (nextPage) {
                const nextPageButton = await page.$(`[data-nclick="${nextPage.page_id}"]`);
                await nextPageButton.click();
                console.log(`goto nextPage : ${nextPage.page_number}`);
                // 여기서 잠깐 쉬어 보자. 딜레이 좀 더 줘야 문제가 없을 듯
                // failed to find element matching selector ".thumbnail_thumb__Bxb6Z > img"
                // 위 오류가 간헐적으로 발생됨. 
                await this.sleep(3000);
            } else {
                flag = false;
            }
        }
        console.log('search end');
        await this.saveToCSV(products, 'products');
        console.log('save to scv end');
        for (let index = 0; index < products.length; index++) {
            try {
                const product = products[index];
                if (product.thumbnail_url) {
                    await this.download(product.thumbnail_url, path.join('.', 'product_thumb'));
                }
            } catch (error) {
                console.error(error);
            }
        }
        console.log('download end');
    }
}

module.exports = scraperObject;