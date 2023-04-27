import {Telegraf, session} from 'telegraf';
import {message} from 'telegraf/filters';
import {code} from 'telegraf/format';
import {ogg} from './ogg.js';
import {openai} from "./openai.js";

import config from 'config';

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'));
console.log(config.get('TEST_ENV'));

const INITIAL_SESSION = {
    messages: []
}

bot.use(session());


bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply(code('Жду вашего запроса.'));
})

bot.on(message('voice'), async (ctx) =>{
    ctx.session ??= INITIAL_SESSION;
    try {
        const userId = String(ctx.message.from.id);
        const voiceLinkOgg = await ctx.telegram.getFileLink(ctx.message.voice.file_id);

        await ctx.reply(code('Загрузка голосового файла...'));
        const oggPath = await ogg.create(voiceLinkOgg.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId);

        await ctx.reply(code('Загрузка транскрипции...'));
        const transcription = await openai.transcription(mp3Path);
        await ctx.reply(code('Ваш запрос: ' + transcription));

        ctx.session.messages.push({role: openai.roles.USER, content:transcription })

        await ctx.reply(code('Отправка ответа...'));
        const response = await openai.chat(ctx.session.messages);
        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content })
        await ctx.reply(response.content);

    } catch(error) {
        console.log(error);
    }
});

bot.on(message('text'), async (ctx) =>{
    ctx.session ??= INITIAL_SESSION;
    try {
        await ctx.reply(code('Загрузка транскрипции...'));

        ctx.session.messages.push({role: openai.roles.USER, content:ctx.message.text })

        await ctx.reply(code('Отправка ответа...'));

        const response = await openai.chat(ctx.session.messages);

        ctx.session.messages.push({role: openai.roles.ASSISTANT, content: response.content })

        await ctx.reply(response.content);
    } catch(error) {
        console.log(error);
    }
});

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION;
    await ctx.reply(code('Жду вашего запроса.'));
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));