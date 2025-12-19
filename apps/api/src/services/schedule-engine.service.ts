
import dayjs from 'dayjs';
import { prisma } from 'database';

interface SimulationInput {
    organizationId: string;
    year: number;
    month: number;
    sectorId: string;
}


export class ScheduleEngineService {
    async simulate(input: SimulationInput) {
        const { organizationId, year, month, sectorId } = input;

        // 1. Fetch Resources
        const sector = await prisma.scheduleSector.findFirst({
            where: { id: sectorId, organizationId }
        });
        if (!sector) throw new Error('Sector not found');

        const employees = await prisma.scheduleEmployee.findMany({
            where: { sectorId, organizationId }
        });
        if (employees.length === 0) throw new Error('No employees in sector');

        const monthConfig = await prisma.scheduleMonthConfig.findUnique({
            where: { organizationId_year_month: { organizationId, year, month } }
        });

        // 2. Setup Calendar
        const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
        const matrix: Record<string, Record<number, string>> = {}; // userId -> day -> status
        const coverageByDay: Record<number, number> = {};
        const warnings: string[] = [];

        // Initialize Matrix
        for (const emp of employees) {
            matrix[emp.id] = {};
        }

        // 3. Logic per Employee Type
        const employees12x36 = employees.filter((e: any) => e.scheduleType === '12x36');
        const employees6x1 = employees.filter((e: any) => !e.scheduleType || e.scheduleType === '6x1');

        // === HANDLE 12x36 ===
        // Distribute them evenly to start (Group A starts Day 1, Group B starts Day 2) if possible
        let groupACount = 0;
        let groupBCount = 0;

        for (const emp of employees12x36) {
            // Check if they have a fixed work day preference to anchor them
            // For now, simple alternating. Try to balance A and B.
            const startWorkingDay1 = groupACount <= groupBCount;
            if (startWorkingDay1) groupACount++; else groupBCount++;

            for (let day = 1; day <= daysInMonth; day++) {
                const date = dayjs(`${year}-${month}-${day}`);
                // const weekday = date.day();

                // Check Fixed Off overrides
                if (this.isFixedOff(emp, date)) {
                    matrix[emp.id][day] = 'F';
                    continue;
                }

                // Logic: Work every other day
                // Group A: 1, 3, 5...
                // Group B: 2, 4, 6...
                const isWorkDay = startWorkingDay1 ? (day % 2 !== 0) : (day % 2 === 0);

                if (isWorkDay) {
                    matrix[emp.id][day] = 'T';
                } else {
                    matrix[emp.id][day] = 'F';
                }
            }
        }

        // === HANDLE 6x1 ===
        // We need to ensure 1 day off per week (Sunday-Saturday block)
        // And distribute extra days off per month

        // Setup initial 6x1 grid (Work all, then punch holes for offs)
        for (const emp of employees6x1) {
            // Track used extra days
            let extraDaysUsed = 0;
            const extraDaysTarget = emp.extraDaysOffPerMonth || 0;

            // Iterate by weeks to ensure 1 mandatory off
            // Identify weeks in this month
            // We can just iterate days and keep track of "days since last off" or process by week blocks
            // Let's process day by day but look ahead/back for weekly constraint?
            // Simpler: Pre-fill all as Work, then select Off days.

            for (let day = 1; day <= daysInMonth; day++) {
                const date = dayjs(`${year}-${month}-${day}`);
                const dateStr = date.format('YYYY-MM-DD');
                const isBlocked = (monthConfig?.blockedDates as string[] | undefined)?.includes(dateStr);

                if (isBlocked) {
                    matrix[emp.id][day] = 'T'; // Force Work on blocked dates
                } else if (this.isFixedOff(emp, date)) {
                    matrix[emp.id][day] = 'F';
                    // This counts as the weekly off if needed
                } else if (this.isUnavailable(emp, date.day())) {
                    matrix[emp.id][day] = 'F';
                } else {
                    matrix[emp.id][day] = 'T'; // Default to work, refine later
                }
            }

            // Enforce 1 Off Per Week (Sunday to Saturday)
            // Get all Sundays in month
            // For each week, check if there is an 'F'. If not, assign one (Preferably Sunday or Preferred Day)
            // This is a naive heuristic.

            // Simple approach: Assign 1 fixed off per week based on `weeklyOffPreferenceMain` or random/rotation
            // If they worked 6 days consecutive, force 7th as off.

            // Re-pass to enforce 6x1 logic
            let consecutiveWork = 0;
            for (let day = 1; day <= daysInMonth; day++) {
                // Check blocked again for the 6-day force off
                const date = dayjs(`${year}-${month}-${day}`);
                const dateStr = date.format('YYYY-MM-DD');
                const isBlocked = (monthConfig?.blockedDates as string[] | undefined)?.includes(dateStr);

                if (matrix[emp.id][day] === 'T') {
                    consecutiveWork++;
                } else {
                    consecutiveWork = 0; // Reset on off
                }

                if (consecutiveWork > 6) {
                    // Must force off, BUT NOT if blocked
                    if (!isBlocked) {
                        matrix[emp.id][day] = 'F';
                        consecutiveWork = 0;
                    } else {
                        // Violation: Worked > 6 days because 7th was blocked.
                        // Ideally we should have given off on day 6.
                        // For now, allow violation or try to set previous day to F?
                        // Let's just suppress the 'F' assignment on this blocked day.
                        // They will work 7+ days. (Should add warning? Maybe later)
                    }
                }
            }

            // Distribute Extra Days Off
            if (extraDaysTarget > 0) {
                // Try to place them in weeks that don't have multiple offs yet?
                // Or randomly place them on low-demand days? 
                // For MVP: Place them in Week 2 and Week 4 if available
                let extraAssigned = 0;
                // Try Sundays first if working? Or Mondays?
                // Heuristic: Find a working day and flip to Extra Off (FE)
                for (let day = 1; day <= daysInMonth; day++) {
                    if (extraAssigned >= extraDaysTarget) break;

                    const date = dayjs(`${year}-${month}-${day}`);
                    const dateStr = date.format('YYYY-MM-DD');
                    const isBlocked = (monthConfig?.blockedDates as string[] | undefined)?.includes(dateStr);

                    // Optimization: Don't pick if it breaks min staffing (checked later, but here we guess)
                    // Just pick random 'T' days for now to verify concept
                    if (matrix[emp.id][day] === 'T' && Math.random() > 0.8 && !isBlocked) {
                        matrix[emp.id][day] = 'FE';
                        extraAssigned++;
                    }
                }
            }
        }

        // 4. Verify Coverage & Generate Warnings
        for (let day = 1; day <= daysInMonth; day++) {
            const date = dayjs(`${year}-${month}-${day}`);
            const weekday = date.day();

            // Handle minStaff potentially being nested or number
            const minStaffRaw = (sector.minStaffByWeekday as any)?.[String(weekday)] || 0;
            const hasMultipleShifts = sector.numberOfShifts === 2;

            if (hasMultipleShifts && typeof minStaffRaw === 'object') {
                // Per shift check
                const minShift1 = minStaffRaw['1'] || 0;
                const minShift2 = minStaffRaw['2'] || 0;

                let countShift1 = 0;
                let countShift2 = 0;

                employees.forEach((emp: any) => {
                    if (matrix[emp.id][day] === 'T') {
                        // 12x36 counts for BOTH
                        if (emp.scheduleType === '12x36') {
                            countShift1++;
                            countShift2++;
                        } else if (emp.shift === '1') {
                            countShift1++;
                        } else if (emp.shift === '2') {
                            countShift2++;
                        }
                    }
                });

                // We store total coverage just for stats, maybe sum?
                coverageByDay[day] = countShift1 + countShift2; // Rough metric

                if (countShift1 < minShift1) {
                    warnings.push(`Dia ${day} (${date.format('dddd')}): Turno 1 tem ${countShift1}, precisa de ${minShift1}.`);
                }
                if (countShift2 < minShift2) {
                    warnings.push(`Dia ${day} (${date.format('dddd')}): Turno 2 tem ${countShift2}, precisa de ${minShift2}.`);
                }

            } else {
                // Simple check (Single shift or old data)
                const minStaff = typeof minStaffRaw === 'number' ? minStaffRaw : 0;
                let count = 0;
                employees.forEach((emp: any) => {
                    if (matrix[emp.id][day] === 'T') count++;
                });

                coverageByDay[day] = count;

                if (count < minStaff) {
                    warnings.push(`Dia ${day} (${date.format('dddd')}): Falta gente! Tem ${count}, precisa de ${minStaff}.`);
                }
            }
        }

        // 5. Calculate stats
        const score = Math.max(0, 100 - (warnings.length * 5));

        return {
            matrix,
            coverageByDay,
            warnings,
            score,
            hardViolations: []
        };
    }

