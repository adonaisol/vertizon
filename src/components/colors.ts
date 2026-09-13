export const MANAGER_COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];
export function managerColor(index: number): string {
  return MANAGER_COLORS[index % MANAGER_COLORS.length];
}
