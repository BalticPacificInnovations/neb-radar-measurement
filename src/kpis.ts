// The 29 KPIs of the JRC139118 NEB self-assessment method (European Commission, Joint Research Centre, 2024, CC BY 4.0).
export type Dimension = "sustainability" | "beauty" | "inclusiveness";
export interface Kpi { code: string; dimension: Dimension; title: string }

const S: [string, string][] = [
  ["S.1", "Minimise the use of fossil fuels in the built environment"],
  ["S.2", "Maximise the use of sustainable energy in the built environment"],
  ["S.3", "Minimise greenhouse gas emissions from the built environment"],
  ["S.4", "Enhance sustainable mobility in the built environment"],
  ["S.5", "Minimise non-energy related environmental impacts to air and water"],
  ["S.6", "Minimise non-energy related environmental impacts from the built environment"],
  ["S.7", "Achieve the best possible greening of the public sector in terms of its economic involvement in the sustainability of the built environment"],
  ["S.8", "Achieve the best possible greening of the private and financial sector in terms of its economic involvement in the sustainability of the built environment"],
  ["S.9", "Promote circular economy in the built environment"],
];
const B: [string, string][] = [
  ["B.1", "Digitalisation in construction"],
  ["B.2", "Quality of design and delivery"],
  ["B.3", "Improving building resilience to extreme events"],
  ["B.4", "Ensuring occupant health, comfort and wellbeing"],
  ["B.5", "Improving accessibility of the built environment for everyone"],
  ["B.6", "Maximising durability and service life"],
  ["B.7", "Ensuring high level of aesthetic acceptance of buildings and spaces"],
  ["B.8", "Providing spatial coherence in planning and design"],
  ["B.9", "Improving preservation of cultural and natural heritage"],
  ["B.10", "Maintaining genius loci and improving sense of belonging"],
  ["B.11", "Understanding aesthetic perception of buildings and spaces through comparison to actual 'styles' and tendencies in art and architecture"],
];
const I: [string, string][] = [
  ["I.1", "Funding and land value"],
  ["I.2", "Affordability"],
  ["I.3", "Inclusive quality, equality and accessibility"],
  ["I.4", "Rent regulation"],
  ["I.5", "Impact on neighbourhood social cohesion"],
  ["I.6", "Needs and resources for social accessibility"],
  ["I.7", "Needs of vulnerable and marginalised groups"],
  ["I.8", "Anti-discrimination initiatives"],
  ["I.9", "Involvement of stakeholders"],
];

export const KPIS: Kpi[] = [
  ...S.map(([code, title]) => ({ code, title, dimension: "sustainability" as const })),
  ...B.map(([code, title]) => ({ code, title, dimension: "beauty" as const })),
  ...I.map(([code, title]) => ({ code, title, dimension: "inclusiveness" as const })),
];
