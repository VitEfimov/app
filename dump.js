const { remote } = require('webdriverio');
const fs = require('fs');

async function main() {
    const driver = await remote({
        path: '/',
        port: 4723,
        capabilities: {
            platformName: 'Android',
            'appium:automationName': 'UiAutomator2',
            'appium:noReset': true,
        }
    });

    try {
        await driver.activateApp('com.vitvalef.app');
        await driver.pause(3000); // Wait for load

        // Click Today to open board
        const today = await driver.$('//*[@resource-id="dashboard_category_today"]');
        if (await today.isExisting()) {
            await today.click();
            await driver.pause(2000);
        }

        const source = await driver.getPageSource();
        fs.writeFileSync('boardsource.xml', source);
        console.log("Source dumped to boardsource.xml");
    } finally {
        await driver.deleteSession();
    }
}
main();
