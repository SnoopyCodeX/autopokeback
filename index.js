const puppeteer = require('puppeteer');
const { input, password } = require('@inquirer/prompts');
const dotenv = require('dotenv');
const ansis = require('ansis');
const figlet = require('figlet');
const { existsSync, writeFileSync } = require('fs');
dotenv.config();

(async () => {
    console.log(ansis.cyanBright(figlet.textSync('AutoPokeBack', 'Chunky')));
    console.log(ansis.cyan.bold(`Made by: SnoopyCodeX @https://github.com/SnoopyCodeX/autopokeback\n`));

    const delay = (time) => new Promise(resolve => setTimeout(resolve, time));
    const browser = await puppeteer.launch({ headless: false, protocolTimeout: 0 });
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
        console.log(ansis.red.italic('Process interrupted, terminating...\n'));
        process.exit(1);
    });

    try {
        // ===========================[ START ]===========================
        console.log(ansis.italic.gray('Loading facebook...'));
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
        console.log(ansis.italic.gray('Facebook loaded, checking for login credentials...'));

        // Checking if .env file exists or if the FB_EMAIl and FB_PASS exists and has values
        if (!existsSync('.env') || !process.env.FB_EMAIL || !process.env.FB_PASS || !process.env.FB_EMAIL.trim().length || !process.env.FB_PASS.length) {
            console.log(ansis.red.italic(`\nNo .env file or login credentials found, this tool will manually ask for your facebook login credentials...\n`));

            const userEmailAddress = await input({
                message: 'Enter your email address: ',
                required: true,
                validate: (email) => {
                    if (!email.includes('@')) {
                        return 'Please enter a valid email address!'
                    } else if (email.indexOf('@') != email.lastIndexOf('@')) {
                        return 'Email address may only contain 1 "@" symbol!';
                    }

                    return true;
                }
            }, {clearPromptOnDone: true});

            const userPassword = await password({
                mask: '*',
                message: 'Enter your password: ',
                validate: (pwd) => {
                    if (!pwd.trim().length) {
                        return 'Please enter a valid password!';
                    }

                    return true;
                }
            }, {clearPromptOnDone: true});

            // Write to .env file
            writeFileSync(`.env`, `FB_EMAIL=${userEmailAddress}\nFB_PASS=${userPassword}\nUSER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.2420.81'`);
            console.log(ansis.gray.italic(`Credentials has been written to .env file...`));
            console.log(ansis.gray.italic(`Trying to login to facebook...`));

            // Reload .env
            dotenv.config();
        } 
        else
            console.log(ansis.gray.italic(`An existing .env file was found, logging in...`));

        await page.type('#email', process.env.FB_EMAIL);
        await page.type('#pass', process.env.FB_PASS);
        await page.click('button[name="login"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60 * 1000 });
        let url = page.url();

        // Incorrect password detection
        if (url.includes("login") || url.includes("login_attempt")) {
            console.log(ansis.red.italic(`\nIncorrect login credentials detected, please recheck your credentials in your .env file and try again...`))
            console.log(ansis.gray.italic(`Terminating...\n`));
            await browser.close();
            process.exit(1);
        }

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
                console.log(ansis.red.italic(`Failed to approve this login, terminating...\n`));
                await browser.close();
                process.exit(1);
            }

            // Login has been approved successfully
            console.log(ansis.green.italic('Login has been approved...'));
        }

        // Two-Step Verification detection
        if (url.includes("two_step_verification")) {
            console.log(ansis.red.italic(`\nTwo-Step Verification detected, please turn off this security feature in your facebook account to use this tool!`));
            console.log(ansis.red.italic(`Terminating...\n`));
            await page.screenshot({ path: './screenshots/2sv.png' });
            await browser.close();
            process.exit(1);
        }

        console.log(ansis.italic.gray('Logged in, redirecting to pokes page...'));
        await page.setUserAgent(process.env.USER_AGENT);
        await page.goto('https://www.facebook.com/pokes', { waitUntil: 'networkidle2' });

        const pokeButtons = await page.$$(`div[aria-label="Poke"]`);
        url = page.url();
        
        if (url.includes('pokes') && pokeButtons.length > 0) {
            console.log(ansis.italic.gray('Pokes page loaded, checking for users that poked you...\n'));
        
            while(true) {
                const pokeBackButtons = await page.$$(`div[aria-label="Poke Back"]`);
                const pokeBackAnchors = await page.$$(`span > a[role='link'][target='_blank']`);
                let usersToPokeBack = pokeBackButtons.length;
        
                const message = `Found ${usersToPokeBack} user${usersToPokeBack > 1 || usersToPokeBack == 0 ? 's' : ''} that poked you`;
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
        
                console.log(ansis.italic.gray('\nRechecking for users that poked you...'));
                usersToPokeBack = 0;
                await delay(2000);
            }
        } else {
            await page.screenshot({ path: './screenshots/pokepage.png' });
            console.log(ansis.red.italic(`\nFailed to load pokes page, see screenshot at ./screenshots/pokepage.png`));
            console.log(ansis.gray.italic(`Terminating...\n`));
            browser.close();
        }
    } catch (e) {
        if (e instanceof puppeteer.TimeoutError) {
            console.log(ansis.red.italic(`\nTimeout exceeded, terminating gracefully...\n`));
        } else {
            console.log(ansis.red.italic(`\nAn exception occured, terminating gracefully...\nCause: ${e}\n`));
        }

        await browser.close();
        process.exit(1);
    }
})();
