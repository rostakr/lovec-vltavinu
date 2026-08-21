const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
};

export const SLAVIA_PHASES = Object.freeze([
  "documents",
  "expert-consultation",
  "thief-recovery",
  "certification",
  "event-entry",
  "complete"
]);

export class SlaviaObjectiveFlow {
  #state;

  constructor() {
    this.reset();
  }

  get state() {
    return this.#state;
  }

  reset() {
    this.#state = deepFreeze({
      phase: "documents",
      documents: Object.freeze([]),
      expertConsulted: false,
      thiefStarted: false,
      thiefDefeated: false,
      certificateReceived: false,
      enteredEvent: false,
      complete: false
    });
    return this.#state;
  }

  collectDocument(id) {
    const documentId = String(id ?? "").trim();
    if (!documentId) throw new TypeError("document id must be a non-empty string.");
    if (this.#state.documents.includes(documentId)) return this.#state;
    if (this.#state.phase !== "documents") throw new Error("Documents can only be collected during the documents phase.");

    const documents = Object.freeze([...this.#state.documents, documentId].sort());
    this.#state = deepFreeze({
      ...this.#state,
      documents,
      phase: documents.length >= 3 ? "expert-consultation" : "documents"
    });
    return this.#state;
  }

  consultExpert() {
    if (this.#state.documents.length < 3) throw new Error("All three documents are required before consulting the expert.");
    if (this.#state.expertConsulted) return this.#state;
    this.#state = deepFreeze({
      ...this.#state,
      expertConsulted: true,
      thiefStarted: true,
      phase: "thief-recovery"
    });
    return this.#state;
  }

  defeatThief() {
    if (!this.#state.thiefStarted) throw new Error("The thief encounter has not started.");
    if (this.#state.thiefDefeated) return this.#state;
    this.#state = deepFreeze({
      ...this.#state,
      thiefDefeated: true,
      phase: "certification"
    });
    return this.#state;
  }

  receiveCertificate() {
    if (!this.#state.expertConsulted || !this.#state.thiefDefeated) {
      throw new Error("Expert consultation and thief recovery are required before certification.");
    }
    if (this.#state.certificateReceived) return this.#state;
    this.#state = deepFreeze({
      ...this.#state,
      certificateReceived: true,
      phase: "event-entry"
    });
    return this.#state;
  }

  enterEvent() {
    if (!this.#state.certificateReceived) throw new Error("A certificate is required before entering the event.");
    if (this.#state.complete) return this.#state;
    this.#state = deepFreeze({
      ...this.#state,
      enteredEvent: true,
      complete: true,
      phase: "complete"
    });
    return this.#state;
  }

  snapshot() {
    return this.#state;
  }
}
