const puppeteer = require('puppeteer');
const dotenv = require('dotenv');
const ansis = require('ansis');
const figlet = require('figlet');
dotenv.config();

(async () => {
    console.log(ansis.cyanBright(figlet.textSync('AutoPokeBack', 'Chunky')));
    console.log(ansis.cyan.bold(`Made by: SnoopyCodeX @https://github.com/SnoopyCodeX/autopokeback\n`));

    const delay = (time) => new Promise(resolve => setTimeout(resolve, time));
    const browser = await puppeteer.launch({ headless: 'shell', protocolTimeout: 0 });
    const page = await browser.newPage();

    // Custom SIGINT event for windows
    if (process.platform == 'win32') {
        const rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on('SIGINT', () => process.emit('SIGINT'));
    }

    // Gracefully shutdown headless browser when 
    // user exits using CTRL + C
    process.on('SIGINT', async () => {
        await browser.close();
        console.log(ansis.red.italic('Process interrupted, exiting...'));
        process.exit(1);
    });

    // ===========================[ START ]===========================
    console.log(ansis.italic.gray('Trying to log in...'));
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    console.log(ansis.italic.gray('Facebook loaded, logging in...'));

    await page.type('#email', process.env.FB_EMAIL);
    await page.type('#pass', process.env.FB_PASS);
    await page.click('button[name="login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    let url = page.url();

    // Checkpoint detection (Login approval)
    if (url.includes('checkpoint')) {
        console.log(ansis.red.italic(`\nCheckpoint detected, open your facebook notification to approve this login...`));
        console.log(ansis.grey.italic('Waiting for login approval...\n'));
        await page.screenshot({ path: './screenshots/checkpoint.png' });

        // Wait for approval
        while (url.includes('checkpoint')) {
            await delay(3000);
            url = page.url();
        }

        // Wait for main element to display (If I remember correctly, this element is only present on the home page after logging in)
        const mainElement = await page.$('div[role=main]');

        // If main element is null/undefined, exit the process because this might mean that the user failed to
        // approve this login
        if (!mainElement) {
            console.log(ansis.red.italic(`Failed to approve this login, exiting...`));
            await browser.close();
            process.exit(1);
        }

        // Login has been approved successfully
        console.log(ansis.grey.italic('Login has been approved...'));
    }

    console.log(ansis.italic.gray('Logged in, redirecting to pokes page...'));
    await page.setUserAgent(process.env.USER_AGENT);
    await page.goto('https://www.facebook.com/pokes', { waitUntil: 'networkidle2' });
    console.log(ansis.italic.gray('Opened pokes page...\n'));

    while(true) {
        const pokeBackButtons = await page.$$(`div[aria-label="Poke Back"]`);
        const pokeBackAnchors = await page.$$(`span > a[role='link'][target='_blank']`);
        let usersToPokeBack = pokeBackButtons.length;

        const message = `Found ${usersToPokeBack} user${usersToPokeBack > 1 || usersToPokeBack == 0 ? 's' : ''} to poke back`;
        console.log(usersToPokeBack > 0 ? ansis.green(message) : ansis.italic.dim.red(message));

        for (let i = 0; i < usersToPokeBack; i++) {
            // Get name of the user
            const userName = await page.evaluate((el) => el.textContent, pokeBackAnchors[i]);

            // Click "Poke Back"
            await pokeBackButtons[i].click();
            console.log(`[${i + 1}]: ${ansis.green.bold(userName)} ${ansis.reset.green('has been poked back!')}`);

            // Delay for 1s
            await delay(1000);
        }

        if (usersToPokeBack > 0)
            console.log(ansis.green('\nAll users has been poked back!'));

        console.log(ansis.italic.gray('\nRechecking for users to poke back...'));
        usersToPokeBack = 0;
        await delay(2000);
    }
})();
