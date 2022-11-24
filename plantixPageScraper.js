const { Parser, transforms: { unwind } } = require('json2csv');
const fs = require('fs');
const path = require('path');
const https = require('node:https');

const scraperObject = {
    url: `https://plantix.net/en/library/plant-diseases`,
    async sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    },
    download: (url, file_dir) => new Promise((resolve, reject) => {
        console.log(`download url: ${url}`);
        const filename = url.substring(url.lastIndexOf('/') + 1);
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
    async extractItems(page) {
        /*  For extractedElements, you are selecting the tag and class,
            that holds your desired information,
            then choosing the desired child element you would like to scrape from.
            in this case, you are selecting the
            "<div class=blog-post />" from "<div class=container />" See below: */
        const results = await page.$$eval('.pests-and-diseases-result > a:not(.disease-content):not(.open-button)', (nodes, capitalize) => nodes.map(node => {
            function capitalize(text) {
                const arr = text.split(" ");
                for (var i = 0; i < arr.length; i++) {
                    arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
                }
                return arr.join(" ");
            }
            const url = node.href;
            const split_url = url.split('/');
            let name = split_url[split_url.length - 2];
            // - 를 space 로 치환
            name = name.replaceAll('-', ' ');
            // 단어 첫글자 대문자로
            name = capitalize(name);
            const id = split_url[split_url.length - 3];
            return {
                url: node.href,
                disease_name: name,
                disease_id: id,
            };
        }));
        return results;
    },
    async scrapeItems(page, extractItems, itemCount, scrollDelay = 800) {
        let results = [];
        let scrollCount = 0
        try {
            let previousHeight;
            while (results.length < itemCount) {
                results = await extractItems(page);
                previousHeight = await page.evaluate('document.body.scrollHeight');
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
                await page.waitForTimeout(scrollDelay);
                scrollCount++;
                console.log(`scrollCount: ${scrollCount}`);
            }
        } catch (error) {
            console.error(error);
        }
        return results;
    },
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
    async scraper(browser) {
        const page = await browser.newPage();
        page.setViewport({ width: 600, height: 842 });
        await page.goto(this.url);
        console.log(`Navigating to ${this.url}...`);
        const items = await this.scrapeItems(page, this.extractItems, 681);
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            await page.goto(item.url);
            console.log(`Navigating to ${item.url}...`);
            const contents_node = await page.waitForSelector('#pathogen-detail-wrapper');
            item.disease_class = await contents_node.$eval('.class_text', node => node.textContent);
            item.scientific_name = await contents_node.$eval('.scientific-name', node => node.textContent);
            item.in_a_nutshell = await contents_node.$$eval('.in_a_nutshell > li', nodes => nodes.map(node => {
                return node.textContent
            }));
            item.symptoms = await contents_node.$eval('.symptoms > p', node => node.textContent);
            // 아래 요소를 랜더링 하려면 화면을 내려야함.
            await this.autoScroll(page);
            item.companion_crops = await contents_node.$$eval('.companion-crop:not(.lastslide)', nodes => nodes.map(node => {
                return node.textContent
            }));
            item.what_caused_it = await contents_node.$eval('[gaonscreenelementname="Pathogen Trigger Text"]', node => node.textContent);
            item.organic_control = await contents_node.$eval('[gaonscreenelementname="Alternative Treatment Text"]', node => node.textContent);
            item.chemical_control = await contents_node.$eval('[gaonscreenelementname="Chemical Treatment Text"]', node => node.textContent);
            item.preventive_measures = await contents_node.$$eval('.preventive-measures-list > li', nodes => nodes.map(node => {
                return node.textContent
            }));
            // 팝업 방지
            await page.$eval('#cookie-consent-popup', node => node.hidden = true);

            const imgs = [];            
            let flag = true;
            while (flag) {
                try {
                    const slide_img_node = await contents_node.$('.appearance-slider.slider');
                    const img = await slide_img_node.$eval('[src]', (node) => {
                        return {
                            url: node.src,
                            crop_name: node.alt,
                        }
                    });
                    if (imgs.find(item => {
                        return item.url === img.url & item.crop_name === img.crop_name
                    })) {
                        // 중복이 나타나면 멈춤
                        flag = false;
                    } else {
                        // 중복이 아니면 next 선택
                        console.log(`get img : ${JSON.stringify(img)}`);
                        imgs.push(img);
                        const slide_next_node = await slide_img_node.$('.next-stage');
                        await slide_next_node.click();
                        // 시간을 좀 주자
                        await this.sleep(1000);
                    }
                } catch (error) {
                    // 에러 발생 시 멈춤
                    flag = false;
                    console.error(error);
                }
            }
            item.imgs = imgs;            
        }
        // 여기서 item 저장
        console.log('end search');
        await this.saveToCSV(items, 'output');
        // 여기서 이미지 다운로드 진행
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            if (item.imgs && item.imgs.length > 0) {
                for (let index = 0; index < item.imgs.length; index++) {
                    const img = item.imgs[index];
                    const img_path = path.join('.', 'img', `${item.disease_id}`);
                    await this.download(img.url, img_path);
                }
            }
        }
        console.log('end download');
    }
}

module.exports = scraperObject;