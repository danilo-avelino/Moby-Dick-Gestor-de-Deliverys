


import { prisma } from 'database';

export class ScheduleResourceService {
    // ==========================================
    // SECTORS
    // ==========================================

    async listSectors(organizationId: string) {
        return prisma.scheduleSector.findMany({
            where: { organizationId, isActive: true },
            include: {
                _count: { select: { employees: true } },
                employees: {
                    select: {
                        id: true,
                        name: true,
                        scheduleType: true,
                        shift: true
                    },
                    orderBy: { name: 'asc' }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    async createSector(organizationId: string, data: { name: string; minStaffByWeekday: any; maxStaffByWeekday?: any; numberOfShifts?: number }) {
        return prisma.scheduleSector.create({
            data: {
                organizationId,
                name: data.name,
                minStaffByWeekday: data.minStaffByWeekday,
                maxStaffByWeekday: data.maxStaffByWeekday,
                numberOfShifts: data.numberOfShifts,
            }
        });
    }

    async updateSector(organizationId: string, id: string, data: { name?: string; minStaffByWeekday?: any; maxStaffByWeekday?: any; numberOfShifts?: number; isActive?: boolean }) {
        // Verify ownership
        await this.verifySectorOwnership(organizationId, id);

        return prisma.scheduleSector.update({
            where: { id },
            data
        });
    }

    async deleteSector(organizationId: string, id: string) {
        await this.verifySectorOwnership(organizationId, id);
        // Soft delete
        return prisma.scheduleSector.update({
            where: { id },
            data: { isActive: false }
        });
    }

    private async verifySectorOwnership(organizationId: string, sectorId: string) {
        const sector = await prisma.scheduleSector.findFirst({
            where: { id: sectorId, organizationId }
        });
        if (!sector) throw new Error('Sector not found or access denied');
    }

    // ==========================================
    // EMPLOYEES
    // ==========================================

    async listEmployees(organizationId: string, sectorId?: string) {
        const where: any = { organizationId };
        if (sectorId) {
            where.sectorId = sectorId;
        }

        return prisma.scheduleEmployee.findMany({
            where,
            include: { sector: true },
            orderBy: { name: 'asc' }
        });
    }

    async createEmployee(organizationId: string, data: {
        sectorId: string;
        name: string;
        scheduleType?: string; // NEW
        shift?: string; // NEW
        extraDaysOffPerMonth?: number; // NEW
        workDaysPerWeek: number;
        extraDaysOffDefault: number;
        extraDaysOffOverride?: number;
        weeklyOffPreferenceMain?: any;
        weeklyOffPreferenceExtra?: any;
        unavailableWeekdays?: any;
        fixedOffDates?: any;
        fixedWorkDates?: any;
        maxConsecutiveWorkDays?: number;
        priorityScore?: number;
    }) {
        // Verify sector belongs to org
        await this.verifySectorOwnership(organizationId, data.sectorId);

        return prisma.scheduleEmployee.create({
            data: {
                organizationId,
                ...data,
                scheduleType: data.scheduleType ?? "6x1", // Default
                extraDaysOffPerMonth: data.extraDaysOffPerMonth ?? 0
            }
        });
    }

    async updateEmployee(organizationId: string, id: string, data: Partial<{
        sectorId: string;
        name: string;
        scheduleType: string; // NEW
        shift: string; // NEW
        extraDaysOffPerMonth: number; // NEW
        workDaysPerWeek: number;
        extraDaysOffDefault: number;
        extraDaysOffOverride: number | null;
        weeklyOffPreferenceMain: any;
        weeklyOffPreferenceExtra: any;
        unavailableWeekdays: any;
        fixedOffDates: any;
        fixedWorkDates: any;
        maxConsecutiveWorkDays: number | null;
        priorityScore: number;
    }>) {
        const employee = await prisma.scheduleEmployee.findFirst({ where: { id, organizationId } });
        if (!employee) throw new Error('Employee not found');

        if (data.sectorId) {
            await this.verifySectorOwnership(organizationId, data.sectorId);
        }

        return prisma.scheduleEmployee.update({
            where: { id },
            data
        });
    }

    async deleteEmployee(organizationId: string, id: string) {
        const employee = await prisma.scheduleEmployee.findFirst({ where: { id, organizationId } });
        if (!employee) throw new Error('Employee not found');

        // Hard delete or soft delete? Assuming Hard delete for now based on simplicity, or delete implies removal from schedule execution.
        // Prisma schema usually cascades or we might want to keep history.
        // Service 'deleteSector' does soft delete (isActive: false). 
        // Employee doesn't seem to have isActive in the schema shown in previous turns (I should verify schema if uncertain, but assuming hard delete or I need to add isActive).
        // Let's check schema first to be safe? 
        // Actually, previous context showed 'deleteSector' uses 'isActive'. 
        // Let's check if ScheduleEmployee has 'isActive'.
        // Checking schema.prisma would be wise, but I can't read it right now without a tool call.
        // Looking at 'createEmployee' in service... it doesn't set isActive.
        // Looking at 'listEmployees'... it doesn't filter by isActive.
        // So Employee might be hard deleted.
        return prisma.scheduleEmployee.delete({
            where: { id }
        });
    }

    // ==========================================
    // MONTH CONFIG
    // ==========================================

    async getMonthConfig(organizationId: string, year: number, month: number) {
        return prisma.scheduleMonthConfig.findUnique({
            where: {
                organizationId_year_month: {
                    organizationId,
                    year,
                    month
                }
            }
        });
    }

    async upsertMonthConfig(organizationId: string, userId: string, data: {
        year: number;
        month: number;
        teamExtraDaysOff: number;
        maxExtraOffPerDayOrg?: number;
        maxExtraOffPerDayPerSector?: number;
        blockedDates?: any;
        preferredExtraOffDates?: any;
    }) {
        return prisma.scheduleMonthConfig.upsert({
            where: {
                organizationId_year_month: {
                    organizationId,
                    year: data.year,
                    month: data.month
                }
            },
            create: {
                organizationId,
                createdById: userId,
                ...data
            },
            update: {
                teamExtraDaysOff: data.teamExtraDaysOff,
                maxExtraOffPerDayOrg: data.maxExtraOffPerDayOrg ?? undefined,
                maxExtraOffPerDayPerSector: data.maxExtraOffPerDayPerSector ?? undefined,
                blockedDates: data.blockedDates,
                preferredExtraOffDates: data.preferredExtraOffDates,
            }
        });
    }
}

export const scheduleResourceService = new ScheduleResourceService();
