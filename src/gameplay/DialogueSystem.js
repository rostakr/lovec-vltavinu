// NPC dialogue system with conversation states and objectives

export const NPC_DIALOGUES = {
  "farmer-vaclav": {
    name: "Václav",
    title: "Farmář",
    location: "chlum",
    avatar: "🚜",
    conversations: {
      first: {
        text: "Ahoj! Vítej na našem poli. Hledáš nějaké staré kamínky?",
        options: [
          { text: "Ano, hledám vltavíny!", next: "permission" },
          { text: "Jen si procházím...", next: "first" }
        ]
      },
      permission: {
        text: "Dobře, můžeš kopat na vyznačených místech. Jen si dej pozor na traktor!",
        options: [{ text: "Děkuji!", next: "default" }],
        effect: { type: "grant-permission", location: "chlum" }
      },
      default: {
        text: "Vždycky se podívej na správná místa. Traktor jezdí velmi blízko!",
        options: [{ text: "Rozumím.", next: "end" }]
      }
    }
  },

  "forester-jan": {
    name: "Jan",
    title: "Lesník",
    location: "nesmen",
    avatar: "🌲",
    conversations: {
      first: {
        text: "Pozor! V tomto lese můžeš kopat POUZE na vyznačených místech. Po sobě musíš všechno zasyp!",
        options: [
          { text: "Slibuji to!", next: "agreement" },
          { text: "Jak dlouho to trvá?", next: "first" }
        ]
      },
      agreement: {
        text: "Výborně. Les musí zůstat čistý. Všechna místa po sobě zasypej.",
        options: [{ text: "Budu opatrný.", next: "default" }],
        effect: { type: "grant-permission", location: "nesmen" }
      },
      default: {
        text: "Pamatuj si - všechna místa musí být zasypaná! Kontroluji to.",
        options: [{ text: "Rozumím.", next: "end" }]
      }
    }
  },

  "expert-eva": {
    name: "Eva",
    title: "Experti na geologii",
    location: "besednice",
    avatar: "🔬",
    conversations: {
      first: {
        text: "Ahoj! Zajímá tě tento lom? Tady se dají najít opravdu krásné naleziště!",
        options: [
          { text: "Co bych měl hledat?", next: "advice" },
          { text: "Jen si prohlížím.", next: "default" }
        ]
      },
      advice: {
        text: "Hledej v suché zóně - tam jsou nejlepší naleziska. Buď opatrný na sesypy!",
        options: [{ text: "Díky za radu!", next: "default" }],
        effect: { type: "grant-permission", location: "besednice" }
      },
      default: {
        text: "Máš-li otázky, neváhej se zeptat. Znám toto místo dobře.",
        options: [{ text: "Děkuji.", next: "end" }]
      }
    }
  },

  "guide-franta": {
    name: "František",
    title: "Průvodce",
    location: "slavia",
    avatar: "👨‍🦰",
    conversations: {
      first: {
        text: "Vítej v ruinách Slavie! Tohle je staré a záhadné místo. Bacha na ostrahu!",
        options: [
          { text: "Co tady mohu hledat?", next: "history" },
          { text: "Vypadá to nebezpečně.", next: "danger" }
        ]
      },
      history: {
        text: "Zde se dají najít staré dokumenty a artefakty. Ale musíš si dát pozor na hlídače!",
        options: [{ text: "Budu opatrný.", next: "default" }],
        effect: { type: "grant-permission", location: "slavia" }
      },
      danger: {
        text: "Ano, hlídač obchází. Když tě vidí, bude problém. Buď připraven se schovat!",
        options: [{ text: "Chápu.", next: "default" }],
        effect: { type: "grant-permission", location: "slavia" }
      },
      default: {
        text: "Podívej se kolem a najdi, co se ti líbí. Ale zůstaň opatrný!",
        options: [{ text: "Děkuji.", next: "end" }]
      }
    }
  }
};

export class DialogueSystem {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.npcStates = new Map();
    this.conversationHistory = [];
    this.listeners = [];
  }

  // Get NPC definition
  getNPC(npcId) {
    return NPC_DIALOGUES[npcId] || null;
  }

  // Get current conversation state for NPC
  getState(npcId) {
    return this.npcStates.get(npcId) || "first";
  }

  // Set NPC state
  setState(npcId, state) {
    this.npcStates.set(npcId, state);
  }

  // Get conversation text and options for current state
  getConversation(npcId) {
    const npc = this.getNPC(npcId);
    if (!npc) return null;

    const state = this.getState(npcId);
    const conversation = npc.conversations[state];

    if (!conversation) {
      return {
        text: "...",
        options: [{ text: "Rozumím.", next: "end" }]
      };
    }

    return {
      name: npc.name,
      title: npc.title,
      avatar: npc.avatar,
      text: conversation.text,
      options: conversation.options
    };
  }

  // Handle conversation choice
  handleChoice(npcId, optionIndex) {
    const npc = this.getNPC(npcId);
    if (!npc) return null;

    const state = this.getState(npcId);
    const conversation = npc.conversations[state];

    if (!conversation || !conversation.options[optionIndex]) {
      return null;
    }

    const option = conversation.options[optionIndex];
    const nextState = option.next;

    // Record conversation
    this.conversationHistory.push({
      npcId,
      state,
      optionText: option.text,
      timestamp: Date.now()
    });

    // Apply conversation effects
    if (conversation.effect) {
      this.applyEffect(npcId, conversation.effect);
    }

    // Move to next state
    if (nextState === "end") {
      this.setState(npcId, "default");
    } else {
      this.setState(npcId, nextState);
    }

    return {
      effect: conversation.effect,
      nextState,
      npc
    };
  }

  // Apply conversation effect
  applyEffect(npcId, effect) {
    this.notifyListeners("effect", { npcId, effect });

    switch (effect.type) {
      case "grant-permission":
        this.logger.info(`Permission granted for ${effect.location}`);
        break;
      case "unlock-objective":
        this.logger.info(`Objective unlocked: ${effect.objective}`);
        break;
      case "hint":
        this.logger.info(`Hint: ${effect.message}`);
        break;
    }
  }

  // Get all NPC interactions for a location
  getLocationNPCs(locationId) {
    return Object.entries(NPC_DIALOGUES)
      .filter(([_, npc]) => npc.location === locationId)
      .map(([id, npc]) => ({ id, ...npc }));
  }

  // Check if NPC has been talked to
  hasSpoken(npcId) {
    return this.conversationHistory.some(entry => entry.npcId === npcId);
  }

  // Get conversation history for an NPC
  getHistory(npcId) {
    return this.conversationHistory.filter(entry => entry.npcId === npcId);
  }

  // Reset dialogue state (for new level/game)
  reset() {
    this.npcStates.clear();
    this.conversationHistory = [];
  }

  // Event system
  onEffect(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(eventType, data) {
    for (const listener of this.listeners) {
      try {
        listener({ type: eventType, data });
      } catch (error) {
        this.logger.error(`Dialogue listener error: ${error.message}`);
      }
    }
  }

  dispose() {
    this.listeners = [];
  }
}

// Global instance
export const dialogueSystem = new DialogueSystem();
