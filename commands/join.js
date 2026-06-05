const joinCommand = async (interaction) => {
 
    const member = interaction.member;


    const guild = interaction.guild;


    const textChannel = guild.channels.cache.find(channel => channel.name === 'typerace-channel');


    if (!textChannel) {
        return interaction.reply("No typerace channel exists. It probably hasn't been created yet.");
    }

    let typeracistRole = guild.roles.cache.find(role => role.name === 'typeracist');
    if (!typeracistRole) {
        try {
            typeracistRole = await guild.roles.create({
                name: 'typeracist',
                color: 3447003, 
                permissions: [], 
                reason: 'Role for typerace participants',
            });
        } catch (roleError) {
            console.error('Error creating typeracist role:', roleError);
            return interaction.reply("Couldn't create typeracist role. Check perms.");
        }
    }

   
    try {
        await member.roles.add(typeracistRole);
        interaction.reply(`**${member.user.username}** has entered the typerace!`);


    
        const removeRoleOnChannelDelete = async () => {
            try {
                await member.roles.remove(typeracistRole);
                console.log(`Role ${typeracistRole.name} removed from ${member.user.tag} after channel deletion.`);
            } catch (removeError) {
                console.error('Error removing typeracist role:', removeError);
            }
        };

        
        interaction.client.on('channelDelete', removeRoleOnChannelDelete);

    
        setTimeout(() => {
       
            interaction.client.off('channelDelete', removeRoleOnChannelDelete);
        }, 60000); 
    } catch (addRoleError) {
        console.error('Error adding typeracist role:', addRoleError);
        interaction.reply("Couldn't add typeracist role. Perms issue.");
    }
};

module.exports = joinCommand;
