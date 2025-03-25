const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    console.log('Chrome executable path:', browser.wsEndpoint());
    await browser.close();
})();