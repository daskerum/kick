import OpenAI from "openai";

class OpenAIOperations {
    constructor(openai_key, model_name = "gpt-3.5-turbo", history_length, randomChance, twitchUser, link, commandChance, botPrompt, chatBotPrompt, cooldownPeriod) {
        this.messages = [{ role: "system", content: botPrompt }];
        this.api_key = openai_key;
        this.model_name = model_name;
        this.history_length = history_length;
        this.randomChance = randomChance;
        this.twitchUser = twitchUser;
        this.link = link;
        this.lastCalled = Date.now();
        this.cooldownPeriod = cooldownPeriod;
        this.openai = new OpenAI({ apiKey: openai_key });
        this.botPrompt = botPrompt;
        this.chatBotPrompt = chatBotPrompt;
        this.commandChance = commandChance;
        this.commandCooldowns = new Map();
        this.randomCooldowns = new Map();

        console.log("OpenAIOperations initialized with the following settings:");
        console.log(`API Key: ${openai_key}`);
        console.log(`Model Name: ${model_name}`);
        console.log(`History Length: ${history_length}`);
        console.log(`Random Chance: ${randomChance}`);
        console.log(`Twitch User: ${twitchUser}`);
        console.log(`Link: ${link}`);
        console.log(`Command Chance: ${commandChance}`);
        console.log(`Bot Prompt: ${botPrompt}`);
        console.log(`Chat Bot Prompt: ${chatBotPrompt}`);
        console.log(`Cooldown Period: ${cooldownPeriod}`);
    }

    check_history_length() {
        console.log(`Conversations in History: ${((this.messages.length / 2) - 1)}/${this.history_length}`);
        if (this.messages.length > ((this.history_length * 2) + 1)) {
            console.log('Message amount in history exceeded. Removing oldest user and assistant messages.');
            this.messages.splice(1, 2);
        }
    }

    async randomInteraction(text, user) {
        if (this.randomCooldowns.has(user.username) && Date.now() - this.randomCooldowns.get(user.username) < this.cooldownPeriod) {
            console.log(`Cooldown in effect for user: ${user.username}`);
            return null;
        }

        const randomChance = Math.floor(Math.random() * 100);
        console.log(`Random chance: ${randomChance}, Threshold: ${this.randomChance}`);
        if (randomChance < this.randomChance && !text.startsWith("!") && !text.startsWith("/") && user.username !== this.twitchUser) {
            this.randomCooldowns.set(user.username, Date.now());
            const prompt = `${this.botPrompt}\nUser: ${text}\nAssistant:`;
            return await this.make_openai_call(prompt);
        } else {
            console.log("No random interaction or bot is trying to reply to itself.");
            return null;
        }
    }

    async make_openai_call(prompt) {
        const currentTime = Date.now();
        if (prompt == null) {
            console.log("Invalid prompt: null");
            return null;
        }

        if (currentTime - this.lastCalled < this.cooldownPeriod) {
            console.log("Cooldown in effect. Try again later.");
            return null;
        }
        this.lastCalled = currentTime;

        try {
            this.messages.push({ role: "user", content: prompt });
            this.check_history_length();

            const response = await this.openai.chat.completions.create({
                model: this.model_name,
                messages: this.messages,
                temperature: 0.9,
                max_tokens: 150,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0.6,
                stop: ["\n", " User:", " Assistant:"]
            });

            if (response.choices && response.choices.length > 0) {
                let agent_response = response.choices[0].message.content;

                // Kurallara uygunluğu kontrol et
                if (agent_response.includes('#')) {
                    console.log("Response contains # character, modifying response.");
                    agent_response = agent_response.replace(/#/g, '');
                }
                if (agent_response.length > 500) {
                    console.log("Response exceeds 500 characters, trimming response.");
                    agent_response = agent_response.substring(0, 497) + '...';
                }

                this.messages.push({ role: "assistant", content: agent_response });
                console.log(`Agent Response: ${agent_response}`);
                return agent_response;
            } else {
                throw new Error("No choices returned from OpenAI");
            }
        } catch (error) {
            console.error("Error in make_openai_call:", error);
            return "Sorry, something went wrong. Please try again later.";
        }
    }

    async make_timed_message() {
        const prompt = `${this.botPrompt}\nCreate a message related to the channel and include the following link: ${this.link}`;
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model_name,
                messages: [{ role: "system", content: this.botPrompt }, { role: "user", content: prompt }],
                temperature: 0.9,
                max_tokens: 150,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0.6,
                stop: ["\n", " User:", " Assistant:"]
            });

            if (response.choices && response.choices.length > 0) {
                let agent_response = response.choices[0].message.content;
                agent_response += ` ${this.link}`; // Ensure the link is added
                console.log(`Timed Message Response: ${agent_response}`);
                return agent_response;
            } else {
                throw new Error("No choices returned from OpenAI");
            }
        } catch (error) {
            console.error("Error in make_timed_message:", error);
            return "Sorry, something went wrong. Please try again later.";
        }
    }

    getRecentMessages() {
        return this.messages.slice(-7).map(msg => `${msg.role}: ${msg.content}`).join('\n');
    }

    async executeCommand(command, text, user) {
        if (this.commandCooldowns.has(user.username) && Date.now() - this.commandCooldowns.get(user.username) < this.cooldownPeriod) {
            console.log(`Command cooldown in effect for user: ${user.username}`);
            return null;
        }

        const commandChance = Math.floor(Math.random() * 100);
        console.log(`Command chance: ${commandChance}, Threshold: ${this.commandChance}`);
        if (commandChance < this.commandChance) {
            this.commandCooldowns.set(user.username, Date.now());
            const prompt = `${this.chatBotPrompt}\nUser: ${text}\nAssistant:`;
            return await this.make_openai_call(prompt);
        } else {
            console.log("Command not executed due to chance setting.");
            return null;
        }
    }
}

export default OpenAIOperations;
