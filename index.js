import express from 'express';
import axios from 'axios';
import qs from 'qs';
import bodyParser from 'body-parser';
import tmi from 'tmi.js';
import OpenAIOperations from './openai_operations.js';
import expressWs from 'express-ws';
import { CronJob } from 'cron';

const app = express();
expressWs(app);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('views', './views');
app.set('view engine', 'ejs');

app.use('/public', express.static('public'));

const config = {
    GPT_MODE: process.env.GPT_MODE || "CHAT",
    HISTORY_LENGTH: parseInt(process.env.HISTORY_LENGTH || "10"),
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    MODEL_NAME: process.env.MODEL_NAME || "gpt-3.5-turbo",
    TWITCH_USER: process.env.TWITCH_USER || "oSetinhasBot",
    BOT_NAME: process.env.BOT_NAME || "VarianTheVampire",
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    TWITCH_AUTH: process.env.TWITCH_AUTH || "oauth:your-oauth-token",
    COMMAND_NAME: (process.env.COMMAND_NAME || "!gpt").split(",").map(x => x.trim().toLowerCase()),
    CHANNELS: (process.env.CHANNELS || "oSetinhas,jones88").split(",").map(x => x.trim()),
    SEND_USERNAME: process.env.SEND_USERNAME !== "false",
    ENABLE_TTS: process.env.ENABLE_TTS === "true",
    ENABLE_CHANNEL_POINTS: process.env.ENABLE_CHANNEL_POINTS === "true",
    RANDOM_CHANCE: parseInt(process.env.RANDOM_CHANCE || "20"),
    LINK: process.env.LINK || "http://default-link.com",
    TIMED_MESSAGE_TIME: parseInt(process.env.TIMED_MESSAGE_TIME) || 15,
    COMMAND_CHANCE: parseInt(process.env.COMMAND_CHANCE || "100"),
    BOT_PROMPT: process.env.BOT_PROMPT || `Sen Arif adında bir dondurma satıcısısın. Tam bir Türk esnafı gibi sıcak, samimi ve esprili bir şekilde konuşuyorsun. Günün büyük kısmını dükkanında geçiriyor, müşterilerinle keyifli sohbetler ediyorsun. Amacın, Golf Dondurma markasının ROKO adlı ürününü tanıtmak. Üç çeşit ROKO dondurman var: çikolata, bitter çikolata ve beyaz çikolata. 

- Hiçbir zaman küfür etmezsin ve ofansif, ayrıştırıcı şeyler söylemezsin.
- Gerçek olmayan bilgi vermezsin ve markayı kötülemezsin.
- Mesajların 500 karakteri geçmez.
- Samimi, sıcakkanlı ve şakacı bir üslupla konuşursun.
- Mesajlarında # karakteri kullanmazsın.

Örnek davranışların:
- "Selamünaleyküm gençler, Arif amcanız burada! Bu sıcak günlerde serinlemenin en güzel yolu ROKO dondurması. Çikolatalısı tam size göre, benden söylemesi!"
- "Hanımlar beyler, ROKO'nun beyaz çikolata çeşidini denediniz mi? Vallahi parmaklarını yersin! Daha iyisini bulamazsınız, ben Arif derim!"
- "Evlatlar, ROKO'nun bitter çikolatası var ya, lezzeti efsane! Hem serinleyin hem de tatlı ihtiyacınızı giderin. Bunu kaçırmayın!"
- "Mahallemizin çocukları, gelin bakayım buraya! ROKO dondurmasıyla serinlemeye ne dersiniz? Üç farklı çeşidiyle herkesin gönlüne göre bir lezzet var. Benim favorim çikolatalı, sizinki hangisi?"
- "Bakın gençler, bu ROKO dondurması var ya, çikolata, bitter çikolata ve beyaz çikolata çeşitleriyle tam damak tadınıza uygun. Bir deneyin derim, pişman olmazsınız!"

Müşteriler olumsuz yorum yaptığında:
- "Ah, yeğenim, herkesin damak tadı farklı tabii. Ama başka bir çeşidimizi denemelisin, eminim memnun kalacaksın."
- "Üzgünüm ki beğenmedin. Belki bir dahaki sefere başka bir çeşidimizi denersin, memnun kalacağından eminim. Bize bir şans daha ver!"

Unutma, Arif, amacın izleyicilerle samimi ve eğlenceli bir şekilde etkileşim kurarak ROKO dondurmasını tanıtmak. Keyifli sohbetler!`,
    CHAT_BOT_PROMPT: process.env.CHAT_BOT_PROMPT || `Sen Arif adında bir dondurma satıcısısın. Komutla çağrıldığında profesyonel ve bilgilendirici bir şekilde davranıyorsun. Golf Dondurma markasının ROKO adlı ürününü tanıtmak için detaylı bilgi veriyorsun. Üç çeşit ROKO dondurman var: çikolata, bitter çikolata ve beyaz çikolata.

- Hiçbir zaman küfür etmezsin ve ofansif, ayrıştırıcı şeyler söylemezsin.
- Gerçek olmayan bilgi vermezsin ve markayı kötülemezsin.
- Mesajların 500 karakteri geçmez.
- Profesyonel ve bilgilendirici bir üslupla konuşursun.
- Mesajlarında # karakteri kullanmazsın.

Örnek davranışların:
- "Merhaba, ben Arif. Golf Dondurma'nın ROKO serisi hakkında bilgi almak ister misiniz? Çikolatalı ROKO, gerçek çikolata ile hazırlanmıştır ve lezzetiyle öne çıkar."
- "ROKO'nun beyaz çikolatalı çeşidi, beyaz çikolata tutkunları için harika bir seçenektir. Hem serinletici hem de tatmin edici."
- "Bitter çikolatalı ROKO, yoğun çikolata tadı ve düşük şeker oranıyla sağlıklı bir atıştırmalık arayanlar için idealdir."

Unutma, Arif, amacın izleyicilere ROKO dondurmasının detaylı bilgisini vermek ve markayı tanıtmaktır.`,
    COOLDOWN: parseInt(process.env.COOLDOWN || "10000"),
    REDIRECT_URI: process.env.REDIRECT_URI || "https://srv-copts7tjm4es73abmg90.onrender.com/auth/twitch/callback"
};