    private isFixedOff(emp: any, date: dayjs.Dayjs) {
        if (Array.isArray(emp.fixedOffDates)) {
            return emp.fixedOffDates.includes(date.format('YYYY-MM-DD'));
        }
        return false;
    }

    private isUnavailable(emp: any, weekday: number) {
        if (Array.isArray(emp.unavailableWeekdays)) {
            return emp.unavailableWeekdays.includes(weekday);
        }
        return false;
    }

    // Placeholder for Optimization
    async optimize(input: SimulationInput & { currentMatrix: any }) {
        // For V1, just re-run simulate
        return this.simulate(input);
    }

    // Placeholder for Finalization
    async finalize(organizationId: string, userId: string, data: {
        year: number;
        month: number;
        sectorId: string;
        matrix: any;
        stats: any;
    }) {
        // 1. Upsert Schedule (Parent)
        const schedule = await prisma.schedule.upsert({
            where: {
                organizationId_year_month: {
                    organizationId,
                    year: data.year,
                    month: data.month
                }
            },
            create: {
                organizationId,
                year: data.year,
                month: data.month,
                status: 'DRAFT',
                createdById: userId
            },
            update: {}
        });

        // 2. Upsert Sector Output
        const output = await prisma.scheduleSectorOutput.upsert({
            where: {
                scheduleId_sectorId: {
                    scheduleId: schedule.id,
                    sectorId: data.sectorId
                }
            },
            create: {
                scheduleId: schedule.id,
                sectorId: data.sectorId,
                data: data.matrix,
                coverageByDay: data.stats.coverageByDay,
                warnings: data.stats.warnings,
            },
            update: {
                data: data.matrix,
                coverageByDay: data.stats.coverageByDay,
                warnings: data.stats.warnings,
            }
        });

        return output;
    }
}

export const scheduleEngineService = new ScheduleEngineService();
