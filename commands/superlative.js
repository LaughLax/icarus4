const Augur = require("augurbot"),
  Rank = require("../utils/RankInfo"),
  u = require("../utils/utils");

const starboard = "405405857099284490",
  threshold = 5;

async function updateStarboard(message) {
  try {
    // Don't post bot messages, silly
    if (message.author.bot || message.author.id == message.client.user.id) return false;

    let bot = message.client;
    let {count, valid} = validate(message);
    const reactions = message.reactions.filter(r => (!r.emoji.guild || (r.emoji.guild.id == Module.config.ldsg)));

    let embed = u.embed()
    .setAuthor(message.member.displayName, message.author.displayAvatarURL)
    .setTimestamp(message.createdAt)
    .setDescription(message.cleanContent)
    .setColor((valid ? "DARK_GOLD" : null))
    .addField("Channel", message.channel.name)
    .addField("Jump to post", message.url)
    .setFooter(reactions.map(r => `${r.emoji.name} ${r.count}`).join(" | "));

    if (message.attachments && (message.attachments.size > 0))
    embed.setImage(message.attachments.first().url);

    let star = await Module.db.starboard.fetchStar(message.id);
    if (star && !star.deny) {
      let m = await bot.channels.get(starboard).fetchMessage(star.starId);
      m.edit(embed);
    } else {
      let m = await bot.channels.get(starboard).send(embed);
      Module.db.starboard.saveStar(message, m);
    }
  } catch(e) { u.alertError(e); }
};

function validate(message) {
  const management = message.guild.roles.get(Module.config.roles.management);
  const team = message.guild.roles.get(Module.config.roles.mod);
  let count = 0;
  let valid = false;

  if (!message.author.bot) {
    for (const [__, reaction] of message.reactions) {
      if (reaction.count > count) count = reaction.count;
      if (reaction.emoji.name == "🌟") {
        for (const [userId, user] of reaction.users) {
          if (team.members.has(userId) || management.members.has(userId)) {
            valid = true;
            break;
          }
        }
      }
    }
  }

  return {count, valid};
};

const Module = new Augur.Module()
.addEvent("messageReactionAdd", (reaction, user) => {
  let message = reaction.message;
  if (message.guild && (message.guild.id == Module.config.ldsg) && !message.author.bot) {
    if ((message.channel.id == starboard) && reaction.emoji.name == "🚫" && (message.guild.roles.get(Module.config.roles.mod).members.has(user.id))) {
      if (message.embeds[0].color == null) {
        message.delete();
        Module.db.starboard.denyStar(message);
      }
    } else {
      let {count, valid} = validate(message);
      if ((valid || (count >= threshold)) && !Rank.excludeChannels.includes(message.channel.id))
        updateStarboard(message);
    }
  }
})
.addEvent("messageReactionRemove", (reaction, user) => {
  let message = reaction.message;
	if (message.guild && (message.guild.id == Module.config.ldsg)) {
		let {count, valid} = validate(message);
		if ((valid || (count >= threshold)) && !Rank.excludeChannels.includes(message.channel.id))
      updateStarboard(message);
	}
});

module.exports = Module;