console.log("Config initialized with the following settings:");
console.log(`GPT_MODE: ${config.GPT_MODE}`);
console.log(`HISTORY_LENGTH: ${config.HISTORY_LENGTH}`);
console.log(`OPENAI_API_KEY: ${config.OPENAI_API_KEY}`);
console.log(`MODEL_NAME: ${config.MODEL_NAME}`);
console.log(`TWITCH_USER: ${config.TWITCH_USER}`);
console.log(`BOT_NAME: ${config.BOT_NAME}`);
console.log(`TWITCH_CLIENT_ID: ${config.TWITCH_CLIENT_ID}`);
console.log(`TWITCH_CLIENT_SECRET: ${config.TWITCH_CLIENT_SECRET}`);
console.log(`TWITCH_AUTH: ${config.TWITCH_AUTH}`);
console.log(`COMMAND_NAME: ${config.COMMAND_NAME}`);
console.log(`CHANNELS: ${config.CHANNELS}`);
console.log(`SEND_USERNAME: ${config.SEND_USERNAME}`);
console.log(`ENABLE_TTS: ${config.ENABLE_TTS}`);
console.log(`ENABLE_CHANNEL_POINTS: ${config.ENABLE_CHANNEL_POINTS}`);
console.log(`RANDOM_CHANCE: ${config.RANDOM_CHANCE}`);
console.log(`LINK: ${config.LINK}`);
console.log(`TIMED_MESSAGE_TIME: ${config.TIMED_MESSAGE_TIME}`);
console.log(`COMMAND_CHANCE: ${config.COMMAND_CHANCE}`);
console.log(`BOT_PROMPT: ${config.BOT_PROMPT}`);
console.log(`CHAT_BOT_PROMPT: ${config.CHAT_BOT_PROMPT}`);
console.log(`COOLDOWN: ${config.COOLDOWN}`);
console.log(`REDIRECT_URI: ${config.REDIRECT_URI}`);

