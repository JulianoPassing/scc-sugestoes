require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const SUGGESTION_CHANNEL_ID = '1395111676075966716';

client.on('messageCreate', async (message) => {
  // Ignora mensagens do bot e fora do canal de sugestões
  if (message.author.bot) return;
  if (message.channel.id !== SUGGESTION_CHANNEL_ID) return;

  // Salva o conteúdo e deleta a mensagem original
  const conteudo = message.content;
  await message.delete();

  // Cria o embed da sugestão
  const embed = new EmbedBuilder()
    .setColor('#0099FF') // Cor azul para o padrão
    .setAuthor({
      name: `${message.author.username} - ${message.author.id}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true, size: 64 })
    })
    .setTitle('💡 Sugestão')
    .setDescription(`\`\`\`\{conteudo}\n\`\`\``)
    .addFields(
      { name: '👤 Autor', value: `<@${message.author.id}>`, inline: true },
      { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    )
    .setFooter({ 
      text: 'Sistema de Sugestões • SCC', 
      iconURL: message.guild.iconURL({ dynamic: true }) 
    })
    .setTimestamp();

  // Cria os botões de votação
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vote_yes')
      .setLabel('👍 (0) - 0%')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId('vote_no')
      .setLabel('👎 (0) - 0%')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  // Envia a sugestão formatada
  await message.channel.send({ embeds: [embed], components: [row] });
});

// Lógica de votação
const votos = new Map(); // Map<messageId, {yes: Set<userId>, no: Set<userId>}>

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const { customId, message, user } = interaction;

  if (!['vote_yes', 'vote_no'].includes(customId)) return;

  // Inicializa votos se necessário
  if (!votos.has(message.id)) {
    votos.set(message.id, { yes: new Set(), no: new Set() });
  }
  const voto = votos.get(message.id);

  // Remove voto anterior
  voto.yes.delete(user.id);
  voto.no.delete(user.id);

  // Adiciona novo voto
  if (customId === 'vote_yes') voto.yes.add(user.id);
  if (customId === 'vote_no') voto.no.add(user.id);

  // Atualiza labels dos botões
  const row = ActionRowBuilder.from(message.components[0]);
  const totalVotos = voto.yes.size + voto.no.size;
  
  const porcentagemSim = totalVotos > 0 ? Math.round((voto.yes.size / totalVotos) * 100) : 0;
  const porcentagemNao = totalVotos > 0 ? Math.round((voto.no.size / totalVotos) * 100) : 0;
  
  row.components[0].setLabel(`👍 (${voto.yes.size}) - ${porcentagemSim}%`);
  row.components[1].setLabel(`👎 (${voto.no.size}) - ${porcentagemNao}%`);

  await interaction.update({ components: [row] });
});

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN); 