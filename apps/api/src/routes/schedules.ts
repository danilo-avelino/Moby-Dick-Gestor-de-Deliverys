
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { scheduleResourceService } from '../services/schedule-resources.service';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';

export async function scheduleRoutes(app: FastifyInstance) {
    // Require Authentication & Org Context (with fallback)
    app.addHook('preHandler', async (req) => {
        // Authenticate handled per route or via global hook if configured
    });

    // Zod Schemas
    const SectorCreateSchema = z.object({
        name: z.string().min(1),
        minStaffByWeekday: z.record(z.string(), z.union([z.number(), z.record(z.string(), z.number())])),
        maxStaffByWeekday: z.record(z.string(), z.union([z.number(), z.record(z.string(), z.number())])).optional(),
        numberOfShifts: z.number().min(1).max(2).default(1),
    });

    const SectorUpdateSchema = SectorCreateSchema.partial();

    const EmployeeCreateSchema = z.object({
        sectorId: z.string(),
        name: z.string().min(1),
        scheduleType: z.enum(['12x36', '6x1']).optional(),
        shift: z.string().optional(),
        extraDaysOffPerMonth: z.number().optional().default(0),
        workDaysPerWeek: z.number().min(1).max(7).default(6),
        extraDaysOffDefault: z.number().min(0).default(0),
        extraDaysOffOverride: z.number().optional().nullable(),
        weeklyOffPreferenceMain: z.array(z.number()).optional(),
        weeklyOffPreferenceExtra: z.array(z.number()).optional(),
        unavailableWeekdays: z.array(z.number()).optional(),
        fixedOffDates: z.array(z.string()).optional(), // ISO Dates
        fixedWorkDates: z.array(z.string()).optional(),
        maxConsecutiveWorkDays: z.number().optional().nullable(),
        priorityScore: z.number().default(0),
    });

    const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

    const MonthConfigUpsertSchema = z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
        teamExtraDaysOff: z.number().default(1),
        maxExtraOffPerDayOrg: z.number().optional().nullable(),
        maxExtraOffPerDayPerSector: z.number().optional().nullable(),
        blockedDates: z.array(z.string()).optional(),
        preferredExtraOffDates: z.array(z.string()).optional(),
    });

    // ==========================================
    // SECTORS
    // ==========================================
    app.get('/sectors', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const sectors = await scheduleResourceService.listSectors(organizationId);
        return sectors;
    });

    app.post('/sectors', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const data = SectorCreateSchema.parse(req.body);
        const sector = await scheduleResourceService.createSector(organizationId, data);
        return sector;
    });

    app.put('/sectors/:id', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { id } = req.params as { id: string };
        const data = SectorUpdateSchema.parse(req.body);
        const sector = await scheduleResourceService.updateSector(organizationId, id, data);
        return sector;
    });

    app.delete('/sectors/:id', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { id } = req.params as { id: string };
        await scheduleResourceService.deleteSector(organizationId, id);
        return { success: true };
    });

    // ==========================================
    // EMPLOYEES
    // ==========================================
    app.get('/employees', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { sectorId } = req.query as { sectorId?: string };
        return scheduleResourceService.listEmployees(organizationId, sectorId);
    });

    app.post('/employees', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const data = EmployeeCreateSchema.parse(req.body);

        // Sanitize nullable fields for Prisma
        const safeData = {
            ...data,
            extraDaysOffOverride: data.extraDaysOffOverride ?? undefined,
            maxConsecutiveWorkDays: data.maxConsecutiveWorkDays ?? undefined,
        };

        return scheduleResourceService.createEmployee(organizationId, safeData);
    });

    app.put('/employees/:id', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { id } = req.params as { id: string };
        const data = EmployeeUpdateSchema.parse(req.body);

        const safeData = {
            ...data,
            extraDaysOffOverride: data.extraDaysOffOverride ?? undefined,
            maxConsecutiveWorkDays: data.maxConsecutiveWorkDays ?? undefined,
        };

        return scheduleResourceService.updateEmployee(organizationId, id, safeData);
    });

    app.delete('/employees/:id', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { id } = req.params as { id: string };
        await scheduleResourceService.deleteEmployee(organizationId, id);
        return { success: true };
    });

    // ==========================================
    // MONTH CONFIG
    // ==========================================
    app.get('/month-config', {
        preHandler: [authenticate]
    }, async (req, reply) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { year, month } = req.query as { year: string, month: string };

        if (!year || !month) return reply.status(400).send({ error: 'Year and Month required' });

        const config = await scheduleResourceService.getMonthConfig(organizationId, Number(year), Number(month));
        return config || {};
    });

    app.put('/month-config', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const userId = user.id;
        const data = MonthConfigUpsertSchema.parse(req.body);

        const config = await scheduleResourceService.upsertMonthConfig(organizationId, userId, {
            ...data,
            maxExtraOffPerDayOrg: data.maxExtraOffPerDayOrg ?? undefined,
            maxExtraOffPerDayPerSector: data.maxExtraOffPerDayPerSector ?? undefined,
        });
        return config;
    });

    // ==========================================
    // GENERATION / ENGINE
    // ==========================================
    app.post('/simulate', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const SimulationSchema = z.object({
            year: z.number(),
            month: z.number(),
            sectorId: z.string(),
        });
        const data = SimulationSchema.parse(req.body);
        const { scheduleEngineService } = await import('../services/schedule-engine.service');

        return scheduleEngineService.simulate({
            organizationId,
            ...data
        });
    });

    app.post('/optimize', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const OptimizeSchema = z.object({
            year: z.number(),
            month: z.number(),
            sectorId: z.string(),
            currentMatrix: z.any().optional(),
        });
        const data = OptimizeSchema.parse(req.body);
        const { scheduleEngineService } = await import('../services/schedule-engine.service');

        return scheduleEngineService.optimize({
            organizationId,
            year: data.year,
            month: data.month,
            sectorId: data.sectorId,
            currentMatrix: data.currentMatrix || {}
        });
    });

    app.post('/optimize-chat', {
        preHandler: [authenticate]
    }, async (req) => {
        // Placeholder for Chat AI Loop
        // const user = req.user as any;
        // const organizationId = user.organizationId as string;
        return {
            message: "Entendido. (Mock Response)",
            operations: []
        };
    });

    app.post('/finalize', {
        preHandler: [authenticate]
    }, async (req) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const userId = user.id;
        const FinalizeSchema = z.object({
            year: z.number(),
            month: z.number(),
            sectorId: z.string(),
            matrix: z.any(),
            stats: z.any(),
        });

        const data = FinalizeSchema.parse(req.body);
        const { scheduleEngineService } = await import('../services/schedule-engine.service');

        return scheduleEngineService.finalize(organizationId, userId, {
            year: data.year,
            month: data.month,
            sectorId: data.sectorId,
            matrix: data.matrix,
            stats: data.stats
        });
    });

    app.delete('/', {
        preHandler: [authenticate]
    }, async (req, reply) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { year, month, sectorId } = req.query as { year: string, month: string, sectorId: string };

        if (!year || !month || !sectorId) {
            return reply.status(400).send({ error: 'Missing parameters: year, month, sectorId' });
        }

        // We need to delete the ScheduleSectorOutput or the whole Schedule?
        // Usually, schedules are per Org/Year/Month (Parent) and contain multiple SectorOutputs.
        // "Excluir escala do mês" ambiguous: Delete *this sector's* schedule or the *whole month*?
        // Context: We are in a specific sector view. So delete sector output.
        // But the parent Schedule exists for the month.
        // Let's delete the Sector Output.

        await prisma.scheduleSectorOutput.deleteMany({
            where: {
                sectorId,
                schedule: {
                    organizationId,
                    year: Number(year),
                    month: Number(month)
                }
            }
        });

        return { success: true };
    });

    app.get('/:id', {
        preHandler: [authenticate]
    }, async (req, reply) => {
        const user = req.user as any;
        const organizationId = user.organizationId as string;
        const { id } = req.params as { id: string };

        const schedule = await prisma.schedule.findUnique({
            where: { id, organizationId },
            include: {
                sectorOutputs: {
                    include: { sector: true }
                }
            }
        });

        if (!schedule) {
            return reply.status(404).send({ error: 'Schedule not found' });
        }
        return schedule;
    });
}
