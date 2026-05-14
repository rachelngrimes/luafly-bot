console.log("Token:", process.env.BOT_TOKEN ? "Found" : "NOT FOUND");

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check if bot is online"),
  new SlashCommandBuilder().setName("whitelist").setDescription("Whitelist a user")
    .addStringOption(o => o.setName("hwid").setDescription("The HWID to whitelist").setRequired(true))
    .addStringOption(o => o.setName("username").setDescription("Their username").setRequired(true)),
  new SlashCommandBuilder().setName("blacklist").setDescription("Blacklist a user")
    .addStringOption(o => o.setName("hwid").setDescription("The HWID to blacklist").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for blacklist").setRequired(false)),
  new SlashCommandBuilder().setName("removeuser").setDescription("Remove a user")
    .addStringOption(o => o.setName("hwid").setDescription("The HWID to remove").setRequired(true)),
  new SlashCommandBuilder().setName("genkey").setDescription("Generate a whitelist key")
    .addStringOption(o => o.setName("duration").setDescription("7day, 30day, or lifetime").setRequired(true)),
  new SlashCommandBuilder().setName("addtokens").setDescription("Give a user reset tokens")
    .addStringOption(o => o.setName("hwid").setDescription("The HWID").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount of tokens").setRequired(true)),
  new SlashCommandBuilder().setName("userinfo").setDescription("Get info about a user")
    .addStringOption(o => o.setName("hwid").setDescription("The HWID to look up").setRequired(true)),
  new SlashCommandBuilder().setName("stats").setDescription("Show overall stats"),
];

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map(c => c.toJSON()) });
  console.log("Commands registered!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const ADMIN_ID = process.env.ADMIN_ID;
  if (interaction.user.id !== ADMIN_ID) {
    return interaction.reply({ content: "❌ You don't have permission to use this.", ephemeral: true });
  }

  const API = process.env.LUAFLY_API;

  if (interaction.commandName === "ping") {
    return interaction.reply({ content: "✅ Bot is online!", ephemeral: true });
  }

  if (interaction.commandName === "whitelist") {
    const hwid = interaction.options.getString("hwid");
    const username = interaction.options.getString("username");
    await interaction.deferReply({ ephemeral: true });
    const res = await fetch(`${API}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hwid, username, status: "whitelisted" })
    });
    const data = await res.json();
    return interaction.editReply(data.success ? `✅ **${username}** has been whitelisted!` : `❌ Error: ${data.error}`);
  }

  if (interaction.commandName === "blacklist") {
    const hwid = interaction.options.getString("hwid");
    const reason = interaction.options.getString("reason") || "No reason provided";
    await interaction.deferReply({ ephemeral: true });

    const check = await fetch(`${API}/api/users`).then(r => r.json());
    const exists = check.find(u => u.hwid === hwid);

    if (exists) {
      const res = await fetch(`${API}/api/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hwid, status: "blacklisted", ban_reason: reason })
      });
      const data = await res.json();
      return interaction.editReply(data.success ? `✅ User blacklisted.\n**Reason:** ${reason}` : `❌ Error: ${data.error}`);
    } else {
      const res = await fetch(`${API}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hwid, username: "Unknown", status: "blacklisted", ban_reason: reason })
      });
      const data = await res.json();
      return interaction.editReply(data.success ? `✅ User blacklisted.\n**Reason:** ${reason}` : `❌ Error: ${data.error}`);
    }
  }

  if (interaction.commandName === "removeuser") {
    const hwid = interaction.options.getString("hwid");
    await interaction.deferReply({ ephemeral: true });
    const res = await fetch(`${API}/api/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hwid })
    });
    const data = await res.json();
    return interaction.editReply(data.success ? `✅ User removed!` : `❌ Error: ${data.error}`);
  }

  if (interaction.commandName === "genkey") {
    const duration = interaction.options.getString("duration");
    if (!["7day", "30day", "lifetime"].includes(duration)) {
      return interaction.reply({ content: "❌ Duration must be 7day, 30day, or lifetime.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const res = await fetch(`${API}/api/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration, amount: 1 })
    });
    const data = await res.json();
    return interaction.editReply(data.success ? `✅ Key generated!\n\`${data.keys[0]}\`` : `❌ Error: ${data.error}`);
  }

  if (interaction.commandName === "addtokens") {
    const hwid = interaction.options.getString("hwid");
    const amount = interaction.options.getInteger("amount");
    await interaction.deferReply({ ephemeral: true });
    const res = await fetch(`${API}/api/addtokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hwid, amount })
    });
    const data = await res.json();
    return interaction.editReply(data.success ? `✅ Added **${amount}** token(s)!\n🪙 Total: **${data.tokens}**` : `❌ Error: ${data.error}`);
  }

  if (interaction.commandName === "userinfo") {
    const hwid = interaction.options.getString("hwid");
    await interaction.deferReply({ ephemeral: true });
    const res = await fetch(`${API}/api/status?hwid=${hwid}`);
    const data = await res.json();
    if (data.status === "not_found") return interaction.editReply("❌ User not found.");
    return interaction.editReply(
      `👤 **${data.username || "Unknown"}**\n` +
      `**Status:** ${data.status}\n` +
      `**Expires:** ${data.expires_at ? new Date(data.expires_at).toLocaleDateString() : "Lifetime"}\n` +
      `**Resets left:** ${data.hwid_resets_left ?? 0}\n` +
      `**Tokens:** ${data.tokens ?? 0}\n` +
      `**Member since:** ${data.created_at ? new Date(data.created_at).toLocaleDateString() : "Unknown"}`
    );
  }

  if (interaction.commandName === "stats") {
    await interaction.deferReply({ ephemeral: true });
    const users = await fetch(`${API}/api/users`).then(r => r.json());
    const logs = await fetch(`${API}/api/logs?filter=today`).then(r => r.json());
    const wl = users.filter(u => u.status === "whitelisted").length;
    const bl = users.filter(u => u.status === "blacklisted").length;
    const exec = logs.filter(l => l.action === "executed").length;
    return interaction.editReply(
      `📊 **Luafly Stats**\n` +
      `**Total Users:** ${users.length}\n` +
      `**Whitelisted:** ${wl}\n` +
      `**Blacklisted:** ${bl}\n` +
      `**Executions Today:** ${exec}`
    );
  }
});

client.login(process.env.BOT_TOKEN);
