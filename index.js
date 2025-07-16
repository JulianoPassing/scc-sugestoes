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
const VOTES_CHANNEL_ID = '1395115693598576683';

client.on('messageCreate', async (message) => {
  // Ignora mensagens do bot e fora do canal de sugestões
  if (message.author.bot) return;
  if (message.channel.id !== SUGGESTION_CHANNEL_ID) return;

  try {
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
      .setDescription(`\`\`\`\n${conteudo}\n\`\`\``)
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

    // Envia a sugestão formatada (apenas uma vez)
    const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
    
    // Inicializa o registro de votos para esta mensagem
    votos.set(sentMessage.id, { yes: new Set(), no: new Set() });
    
    // Cria automaticamente um tópico para debate
    try {
      await sentMessage.startThread({
        name: `💬 Debate: ${conteudo.substring(0, 50)}${conteudo.length > 50 ? '...' : ''}`,
        autoArchiveDuration: 60, // 1 hora
        reason: 'Tópico de debate criado automaticamente para a sugestão'
      });
    } catch (threadError) {
      console.error('Erro ao criar tópico de debate:', threadError);
    }
    
  } catch (error) {
    console.error('Erro ao processar sugestão:', error);
  }
});

// Lógica de votação
const votos = new Map(); // Map<messageId, {yes: Set<userId>, no: Set<userId>}>

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const { customId, message, user } = interaction;

  if (!['vote_yes', 'vote_no'].includes(customId)) return;

  try {
    // Verifica se existe registro de votos para esta mensagem
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

    // Atualiza apenas os botões no canal de sugestões (sem lista de votantes)
    await interaction.update({ components: [row] });

    // Envia/atualiza a lista de votantes no canal separado
    const votesChannel = interaction.guild.channels.cache.get(VOTES_CHANNEL_ID);
    if (votesChannel) {
      // Procura por mensagem existente de votos para esta sugestão
      const existingMessages = await votesChannel.messages.fetch({ limit: 50 });
      const existingVoteMessage = existingMessages.find(msg => 
        msg.content.includes(`Sugestão ID: ${message.id}`)
      );

      // Cria o embed com a lista de votantes
      const votesEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Votação da Sugestão')
        .setDescription(`**Sugestão:** ${message.embeds[0].description}`)
        .addFields(
          { name: '👤 Autor Original', value: message.embeds[0].fields.find(f => f.name.includes('Autor'))?.value || 'N/A', inline: true },
          { name: '📅 Data', value: message.embeds[0].fields.find(f => f.name.includes('Data'))?.value || 'N/A', inline: true },
          { name: '📈 Total de Votos', value: `${totalVotos}`, inline: true }
        )
        .setFooter({ text: `Sugestão ID: ${message.id}` })
        .setTimestamp();

      // Adiciona campos com os votantes
      if (voto.yes.size > 0) {
        const votantesSim = Array.from(voto.yes).map(id => `<@${id}>`).join(', ');
        votesEmbed.addFields({ 
          name: `✅ Votaram Sim (${voto.yes.size}) - ${porcentagemSim}%`, 
          value: votantesSim, 
          inline: false 
        });
      }
      
      if (voto.no.size > 0) {
        const votantesNao = Array.from(voto.no).map(id => `<@${id}>`).join(', ');
        votesEmbed.addFields({ 
          name: `❌ Votaram Não (${voto.no.size}) - ${porcentagemNao}%`, 
          value: votantesNao, 
          inline: false 
        });
      }

      if (existingVoteMessage) {
        // Atualiza mensagem existente
        await existingVoteMessage.edit({ embeds: [votesEmbed] });
      } else {
        // Cria nova mensagem
        await votesChannel.send({ embeds: [votesEmbed] });
      }
    }
  } catch (error) {
    console.error('Erro ao processar voto:', error);
    await interaction.reply({ content: 'Erro ao processar seu voto. Tente novamente.', ephemeral: true });
  }
});

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN); 