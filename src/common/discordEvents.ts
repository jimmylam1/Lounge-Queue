import EventEmitter from "events";
import Discord from "discord.js";

class SlashCommandEmitter extends EventEmitter {
    on(event: string, listener: (interaction: Discord.CommandInteraction<Discord.CacheType>) => any): this {
      return super.on(event, listener);
    }

    emit(event: string, interaction: Discord.CommandInteraction<Discord.CacheType>): boolean {
      return super.emit(event, interaction);
    }
}

class ButtonEmitter extends EventEmitter {
    on(event: string, listener: (interaction: Discord.ButtonInteraction<Discord.CacheType>) => any): this {
      return super.on(event, listener);
    }

    emit(event: string, interaction: Discord.ButtonInteraction<Discord.CacheType>): boolean {
      return super.emit(event, interaction);
    }
}

class AutocompleteEmitter extends EventEmitter {
  on(event: string, listener: (interaction: Discord.AutocompleteInteraction<Discord.CacheType>) => any): this {
    return super.on(event, listener);
  }

  emit(event: string, interaction: Discord.AutocompleteInteraction<Discord.CacheType>): boolean {
    return super.emit(event, interaction);
  }
}

export const slashCommandEvent = new SlashCommandEmitter();
export const buttonEvent = new ButtonEmitter();
export const autocompleteEvent = new AutocompleteEmitter();
