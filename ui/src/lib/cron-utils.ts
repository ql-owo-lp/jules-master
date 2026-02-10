
export const CRON_PRESETS = [
    { label: "Every Hour", value: "0 * * * *" },
    { label: "Every Day", value: "0 0 * * *" },
    { label: "Every Week", value: "0 0 * * 0" },
    { label: "Every Month", value: "0 0 1 * *" },
    { label: "Weekdays", value: "0 0 * * 1-5" },
];

export function getScheduleDescription(schedule: string): string | null {
    if (!schedule) return null;

    // Normalize string by trimming
    const normalizedSchedule = schedule.trim();

    const preset = CRON_PRESETS.find(p => p.value === normalizedSchedule);
    if (preset) {
        return preset.label;
    }

    return null;
}