let botActive = true;
let streamerAccessToken = '';

let openai_ops = new OpenAIOperations(
    config.OPENAI_API_KEY,
    config.MODEL_NAME,
    config.HISTORY_LENGTH,
    config.RANDOM_CHANCE,
    config.TWITCH_USER,
    config.LINK,
    config.COMMAND_CHANCE,
    config.BOT_PROMPT,
    config.CHAT_BOT_PROMPT,
    config.COOLDOWN
);

// TMI.js Twitch Bot setup
const twitchClient = new tmi.Client({
    options: { debug: true },
    identity: {
        username: config.TWITCH_USER,
        password: config.TWITCH_AUTH
    },
    channels: config.CHANNELS
});

twitchClient.connect().catch(console.error);

twitchClient.on('message', async (channel, userstate, message, self) => {
    if (!botActive) return;
    if (self || userstate.username === config.TWITCH_USER) return;

    // Random interaction
    if (!message.startsWith('!') && !message.startsWith('/')) {
        const prompt = `${config.BOT_PROMPT}\nUser: ${message}\nAssistant:`;
        const randomResponse = await openai_ops.randomInteraction(message, userstate);
        if (randomResponse) {
            randomResponse.match(new RegExp(`.{1,399}`, "g")).forEach((msg, index) => {
                setTimeout(() => twitchClient.say(channel, msg), 1000 * index);
            });
            return;
        }
    }

    // Command handling
    for (const cmd of config.COMMAND_NAME) {
        if (message.toLowerCase().startsWith(cmd)) {
            let text = message.slice(cmd.length).trim();
            if (config.SEND_USERNAME) text = `Message from user ${userstate.username}: ${text}`;

            const prompt = `${config.CHAT_BOT_PROMPT}\nUser: ${text}\nAssistant:`;
            const response = await openai_ops.executeCommand(cmd, text, userstate);
            if (response) {
                response.match(new RegExp(`.{1,399}`, "g")).forEach((msg, index) => {
                    setTimeout(() => twitchClient.say(channel, msg), 1000 * index);
                });
            }
            return;
        }
    }
});

// Endpoint to handle OAuth redirect
app.get('/auth/twitch/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Code is missing');
    }

    try {
        const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', qs.stringify({
            client_id: config.TWITCH_CLIENT_ID,
            client_secret: config.TWITCH_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: config.REDIRECT_URI
        }));

        streamerAccessToken = tokenResponse.data.access_token;
        res.send('Authorization successful, you can close this tab.');
    } catch (error) {
        console.error('Error getting access token:', error);
        res.status(500).send('Failed to get access token');
    }
});

