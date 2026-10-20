/** Tariflar (TAKLIF — narxlar 5-bosqichda tasdiqlanadi). bootstrap va seed bir xil ro'yxatni yozadi. */
export const PLAN_ROWS = [
  { code: 'sinov', name: 'Sinov', priceSom: 0, maxEmployees: 15, maxBranches: 1, faceControl: true, sort: 0 },
  { code: 'start', name: 'Start', priceSom: 199_000, maxEmployees: 20, maxBranches: 1, faceControl: true, sort: 1 },
  { code: 'biznes', name: 'Biznes', priceSom: 449_000, maxEmployees: 60, maxBranches: 3, faceControl: true, sort: 2 },
  { code: 'pro', name: 'Pro', priceSom: 899_000, maxEmployees: 200, maxBranches: 10, faceControl: true, sort: 3 },
] as const;

export const TRIAL_DAYS = 14;
