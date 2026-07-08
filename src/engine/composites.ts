/** A team's composite ratings. Each is 0..1 with 0.5 = league average. */
export interface Composites {
  name: string;
  attack: number; // how often possession escalates into a shot
  finishing: number; // shot accuracy + conversion
  defense: number; // suppresses opponent chances, blocks shots
  keeping: number; // goalkeeper save rate
  control: number; // possession retention
}

export type CompositeOverrides = Partial<Omit<Composites, "name">>;

/** Build a team's composites, defaulting any unset composite to 0.5. */
export function makeTeam(name: string, o: CompositeOverrides = {}): Composites {
  return {
    name,
    attack: o.attack ?? 0.5,
    finishing: o.finishing ?? 0.5,
    defense: o.defense ?? 0.5,
    keeping: o.keeping ?? 0.5,
    control: o.control ?? 0.5,
  };
}