// Express routes for updating variables and toggling bot status
app.post('/update-vars', async (req, res) => {
    const { gptMode, historyLength, openaiApiKey, modelName, twitchUser, botName, commandName, channels, sendUsername, enableTts, enableChannelPoints, randomChance, link, timedMessageTime, commandChance, botPrompt, chatBotPrompt, cooldown } = req.body;

    const updatedConfig = {
        GPT_MODE: gptMode || config.GPT_MODE,
        HISTORY_LENGTH: parseInt(historyLength) || config.HISTORY_LENGTH,
        OPENAI_API_KEY: openaiApiKey || config.OPENAI_API_KEY,
        MODEL_NAME: modelName || config.MODEL_NAME,
        TWITCH_USER: twitchUser || config.TWITCH_USER,
        BOT_NAME: botName || config.BOT_NAME,
        COMMAND_NAME: (commandName || config.COMMAND_NAME).split(",").map(x => x.trim().toLowerCase()),
        CHANNELS: (channels || config.CHANNELS).split(",").map(x => x.trim()),
        SEND_USERNAME: sendUsername !== undefined ? sendUsername === "true" : config.SEND_USERNAME,
        ENABLE_TTS: enableTts !== undefined ? enableTts === "true" : config.ENABLE_TTS,
        ENABLE_CHANNEL_POINTS: enableChannelPoints !== undefined ? enableChannelPoints === "true" : config.ENABLE_CHANNEL_POINTS,
        RANDOM_CHANCE: parseInt(randomChance) || config.RANDOM_CHANCE,
        LINK: link || config.LINK,
        TIMED_MESSAGE_TIME: parseInt(timedMessageTime) || 15,
        COMMAND_CHANCE: parseInt(commandChance) || config.COMMAND_CHANCE,
        BOT_PROMPT: botPrompt || config.BOT_PROMPT,
        CHAT_BOT_PROMPT: chatBotPrompt || config.CHAT_BOT_PROMPT,
        COOLDOWN: parseInt(cooldown) || config.COOLDOWN
    };

    Object.assign(config, updatedConfig);

    console.log("Variables updated with the following settings:");
    console.log(`GPT_MODE: ${config.GPT_MODE}`);
    console.log(`HISTORY_LENGTH: ${config.HISTORY_LENGTH}`);
    console.log(`OPENAI_API_KEY: ${config.OPENAI_API_KEY}`);
    console.log(`MODEL_NAME: ${config.MODEL_NAME}`);
    console.log(`TWITCH_USER: ${config.TWITCH_USER}`);
    console.log(`BOT_NAME: ${config.BOT_NAME}`);
    console.log(`COMMAND_NAME: ${config.COMMAND_NAME}`);
    console.log(`CHANNELS: ${config.CHANNELS}`);
    console.log(`SEND_USERNAME: ${config.SEND_USERNAME}`);
    console.log(`ENABLE_TTS: ${config.ENABLE_TTS}`);
    console.log(`ENABLE_CHANNEL_POINTS: ${config.ENABLE_CHANNEL_POINTS}`);
    console.log(`RANDOM_CHANCE: ${config.RANDOM_CHANCE}`);
    console.log(`LINK: ${config.LINK}`);
    console.log(`TIMED_MESSAGE_TIME: ${config.TIMED_MESSAGE_TIME}`);
    console.log(`COMMAND_CHANCE: ${config.COMMAND_CHANCE}`);
    console.log(`BOT_PROMPT: ${config.BOT_PROMPT}`);
    console.log(`CHAT_BOT_PROMPT: ${config.CHAT_BOT_PROMPT}`);
    console.log(`COOLDOWN: ${config.COOLDOWN}`);
    console.log(`REDIRECT_URI: ${config.REDIRECT_URI}`);

    openai_ops = new OpenAIOperations(
        config.OPENAI_API_KEY,
        config.MODEL_NAME,
        config.HISTORY_LENGTH,
        config.RANDOM_CHANCE,
        config.TWITCH_USER,
        config.LINK,
        config.COMMAND_CHANCE,
        config.BOT_PROMPT,
        config.CHAT_BOT_PROMPT,
        config.COOLDOWN
    );

    res.status(200).send("Variables updated successfully");
});

// Toggle bot status
app.post('/toggle-bot', (req, res) => {
    botActive = !botActive;
    res.status(200).send(`Bot is now ${botActive ? 'active' : 'inactive'}`);
});

// Serve the control panel
app.all('/', async (req, res) => {
    res.render('index', { config, botActive });
});

// Timed message
const timedMessageJob = new CronJob(`*/${config.TIMED_MESSAGE_TIME} * * * *`, async function() {
    if (!botActive) return;

    for (const channel of config.CHANNELS) {
        const message = await openai_ops.make_timed_message();
        if (message) {
            message.match(new RegExp(`.{1,399}`, "g")).forEach((msg, index) => {
                setTimeout(() => twitchClient.say(channel, msg), 1000 * index);
            });
        }
    }
});
timedMessageJob.start();

// Start the server
const server = app.listen(3000, () => console.log('Server running on port 3000'));

// WebSocket for updates
const wss = expressWs(app);
app.ws('/check-for-updates', (ws, req) => {
    ws.on('message', message => console.log("WebSocket message received:", message));
});

function notifyFileChange(url) {
    wss.clients.forEach(client => {
        if (client.readyState === ws.OPEN) client.send(JSON.stringify({ updated: true, url }));
    });
}

// Example log entry
console.log('info', 'Bot started successfully');
