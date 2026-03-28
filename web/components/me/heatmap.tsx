import { eachDayOfInterval, format, subDays } from "date-fns";

type HeatmapProps = {
  completedDays: string[];
};

export function Heatmap({ completedDays }: HeatmapProps) {
  const completed = new Set(completedDays.map((day) => format(new Date(day), "yyyy-MM-dd")));
  const days = eachDayOfInterval({
    start: subDays(new Date(), 83),
    end: new Date(),
  });

  return (
    <div className="grid grid-cols-12 gap-2">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const done = completed.has(key);

        return (
          <div
            key={key}
            title={key}
            className={`aspect-square rounded-[8px] border ${
              done
                ? "border-control-500/24 bg-linear-to-br from-control-500/70 to-sand-500/70"
                : "border-white/8 bg-white/5"
            }`}
          />
        );
      })}
    </div>
  );
}
