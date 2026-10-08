/**
 * Business logic for KPI and performance calculations.
 * Used by both frontend (display) and backend (Functions).
 */

export interface KPIData {
  kpiId: string;
  target: number;
  actual: number;
}

export const PerformanceLogic = {
  /**
   * Calculates progress percentage for a single KPI.
   */
  calculateKPIProgress(actual: number, target: number): number {
    if (!target || target <= 0) return 0;
    const progress = (actual / target) * 100;
    return progress;
  },

  /**
   * Formats progress for display, capping at 100% if requested.
   */
  formatProgress(progress: number, capAt100: boolean = true): number {
    if (capAt100 && progress > 100) return 100;
    return Math.round(progress * 10) / 10; // 1 decimal place
  },

  /**
   * Calculates overall progress for a staff member across multiple KPIs.
   * Average of progress across all KPIs that have a target > 0.
   */
  calculateStaffOverall(kpis: KPIData[]): number {
    const activeKpis = kpis.filter(k => k.target > 0);
    if (activeKpis.length === 0) return 0;
    
    const sumProgress = activeKpis.reduce((acc, k) => {
      return acc + this.calculateKPIProgress(k.actual, k.target);
    }, 0);
    
    return sumProgress / activeKpis.length;
  },

  /**
   * Aggregates branch performance.
   * Logic: Sum of staff achievements / branch target.
   */
  calculateBranchKPIProgress(staffAchievements: number, branchTarget: number): number {
    return this.calculateKPIProgress(staffAchievements, branchTarget);
  },

  /**
   * Validates if adding a staff target would exceed the branch's total target.
   */
  validateTargetAllocation(totalBranchTarget: number, currentAllocated: number, newStaffTarget: number): boolean {
    return (currentAllocated + newStaffTarget) <= totalBranchTarget;
  }
};
