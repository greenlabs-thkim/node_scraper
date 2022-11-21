const { Parser, transforms: { unwind } } = require('json2csv');
const fs = require('fs');
const path = require('path');
const https = require('node:https');

const scraperObject = {
    download: (url, destination) => new Promise((resolve, reject) => {
        const pathFileName = url.lastIndexOf(".") + 1;    //확장자 제외한 경로+파일명        
        const extension = (url.substr(pathFileName, url.length)).toLowerCase();
        if (extension === 'jpg') {
            const dir = path.dirname(destination);
            fs.mkdirSync(dir, { recursive: true });
            const file = fs.createWriteStream(destination);
            https.get(url, response => {
                response.pipe(file);

                file.on('finish', () => {
                    file.close(resolve(true));
                });
            }).on('error', error => {
                fs.unlink(destination);

                reject(error.message);
            });
        } else {
            resolve(true);
        }
    }),
    url: 'https://www.nongsaro.go.kr/portal/ps/pss/pssa/photoSearchLst.ps',
    tabs: [
        {
            url: 'https://www.nongsaro.go.kr/portal/ps/pss/pssa/photoSearchLst.ps?menuId=&sKidofcomdtyTabCode=FC&sKidofcomdtyCode=FC010101&hlsctCode=&sicknsCode=&nnmyInsectCode=',
            title: '식량작물',
        },
        {
            url: 'https://www.nongsaro.go.kr/portal/ps/pss/pssa/photoSearchLst.ps?menuId=&sKidofcomdtyTabCode=FT&sKidofcomdtyCode=FT010601&hlsctCode=&sicknsCode=&nnmyInsectCode=',
            title: '과수',
        },
        {
            url: 'https://www.nongsaro.go.kr/portal/ps/pss/pssa/photoSearchLst.ps?menuId=&sKidofcomdtyTabCode=FL&sKidofcomdtyCode=&hlsctCode=&sicknsCode=&nnmyInsectCode=',
            title: '화훼',
        },
        {
            url: 'https://www.nongsaro.go.kr/portal/ps/pss/pssa/photoSearchLst.ps?menuId=&sKidofcomdtyTabCode=VC&sKidofcomdtyCode=VC010801&hlsctCode=&sicknsCode=&nnmyInsectCode=',
            title: '채소',
        },
        {
            url: 'https://www.nongsaro.go.kr/portal/ps/pss/pssa/photoSearchLst.ps?menuId=&sKidofcomdtyTabCode=IC&sKidofcomdtyCode=IC011602&hlsctCode=&sicknsCode=&nnmyInsectCode=',
            title: '특용작물',
        },
    ],
    async getPageInfo(node, subTab, zoneName) {
        const results = await node.$$eval('div > ul > li > p.con > a', (nodes, subTab, zoneName) => nodes.map(node => {
            const id = node.onclick.toString().split('\'')[1]
            return {
                url: subTab.url,
                tabName: subTab.pageTitle,
                subTabName: subTab.subTitle,
                subId: subTab.subId,
                name: node.outerText,
                id: id,
                zoneName: zoneName,
            }
        }), subTab, zoneName);
        return results;
    },
    async saveToCSV(json, fileName) {
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(json);
        fs.writeFileSync(`${fileName}.csv`, csv);
    },
    async scraper(browser) {
        const diseasesResult = [];
        const pestsResult = [];
        const naturalEnemyResult = [];

        let page = await browser.newPage();
        const subTabList = [];
        // for (let index = 0; index < 1; index++) {
        for (let index = 0; index < this.tabs.length; index++) {
            const tab = this.tabs[index];
            console.log(`Navigating to ${tab.url}...`);
            await page.goto(tab.url);
            const subTabs = await page.waitForSelector('#subTabArea');
            const subTabInfos = await subTabs.$$eval('li > a', nodes => nodes.map(node => {
                return {
                    subTitle: node.outerText,
                    subId: node.id,
                }
            }));
            subTabInfos.forEach(subTabInfo => {
                subTabInfo.pageTitle = tab.title;
                subTabInfo.url = tab.url;
            });
            subTabList.push(...subTabInfos);
        }

        const diseasePageList = [];
        const pestPageList = [];
        const naturalEnemyPageList = [];

        // for (let index = 0; index < 1; index++) {
        for (let index = 0; index < subTabList.length; index++) {
            const subTab = subTabList[index];
            console.log(`Navigating to subTab : ${subTab.subId}`);
            await Promise.all([
                page.waitForNavigation({ waitUntil: ['load', 'networkidle2'] }),
                page.evaluate(async (id) => {
                    await window.fncSearch(id);
                }, subTab.subId),
            ]);

            const printZoneNode = await page.waitForSelector('#printZone');
            const printZoneNodeList = await await printZoneNode.$$('div.pic-list02.list4.clearfix');
            // 여기서 3의 배수로 printZoneNodeList 가 나옴.
            // printZoneNodeList[0], [3], [6] 은 제목 나머지 중 printZoneNodeList[2], [5], [8] 은 내용 임
            for (let index = 0; index < printZoneNodeList.length; index++) {
                if (index % 3 === 0) {
                    const zoneNameNode = printZoneNodeList[index];
                    const zoneName = await zoneNameNode.getProperty('outerText');
                    switch (zoneName.toString()) {
                        case 'JSHandle:ㆍ병 피해':
                            const diseases = await this.getPageInfo(printZoneNodeList[index + 2], subTab, 'disease');
                            diseasePageList.push(...diseases);
                            break;
                        case 'JSHandle:ㆍ해충 피해':
                            const pests = await this.getPageInfo(printZoneNodeList[index + 2], subTab, 'pest');
                            pestPageList.push(...pests);
                            break;
                        case 'JSHandle:ㆍ천척 곤충':
                            const naturalEnemies = await this.getPageInfo(printZoneNodeList[index + 2], subTab, 'naturalEnemy');
                            naturalEnemyPageList.push(...naturalEnemies);
                            break;
                        default:
                            throw `undefind zoneName : ${zoneName}`;
                    }
                }
            }
        }

        for (let index = 0; index < diseasePageList.length; index++) {            
            try {
                const diseasePage = diseasePageList[index];
                console.log(`Navigating to Disease [name : ${diseasePage.name}][id:${diseasePage.id}]`);
                await page.goto(diseasePage.url);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load', 'networkidle2'] }),
                    page.evaluate(async (id) => {
                        await window.fncDetail(id);
                    }, diseasePage.id),
                ]);
    
                const bodyNode = await page.waitForSelector('#paramVO');
                try {
                    diseasePage.title = await bodyNode.$eval('h4.mt10.fl', node => node.outerText);
                } catch (error) {
                    console.error(error);
                }
    
                const list = await bodyNode.$$('div.list-type01 > ul > li');
                for (let index = 0; index < list.length; index++) {
                    try {
                        const element = list[index];
                        const name = await element.$eval('h5', node => node.outerText);
                        const value = await element.$eval('p', node => node.outerText);
                        eval(`diseasePage.${name} = value`);
                    } catch (error) {
                        console.error(error);
                    }
                }
    
                diseasesResult.push(diseasePage);                
            } catch (error) {
                console.error(`[errorIdx:${index}]\n[msg:${error}]`)
            }
        }        
        console.log('end search disease');
        await this.saveToCSV(diseasesResult, 'diseases');

        for (let index = 0; index < pestPageList.length; index++) {
            try {
                const pestPage = pestPageList[index];
                console.log(`Navigating to Pest [name : ${pestPage.name}][id:${pestPage.id}]`);
                await page.goto(pestPage.url);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load', 'networkidle2'] }),
                    page.evaluate(async (id) => {
                        await window.fncDetail(id);
                    }, pestPage.id),
                ]);
    
                const bodyNode = await page.waitForSelector('#paramVO');
                try {
                    pestPage.title = await bodyNode.$eval('.back-gray.mt10.txt-c > strong', node => node.outerText);
                } catch (error) {
                    console.error(error);
                }
    
                const list = await bodyNode.$$('.list-type01.cont-bx.back-line.mt10 > ul > li');
                for (let index = 0; index < list.length; index++) {
                    try {
                        const element = list[index];
                        const name = await element.$eval('strong', node => node.outerText);
                        const value = await element.$eval('p', node => node.outerText);
                        eval(`pestPage.${name.replaceAll('/', '_')} = value`);
                    } catch (error) {
                        console.error(error);
                    }
                }
    
                pestsResult.push(pestPage);                    
            } catch (error) {
                console.error(`[errorIdx:${index}]\n[msg:${error}]`)   
            }
        }        
        console.log('end search pest');
        await this.saveToCSV(pestsResult, 'pest');
        
        for (let index = 0; index < naturalEnemyPageList.length; index++) {
            try {
                const naturalEnemyPage = naturalEnemyPageList[index];
                console.log(`Navigating to Natural Enemy [name : ${naturalEnemyPage.name}][id:${naturalEnemyPage.id}]`);
                await page.goto(naturalEnemyPage.url);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: ['load', 'networkidle2'] }),
                    page.evaluate(async (id) => {
                        await window.fncDetail(id);
                    }, naturalEnemyPage.id),
                ]);
    
                const bodyNode = await page.waitForSelector('#paramVO');
                try {
                    naturalEnemyPage.title = await bodyNode.$eval('.back-gray.mt10.txt-c > strong', node => node.outerText);
                } catch (error) {
                    console.error(error);
                }
    
                const list = await bodyNode.$$('.list-type01.cont-bx.back-line.mt10 > ul > li');
                for (let index = 0; index < list.length; index++) {
                    try {
                        const element = list[index];
                        const name = await element.$eval('strong', node => node.outerText);
                        const value = await element.$eval('p', node => node.outerText);
                        eval(`naturalEnemyPage.${name.replaceAll('/', '_')} = value`);
                    } catch (error) {
                        console.error(error);
                    }
                }
    
                naturalEnemyResult.push(naturalEnemyPage);                
            } catch (error) {
                console.error(`[errorIdx:${index}]\n[msg:${error}]`)   
            }
        }        
        console.log('end search natural enemy');
        await this.saveToCSV(naturalEnemyResult, 'naturalEnemy');
    }
}

module.exports = scraperObject;