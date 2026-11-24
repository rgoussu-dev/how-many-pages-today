/**
 * Ubiquitous driven ports. They belong to no context: every hexagon needs the time and
 * some randomness, and every test wants to pin both.
 */
export interface Clock {
  /** The current instant. Local calendar fields (getFullYear, getHours…) are the user's day. */
  now(): Date;
}

export interface RandomSource {
  /** A float in [0, 1). */
  next(): number;
}

export interface LanguageSource {
  /** The device's preferred languages as BCP 47 tags, most preferred first (`fr-FR`, `en`). */
  preferred(): readonly string[];
}
